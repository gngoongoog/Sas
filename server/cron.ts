import http from 'http';
import https from 'https';
import crypto from 'crypto';

export function startCronJobs(db: any, decrypt: (s: string) => string): void {
  console.log('[SuperSAS Cron] Initializing periodic subscriber expiry checker...');

  // Helper function to perform MikroTik REST API requests using native http/https
  function performRouterRequest(options: {
    host: string;
    port: number;
    path: string;
    method: string;
    auth: string;
    body?: any;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    return new Promise((resolve) => {
      const isHttps = options.port === 443 || options.port === 8443;
      const transport = isHttps ? https : http;
      const cleanHost = options.host.replace(/^https?:\/\//, '');

      const reqOptions: http.RequestOptions | https.RequestOptions = {
        hostname: cleanHost,
        port: options.port,
        path: options.path,
        method: options.method,
        headers: {
          'Authorization': 'Basic ' + Buffer.from(options.auth).toString('base64'),
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 5000,
        rejectUnauthorized: false // Bypass self-signed router SSL certificates
      };

      const req = transport.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed: any = null;
          try {
            if (data.trim()) {
              parsed = JSON.parse(data);
            } else {
              parsed = { success: true };
            }
          } catch (e) {
            parsed = data;
          }
          resolve({
            success: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
            data: parsed
          });
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Request timeout' });
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  }

  // Master expiry check runner
  async function runExpiryCheck() {
    try {
      const now = new Date().toISOString();
      console.log(`[SuperSAS Cron] Checking expired subscribers at ${now}...`);

      // 1. Query: Subscribers whose status is active but expiryDate is past now
      const query = `
        SELECT s.*, r.ip, r.apiPort, r.username as routerUsername, r.password as routerPassword 
        FROM subscribers s 
        JOIN routers r ON s.routerId = r.id 
        WHERE s.status = 'active' AND s.expiryDate IS NOT NULL AND s.expiryDate < datetime('now')
      `;

      const expiredSubs = db.prepare(query).all() as any[];
      if (expiredSubs.length === 0) {
        console.log('[SuperSAS Cron] No expired subscribers found in this run.');
        return;
      }

      console.log(`[SuperSAS Cron] Found ${expiredSubs.length} active subscribers whose validity has expired. Processing...`);

      for (const sub of expiredSubs) {
        const subId = sub.id;
        const username = sub.username;
        const routerIp = sub.ip;
        const routerPort = sub.apiPort || 8728;
        const routerUser = sub.routerUsername;
        const routerPassEnc = sub.routerPassword;

        console.log(`[SuperSAS Cron] Processing expiration for Subscriber: "${username}"`);

        // a. Update local status to 'expired'
        db.prepare("UPDATE subscribers SET status = 'expired' WHERE id = ?").run(subId);

        // b. Check if router is a simulator or local loopback
        const isSimulated = 
          routerIp.startsWith('127.0.0.') || 
          routerIp.startsWith('10.99.') || 
          routerIp === '172.16.50.1' || 
          routerIp === 'demo.supersas';

        if (isSimulated) {
          console.log(`[SuperSAS Cron] Skipped router command execution for simulated router: ${routerIp}`);
          
          // Log local expiration event
          const logId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO logs (id, timestamp, type, category, message, details) 
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            logId,
            new Date().toISOString(),
            'billing',
            'warning',
            `انتهى اشتراك المستخدم: ${username} (الراوتر محاكاة)`,
            `تم تحديث حالة المشترك محلياً فقط إلى منتهي لصعوبة الاتصال براوتر محاكاة في ${routerIp}.`
          );
          continue;
        }

        // c. Decrypt router password
        let routerPassword = '';
        try {
          routerPassword = decrypt(routerPassEnc);
        } catch (decryptErr) {
          console.error(`[SuperSAS Cron] Decryption of password for router ${routerIp} failed:`, decryptErr);
          routerPassword = routerPassEnc;
        }

        const credentials = `${routerUser}:${routerPassword}`;

        try {
          // f. GET /rest/ppp/secret?name=<username> to find secret ID
          const secretListResult = await performRouterRequest({
            host: routerIp,
            port: routerPort,
            path: `/rest/ppp/secret?name=${encodeURIComponent(username)}`,
            method: 'GET',
            auth: credentials
          });

          let secretId: string | undefined;
          if (secretListResult.success && Array.isArray(secretListResult.data)) {
            const secret = secretListResult.data.find((item: any) => item.name === username);
            if (secret) {
              secretId = secret['.id'] || secret['id'];
            }
          }

          let routerDeregistered = false;
          if (secretId) {
            // g. PATCH /rest/ppp/secret/<secretId> with body { disabled: true }
            const disableResult = await performRouterRequest({
              host: routerIp,
              port: routerPort,
              path: `/rest/ppp/secret/${encodeURIComponent(secretId)}`,
              method: 'PATCH',
              auth: credentials,
              body: { disabled: 'true' } // RouterOS REST API takes boolean values
            });
            routerDeregistered = disableResult.success;
          }

          // h. GET /rest/ppp/active?name=<username> to find active session
          const activeListResult = await performRouterRequest({
            host: routerIp,
            port: routerPort,
            path: `/rest/ppp/active?name=${encodeURIComponent(username)}`,
            method: 'GET',
            auth: credentials
          });

          let activeId: string | undefined;
          if (activeListResult.success && Array.isArray(activeListResult.data)) {
            const activeSession = activeListResult.data.find((item: any) => item.name === username);
            if (activeSession) {
              activeId = activeSession['.id'] || activeSession['id'];
            }
          }

          let sessionTerminated = false;
          if (activeId) {
            // i. DELETE /rest/ppp/active/<activeId>
            const disconnectResult = await performRouterRequest({
              host: routerIp,
              port: routerPort,
              path: `/rest/ppp/active/${encodeURIComponent(activeId)}`,
              method: 'DELETE',
              auth: credentials
            });
            sessionTerminated = disconnectResult.success;
          }

          // j. Insert log of action
          const successLogId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO logs (id, timestamp, type, category, message, details) 
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            successLogId,
            new Date().toISOString(),
            'system',
            'success',
            `تعليق آلي لاشتراك منتهي: ${username}`,
            `تم تحديث الحالة لـ منتهي. الميكروتيك: تعطيل سر PPPoE (${routerDeregistered ? 'نجح' : 'لم يجد سر جديد لتعطيله'}) وقص الاتصال الفعّال (${sessionTerminated ? 'تم بنجاح' : 'لا توجد جلسة نشطة'}).`
          );

        } catch (routerErr: any) {
          console.error(`[SuperSAS Cron] Network/API Error processing router ${routerIp} for "${username}":`, routerErr);
          
          // Log failure but subscriber status is already updated locally
          const failureLogId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO logs (id, timestamp, type, category, message, details) 
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            failureLogId,
            new Date().toISOString(),
            'system',
            'error',
            `خطأ اتصال بالراوتر لتعليق يوزر: ${username}`,
            `تم تغيير الحالة محلياً إلى منتهي، لكن تعذر الاتصال بـ MikroTik على ${routerIp}:${routerPort} لتعطيله. الخطأ: ${routerErr.message || routerErr}`
          );
        }
      }

      console.log(`[SuperSAS Cron] Expiry cron job run completed successfully. Processed ${expiredSubs.length} subscribers.`);
    } catch (criticalErr) {
      // Wrap everything in try/catch to guarantee the Node process never crashes!
      console.error('[SuperSAS Cron] Critical unexpected error in subscription expiry loop:', criticalErr);
    }
  }

  // Trigger once immediately on boot
  setTimeout(() => {
    runExpiryCheck();
  }, 5000); // Wait 5 seconds after startup to ensure DB & network services are settled

  // Run subsequent intervals every 60 minutes
  setInterval(runExpiryCheck, 60 * 60 * 1000);
}

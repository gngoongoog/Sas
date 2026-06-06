import http from 'http';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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

  // Daily automatic database backup schedule
  function scheduleDailyBackup(): void {
    function runBackup(): void {
      try {
        const backupDir  = path.join(process.cwd(), 'data', 'backups');
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }

        const dateStr    = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const backupPath = path.join(backupDir, `supersas-${dateStr}.db`);

        (db as any).backup(backupPath)
          .then(() => {
            console.log(`[Backup] ✅ النسخة الاحتياطية اليومية: ${backupPath}`);

            // Keep only the last 7 backups, delete older ones
            const files = fs.readdirSync(backupDir)
              .filter((f: string) => f.startsWith('supersas-') && f.endsWith('.db'))
              .sort(); // alphabetical = chronological for YYYY-MM-DD format
            while (files.length > 7) {
              const old = files.shift()!;
              fs.unlinkSync(path.join(backupDir, old));
              console.log(`[Backup] 🗑️ حذف نسخة قديمة: ${old}`);
            }
          })
          .catch((err: Error) => {
            console.error('[Backup] ❌ فشل إنشاء النسخة الاحتياطية:', err.message);
          });
      } catch (err: any) {
        console.error('[Backup] ❌ خطأ في إعداد النسخ الاحتياطي:', err.message);
      }
    }

    // Calculate milliseconds until next 3:00 AM
    const now     = new Date();
    const next3AM = new Date(now);
    next3AM.setHours(3, 0, 0, 0);
    if (next3AM <= now) {
      next3AM.setDate(next3AM.getDate() + 1);
    }
    const msUntil = next3AM.getTime() - now.getTime();

    setTimeout(() => {
      runBackup(); // first run at 3:00 AM
      setInterval(runBackup, 24 * 60 * 60 * 1000); // then every 24 hours
    }, msUntil);

    console.log(
      `[Backup] 📅 النسخة الاحتياطية القادمة الساعة 03:00 صباحاً` +
      ` (بعد ${Math.round(msUntil / 3600000)} ساعة)`
    );
  }

  // --- Automated Periodic JSON database backup ---
  function runJsonBackup(): void {
    try {
      const backupDir = path.join(process.cwd(), 'data', 'backups', 'json');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const subscribers = db.prepare('SELECT * FROM subscribers').all() as any[];
      const routers = db.prepare('SELECT * FROM routers').all() as any[];
      const profiles = db.prepare('SELECT * FROM profiles').all() as any[];

      const exportData = {
        exportedAt: new Date().toISOString(),
        generator: 'SuperSAS v4 Periodic Database Export',
        subscribers,
        routers,
        profiles
      };

      const dateStr = new Date().toISOString().replace(/[:.]/g, '-'); // e.g. 2026-06-04T00-26-23-000Z
      const filename = `backup-json-${dateStr}.json`;
      const backupPath = path.join(backupDir, filename);
      
      fs.writeFileSync(backupPath, JSON.stringify(exportData, null, 2), 'utf8');
      console.log(`[Backup JSON] ✅ Periodic JSON backup created successfully: ${backupPath}`);

      // Update settings table with last run timestamp
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .run('backup_json_last_run', new Date().toISOString());

      // Clean up excess periodic JSON backups, e.g. keep last 20
      const files = fs.readdirSync(backupDir)
        .filter((f: string) => f.startsWith('backup-json-') && f.endsWith('.json'))
        .sort(); // alphabetical sort is chronological for ISO strings
      while (files.length > 20) {
        const oldFile = files.shift()!;
        fs.unlinkSync(path.join(backupDir, oldFile));
        console.log(`[Backup JSON] 🗑️ Deleted old periodic JSON backup: ${oldFile}`);
      }

      // Write a system log
      const logId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO logs (id, timestamp, type, category, message, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        logId,
        new Date().toISOString(),
        'system',
        'success',
        `نسخ احتياطي دوري JSON ناجح`,
        `تم تصدير قسيمة قاعدة البيانات (${subscribers.length} مشترك و ${routers.length} راوتر) تلقائياً وحفظها كملف مجلد تحت اسم ${filename}.`
      );

    } catch (error: any) {
      console.error('[Backup JSON] ❌ Error during JSON Backup:', error.message);
    }
  }

  function checkAndRunJsonBackup(): void {
    try {
      const rows = db.prepare('SELECT * FROM settings').all() as any[];
      const settings: any = {};
      rows.forEach((r: any) => {
        settings[r.key] = r.value;
      });

      const enabled = settings.backup_json_enabled === 'true';
      if (!enabled) return;

      const interval = settings.backup_json_interval || 'daily';
      const lastRunStr = settings.backup_json_last_run;

      let intervalMs = 24 * 60 * 60 * 1000; // default Daily
      if (interval === 'hourly') intervalMs = 60 * 60 * 1000;
      else if (interval === '12hr') intervalMs = 12 * 60 * 60 * 1000;
      else if (interval === 'daily') intervalMs = 24 * 60 * 60 * 1000;
      else if (interval === 'weekly') intervalMs = 7 * 24 * 60 * 60 * 1000;

      const now = Date.now();
      let shouldRun = false;

      if (!lastRunStr) {
        shouldRun = true;
      } else {
        const lastRun = new Date(lastRunStr).getTime();
        if (now - lastRun >= intervalMs) {
          shouldRun = true;
        }
      }

      if (shouldRun) {
        console.log('[Backup JSON] ⏰ Running scheduled JSON backup...');
        runJsonBackup();
      }
    } catch (error: any) {
      console.error('[Backup JSON] ❌ Error checking periodic JSON backup:', error.message);
    }
  }

  // Trigger check every 1 minute
  setInterval(checkAndRunJsonBackup, 60 * 1000);

  // Run initial check 10 seconds after startup
  setTimeout(checkAndRunJsonBackup, 10000);

  // --- Automated 2-day expiry WhatsApp notifications ---
  async function sendAutomatedWhatsApp(sub: any) {
    try {
      const tempRow = db.prepare("SELECT value FROM settings WHERE key = 'whatsapp_template'").get() as any;
      const methodRow = db.prepare("SELECT value FROM settings WHERE key = 'whatsapp_method'").get() as any;
      const gateRow = db.prepare("SELECT value FROM settings WHERE key = 'whatsapp_gateway_url'").get() as any;

      const templateText = tempRow?.value || "تنبيه: عزيزي المشترك {fullName}، نود إعلامكم بأن اشتراككم بالباقة {profileName} ينتهي بعد {daysLeft} أيام بتاريخ {expiryDate}. يرجى التجديد لتفادي انقطاع الخدمة.";
      const method = methodRow?.value || 'url_scheme';
      const gatewayUrl = gateRow?.value || '';

      if (method !== 'http_api' || !gatewayUrl) {
        console.log(`[SuperSAS Auto-WhatsApp] Skipped alert for ${sub.username}: WhatsApp gateway is not configured as HTTP_API.`);
        return;
      }

      const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(sub.profileId) as any;
      const router = db.prepare("SELECT * FROM routers WHERE id = ?").get(sub.routerId) as any;

      const currencyRow = db.prepare("SELECT value FROM settings WHERE key = 'currency'").get() as any;
      const currency = currencyRow?.value || "IQD";
      const priceFormatted = profile ? `${profile.price.toLocaleString()} ${currency}` : '0';

      const expDate = new Date(sub.expiryDate);
      const now = new Date();
      const daysLeft = Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24)));

      const message = templateText
        .replace(/{fullName}/g, sub.fullName)
        .replace(/{name}/g, sub.fullName)
        .replace(/{username}/g, sub.username)
        .replace(/{phone}/g, sub.phone || '')
        .replace(/{profileName}/g, profile?.name || 'الافتراضية')
        .replace(/{packageName}/g, profile?.name || 'الافتراضية')
        .replace(/{expiryDate}/g, expDate.toLocaleDateString('ar-IQ'))
        .replace(/{daysLeft}/g, String(daysLeft))
        .replace(/{price}/g, priceFormatted)
        .replace(/{routerName}/g, router?.name || 'سيرفر تلقائي');

      let cleanPhone = sub.phone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('07')) {
        cleanPhone = '964' + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith('7')) {
        cleanPhone = '964' + cleanPhone;
      }

      const targetUrl = gatewayUrl
        .replace(/{phone}/g, encodeURIComponent(cleanPhone))
        .replace(/{number}/g, encodeURIComponent(cleanPhone))
        .replace(/{message}/g, encodeURIComponent(message))
        .replace(/{msg}/g, encodeURIComponent(message));

      console.log(`[SuperSAS Auto-WhatsApp] Dispatching auto-notification to ${sub.username} (${cleanPhone})...`);

      const response = await fetch(targetUrl, { method: 'GET' });
      const responseText = await response.text();

      if (response.ok) {
        // Mark as sent for this expiryDate
        db.prepare("UPDATE subscribers SET lastExpiryAlertSentAt = ? WHERE id = ?").run(sub.expiryDate, sub.id);
        
        const logId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO logs (id, timestamp, type, category, message, details)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          logId,
          new Date().toISOString(),
          'system',
          'success',
          `تنبيه الواتساب الآلي (قبل يومين): ${sub.fullName}`,
          `تم إرسال تذكير الدفع التلقائي بنجاح للرقم ${sub.phone}.`
        );
        console.log(`[SuperSAS Auto-WhatsApp] Automatic WhatsApp alert sent to ${sub.username}`);
      } else {
        console.warn(`[SuperSAS Auto-WhatsApp] Warning: WhatsApp gateway returned status code ${response.status}`);
      }
    } catch (err: any) {
      console.error(`[SuperSAS Auto-WhatsApp] Dispatch fail:`, err.message);
    }
  }

  async function runAutoWhatsAppAlertsJob() {
    try {
      console.log(`[SuperSAS Cron] Scanning for subscribers expiring in 2 days for WhatsApp alerts...`);
      const subs = db.prepare(`
        SELECT s.* 
        FROM subscribers s
        WHERE s.status = 'active'
          AND s.phone IS NOT NULL
          AND s.phone != ''
          AND s.expiryDate IS NOT NULL
      `).all() as any[];

      const now = new Date();
      for (const sub of subs) {
        const mode = sub.whatsappAlertMode || 'auto';
        if (mode !== 'auto') continue;

        const expDate = new Date(sub.expiryDate);
        const diffTime = expDate.getTime() - now.getTime();
        const diffDays = diffTime / (1000 * 3600 * 24);

        // If remaining validity is between 1.5 days and 2.5 days (approx exactly 2 days left)
        if (diffDays >= 1.5 && diffDays <= 2.5) {
          if (sub.lastExpiryAlertSentAt !== sub.expiryDate) {
            await sendAutomatedWhatsApp(sub);
          }
        }
      }
    } catch (e: any) {
      console.error('[SuperSAS Cron] Error in automated WhatsApp cron execution:', e.message);
    }
  }

  // Trigger once shortly on boot and then periodically
  setTimeout(runAutoWhatsAppAlertsJob, 15000); 
  setInterval(runAutoWhatsAppAlertsJob, 3 * 60 * 60 * 1000); // Check every 3 hours

  scheduleDailyBackup();
}

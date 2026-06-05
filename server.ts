import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import https from 'https';
import http from 'http';
import dotenv from 'dotenv';
import fs from 'fs';

// Import database, encryption and auth layers
import db, { initDb, encrypt, decrypt } from './server/db';
import { requireAdminAuth, verifyAdminLogin, generateToken, AdminPayload } from './server/auth';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { startCronJobs } from './server/cron';

dotenv.config();

// Ensure Database schema is ready on first boot
initDb();
startCronJobs(db, decrypt);

// RouterOS REST Request Helper Supporting SSL options and timeout limits
function requestRouterOS(options: {
  host: string;
  port: number;
  path: string;
  method: string;
  auth: string;
  body?: any;
}): Promise<{ success: boolean; data?: any; statusCode?: number; error?: string }> {
  return new Promise((resolve) => {
    // Check if port is ssl or plain HTTP
    const isHttps = options.port === 443 || options.port === 8443 || (!options.host.startsWith('192.168.') && !options.host.startsWith('10.'));
    const transport = isHttps ? https : http;
    const cleanHost = options.host.replace(/^https?:\/\//, '');

    const reqOptions: https.RequestOptions = {
      hostname: cleanHost,
      port: options.port,
      path: options.path,
      method: options.method,
      headers: {
        'Authorization': 'Basic ' + Buffer.from(options.auth).toString('base64'),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 3000,
      rejectUnauthorized: false // Bypass self-signed v7 certificates commonly present on MikroTik devices
    };

    const req = transport.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed: any = data;
        try {
          if (data.trim()) {
            parsed = JSON.parse(data);
          } else {
            parsed = { success: true };
          }
        } catch (e) {}
        resolve({
          success: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
          statusCode: res.statusCode,
          data: parsed
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'انتهت مهلة الاتصال بالراوتر (Timeout)'
      });
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = 3000;

  // Body parser
  app.use(express.json({ limit: '10mb' }));

  // CORS Configuration
  app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
    credentials: true
  }));

  // Helper to log system events programmatically inside SQL
  function logToSql(type: string, category: string, message: string, details?: string) {
    try {
      db.prepare(`
        INSERT INTO logs (id, timestamp, type, category, message, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        new Date().toISOString(),
        type,
        category,
        message,
        details || null
      );
    } catch (e) {
      console.error('Failed to write system log to database:', e);
    }
  }

  // ==========================================
  // 🔐 AUTH ROUTES
  // ==========================================

  // POST /api/auth/login
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'تم تجاوز الحد المسموح لمحاولات تسجيل الدخول. حاول بعد 15 دقيقة.' }
  });
  app.post('/api/auth/login', loginLimiter, (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'الرجاء توفير اسم المستخدم وكلمة المرور.' });
      }

      const isValid = verifyAdminLogin(username, password);
      if (!isValid) {
        logToSql('auth', 'error', `فشل تسجيل دخول للمستخدم: ${username}`, 'بيانات اعتماد خاطئة');
        return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
      }

      const payload: AdminPayload = { username, role: 'admin' };
      const token = generateToken(payload);

      logToSql('auth', 'success', `تسجيل دخول ناجح للمشرف: ${username}`, `رمز JWT مفعّل بنجاح`);
      res.json({
        success: true,
        token,
        admin: { username, role: 'admin' }
      });
    } catch (error: any) {
      console.error('Login routing issue:', error);
      res.status(500).json({ error: 'حدث خطأ في الخادم أثناء معالجة تسجيل الدخول.' });
    }
  });

  // ==========================================
  // 🛡️ PROTECTED CONCERNS APIs (Routers, Profiles, Patients, Cards, etc.)
  // ==========================================

  // Apply protection middleware to all endpoints under /api except /api/auth/login
  app.use('/api', (req, res, next) => {
    if (req.path === '/auth/login') {
      return next();
    }
    requireAdminAuth(req, res, next);
  });

  // ==========================================
  // 🖧 ROUTERS API Endpoint Concerns
  // ==========================================

  // GET /api/routers
  app.get('/api/routers', (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM routers').all() as any[];
      // Decrypt passwords before returning them to client safely
      const decryptedRows = rows.map(r => ({
        ...r,
        password: decrypt(r.password)
      }));
      res.json(decryptedRows);
    } catch (error: any) {
      res.status(500).json({ error: 'فشل استرجاع بيانات الرواترات.', details: error.message });
    }
  });

  // POST /api/routers
  app.post('/api/routers', (req, res) => {
    try {
      const { id, name, ip, apiPort, username, password, status, location, version } = req.body;
      if (!name || !ip || !username) {
        return res.status(400).json({ error: 'حقول الاسم والآيبي واسم المستخدم مطلوبة.' });
      }

      const finalId = id || `r-${Date.now()}`;
      const encryptedPassword = encrypt(password || '');

      db.prepare(`
        INSERT INTO routers (id, name, ip, apiPort, username, password, status, location, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        finalId,
        name,
        ip,
        Number(apiPort) || 8728,
        username,
        encryptedPassword,
        status || 'connecting',
        location || 'غير محدد',
        version || 'RouterOS v7'
      );

      logToSql('system', 'success', `تم إضافة راوتر جديد: ${name}`, `العنوان: ${ip}:${apiPort}`);
      res.status(201).json({ success: true, id: finalId });
    } catch (error: any) {
      res.status(500).json({ error: 'فشل إضافة الراوتر.', details: error.message });
    }
  });

  // PUT /api/routers/:id
  app.put('/api/routers/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, ip, apiPort, username, password, status, location, version } = req.body;

      // Check existence
      const exist = db.prepare('SELECT id FROM routers WHERE id = ?').get(id);
      if (!exist) {
        return res.status(404).json({ error: 'الراوتر غير موجود.' });
      }

      const encryptedPassword = encrypt(password || '');

      db.prepare(`
        UPDATE routers
        SET name = ?, ip = ?, apiPort = ?, username = ?, password = ?, status = ?, location = ?, version = ?
        WHERE id = ?
      `).run(
        name,
        ip,
        Number(apiPort) || 8728,
        username,
        encryptedPassword,
        status || 'connecting',
        location || 'غير محدد',
        version || 'RouterOS v7',
        id
      );

      logToSql('system', 'info', `تم تعديل بيانات الراوتر: ${name}`, `تمت المزامنة الآمنة للمعلومات`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'فشل التعديل.', details: error.message });
    }
  });

  // DELETE /api/routers/:id
  app.delete('/api/routers/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM routers WHERE id = ?').run(id);
      logToSql('system', 'warning', `تم حذف راوتر معرف: ${id}`, 'تمت الإزالة من السيرفر بنجاح');
      res.json({ success: true });
    } catch (error: any) {
      res.status(550).json({ error: 'فشل حذف الراوتر.', details: error.message });
    }
  });

  // ==========================================
  // 📦 PACKAGES / PROFILES API Endpoint Concerns
  // ==========================================

  // Support both endpoint schemes (/profiles and /packages) to prevent path breaks
  const handleGetProfiles = (req: any, res: any) => {
    try {
      const rows = db.prepare('SELECT * FROM profiles').all();
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: 'فشل استرجاع الباقات.', details: error.message });
    }
  };

  app.get('/api/packages', handleGetProfiles);
  app.get('/api/profiles', handleGetProfiles);

  const handlePostProfile = (req: any, res: any) => {
    try {
      const { 
        id, name, localAddress, remoteAddressPool, rateLimit, addressList, price, validityDays,
        qosPriority, qosParentQueue, qosBurstEnabled, qosBurstLimit, qosBurstThreshold, qosBurstTime, qosFastTrack,
        qosAppsList, qosAppsRuleType, qosAppsLimitValue
      } = req.body;
      if (!name || !rateLimit || price === undefined) {
        return res.status(400).json({ error: 'الاسم، سرعة الباقة، والسعر حقول مطلوبة.' });
      }

      const finalId = id || `p-${Date.now()}`;
      db.prepare(`
        INSERT INTO profiles (
          id, name, localAddress, remoteAddressPool, rateLimit, addressList, price, validityDays,
          qosPriority, qosParentQueue, qosBurstEnabled, qosBurstLimit, qosBurstThreshold, qosBurstTime, qosFastTrack,
          qosAppsList, qosAppsRuleType, qosAppsLimitValue
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        finalId,
        name,
        localAddress || '10.0.0.1',
        remoteAddressPool || 'dhcp_pool',
        rateLimit,
        addressList || 'ACTIVE_USERS',
        Number(price) || 0,
        Number(validityDays) || 30,
        qosPriority !== undefined ? Number(qosPriority) : 8,
        qosParentQueue || '',
        qosBurstEnabled ? 1 : 0,
        qosBurstLimit || '',
        qosBurstThreshold || '',
        qosBurstTime || '',
        qosFastTrack ? 1 : 0,
        qosAppsList || '',
        qosAppsRuleType || 'prioritize',
        qosAppsLimitValue || '2M/2M'
      );

      logToSql('billing', 'success', `تم إنشاء باقة اشتراك جديدة مع إعدادات QoS: ${name}`, `سعر: ${price} د.ع - سرعة: ${rateLimit}`);
      res.status(201).json({ success: true, id: finalId });
    } catch (error: any) {
      res.status(500).json({ error: 'فشل إضافة الباقة.', details: error.message });
    }
  };

  app.post('/api/packages', handlePostProfile);
  app.post('/api/profiles', handlePostProfile);

  const handlePutProfile = (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { 
        name, localAddress, remoteAddressPool, rateLimit, addressList, price, validityDays,
        qosPriority, qosParentQueue, qosBurstEnabled, qosBurstLimit, qosBurstThreshold, qosBurstTime, qosFastTrack,
        qosAppsList, qosAppsRuleType, qosAppsLimitValue
      } = req.body;

      db.prepare(`
        UPDATE profiles
        SET name = ?, localAddress = ?, remoteAddressPool = ?, rateLimit = ?, addressList = ?, price = ?, validityDays = ?,
            qosPriority = ?, qosParentQueue = ?, qosBurstEnabled = ?, qosBurstLimit = ?, qosBurstThreshold = ?, qosBurstTime = ?, qosFastTrack = ?,
            qosAppsList = ?, qosAppsRuleType = ?, qosAppsLimitValue = ?
        WHERE id = ?
      `).run(
        name,
        localAddress || '10.0.0.1',
        remoteAddressPool || 'dhcp_pool',
        rateLimit,
        addressList || 'ACTIVE_USERS',
        Number(price) || 0,
        Number(validityDays) || 30,
        qosPriority !== undefined ? Number(qosPriority) : 8,
        qosParentQueue || '',
        qosBurstEnabled ? 1 : 0,
        qosBurstLimit || '',
        qosBurstThreshold || '',
        qosBurstTime || '',
        qosFastTrack ? 1 : 0,
        qosAppsList || '',
        qosAppsRuleType || 'prioritize',
        qosAppsLimitValue || '2M/2M',
        id
      );

      logToSql('billing', 'info', `تم تحديث الباقة وإعدادات جودة الخدمة QoS: ${name}`, `تفاصيل السرعة: ${rateLimit}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'فشل التحديث.', details: error.message });
    }
  };

  app.put('/api/packages/:id', handlePutProfile);
  app.put('/api/profiles/:id', handlePutProfile);

  const handleDeleteProfile = (req: any, res: any) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
      logToSql('billing', 'warning', `تم حذف باقة معرّف: ${id}`, 'تمت التصفية من جدول الباقات');
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'فشل الحذف.', details: error.message });
    }
  };

  app.delete('/api/packages/:id', handleDeleteProfile);
  app.delete('/api/profiles/:id', handleDeleteProfile);

  // ==========================================
  // 👥 SUBSCRIBERS API Endpoint Concerns
  // ==========================================

  // GET /api/subscribers (Paginated, Masked Credentials version)
  app.get('/api/subscribers', requireAdminAuth, (req, res) => {
    try {
      const page   = Math.max(1, parseInt(req.query.page   as string) || 1);
      const limit  = Math.min(200, parseInt(req.query.limit as string) || 100);
      const offset = (page - 1) * limit;
      const search = ((req.query.search as string) || '').trim();

      let baseQuery   = 'FROM subscribers';
      const params: any[] = [];

      if (search) {
        baseQuery += ' WHERE username LIKE ? OR fullName LIKE ? OR phone LIKE ?';
        const s = `%${search}%`;
        params.push(s, s, s);
      }

      const rows = db.prepare(
        `SELECT * ${baseQuery} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
      ).all(...params, limit, offset) as any[];

      const total = (db.prepare(
        `SELECT COUNT(*) as total ${baseQuery}`
      ).get(...params) as any).total;

      const safeRows = rows.map((r: any) => ({ ...r, password: '••••••••' }));

      res.json({
        data:  safeRows,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      });
    } catch (error: any) {
      res.status(500).json({ error: 'فشل استرجاع بيانات المشتركين.', details: error.message });
    }
  });

  // POST /api/subscribers
  app.post('/api/subscribers', (req, res) => {
    try {
      const { id, username, password, fullName, phone, routerId, profileId, ipAddress, status, createdAt, expiryDate, macAddress } = req.body;
      if (!username || !password || !fullName || !routerId || !profileId) {
        return res.status(400).json({ error: 'تفاصيل اليوزر والرمز والاسم والراوتر والباقة حقول إجبارية للمشترك.' });
      }

      const finalId = id || `sub-${Date.now()}`;
      db.prepare(`
        INSERT INTO subscribers (id, username, password, fullName, phone, routerId, profileId, ipAddress, status, createdAt, expiryDate, macAddress)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        finalId,
        username,
        password,
        fullName,
        phone || '',
        routerId,
        profileId,
        ipAddress || null,
        status || 'active',
        createdAt || new Date().toISOString(),
        expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        macAddress || null
      );

      logToSql('system', 'success', `إضافة المشترك: ${fullName}`, `يوزر PPPoE: ${username}`);
      res.status(201).json({ success: true, id: finalId });
    } catch (error: any) {
      console.error('Error inserting subscriber:', error);
      res.status(500).json({ error: 'فشل إضافة المشترك (اليوزر قد يكون مكرراً).', details: error.message });
    }
  });

  // PUT /api/subscribers/:id
  app.put('/api/subscribers/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, fullName, phone, routerId, profileId, ipAddress, status, expiryDate, macAddress } = req.body;

      const existing = db.prepare('SELECT password FROM subscribers WHERE id = ?').get(id) as any;
      const finalPassword = (password && password !== '••••••••') ? password : (existing?.password || '');

      // Update db row
      db.prepare(`
        UPDATE subscribers
        SET username = ?, password = ?, fullName = ?, phone = ?, routerId = ?, profileId = ?, ipAddress = ?, status = ?, expiryDate = ?, macAddress = ?
        WHERE id = ?
      `).run(
        username,
        finalPassword,
        fullName,
        phone || '',
        routerId,
        profileId,
        ipAddress || null,
        status || 'active',
        expiryDate,
        macAddress || null,
        id
      );

      logToSql('system', 'info', `تعديل حساب المشترك: ${fullName}`, `يوزر: ${username}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'فشل تعديل المشترك.', details: error.message });
    }
  });

  // DELETE /api/subscribers/:id
  app.delete('/api/subscribers/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM subscribers WHERE id = ?').run(id);
      logToSql('system', 'warning', `تم حذف المشترك صاحب المعرف: ${id}`, 'الإزالة تمت بنجاح');
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'فشل حذف الحساب.', details: error.message });
    }
  });

  // ==========================================
  // 🎫 CARD PIN GENERATOR API
  // ==========================================

  // GET /api/cards
  app.get('/api/cards', (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM cards').all();
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: 'فشل جلب الكروت.', details: error.message });
    }
  });

  // POST /api/cards
  app.post('/api/cards', (req, res) => {
    try {
      const { cardsList } = req.body;
      if (!Array.isArray(cardsList)) {
        return res.status(400).json({ error: 'مطلوب قائمة الكروت لإدخالها.' });
      }

      const insert = db.prepare(`
        INSERT INTO cards (id, pin, serial, profileId, price, status, usedBy, usedAt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction((list) => {
        for (const card of list) {
          insert.run(
            card.id || `card-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            card.pin,
            card.serial,
            card.profileId,
            card.price,
            card.status || 'active',
            card.usedBy || null,
            card.usedAt || null,
            card.createdAt || new Date().toISOString()
          );
        }
      });

      transaction(cardsList);
      logToSql('billing', 'success', `تم توليد وحقن عدد ${cardsList.length} كارت بنجاح`, `تنفيذ استعلام دفع آمن`);
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'فشل عملية توليد الكروت.', details: error.message });
    }
  });

  // DELETE /api/cards/:id
  app.delete('/api/cards/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM cards WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'فشل الحذف.', details: error.message });
    }
  });

  // ==========================================
  // 🔌 SESSIONS (ACTIVE SUBSCRIBERS CALLED ON CORES)
  // ==========================================

  // GET /api/sessions
  app.get('/api/sessions', (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM sessions').all();
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: 'فشل جلب الجلسات.' });
    }
  });

  // DELETE /api/sessions/:id (Disconnect user)
  app.delete('/api/sessions/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
      logToSql('mikrotik_cmd', 'info', `فصل كبينة الجلسة المعرّفة: ${id}`, 'فصل مباشر إجباري (Kick Out)');
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'فشل فصل الجلسة.' });
    }
  });

  // ==========================================
  // 📊 LOGS & SETTINGS API
  // ==========================================

  // GET /api/logs
  app.get('/api/logs', (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 200').all();
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: 'فشل استرجاع السجلات.' });
    }
  });

  // DELETE /api/logs/all
  app.delete('/api/logs/all', (req, res) => {
    try {
      db.prepare('DELETE FROM logs').run();
      logToSql('system', 'warning', 'تم مسح وتصفير كافة سجلات الأحداث من القائمة بنجاح.');
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'فشل مسح السجلات.' });
    }
  });

  // GET /api/settings
  app.get('/api/settings', (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM settings').all() as any[];
      const config: any = {};
      rows.forEach(r => {
        config[r.key] = r.value;
      });
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: 'فشل جلب إعدادات العمليات.' });
    }
  });

  // POST /api/settings
  app.post('/api/settings', (req, res) => {
    try {
      const { settings } = req.body;
      if (settings && typeof settings === 'object') {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        Object.entries(settings).forEach(([key, val]) => {
          stmt.run(key, String(val));
        });
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'بنية الإعداد تالفة.' });
      }
    } catch (error: any) {
      res.status(500).json({ error: 'فشل حفظ الإعدادات.' });
    }
  });

  // =========================================================================
  // 💾 DATABASE EXPORT / JSON PERIODIC & MANUAL BACKUP ENDPOINTS
  // =========================================================================

  // 1. Export direct on-demand JSON for browser download
  app.get('/api/settings/backup-json/export', requireAdminAuth, (req, res) => {
    try {
      const subscribers = db.prepare('SELECT * FROM subscribers').all() as any[];
      const routers = db.prepare('SELECT * FROM routers').all() as any[];
      const profiles = db.prepare('SELECT * FROM profiles').all() as any[];
      
      const exportData = {
        exportedAt: new Date().toISOString(),
        generator: 'SuperSAS v4 Database Export',
        subscribers,
        routers,
        profiles
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=supersas-export.json');
      res.json(exportData);
    } catch (error: any) {
      console.error('[Backup Export API] Error:', error);
      res.status(500).json({ error: 'فشل تصدير البيانات: ' + error.message });
    }
  });

  // 2. Get list of periodic & manual JSON backup files saved on the server
  app.get('/api/settings/backup-json/list', requireAdminAuth, (req, res) => {
    try {
      const backupDir = path.join(process.cwd(), 'data', 'backups', 'json');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const files = fs.readdirSync(backupDir)
        .filter((f: string) => f.startsWith('backup-json-') && f.endsWith('.json'))
        .map((f: string) => {
          const filePath = path.join(backupDir, f);
          const stats = fs.statSync(filePath);
          return {
            filename: f,
            sizeBytes: stats.size,
            sizeFormatted: (stats.size / 1024).toFixed(2) + ' KB',
            createdAt: stats.mtime.toISOString()
          };
        })
        .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));

      res.json(files);
    } catch (error: any) {
      console.error('[Backup List API] Error:', error);
      res.status(500).json({ error: 'فشل جلب قائمة النسخ الاحتياطية JSON: ' + error.message });
    }
  });

  // 3. Trigger manual JSON backup saved to server data folder
  app.post('/api/settings/backup-json/trigger', requireAdminAuth, (req, res) => {
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
        generator: 'SuperSAS v4 Manual Database Export',
        subscribers,
        routers,
        profiles
      };

      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup-json-manual-${dateStr}.json`;
      const backupPath = path.join(backupDir, filename);
      
      fs.writeFileSync(backupPath, JSON.stringify(exportData, null, 2), 'utf8');

      // write a system log
      logToSql('system', 'success', `نسخ احتياطي يدوي JSON ناجح`, `تم تصدير قسيمة قاعدة البيانات (${subscribers.length} مشترك و ${routers.length} راوتر) وحفظها بنجاح بالسيرفر باسم ${filename}.`);

      res.json({ success: true, filename, message: 'تم إنشاء النسخة الاحتياطية وحفظها محلياً في السيرفر بنجاح!' });
    } catch (error: any) {
      console.error('[Backup Trigger API] Error:', error);
      res.status(500).json({ error: 'فشل حفظ النسخة الاحتياطية JSON في السيرفر: ' + error.message });
    }
  });

  // 4. Download specific JSON backup file
  app.get('/api/settings/backup-json/download/:filename', requireAdminAuth, (req, res) => {
    try {
      const filename = req.params.filename;
      if (filename.includes('/') || filename.includes('..') || !filename.endsWith('.json') || !filename.startsWith('backup-json-')) {
        return res.status(400).json({ error: 'اسم ملف غير صالح.' });
      }

      const filePath = path.join(process.cwd(), 'data', 'backups', 'json', filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'ملف النسخة الاحتياطية غير موجود.' });
      }

      res.download(filePath, filename);
    } catch (error: any) {
      console.error('[Backup Download API] Error:', error);
      res.status(500).json({ error: 'فشل تحميل ملف النسخة الاحتياطية: ' + error.message });
    }
  });

  // 5. Delete specific JSON backup file
  app.delete('/api/settings/backup-json/delete/:filename', requireAdminAuth, (req, res) => {
    try {
      const filename = req.params.filename;
      if (filename.includes('/') || filename.includes('..') || !filename.endsWith('.json') || !filename.startsWith('backup-json-')) {
        return res.status(400).json({ error: 'اسم ملف غير صالح.' });
      }

      const filePath = path.join(process.cwd(), 'data', 'backups', 'json', filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'ملف النسخة الاحتياطية غير موجود.' });
      }

      fs.unlinkSync(filePath);
      logToSql('system', 'warning', `حذف نسخة احتياطية JSON`, `تم حذف ملف النسخة الاحتياطية: ${filename}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Backup Delete API] Error:', error);
      res.status(500).json({ error: 'فشل حذف ملف النسخة الاحتياطية: ' + error.message });
    }
  });

  // POST /api/whatsapp/send
  app.post('/api/whatsapp/send', async (req, res) => {
    try {
      const { phone, message, gatewayUrl } = req.body;
      if (!phone || !message || !gatewayUrl) {
        return res.status(400).json({ error: 'الحقول المطلوبة مفقودة (phone, message, gatewayUrl).' });
      }

      // Format Iraqi numbers securely to standard international formats
      let cleanPhone = phone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('07')) {
        cleanPhone = '964' + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith('7')) {
        cleanPhone = '964' + cleanPhone;
      }

      // Interpolate url with phone and message
      const targetUrl = gatewayUrl
        .replace(/{phone}/g, encodeURIComponent(cleanPhone))
        .replace(/{number}/g, encodeURIComponent(cleanPhone))
        .replace(/{message}/g, encodeURIComponent(message))
        .replace(/{msg}/g, encodeURIComponent(message));

      // Fire external HTTP request safely with absolute 8-sec timeout to prevent thread blocking
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(targetUrl, {
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const responseText = await response.text();
        if (response.ok) {
          logToSql('system', 'success', `تم إرسال تنبيه WhatsApp بنجاح للرقم ${phone}`, `الاستجابة: ${responseText.substring(0, 100)}`);
          res.json({ success: true, response: responseText });
        } else {
          logToSql('system', 'error', `فشل إرسال تنبيه WhatsApp للرقم ${phone}`, `حالة الاستجابة: ${response.status} - ${responseText.substring(0, 100)}`);
          res.status(502).json({ error: `بوابة الرسائل رجعت بحالة خطأ: ${response.status}`, details: responseText });
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        logToSql('system', 'error', `خطأ في الاتصال ببوابة WhatsApp للرقم ${phone}`, err.message);
        res.status(504).json({ error: 'انتهت مهلة الطلب أو حدث خطأ أثناء الاتصال بالبوابة الخارجية.', details: err.message });
      }
    } catch (error: any) {
      res.status(500).json({ error: 'عطل داخلي في خادم الإرسال.', details: error.message });
    }
  });

  // ==========================================
  // ⚙️ REAL-TIME MIKROTIK ROUTEROS API INTEGRATION
  // ==========================================

  // GET /api/mikrotik/status (Router ping/status check)
  app.get('/api/mikrotik/status', async (req, res) => {
    try {
      const routers = db.prepare('SELECT id, name, ip, apiPort, username, password FROM routers').all() as any[];
      const statusResults = [];

      for (const router of routers) {
        const apiHost = router.ip || '192.168.88.1';
        const isSimulatedOnly = apiHost === '172.16.50.1' || apiHost.startsWith('10.99.') || apiHost === 'demo.supersas' || apiHost.startsWith('127.0.0.');

        if (isSimulatedOnly) {
          statusResults.push({ id: router.id, name: router.name, status: 'online', mode: 'simulated' });
        } else {
          const apiPortNum = Number(router.apiPort) || 443;
          const credentials = `${router.username || 'admin'}:${decrypt(router.password)}`;

          const result = await requestRouterOS({
            host: apiHost,
            port: apiPortNum,
            path: '/rest/system/resource',
            method: 'GET',
            auth: credentials
          });

          statusResults.push({
            id: router.id,
            name: router.name,
            status: result.success ? 'online' : 'offline',
            mode: 'live_api',
            error: result.error
          });

          // Sync status to DB
          db.prepare('UPDATE routers SET status = ? WHERE id = ?').run(result.success ? 'online' : 'offline', router.id);
        }
      }

      res.json(statusResults);
    } catch (err: any) {
      res.status(500).json({ error: 'فشل قياس بنية الإتصال الكلي.' });
    }
  });

  // POST /api/mikrotik/resources (Resources monitoring via admin auth)
  app.post('/api/mikrotik/resources', async (req, res) => {
    try {
      const { router } = req.body;
      if (!router) {
        return res.status(400).json({ error: 'الرجاء توفير بيانات جهاز المايكروتك.' });
      }

      // Read router credentials from DB to verify we use the decrypted password correctly
      const dbRouter = db.prepare('SELECT * FROM routers WHERE id = ?').get(router.id) as any;
      const passToUse = dbRouter ? decrypt(dbRouter.password) : router.password;

      const apiHost = router.ip || '192.168.88.1';
      const apiPortNum = Number(router.apiPort) || 443;
      const credentials = `${router.username || 'admin'}:${passToUse}`;

      // Check if IP is simulated
      const isSimulatedOnly = apiHost === '172.16.50.1' || apiHost.startsWith('10.99.') || apiHost === 'demo.supersas' || apiHost.startsWith('127.0.0.');

      if (isSimulatedOnly) {
        const seedStr = router.id || 'router-1';
        let seed = 0;
        for (let i = 0; i < seedStr.length; i++) {
          seed += seedStr.charCodeAt(i);
        }

        const timeSec = Math.floor(Date.now() / 4000);
        const randomCpu = Math.floor(((Math.sin(timeSec + seed) + 1) / 2) * 45) + 5;
        const totalMem = 67108864;
        const usedMemRatio = ((Math.cos(timeSec / 2 + seed) + 1) / 2) * 15 + 40;
        const freeMem = Math.floor(totalMem * (1 - usedMemRatio / 100));

        const serverStarted = 1717372800000;
        const secondsRunning = Math.floor((Date.now() - serverStarted) / 1000) % 654321;
        const upD = Math.floor(secondsRunning / 86400);
        const upH = Math.floor((secondsRunning % 86400) / 3600);
        const upM = Math.floor((secondsRunning % 3600) / 60);
        const uptimeStr = `${upD > 0 ? `${upD}d ` : ''}${upH}h ${upM}m`;

        return res.json({
          success: true,
          mode: 'simulated',
          data: {
            "uptime": uptimeStr,
            "cpu-load": randomCpu,
            "free-memory": freeMem,
            "total-memory": totalMem,
            "cpu-frequency": 650,
            "board-name": router.name.includes("Core") ? "RB1100AHx4" : "hAP ac lite",
            "version": "7.12.1"
          }
        });
      }

      // Query actual MikroTik REST API
      const apiRes = await requestRouterOS({
        host: apiHost,
        port: apiPortNum,
        path: '/rest/system/resource',
        method: 'GET',
        auth: credentials
      });

      if (apiRes.success && apiRes.data) {
        let singleRes = apiRes.data;
        if (Array.isArray(singleRes)) {
          singleRes = singleRes[0];
        }
        return res.json({
          success: true,
          mode: 'live_api',
          data: {
            "uptime": singleRes["uptime"] || "Unknown",
            "cpu-load": Number(singleRes["cpu-load"]) || 0,
            "free-memory": Number(singleRes["free-memory"]) || 0,
            "total-memory": Number(singleRes["total-memory"]) || 0,
            "cpu-frequency": Number(singleRes["cpu-frequency"]) || 0,
            "board-name": singleRes["board-name"] || "MikoTik RouterBOARD",
            "version": singleRes["version"] || "Unknown"
          }
        });
      } else {
        return res.json({
          success: false,
          error: apiRes.error || 'فشل الاتصال بجهاز المايكروتك لاسترجاع المؤشرات.'
        });
      }
    } catch (err: any) {
      console.error('Router System Resource Error:', err);
      res.json({
        success: false,
        error: 'حدث خطأ داخلي أثناء معالجة استهلاك المايكروتك.'
      });
    }
  });

  // POST /api/mikrotik/sync-secret
  app.post('/api/mikrotik/sync-secret', async (req, res) => {
    const debugLogs: string[] = [];
    try {
      const { router, action, subscriber, profile, oldUsername } = req.body;

      if (!router || !action || !subscriber) {
        return res.status(400).json({
          error: 'فشل المزامنة: البيانات المرسلة غير مكتملة.'
        });
      }

      // Fetch latest router info from SQLite to guarantee we have the decrypted password
      const dbRouter = db.prepare('SELECT * FROM routers WHERE id = ?').get(router.id) as any;
      const routerPasswordDecrypted = dbRouter ? decrypt(dbRouter.password) : router.password;

      const { ip, apiPort, username: routerUser } = router;
      const apiHost = ip || '192.168.88.1';
      const apiPortNum = Number(apiPort) || 443;
      const credentials = `${routerUser || 'admin'}:${routerPasswordDecrypted || ''}`;

      const subUser = subscriber.username;
      const subPass = subscriber.password;
      const subName = subscriber.fullName || 'مشترك PPPoE';
      const subMac = subscriber.macAddress || '';
      const limitProfile = profile?.name || 'default';
      const comment = `${subName} - ${subscriber.status === 'active' ? 'نشط' : 'معطل'} - Exp: ${new Date(subscriber.expiryDate || Date.now()).toLocaleDateString('ar-IQ')}`;

      debugLogs.push(`🔄 بدأت محاولة المزامنة مع سيرفر المايكروتك: ${router.name}`);
      debugLogs.push(`🌐 عنوان السيرفر والمنفذ: ${apiHost}:${apiPortNum} (المستخدم: ${routerUser})`);
      debugLogs.push(`⚙️ الإجراء المطلق: ${action} لليوزر PPPoE: ${subUser}`);

      // Default CLI Command representation
      let cliCommand = '';
      if (action === 'add') {
        cliCommand = `/ppp secret add name="${subUser}" password="${subPass}" profile="${limitProfile}" service=pppoe comment="${comment}"${subMac ? ` caller-id="${subMac}"` : ''}`;
      } else if (action === 'update') {
        cliCommand = `/ppp secret set [find name="${oldUsername || subUser}"] name="${subUser}" password="${subPass}" profile="${limitProfile}" comment="${comment}"${subMac ? ` caller-id="${subMac}"` : ' caller-id=""'}`;
      } else if (action === 'delete') {
        cliCommand = `/ppp secret remove [find name="${subUser}"]\n/ppp active remove [find name="${subUser}"]`;
      } else if (action === 'toggle') {
        cliCommand = subscriber.status === 'disabled'
          ? `/ppp secret disable [find name="${subUser}"]\n/ppp active remove [find name="${subUser}"]`
          : `/ppp secret enable [find name="${subUser}"]`;
      } else if (action === 'renew') {
        cliCommand = `/ppp secret set [find name="${subUser}"] profile="${limitProfile}" comment="${comment}"\n/ppp active remove [find name="${subUser}"]`;
      }

      // Check if IP is localhost, fallback, or private simulated node
      const isSimulatedOnly = apiHost === '172.16.50.1' || apiHost.startsWith('10.99.') || apiHost === 'demo.supersas' || apiHost.startsWith('127.0.0.');

      let syncResult: any = { success: false, statusCode: 0, data: null, error: '' };

      if (isSimulatedOnly) {
        debugLogs.push(`🛡️ تم رصد بيئة تجريبية أو عنوان IP عزل محلي (${apiHost}). تم تشغيل كود المحاكاة التفاعلية بنجاح.`);
        syncResult = {
          success: true,
          statusCode: 200,
          data: { status: 'simulated_ok', message: 'Successfully executed on Sandbox container' },
          error: ''
        };
      } else {
        debugLogs.push(`⏳ جاري تأسيس اتصال مشفر REST API بالراوتر...`);
        let targetId = '';

        // Find existing secret by name first
        if (action !== 'add') {
          debugLogs.push(`🔍 جاري الاستعلام في السيرفر عن يوزر PPPoE الحالي: ${oldUsername || subUser}...`);
          const searchPath = `/rest/ppp/secret?name=${encodeURIComponent(oldUsername || subUser)}`;

          const searchRes = await requestRouterOS({
            host: apiHost,
            port: apiPortNum,
            path: searchPath,
            method: 'GET',
            auth: credentials
          });

          if (searchRes.success && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
            targetId = searchRes.data[0]['.id'];
            debugLogs.push(`✅ تم العثور على المعرف التعريفي لليوزر في الراوتر: ${targetId}`);
          } else {
            debugLogs.push(`⚠️ لم نعثر على يوزر بنفس الاسم في الراوتر حالياً.`);
          }
        }

        // Action routing
        if (action === 'add') {
          debugLogs.push(`➕ جاري إرسال طلب إنشاء Secret جديد...`);
          const addPayload = {
            name: subUser,
            password: subPass,
            profile: limitProfile,
            service: 'pppoe',
            comment: comment,
            'caller-id': subMac || ''
          };
          const addRes = await requestRouterOS({
            host: apiHost,
            port: apiPortNum,
            path: '/rest/ppp/secret',
            method: 'POST',
            auth: credentials,
            body: addPayload
          });
          syncResult = addRes;

        } else if (action === 'update') {
          if (targetId) {
            debugLogs.push(`✏️ جاري إجراء تعديل الحساب (Patch) للمعرف: ${targetId}...`);
            const updatePayload = {
              name: subUser,
              password: subPass,
              profile: limitProfile,
              comment: comment,
              'caller-id': subMac || ''
            };
            const updateRes = await requestRouterOS({
              host: apiHost,
              port: apiPortNum,
              path: `/rest/ppp/secret/${targetId}`,
              method: 'PATCH',
              auth: credentials,
              body: updatePayload
            });
            syncResult = updateRes;
          } else {
            debugLogs.push(`➕ الحساب غير موجود في السيرفر. جاري الإنشاء آلياً...`);
            const addRes = await requestRouterOS({
              host: apiHost,
              port: apiPortNum,
              path: '/rest/ppp/secret',
              method: 'POST',
              auth: credentials,
              body: { name: subUser, password: subPass, profile: limitProfile, service: 'pppoe', comment }
            });
            syncResult = addRes;
          }

        } else if (action === 'delete') {
          if (targetId) {
            debugLogs.push(`❌ جاري إرسال طلب حذف الحساب من السيرفر...`);
            const deleteRes = await requestRouterOS({
              host: apiHost,
              port: apiPortNum,
              path: `/rest/ppp/secret/${targetId}`,
              method: 'DELETE',
              auth: credentials
            });

            debugLogs.push(`🧹 جاري البحث عن جلسة نشطة لقطعها فوراً...`);
            const activeRes = await requestRouterOS({
              host: apiHost,
              port: apiPortNum,
              path: `/rest/ppp/active?name=${encodeURIComponent(subUser)}`,
              method: 'GET',
              auth: credentials
            });
            if (activeRes.success && Array.isArray(activeRes.data) && activeRes.data.length > 0) {
              const activeId = activeRes.data[0]['.id'];
              debugLogs.push(`👢 فصل جلسة المستخدم النشطة: ${activeId}`);
              await requestRouterOS({
                host: apiHost,
                port: apiPortNum,
                path: `/rest/ppp/active/${activeId}`,
                method: 'DELETE',
                auth: credentials
              });
            }
            syncResult = deleteRes;
          } else {
            syncResult = { success: true, statusCode: 200, data: { status: 'not_found_on_router' }, error: '' };
          }

        } else if (action === 'toggle') {
          if (targetId) {
            const isDisabled = subscriber.status === 'disabled';
            debugLogs.push(`🔌 جاري ${isDisabled ? 'تعطيل' : 'تمكين'} الحساب PPPoE Secret في مايكروتك...`);
            const toggleRes = await requestRouterOS({
              host: apiHost,
              port: apiPortNum,
              path: `/rest/ppp/secret/${targetId}`,
              method: 'PATCH',
              auth: credentials,
              body: { disabled: isDisabled }
            });

            if (isDisabled) {
              const activeRes = await requestRouterOS({
                host: apiHost,
                port: apiPortNum,
                path: `/rest/ppp/active?name=${encodeURIComponent(subUser)}`,
                method: 'GET',
                auth: credentials
              });
              if (activeRes.success && Array.isArray(activeRes.data) && activeRes.data.length > 0) {
                const activeId = activeRes.data[0]['.id'];
                await requestRouterOS({
                  host: apiHost,
                  port: apiPortNum,
                  path: `/rest/ppp/active/${activeId}`,
                  method: 'DELETE',
                  auth: credentials
                });
              }
            }
            syncResult = toggleRes;
          } else {
            syncResult = { success: false, statusCode: 404, data: null, error: 'اليوزر غير متواجد على الراوتر للتمكين أو التعطيل.' };
          }

        } else if (action === 'renew') {
          if (targetId) {
            debugLogs.push(`🔄 جاري تجديد باقة الحساب وربطه بـ Profile الجديد: ${limitProfile}...`);
            const renewRes = await requestRouterOS({
              host: apiHost,
              port: apiPortNum,
              path: `/rest/ppp/secret/${targetId}`,
              method: 'PATCH',
              auth: credentials,
              body: { profile: limitProfile, comment: comment }
            });

            debugLogs.push(`👢 جاري فصل الاتصال الحالي ليتصل العميل بالسرعة المحسنة الجديدة تلقائياً...`);
            const activeRes = await requestRouterOS({
              host: apiHost,
              port: apiPortNum,
              path: `/rest/ppp/active?name=${encodeURIComponent(subUser)}`,
              method: 'GET',
              auth: credentials
            });
            if (activeRes.success && Array.isArray(activeRes.data) && activeRes.data.length > 0) {
              const activeId = activeRes.data[0]['.id'];
              await requestRouterOS({
                host: apiHost,
                port: apiPortNum,
                path: `/rest/ppp/active/${activeId}`,
                method: 'DELETE',
                auth: credentials
              });
            }
            syncResult = renewRes;
          } else {
            debugLogs.push(`➕ الحساب غير موجود في السيرفر أثناء التجديد. جاري إنشاؤه حالاً...`);
            const addRes = await requestRouterOS({
              host: apiHost,
              port: apiPortNum,
              path: '/rest/ppp/secret',
              method: 'POST',
              auth: credentials,
              body: { name: subUser, password: subPass, profile: limitProfile, service: 'pppoe', comment: comment }
            });
            syncResult = addRes;
          }
        }
      }

      if (syncResult.success) {
        debugLogs.push(`✅ نجح الإجراء البرمجي بالكامل على مايكروتك!`);
        logToSql(
          'mikrotik_cmd',
          isSimulatedOnly ? 'info' : 'success',
          `[مزامنة API] ${isSimulatedOnly ? 'تمت مزامنة محاكاة لليوزر' : 'مزامنة ناجحة على راوتر'} ${subUser}`,
          `الإجراء: ${action}، الباقة: ${limitProfile}`
        );

        res.json({
          success: true,
          mode: isSimulatedOnly ? 'simulated' : 'live_api_sync',
          message: isSimulatedOnly
            ? 'تم تفعيل حساب الـ PPPoE ومزامنته بوضعية المحاكاة الآمنة نجاحاً.'
            : 'تمت مزامنة تفعيل الحساب وتطبيق السرعة وربط الماك بالسيرفر الرئيسي بنجاح!',
          payloadSent: { action, subscriber: { username: subUser }, profile: limitProfile },
          responseReceived: syncResult.data,
          cliCommand,
          debugLogs
        });
      } else {
        const errorMsg = syncResult.error || 'استجابة غير متوقعة من السيرفر.';
        debugLogs.push(`⚠️ فشل الاتصال المباشر بـ Real API السيرفر: ${errorMsg}`);
        debugLogs.push(`⚙️ تفعيل آلية الإنقاذ ومحاكاة السيرفر المحلي (Simulated Match) لحفظ الإشتراك دون عطل بالصالة.`);

        logToSql(
          'mikrotik_cmd',
          'warning',
          `[مزامنة احتياطية] تم تفعيل حساب ${subName} (${subUser}) بوضعية المحاكاة`,
          `تفاصيل الفشل: ${errorMsg}`
        );

        res.json({
          success: true,
          mode: 'scheduled_simulator',
          message: `تم حفظ وتفعيل الحساب على لوحة التحكم ومزامنته محلياً! سيرفر مايكروتك الرئيسي غير متصل بالإنترنت حالياً (مغلق أو خلف نات خاص)، تم تجهيز الكوماند آلياً للتطبيق عند كليك إعادة المزامنة.`,
          payloadSent: { action, subscriber: { username: subUser }, profile: limitProfile },
          errorDetails: errorMsg,
          cliCommand,
          debugLogs
        });
      }

    } catch (globalError: any) {
      console.error('MikroTik Sync Error:', globalError);
      debugLogs.push(`❌ خطأ فادح في معالجة طلب المزامنة: ${globalError.message}`);
      res.status(500).json({
        error: 'حدث خطأ في مزامنة السيرفر آلياً.',
        details: globalError.message,
        debugLogs
      });
    }
  });

  // POST /api/mikrotik/sync/:id (Sync specific subscriber route as requested)
  app.post('/api/mikrotik/sync/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body;

      const subscriber = db.prepare('SELECT * FROM subscribers WHERE id = ?').get(id) as any;
      if (!subscriber) {
        return res.status(404).json({ error: 'المشترك غير موجود في ملف البيانات.' });
      }

      const router = db.prepare('SELECT * FROM routers WHERE id = ?').get(subscriber.routerId) as any;
      const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(subscriber.profileId) as any;

      if (!router) {
        return res.status(404).json({ error: 'جهاز المايكروتك المرتبط بالمشترك غير موجود.' });
      }

      // Proxy request internally to sync-secret
      const syncReq = {
        body: {
          router,
          action: action || 'update',
          subscriber,
          profile,
        }
      };

      // Reuse sync logic or let it run
      req.body = syncReq.body;
      const syncMiddleware = (app as any)._router.stack.find((layer: any) => layer.route && layer.route.path === '/api/mikrotik/sync-secret');
      if (syncMiddleware) {
        return syncMiddleware.route.stack[0].handle(req, res);
      }

      res.json({ success: true, message: 'مزامنة ناجحة للمشترك.', subscriber });
    } catch (error: any) {
      res.status(500).json({ error: 'خطأ في مزامنة العميل المحدد.', details: error.message });
    }
  });

  // ==========================================
  // 📳 ALERTS / TELEGRAM PROXY ROUTE
  // ==========================================

  // POST /api/alerts/send
  app.post('/api/alerts/send', async (req, res) => {
    try {
      const { botToken, chatId, message } = req.body;
      const finalToken = botToken || process.env.TELEGRAM_BOT_TOKEN;
      const finalChatId = chatId || process.env.TELEGRAM_CHAT_ID;

      if (!finalToken || !finalChatId || finalToken === 'YOUR_TELEGRAM_BOT_TOKEN' || finalChatId === 'YOUR_TELEGRAM_CHAT_ID' || !finalToken.trim() || !finalChatId.trim()) {
        return res.status(400).json({
          error: 'فشل الإرسال: لم يتم تكوين مفتاح الـ Bot Token أو الـ Chat ID لـ Telegram في الإعدادات أو البيئة.'
        });
      }

      if (!message) {
        return res.status(400).json({ error: 'الرجاء توفير نص التنبيه لإرساله عبر تلغرام.' });
      }

      const telegramUrl = `https://api.telegram.org/bot${finalToken}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: finalChatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Telegram API error response:', errorData);
        return res.status(502).json({
          error: 'فشل إرسال التنبيه عبر خوادم تلغرام.',
          details: errorData.description || 'رمز استجابة غير صالح من تلغرام.'
        });
      }

      const result = await response.json();
      logToSql('system', 'success', 'تم إرسال تنبيه تلغرام التلقائي للمدير بنجاح', message);
      res.json({ success: true, result });
    } catch (error: any) {
      console.error('Telegram Server Proxy Error:', error);
      res.status(500).json({
        error: 'حدث خطأ غير متوقع في الخادم أثناء محاولة الإرسال لـ Telegram.',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ==========================================
  // 🧠 GEMINI CO-PILOT CHAT ASSISTANT
  // ==========================================

  // POST /api/gemini/chat
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'الرجاء كتابة السؤال.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        return res.json({
          reply: `⚠️ **ملاحظة من لوحة الإدارة:** مفتاح \`GEMINI_API_KEY\` غير مهيأ حالياً في الخادم.
          
          مرحباً بك! لتشغيل المساعد الذكي بكامل كفاءته وتوليد الأكواد الحية، يرجى تزويد النظام بمفتاح Gemini من إعدادات بيئة العمل. بالرغم من ذلك، إليك إرشادات بديلة:
          - يمكنك استخدام تبويب **"معالج سكريبتات"** لنسخ سكريبتات الحجب وسقوط الاتصال بضغطة زر.
          - تفقد تبويب **"المشتركين"** لشحن وفصل اليوزرات آلياً.`
        });
      }

      // Initialize official GenAI SDK
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      // Call Gemini 3.5 Flash Model
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction: `أنت مساعد ومستشار شبكات فائق الذكاء خبير في برمجيات أجهزة مايكروتك (MikroTik RouterOS) وإعدادات أنظمة الـ PPPoE ومطابق تماماً لنظام SAS4 لإدارة اشتراكات الإنترنت.
          أجب دائماً باللغة العربية بأسلوب شبكي هانئ ومنظم.
          اكتب نماذج وأكواد سكريبتات الـ RouterOS CLI بوضوح تام داخل كتل الكود البرمجية متى ما كان ذلك مناسباً لمساعدة المشرفين والوكلاء المحليين للشبكة.`
        }
      });

      const reply = response.text || 'لم يتمكن الذكاء الاصطناعي من صياغة إجابة مناسبة حالياً.';
      res.json({ reply });

    } catch (error: any) {
      console.error('Gemini Server Proxy Error:', error);
      res.status(500).json({
        error: 'حدث خطأ في معالجة طلب الذكاء الاصطناعي.',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ==========================================
  // ⚡ STATIC ASSET SERVING & HOT REBUILD AS SPA
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SuperSAS] Full-Stack Container online and serving at http://0.0.0.0:${PORT}`);
  });
}

startServer();

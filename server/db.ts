import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Ensure ./data/ directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Store DB at ./data/supersas.db
const dbPath = path.join(dataDir, 'supersas.db');
const db = new Database(dbPath);

// Enable WAL mode
db.pragma('journal_mode = WAL');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Encryption keys from Environment
const IV_LENGTH = 16; // AES IV block size

// Encrypt: use AES-256-CBC, read key from process.env.ENCRYPTION_KEY,
// if key is not 32 bytes derive 32 bytes via SHA-256 hash.
// Output format: "ivHex:encryptedHex". On any error return original text.
export function encrypt(text: string): string {
  if (!text) return '';
  try {
    let key: Buffer;
    const encryptionKeyEnv = process.env.ENCRYPTION_KEY || 'supersas_default_secret_32bytes_!';
    if (Buffer.byteLength(encryptionKeyEnv, 'utf8') === 32) {
      key = Buffer.from(encryptionKeyEnv, 'utf8');
    } else {
      key = crypto.createHash('sha256').update(encryptionKeyEnv).digest();
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption failed:', error);
    return text;
  }
}

// Decrypt: split on first ":", if no ":" found return input as-is (graceful fallback).
// On any error return input as-is.
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  const colonIndex = encryptedText.indexOf(':');
  if (colonIndex === -1) return encryptedText; // Graceful fallback
  try {
    let key: Buffer;
    const encryptionKeyEnv = process.env.ENCRYPTION_KEY || 'supersas_default_secret_32bytes_!';
    if (Buffer.byteLength(encryptionKeyEnv, 'utf8') === 32) {
      key = Buffer.from(encryptionKeyEnv, 'utf8');
    } else {
      key = crypto.createHash('sha256').update(encryptionKeyEnv).digest();
    }
    const ivHex = encryptedText.substring(0, colonIndex);
    const encryptedHex = encryptedText.substring(colonIndex + 1);
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    return encryptedText;
  }
}

// Initial Database schemas creation
export function initDb() {
  console.log('[SuperSAS DB] Initializing SQLite tables in data/supersas.db...');

  // Create Routers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS routers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ip TEXT NOT NULL,
      apiPort INTEGER DEFAULT 8728,
      username TEXT NOT NULL,
      password TEXT NOT NULL DEFAULT '',
      status TEXT DEFAULT 'connecting',
      location TEXT DEFAULT 'غير محدد',
      version TEXT DEFAULT 'RouterOS v7',
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create Profiles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      localAddress TEXT DEFAULT '10.0.0.1',
      remoteAddressPool TEXT DEFAULT 'dhcp_pool',
      rateLimit TEXT NOT NULL,
      addressList TEXT DEFAULT 'ACTIVE_USERS',
      price REAL DEFAULT 0,
      validityDays INTEGER DEFAULT 30,
      createdAt TEXT DEFAULT (datetime('now')),
      qosPriority INTEGER DEFAULT 8,
      qosParentQueue TEXT DEFAULT '',
      qosBurstEnabled INTEGER DEFAULT 0,
      qosBurstLimit TEXT DEFAULT '',
      qosBurstThreshold TEXT DEFAULT '',
      qosBurstTime TEXT DEFAULT '',
      qosFastTrack INTEGER DEFAULT 0,
      qosAppsList TEXT DEFAULT '',
      qosAppsRuleType TEXT DEFAULT 'prioritize',
      qosAppsLimitValue TEXT DEFAULT '2M/2M'
    )
  `);

  // Migrations for existing databases to support QoS columns
  try { db.exec("ALTER TABLE profiles ADD COLUMN qosPriority INTEGER DEFAULT 8"); } catch (e) {}
  try { db.exec("ALTER TABLE profiles ADD COLUMN qosParentQueue TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE profiles ADD COLUMN qosBurstEnabled INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE profiles ADD COLUMN qosBurstLimit TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE profiles ADD COLUMN qosBurstThreshold TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE profiles ADD COLUMN qosBurstTime TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE profiles ADD COLUMN qosFastTrack INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE profiles ADD COLUMN qosAppsList TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE profiles ADD COLUMN qosAppsRuleType TEXT DEFAULT 'prioritize'"); } catch (e) {}
  try { db.exec("ALTER TABLE profiles ADD COLUMN qosAppsLimitValue TEXT DEFAULT '2M/2M'"); } catch (e) {}

  // Create Subscribers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      fullName TEXT NOT NULL,
      phone TEXT DEFAULT '',
      routerId TEXT NOT NULL,
      profileId TEXT NOT NULL,
      ipAddress TEXT,
      status TEXT DEFAULT 'active',
      createdAt TEXT DEFAULT (datetime('now')),
      expiryDate TEXT,
      macAddress TEXT,
      whatsappAlertMode TEXT DEFAULT 'auto',
      lastExpiryAlertSentAt TEXT,
      FOREIGN KEY(routerId) REFERENCES routers(id) ON DELETE RESTRICT,
      FOREIGN KEY(profileId) REFERENCES profiles(id) ON DELETE RESTRICT
    )
  `);

  // Migrations for existing databases to support WhatsApp alert columns
  try { db.exec("ALTER TABLE subscribers ADD COLUMN whatsappAlertMode TEXT DEFAULT 'auto'"); } catch (e) {}
  try { db.exec("ALTER TABLE subscribers ADD COLUMN lastExpiryAlertSentAt TEXT"); } catch (e) {}

  // Create Cards table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      pin TEXT NOT NULL UNIQUE,
      serial TEXT,
      profileId TEXT,
      price REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      usedBy TEXT,
      usedAt TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      ipAddress TEXT,
      macAddress TEXT,
      uptime TEXT,
      rxBytes INTEGER DEFAULT 0,
      txBytes INTEGER DEFAULT 0,
      routerId TEXT,
      startedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create Logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT
    )
  `);

  // Create Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);

  // Create OLT devices and ONU signals tables (SuperSAS Fiber Network)
  db.exec(`
    CREATE TABLE IF NOT EXISTS olt_devices (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      ip         TEXT NOT NULL,
      port       INTEGER DEFAULT 22,
      username   TEXT NOT NULL DEFAULT 'admin',
      password   TEXT NOT NULL DEFAULT '',
      model      TEXT DEFAULT 'VSOL V1600G1',
      status     TEXT DEFAULT 'disconnected',
      lastSync   TEXT,
      createdAt  TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS onu_signals (
      id           TEXT PRIMARY KEY,
      oltId        TEXT NOT NULL,
      oltPort      TEXT NOT NULL,
      onuIndex     TEXT NOT NULL,
      subscriberId TEXT,
      onuSerial    TEXT,
      rxPower      REAL,
      txPower      REAL,
      distance     INTEGER,
      status       TEXT DEFAULT 'active',
      lastUpdated  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (oltId) REFERENCES olt_devices(id) ON DELETE CASCADE
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_onu_signals_oltId        ON onu_signals(oltId);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_onu_signals_subscriberId ON onu_signals(subscriberId);`);

  // Create Indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_subscribers_username ON subscribers(username);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_subscribers_routerId ON subscribers(routerId);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);`);

  // Pre-seed tables with data if they are empty
  const countRouters = db.prepare('SELECT count(*) as count FROM routers').get() as { count: number };
  if (countRouters.count === 0) {
    console.log('[SuperSAS DB] Seeding initial data rows...');

    // 1. Seed Routers (encrypt password)
    const insertRouter = db.prepare(`
      INSERT INTO routers (id, name, ip, apiPort, username, password, status, location, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertRouter.run('r-1', 'سيرفر بغداد الرئيسي (CCR-1036)', '192.168.88.1', 8728, 'admin', encrypt('secure_password_123'), 'online', 'الكرادة، البرج الرئيسي', 'RouterOS v7.12');
    insertRouter.run('r-2', 'سيرفر الموصل الفرعي (RB4011)', '10.100.20.1', 8728, 'sub_admin', encrypt('mosul_network_pass'), 'online', 'حي الزهور، كابينة 4', 'RouterOS v6.49');
    insertRouter.run('r-3', 'سيرفر البصرة الاحتياطي (CCR-2004)', '172.16.50.1', 8728, 'basra_admin', encrypt('basra_secure_9s8'), 'offline', 'العشار، فرع النهر', 'RouterOS v7.8');

    // 2. Seed Profiles
    const insertProfile = db.prepare(`
      INSERT INTO profiles (id, name, localAddress, remoteAddressPool, rateLimit, addressList, price, validityDays)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertProfile.run('p-1', 'اشتراك اقتصادي - 15 Mbps', '10.0.10.1', 'Economy_Pool', '15M/15M', 'ACTIVE_SUBSCRIBERS', 15000, 30);
    insertProfile.run('p-2', 'اشتراك اعتيادي - 30 Mbps', '10.0.20.1', 'Standard_Pool', '30M/30M', 'ACTIVE_SUBSCRIBERS', 30000, 30);
    insertProfile.run('p-3', 'اشتراك العاب وعوائل - 60 Mbps', '10.0.30.1', 'Turbo_Pool', '60M/60M', 'VIP_SUBSCRIBERS', 45000, 30);
    insertProfile.run('p-4', 'اشتراك شركات فائق - 150 Mbps', '10.10.10.1', 'Enterprise_Pool', '150M/150M', 'ENTERPRISE_USERS', 120000, 30);

    // 3. Seed Subscribers
    const insertSubscriber = db.prepare(`
      INSERT INTO subscribers (id, username, password, fullName, phone, routerId, profileId, ipAddress, status, createdAt, expiryDate, macAddress)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+30 days'), ?)
    `);

    insertSubscriber.run('sub-1', 'ali_ahmed', 'ali9988_pppoe', 'علي أحمد العبيدي', '07701234567', 'r-1', 'p-2', '10.0.20.15', 'active', 'BC:83:85:12:DF:01');
    insertSubscriber.run('sub-2', 'mustafa_iraq', 'm_pass_992', 'مصطفى محمد الخفاجي', '07812233445', 'r-1', 'p-3', '10.0.30.22', 'active', '70:8F:D8:E5:A2:CC');
    
    // Seed expired sub-3
    const insertSubscriberExp = db.prepare(`
      INSERT INTO subscribers (id, username, password, fullName, phone, routerId, profileId, ipAddress, status, createdAt, expiryDate, macAddress)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-35 days'), datetime('now', '-5 days'), ?)
    `);
    insertSubscriberExp.run('sub-3', 'fatima_hassan', 'f_h_pppoe_77', 'فاطمة حسن الموسوي', '07509876543', 'r-2', 'p-1', '10.0.10.88', 'expired', 'F4:F5:D4:52:12:9E');
    
    insertSubscriber.run('sub-4', 'karar_saadi', 'karar123_pass', 'كرار سعدي الجبوري', '07731235678', 'r-1', 'p-1', null, 'disabled', null);
    insertSubscriber.run('sub-5', 'omar_farooq', 'omar_p_secure', 'عمر فاروق التكريتي', '07804445556', 'r-1', 'p-4', '10.10.10.5', 'active', 'A0:B1:C2:D3:E4:F5');

    // 4. Seed Cards
    const insertCard = db.prepare(`
      INSERT INTO cards (id, pin, serial, profileId, price, status, usedBy, usedAt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    insertCard.run('card-1', '981248214952', 'SS-4022-81729', 'p-1', 15000, 'active', null, null);
    insertCard.run('card-2', '102938475610', 'SS-4022-81730', 'p-2', 30000, 'active', null, null);
    insertCard.run('card-3', '504938201948', 'SS-4022-81731', 'p-3', 45000, 'active', null, null);

    // 5. Seed Sessions
    const insertSession = db.prepare(`
      INSERT INTO sessions (id, username, ipAddress, macAddress, uptime, rxBytes, txBytes, routerId, startedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 hours'))
    `);

    insertSession.run('sess-1', 'ali_ahmed', '10.0.20.15', 'BC:83:85:12:DF:01', '02h 22m 15s', 24151230, 8408920, 'r-1');
    insertSession.run('sess-2', 'mustafa_iraq', '10.0.30.22', '70:8F:D8:E5:A2:CC', '14h 05m 12s', 123450912, 19283749, 'r-1');

    // 6. Seed Logs
    const insertLog = db.prepare(`
      INSERT INTO logs (id, timestamp, type, category, message, details)
      VALUES (?, datetime('now'), ?, ?, ?, ?)
    `);

    insertLog.run('l-1', 'system', 'info', 'تم الإقلاع والنظام بوضعية تشغيل كاملة', 'خدمة الموازنة IP والـ Core Engine نشطة');
    insertLog.run('l-2', 'system', 'success', 'مزامنة ناجحة لراوتر الكرادة', 'مزامنة يوزر ali_ahmed بنجاح');

    // 7. Seed Settings
    const insertSetting = db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
    `);
    insertSetting.run('currency', 'IQD');
    insertSetting.run('terminalScript', '# SuperSAS CLI Script Generator Active\n# All subscriber/profile actions will generate RouterOS commands here.\n');
  }

  // Pre-seed OLT Devices and ONU Signals if OLT is empty
  const countOlt = db.prepare('SELECT count(*) as count FROM olt_devices').get() as { count: number };
  if (countOlt.count === 0) {
    console.log('[SuperSAS DB] Seeding dummy OLT and 5 distinct ONU signal states for live demonstration...');
    
    // Insert dummy OLT Device (password encrypted)
    db.prepare(`
      INSERT INTO olt_devices (id, name, ip, port, username, password, model, status, lastSync, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      'olt-dummy',
      'جهاز تجريبي - VSOL GPON OLT',
      '192.168.10.250',
      22,
      'demo_reader',
      encrypt('demo_masked_password_123'),
      'VSOL V1600G1',
      'online'
    );

    // Helpers to insert ONU signals
    const insertOnu = db.prepare(`
      INSERT INTO onu_signals (id, oltId, oltPort, onuIndex, subscriberId, onuSerial, rxPower, txPower, distance, status, lastUpdated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    // 1. Excellent state (-18.2 dBm) - linked to ali_ahmed (sub-1)
    insertOnu.run(
      'olt-dummy-1-1',
      'olt-dummy',
      '0/1',
      '1',
      'sub-1',
      'VSOL000000A1',
      -18.2,
      2.3,
      350,
      'active'
    );

    // 2. Good state (-22.5 dBm) - linked to mustafa_iraq (sub-2)
    insertOnu.run(
      'olt-dummy-1-2',
      'olt-dummy',
      '0/1',
      '2',
      'sub-2',
      'VSOL000000B2',
      -22.5,
      1.8,
      1250,
      'active'
    );

    // 3. Warning state (-26.1 dBm) - linked to fatima_hassan (sub-3)
    insertOnu.run(
      'olt-dummy-1-3',
      'olt-dummy',
      '0/2',
      '1',
      'sub-3',
      'VSOL000000C3',
      -26.1,
      1.4,
      2900,
      'active'
    );

    // 4. Critical state (-28.6 dBm) - linked to omar_farooq (sub-5)
    insertOnu.run(
      'olt-dummy-1-4',
      'olt-dummy',
      '0/2',
      '2',
      'sub-5',
      'VSOL000000D4',
      -28.6,
      1.1,
      4300,
      'active'
    );

    // 5. Offline state (null dBm) - not linked to any subscriber (active status but null power or offline)
    insertOnu.run(
      'olt-dummy-1-5',
      'olt-dummy',
      '0/3',
      '5',
      null,
      'VSOL000000E5',
      null,
      null,
      null,
      'offline'
    );
  }

  console.log('[SuperSAS DB] Database initialized and pre-seeded.');
}

export default db;

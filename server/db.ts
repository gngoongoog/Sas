import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Determine connection path
const dbPath = path.join(process.cwd(), 'supersas.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Encryption keys from Environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'supersas_default_secret_32bytes_!'; // Must be 32 bytes
const IV_LENGTH = 16; // For AES

// Safely encrypt sensitive string (like router password, IP, user)
export function encrypt(text: string): string {
  if (!text) return '';
  try {
    // Generate derived crypt key or pad to 32 bytes
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption failed:', error);
    return text;
  }
}

// Decrypt sensitive string
export function decrypt(text: string): string {
  if (!text) return '';
  if (!text.includes(':')) return text; // If it's not encrypted yet, return as is
  try {
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption failed:', error);
    return text;
  }
}

// Initial Database schemas creation
export function initDb() {
  console.log('[SuperSAS DB] Initializing SQLite tables...');

  // Create Routers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS routers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ip TEXT NOT NULL,
      apiPort INTEGER NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'connecting',
      location TEXT NOT NULL,
      version TEXT
    )
  `);

  // Create Profiles (Packages) table
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      localAddress TEXT NOT NULL,
      remoteAddressPool TEXT NOT NULL,
      rateLimit TEXT NOT NULL,
      addressList TEXT NOT NULL,
      price REAL NOT NULL,
      validityDays INTEGER NOT NULL
    )
  `);

  // Create Subscribers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullName TEXT NOT NULL,
      phone TEXT NOT NULL,
      routerId TEXT NOT NULL,
      profileId TEXT NOT NULL,
      ipAddress TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL,
      expiryDate TEXT NOT NULL,
      macAddress TEXT,
      FOREIGN KEY (routerId) REFERENCES routers(id),
      FOREIGN KEY (profileId) REFERENCES profiles(id)
    )
  `);

  // Create Card PINs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      pin TEXT UNIQUE NOT NULL,
      serial TEXT UNIQUE NOT NULL,
      profileId TEXT NOT NULL,
      price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      usedBy TEXT,
      usedAt TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (profileId) REFERENCES profiles(id)
    )
  `);

  // Create Active Sessions table (cache of router sessions)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      ip TEXT NOT NULL,
      mac TEXT NOT NULL,
      uptime TEXT NOT NULL,
      downloadSpeed REAL NOT NULL,
      uploadSpeed REAL NOT NULL,
      callerId TEXT NOT NULL
    )
  `);

  // Create System logs table
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

  // Create App Settings state configurations
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertSubscriber.run('sub-1', 'ali_ahmed', 'ali9988_pppoe', 'علي أحمد العبيدي', '07701234567', 'r-1', 'p-2', '10.0.20.15', 'active', '2026-05-15T12:00:00Z', '2026-06-15T12:00:00Z', 'BC:83:85:12:DF:01');
    insertSubscriber.run('sub-2', 'mustafa_iraq', 'm_pass_992', 'مصطفى محمد الخفاجي', '07812233445', 'r-1', 'p-3', '10.0.30.22', 'active', '2026-05-20T14:30:00Z', '2026-06-20T14:30:00Z', '70:8F:D8:E5:A2:CC');
    insertSubscriber.run('sub-3', 'fatima_hassan', 'f_h_pppoe_77', 'فاطمة حسن الموسوي', '07509876543', 'r-2', 'p-1', '10.0.10.88', 'expired', '2026-04-10T10:00:00Z', '2026-05-10T10:00:00Z', 'F4:F5:D4:52:12:9E');
    insertSubscriber.run('sub-4', 'karar_saadi', 'karar123_pass', 'كرار سعدي الجبوري', '07731235678', 'r-1', 'p-1', null, 'disabled', '2026-05-01T08:15:00Z', '2026-06-01T08:15:00Z', null);
    insertSubscriber.run('sub-5', 'omar_farooq', 'omar_p_secure', 'عمر فاروق التكريتي', '07804445556', 'r-1', 'p-4', '10.10.10.5', 'active', '2026-05-28T16:00:00Z', '2026-06-27T16:00:00Z', 'A0:B1:C2:D3:E4:F5');
    insertSubscriber.run('sub-6', 'murtada_saad', 'murtada9922_pass', 'مرتضى سعد الموسوي', '07715566779', 'r-1', 'p-2', null, 'expired', '2026-02-10T09:00:00Z', '2026-03-10T09:00:00Z', null);
    insertSubscriber.run('sub-7', 'sajjad_kassim', 'sajjad_secure', 'سجاد قاسم الكناني', '07801122334', 'r-2', 'p-1', null, 'expired', '2026-01-15T11:20:00Z', '2026-02-15T11:20:00Z', null);

    // 4. Seed PIN Cards
    const insertCard = db.prepare(`
      INSERT INTO cards (id, pin, serial, profileId, price, status, usedBy, usedAt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertCard.run('card-1', '981248214952', 'SS-4022-81729', 'p-1', 15000, 'active', null, null, '2026-05-30T09:00:00Z');
    insertCard.run('card-2', '102938475610', 'SS-4022-81730', 'p-2', 30000, 'active', null, null, '2026-05-30T09:00:00Z');
    insertCard.run('card-3', '504938201948', 'SS-4022-81731', 'p-3', 45000, 'active', null, null, '2026-05-30T09:00:00Z');
    insertCard.run('card-4', '772188439012', 'SS-4022-81732', 'p-1', 15000, 'used', 'ali_ahmed', '2026-06-01T15:20:00Z', '2026-05-30T09:00:00Z');

    // 5. Seed Sessions
    const insertSession = db.prepare(`
      INSERT INTO sessions (id, username, ip, mac, uptime, downloadSpeed, uploadSpeed, callerId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertSession.run('sess-1', 'ali_ahmed', '10.0.20.15', 'BC:83:85:12:DF:01', '04h 22m 15s', 2415, 840, 'pppoe-in1');
    insertSession.run('sess-2', 'mustafa_iraq', '10.0.30.22', '70:8F:D8:E5:A2:CC', '1d 12h 05m', 8412, 1920, 'pppoe-in5');
    insertSession.run('sess-3', 'omar_farooq', '10.10.10.5', 'A0:B1:C2:D3:E4:F5', '12h 45m 30s', 45120, 15400, 'ether2-local');

    // 6. Seed Logs
    const insertLog = db.prepare(`
      INSERT INTO logs (id, timestamp, type, category, message, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertLog.run('l-1', '2026-06-03T02:00:00Z', 'system', 'info', 'تم الإقلاع والنظام بوضعية تشغيل كاملة', 'خدمة الموازنة IP والـ Core Engine نشطة');
    insertLog.run('l-2', '2026-06-03T02:15:00Z', 'mikrotik_cmd', 'success', 'مزامنة ناجحة لراوتر الكرادة', 'يوزر ali_ahmed تم تجديد صلاحيته');
    insertLog.run('l-3', '2026-06-03T02:30:00Z', 'billing', 'success', 'عملية شحن بطاقة كارت ناجحة لليوزر s_kamal', 'قيمة الكارت: 15,000 د.ع');

    // 7. Seed Settings
    const insertSetting = db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
    `);
    insertSetting.run('currency', 'IQD');
    insertSetting.run('terminalScript', '# SuperSAS CLI Script Generator Active\n# All subscriber/profile actions will generate RouterOS commands here.\n');
  }

  console.log('[SuperSAS DB] Database initialized and pre-seeded.');
}

export default db;

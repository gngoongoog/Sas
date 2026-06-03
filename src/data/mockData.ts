import { Router, PPPoEProfile, Subscriber, PinCard, ActiveSession, SystemLog } from '../types';

export const INITIAL_ROUTERS: Router[] = [
  {
    id: 'r-1',
    name: 'سيرفر بغداد الرئيسي (CCR-1036)',
    ip: '192.168.88.1',
    apiPort: 8728,
    username: 'admin',
    password: 'secure_password_123',
    status: 'online',
    location: 'الكرادة، البرج الرئيسي',
    version: 'RouterOS v7.12'
  },
  {
    id: 'r-2',
    name: 'سيرفر الموصل الفرعي (RB4011)',
    ip: '10.100.20.1',
    apiPort: 8728,
    username: 'sub_admin',
    password: 'mosul_network_pass',
    status: 'online',
    location: 'حي الزهور، كابينة 4',
    version: 'RouterOS v6.49'
  },
  {
    id: 'r-3',
    name: 'سيرفر البصرة الاحتياطي (CCR-2004)',
    ip: '172.16.50.1',
    apiPort: 8728,
    username: 'basra_admin',
    password: 'basra_secure_9s8',
    status: 'offline',
    location: 'العشار، فرع النهر',
    version: 'RouterOS v7.8'
  }
];

export const INITIAL_PROFILES: PPPoEProfile[] = [
  {
    id: 'p-1',
    name: 'اشتراك اقتصادي - 15 Mbps',
    localAddress: '10.0.10.1',
    remoteAddressPool: 'Economy_Pool',
    rateLimit: '15M/15M',
    addressList: 'ACTIVE_SUBSCRIBERS',
    price: 15000, // 15,000 IQD
    validityDays: 30
  },
  {
    id: 'p-2',
    name: 'اشتراك اعتيادي - 30 Mbps',
    localAddress: '10.0.20.1',
    remoteAddressPool: 'Standard_Pool',
    rateLimit: '30M/30M',
    addressList: 'ACTIVE_SUBSCRIBERS',
    price: 30000, // 30,000 IQD
    validityDays: 30
  },
  {
    id: 'p-3',
    name: 'اشتراك العاب وعوائل - 60 Mbps',
    localAddress: '10.0.30.1',
    remoteAddressPool: 'Turbo_Pool',
    rateLimit: '60M/60M',
    addressList: 'VIP_SUBSCRIBERS',
    price: 45000, // 45,000 IQD
    validityDays: 30
  },
  {
    id: 'p-4',
    name: 'اشتراك شركات فائق - 150 Mbps',
    localAddress: '10.10.10.1',
    remoteAddressPool: 'Enterprise_Pool',
    rateLimit: '150M/150M',
    addressList: 'ENTERPRISE_USERS',
    price: 120000, // 120,000 IQD
    validityDays: 30
  }
];

export const INITIAL_SUBSCRIBERS: Subscriber[] = [
  {
    id: 'sub-1',
    username: 'ali_ahmed',
    password: 'ali9988_pppoe',
    fullName: 'علي أحمد العبيدي',
    phone: '07701234567',
    routerId: 'r-1',
    profileId: 'p-2',
    ipAddress: '10.0.20.15',
    status: 'active',
    createdAt: '2026-05-15T12:00:00Z',
    expiryDate: '2026-06-15T12:00:00Z',
    macAddress: 'BC:83:85:12:DF:01'
  },
  {
    id: 'sub-2',
    username: 'mustafa_iraq',
    password: 'm_pass_992',
    fullName: 'مصطفى محمد الخفاجي',
    phone: '07812233445',
    routerId: 'r-1',
    profileId: 'p-3',
    ipAddress: '10.0.30.22',
    status: 'active',
    createdAt: '2026-05-20T14:30:00Z',
    expiryDate: '2026-06-20T14:30:00Z',
    macAddress: '70:8F:D8:E5:A2:CC'
  },
  {
    id: 'sub-3',
    username: 'fatima_hassan',
    password: 'f_h_pppoe_77',
    fullName: 'فاطمة حسن الموسوي',
    phone: '07509876543',
    routerId: 'r-2',
    profileId: 'p-1',
    ipAddress: '10.0.10.88',
    status: 'expired',
    createdAt: '2026-04-10T10:00:00Z',
    expiryDate: '2026-05-10T10:00:00Z',
    macAddress: 'F4:F5:D4:52:12:9E'
  },
  {
    id: 'sub-4',
    username: 'karar_saadi',
    password: 'karar123_pass',
    fullName: 'كرار سعدي الجبوري',
    phone: '07731235678',
    routerId: 'r-1',
    profileId: 'p-1',
    status: 'disabled',
    createdAt: '2026-05-01T08:15:00Z',
    expiryDate: '2026-06-01T08:15:00Z'
  },
  {
    id: 'sub-5',
    username: 'omar_farooq',
    password: 'omar_p_secure',
    fullName: 'عمر فاروق التكريتي',
    phone: '07804445556',
    routerId: 'r-1',
    profileId: 'p-4',
    ipAddress: '10.10.10.5',
    status: 'active',
    createdAt: '2026-05-28T16:00:00Z',
    expiryDate: '2026-06-27T16:00:00Z',
    macAddress: 'A0:B1:C2:D3:E4:F5'
  },
  {
    id: 'sub-6',
    username: 'murtada_saad',
    password: 'murtada9922_pass',
    fullName: 'مرتضى سعد الموسوي',
    phone: '07715566779',
    routerId: 'r-1',
    profileId: 'p-2',
    status: 'expired',
    createdAt: '2026-02-10T09:00:00Z',
    expiryDate: '2026-03-10T09:00:00Z'
  },
  {
    id: 'sub-7',
    username: 'sajjad_kassim',
    password: 'sajjad_secure',
    fullName: 'سجاد قاسم الكناني',
    phone: '07801122334',
    routerId: 'r-2',
    profileId: 'p-1',
    status: 'expired',
    createdAt: '2026-01-15T11:20:00Z',
    expiryDate: '2026-02-15T11:20:00Z'
  }
];

export const INITIAL_CARDS: PinCard[] = [
  {
    id: 'card-1',
    pin: '981248214952',
    serial: 'SS-4022-81729',
    profileId: 'p-1',
    price: 15000,
    status: 'active',
    createdAt: '2026-05-30T09:00:00Z'
  },
  {
    id: 'card-2',
    pin: '102938475610',
    serial: 'SS-4022-81730',
    profileId: 'p-2',
    price: 30000,
    status: 'active',
    createdAt: '2026-05-30T09:00:00Z'
  },
  {
    id: 'card-3',
    pin: '504938201948',
    serial: 'SS-4022-81731',
    profileId: 'p-3',
    price: 45000,
    status: 'used',
    usedBy: 'mustafa_iraq',
    usedAt: '2026-05-20T14:30:00Z',
    createdAt: '2026-05-19T11:00:00Z'
  },
  {
    id: 'card-4',
    pin: '773199482103',
    serial: 'SS-4022-81732',
    profileId: 'p-2',
    price: 30000,
    status: 'active',
    createdAt: '2026-05-30T09:05:00Z'
  }
];

export const INITIAL_SESSIONS: ActiveSession[] = [
  {
    id: 'sess-1',
    username: 'ali_ahmed',
    ip: '10.0.20.15',
    mac: 'BC:83:85:12:DF:01',
    uptime: '02:44:12',
    downloadSpeed: 1240, // kbps
    uploadSpeed: 450, // kbps
    callerId: 'pppoe-ali_ahmed'
  },
  {
    id: 'sess-2',
    username: 'mustafa_iraq',
    ip: '10.0.30.22',
    mac: '70:8F:D8:E5:A2:CC',
    uptime: '05:12:09',
    downloadSpeed: 8900, // kbps
    uploadSpeed: 3820, // kbps
    callerId: 'pppoe-mustafa_iraq'
  },
  {
    id: 'sess-3',
    username: 'omar_farooq',
    ip: '10.10.10.5',
    mac: 'A0:B1:C2:D3:E4:F5',
    uptime: '12:01:45',
    downloadSpeed: 45200, // kbps
    uploadSpeed: 14200, // kbps
    callerId: 'pppoe-omar_farooq'
  }
];

export const INITIAL_LOGS: SystemLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-06-01T23:45:00Z',
    type: 'system',
    category: 'info',
    message: 'تهيئة نظام SuperSAS وإلغاء استجابة HMR بنجاح.',
    details: 'نظام التحكم المركزي بالإشتراكات جاهز للعمل.'
  },
  {
    id: 'log-2',
    timestamp: '2026-06-01T23:46:12Z',
    type: 'mikrotik_cmd',
    category: 'success',
    message: 'تواصل ناجح مع سيرفر بغداد الرئيسي (192.168.88.1).',
    details: 'استجاب طلب API /ip/address بقراءة بنجاح واستمر العمل.'
  },
  {
    id: 'log-3',
    timestamp: '2026-06-01T23:48:30Z',
    type: 'billing',
    category: 'success',
    message: 'تفعيل كرت شحن PPPoE للمستخدم "mustafa_iraq"',
    details: 'الرقم التسلسلي: SS-4022-81731، الباقة: اشتراك العاب وعوائل - 60 Mbps.'
  },
  {
    id: 'log-4',
    timestamp: '2026-06-01T23:49:15Z',
    type: 'mikrotik_cmd',
    category: 'warning',
    message: 'تنبيه: سيرفر البصرة الاحتياطي غير متصل بالشبكة.',
    details: 'فشل تواصل ping على العنوان 172.16.50.1'
  }
];

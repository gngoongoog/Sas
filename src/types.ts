export interface Router {
  id: string;
  name: string;
  ip: string;
  apiPort: number;
  username: string;
  password: string;
  status: 'online' | 'offline' | 'connecting';
  location: string;
  version?: string;
}

export interface PPPoEProfile {
  id: string;
  name: string;
  localAddress: string;
  remoteAddressPool: string;
  rateLimit: string; // Download / Upload e.g. "15M/15M" or "20M/40M"
  addressList: string;
  price: number; // in IQD or USD e.g. 15000
  validityDays: number;
  qosPriority?: number;
  qosParentQueue?: string;
  qosBurstEnabled?: boolean | number;
  qosBurstLimit?: string;
  qosBurstThreshold?: string;
  qosBurstTime?: string;
  qosFastTrack?: boolean | number;
  qosAppsList?: string; // Comma-separated list of application keys e.g. "youtube,tiktok,whatsapp"
  qosAppsRuleType?: 'prioritize' | 'limit'; // 'prioritize' to fast-track/increase priority or 'limit' to throttle
  qosAppsLimitValue?: string; // limit speed like "2M/2M" for throttled apps
}

export interface Subscriber {
  id: string;
  username: string; // PPPoE login username
  password: string; // PPPoE login password
  fullName: string;
  phone: string;
  routerId: string;
  profileId: string;
  ipAddress?: string; // Static IP if assigned
  status: 'active' | 'expired' | 'disabled';
  createdAt: string;
  expiryDate: string;
  macAddress?: string; // MAC Lock
  whatsappAlertMode?: 'auto' | 'manual';
}

export interface PinCard {
  id: string;
  pin: string; // Activation code e.g. 9812-4821-4921
  serial: string; // Visible serial e.g. SS-2026-0001
  profileId: string;
  price: number;
  status: 'active' | 'used' | 'expired';
  usedBy?: string; // Subscriber username
  usedAt?: string;
  createdAt: string;
}

export interface ActiveSession {
  id: string;
  username: string;
  ip: string;
  mac: string;
  uptime: string; // Uptime duration
  downloadSpeed: number; // in kbps
  uploadSpeed: number; // in kbps
  callerId: string; // Interface or MAC
}

export interface SystemLog {
  id: string;
  timestamp: string;
  type: 'system' | 'mikrotik_cmd' | 'billing' | 'auth';
  category: 'info' | 'warning' | 'success' | 'error';
  message: string;
  details?: string;
}

export interface Stats {
  totalSubscribers: number;
  activeSubscribers: number;
  expiredSubscribers: number;
  onlineSessions: number;
  totalRevenue: number;
  totalRouters: number;
}

export interface SystemAlert {
  id: string;
  type: 'expiration_warning' | 'failed_payment' | 'device_offline' | 'device_online';
  title: string;
  message: string;
  timestamp: string;
  sentToTelegram: boolean;
  status: 'unread' | 'resolved';
}

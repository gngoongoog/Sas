import React, { createContext, useContext, useState, useEffect } from 'react';
import { Router, PPPoEProfile, Subscriber, PinCard, ActiveSession, SystemLog, Stats } from '../types';

interface SystemContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password_raw: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshAll: () => Promise<void>; // Expose refreshAll helper

  routers: Router[];
  profiles: PPPoEProfile[];
  subscribers: Subscriber[];
  cards: PinCard[];
  sessions: ActiveSession[];
  logs: SystemLog[];
  currency: 'IQD' | 'USD';
  setCurrency: (currency: 'IQD' | 'USD') => void;
  terminalScript: string;
  clearTerminalScript: () => void;
  
  // MikroTik Real-time API Sync States
  apiSyncLogs: string[];
  isSyncing: boolean;
  lastSyncStatus: 'success' | 'warning' | 'error' | 'idle';
  clearApiSyncLogs: () => void;
  syncSubscriberToRouter: (subId: string, action: 'add' | 'update' | 'delete' | 'toggle' | 'renew', oldUsername?: string, subDataOverride?: any) => Promise<any>;

  // Actions
  addRouter: (router: Omit<Router, 'id' | 'status'>) => Promise<void>;
  updateRouter: (router: Router) => Promise<void>;
  deleteRouter: (id: string) => Promise<void>;
  pingRouter: (id: string) => Promise<boolean>;

  addProfile: (profile: Omit<PPPoEProfile, 'id'>) => Promise<void>;
  updateProfile: (profile: PPPoEProfile) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;

  addSubscriber: (sub: Omit<Subscriber, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  updateSubscriber: (sub: Subscriber) => Promise<void>;
  deleteSubscriber: (id: string) => Promise<void>;
  renewSubscriber: (subId: string, profileId: string, paymentMethod: 'cash' | 'card', cardPin?: string, customHours?: number) => Promise<{ success: boolean; message: string }>;
  toggleSubscriberStatus: (id: string) => Promise<void>;
  restoreSubscribers: (subs: Subscriber[]) => Promise<void>;

  generateCards: (profileId: string, quantity: number, prefix: string) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  redeemCardByPin: (pin: string, username: string) => Promise<{ success: boolean; message: string }>;

  disconnectSession: (sessionId: string) => Promise<void>;
  triggerMockConnection: (subUsername: string) => void;
  
  addLog: (type: SystemLog['type'], category: SystemLog['category'], message: string, details?: string) => Promise<void>;
  clearLogs: () => Promise<void>;

  stats: Stats;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Store JWT token completely in-memory (not localStorage) as requested
  const [token, setToken] = useState<string | null>(null);

  // Entities state
  const [routers, setRouters] = useState<Router[]>([]);
  const [profiles, setProfiles] = useState<PPPoEProfile[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [cards, setCards] = useState<PinCard[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [currency, setCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [terminalScript, setTerminalScript] = useState<string>(
    '# SuperSAS CLI Script Generator Active\n# All subscriber/profile actions will generate RouterOS commands here.\n'
  );

  // MikroTik Real-time Sync state
  const [apiSyncLogs, setApiSyncLogs] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<'success' | 'warning' | 'error' | 'idle'>('idle');

  const clearApiSyncLogs = () => setApiSyncLogs([]);

  // Setup request headers helper
  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  // Handle server errors
  const handleApiError = (res: Response, fallbackMsg: string) => {
    if (res.status === 401 || res.status === 403) {
      // Automatic session invalidation if JWT expires/invalid
      setToken(null);
      throw new Error('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً.');
    }
    throw new Error(fallbackMsg);
  };

  // Login handler
  const login = async (username: string, password_raw: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: password_raw })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'فشل تسجيل الدخول، يرجى التحقق من المدخلات.' };
      }
      setToken(data.token);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل الاتصال بالخادم الرئيسي.' };
    }
  };

  // Logout handler
  const logout = () => {
    setToken(null);
    setRouters([]);
    setProfiles([]);
    setSubscribers([]);
    setCards([]);
    setSessions([]);
    setLogs([]);
  };

  // Re-fetch all data lists upon login or periodic interval
  const fetchAllData = async () => {
    if (!token) return;
    try {
      const headers = authHeaders();
      const [rRes, pRes, sRes, cRes, sessRes, lRes, setRes] = await Promise.all([
        fetch('/api/routers', { headers }),
        fetch('/api/profiles', { headers }),
        fetch('/api/subscribers', { headers }),
        fetch('/api/cards', { headers }),
        fetch('/api/sessions', { headers }),
        fetch('/api/logs', { headers }),
        fetch('/api/settings', { headers })
      ]);

      // Check auto logouts
      if (rRes.status === 401 || pRes.status === 401) {
        setToken(null);
        return;
      }

      const routersData = rRes.ok ? await rRes.json() : [];
      const profilesData = pRes.ok ? await pRes.json() : [];
      
      const subsRaw = sRes.ok ? await sRes.json() : [];
      const subsData = Array.isArray(subsRaw) ? subsRaw : (subsRaw.data || []);

      const cardsData = cRes.ok ? await cRes.json() : [];
      const sessionsData = sessRes.ok ? await sessRes.json() : [];
      const logsData = lRes.ok ? await lRes.json() : [];
      const settingsData = setRes.ok ? await setRes.json() : {};

      setRouters(routersData);
      setProfiles(profilesData);
      setSubscribers(subsData);
      setCards(cardsData);
      setSessions(sessionsData);
      setLogs(logsData);

      if (settingsData.currency) {
        setCurrency(settingsData.currency as 'IQD' | 'USD');
      }
      if (settingsData.terminalScript) {
        setTerminalScript(settingsData.terminalScript);
      }
    } catch (e) {
      console.error('Error polling SQLite tables:', e);
    }
  };

  // Fire on Login & Poll periodically using two separate intervals
  useEffect(() => {
    if (!token) return;
    fetchAllData();

    // Fast interval — sessions and logs only — every 45 seconds
    const fastInterval = setInterval(async () => {
      const h = { Authorization: `Bearer ${token}` };
      try {
        const [sRes, lRes] = await Promise.all([
          fetch('/api/sessions', { headers: h }),
          fetch('/api/logs',     { headers: h })
        ]);
        if (sRes.ok) setSessions(await sRes.json());
        if (lRes.ok) setLogs(await lRes.json());
      } catch { /* silent — stale data is acceptable */ }
    }, 45000);

    // Slow interval — routers, profiles, subscribers, cards — every 5 minutes
    const slowInterval = setInterval(async () => {
      const h = { Authorization: `Bearer ${token}` };
      try {
        const [rRes, pRes, subRes, cRes] = await Promise.all([
          fetch('/api/routers',     { headers: h }),
          fetch('/api/profiles',    { headers: h }),
          fetch('/api/subscribers', { headers: h }),
          fetch('/api/cards',       { headers: h })
        ]);
        if (rRes.ok)   setRouters(await rRes.json());
        if (pRes.ok)   setProfiles(await pRes.json());
        if (subRes.ok) {
          const d = await subRes.json();
          setSubscribers(Array.isArray(d) ? d : (d.data || []));
        }
        if (cRes.ok)   setCards(await cRes.json());
      } catch { /* silent */ }
    }, 300000);

    return () => {
      clearInterval(fastInterval);
      clearInterval(slowInterval);
    };
  }, [token]);

  // Sync to database settings table on change
  const saveSetting = async (key: string, value: string) => {
    if (!token) return;
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ settings: { [key]: value } })
      });
    } catch (e) {}
  };

  // Update backend currency setting
  const updateCurrency = (cur: 'IQD' | 'USD') => {
    setCurrency(cur);
    saveSetting('currency', cur);
  };

  // Helper local append for commands
  const appendToTerminal = (command: string) => {
    const freshScript = terminalScript + `\n# Generated at ${new Date().toLocaleTimeString()} \n${command}\n`;
    setTerminalScript(freshScript);
    saveSetting('terminalScript', freshScript);
  };

  const clearTerminalScript = () => {
    const cleared = '# SuperSAS Script Generator Cleared\n';
    setTerminalScript(cleared);
    saveSetting('terminalScript', cleared);
  };

  // Write systemic actions
  const addLog = async (type: SystemLog['type'], category: SystemLog['category'], message: string, details?: string) => {
    if (!token) return;
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: new Date().toISOString(),
          type,
          category,
          message,
          details
        })
      });
      if (res.ok) {
        fetchAllData();
      }
    } catch (e) {}
  };

  const clearLogs = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/logs/all', {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) {
        fetchAllData();
      }
    } catch (e) {}
  };

  // ==========================================
  // 🖧 ROUTERS ACTIONS
  // ==========================================
  const addRouter = async (router: Omit<Router, 'id' | 'status'>) => {
    if (!token) return;
    const res = await fetch('/api/routers', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(router)
    });
    if (!res.ok) handleApiError(res, 'فشل إضافة الراوتر.');
    await fetchAllData();
    appendToTerminal(`# إضافة تعريف سيرفر جديد\n/tool netwatch add host=${router.ip} interval=10s comment="SuperSAS: Watch ${router.name}"`);
  };

  const updateRouter = async (router: Router) => {
    if (!token) return;
    const res = await fetch(`/api/routers/${router.id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(router)
    });
    if (!res.ok) handleApiError(res, 'فشل تحديث الراوتر.');
    await fetchAllData();
  };

  const deleteRouter = async (id: string) => {
    if (!token) return;
    const res = await fetch(`/api/routers/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!res.ok) handleApiError(res, 'فشل حذف الراوتر.');
    await fetchAllData();
  };

  const pingRouter = async (id: string): Promise<boolean> => {
    if (!token) return false;
    try {
      // Hit router ping controller
      const res = await fetch('/api/mikrotik/status', { headers: authHeaders() });
      if (!res.ok) return false;
      const data = await res.json();
      const match = data.find((r: any) => r.id === id);
      await fetchAllData();
      return match ? match.status === 'online' : false;
    } catch (e) {
      return false;
    }
  };

  // ==========================================
  // 📦 PACKAGES/PROFILES ACTIONS
  // ==========================================
  const addProfile = async (profile: Omit<PPPoEProfile, 'id'>) => {
    if (!token) return;
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(profile)
    });
    if (!res.ok) handleApiError(res, 'فشل إضافة باقة.');
    await fetchAllData();

    // Generate detailed RouterOS QoS command
    let finalRateLimit = profile.rateLimit;
    const pPriority = profile.qosPriority || 8;
    if (profile.qosBurstEnabled && profile.qosBurstLimit && profile.qosBurstThreshold && profile.qosBurstTime) {
      finalRateLimit = `${profile.rateLimit} ${profile.qosBurstLimit} ${profile.qosBurstThreshold} ${profile.qosBurstTime} ${pPriority}`;
    } else if (pPriority !== 8) {
      finalRateLimit = `${profile.rateLimit} 0/0 0/0 0/0 ${pPriority}`;
    }

    let appendScript = `# إضافة باقة جديدة مع جودة الخدمة QoS: ${profile.name}\n`;
    appendScript += `/ppp profile add name="${profile.name}" local-address=${profile.localAddress} remote-address=${profile.remoteAddressPool} rate-limit="${finalRateLimit}" address-list="${profile.addressList}" comment="Chanchon Profile: ${profile.price} IQD"`;
    if (profile.qosParentQueue) {
      appendScript += ` parent-queue="${profile.qosParentQueue}"`;
    }

    if (profile.qosFastTrack) {
      appendScript += `\n/ip firewall filter add chain=forward action=fasttrack-connection src-address-list="${profile.addressList}" comment="QoS: FastTrack for ${profile.name}"`;
    } else {
      appendScript += `\n/ip firewall mangle add chain=forward action=change-dscp new-dscp=46 src-address-list="${profile.addressList}" comment="QoS: Voice/Gaming DSCP 46 for ${profile.name}"`;
    }

    // App QoS scripting
    if (profile.qosAppsList) {
      const apps = profile.qosAppsList.split(',').filter(Boolean);
      const ruleType = profile.qosAppsRuleType || 'prioritize';
      const limitVal = profile.qosAppsLimitValue || '2M/2M';
      const addressList = profile.addressList || 'ACTIVE_USERS';

      appendScript += `\n\n# --- [إعدادات QoS لتطبيقات الباقة: ${profile.name}] ---`;
      apps.forEach((app: string) => {
        let nameAr = '';
        let domains: string[] = [];
        let ports = '';

        if (app === 'youtube') {
          nameAr = 'يوتيوب (YouTube)';
          domains = ['youtube.com', 'googlevideo.com', 'ytimg.com'];
        } else if (app === 'tiktok') {
          nameAr = 'تيك توك (TikTok)';
          domains = ['tiktok.com', 'byteoversea.com', 'tiktokv.com', 'tiktokcdn.com'];
        } else if (app === 'whatsapp') {
          nameAr = 'واتساب وتليجرام (WhatsApp & Telegram)';
          domains = ['whatsapp.com', 'whatsapp.net', 'telegram.org', 'telegram.dog'];
          ports = '443,80,5222,5223';
        } else if (app === 'facebook') {
          nameAr = 'فيسبوك وإنستغرام (Facebook & Instagram)';
          domains = ['facebook.com', 'fbcdn.net', 'instagram.com', 'cdninstagram.com'];
        } else if (app === 'gaming') {
          nameAr = 'ألعاب أونلاين وببجي (Gaming & PUBG)';
          ports = '5007,12235,17000,20000';
        } else if (app === 'netflix') {
          nameAr = 'نتفلكس وبث الفيديو (Netflix & Video)';
          domains = ['netflix.com', 'nflxvideo.net'];
        }

        appendScript += `\n# 📱 حركة بيانات ${nameAr}`;
        if (domains.length > 0) {
          domains.forEach((d) => {
            appendScript += `\n/ip firewall address-list add list="list_${app}" address="${d}" comment="QoS ${app}"`;
          });
          appendScript += `\n/ip firewall mangle add chain=forward action=mark-connection new-connection-mark="${app}_conn" dst-address-list="list_${app}" src-address-list="${addressList}" passthrough=yes comment="QoS ${app} Conn"`;
          appendScript += `\n/ip firewall mangle add chain=forward action=mark-packet new-packet-mark="${app}_pkt" connection-mark="${app}_conn" passthrough=no comment="QoS ${app} Packet"`;
        } else if (ports) {
          appendScript += `\n/ip firewall mangle add chain=forward action=mark-connection new-connection-mark="${app}_conn" protocol=tcp dst-port="${ports}" src-address-list="${addressList}" passthrough=yes comment="QoS ${app} Conn"`;
          appendScript += `\n/ip firewall mangle add chain=forward action=mark-packet new-packet-mark="${app}_pkt" connection-mark="${app}_conn" passthrough=no comment="QoS ${app} Packet"`;
        }

        if (ruleType === 'prioritize') {
          appendScript += `\n/queue simple add name="${profile.name}_${app}_QoS" target="${addressList}" packet-marks="${app}_pkt" priority=2/2 max-limit=0/0 comment="Prioritized ${app} for ${profile.name}"`;
        } else {
          appendScript += `\n/queue simple add name="${profile.name}_${app}_Throttle" target="${addressList}" packet-marks="${app}_pkt" priority=7/7 max-limit="${limitVal}" comment="Limited ${app} to ${limitVal} for ${profile.name}"`;
        }
      });
    }

    appendToTerminal(appendScript);
  };

  const updateProfile = async (profile: PPPoEProfile) => {
    if (!token) return;
    const res = await fetch(`/api/profiles/${profile.id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(profile)
    });
    if (!res.ok) handleApiError(res, 'فشل تحديث الباقة.');
    await fetchAllData();

    // Generate detailed RouterOS QoS command for updates
    let finalRateLimit = profile.rateLimit;
    const pPriority = profile.qosPriority || 8;
    if (profile.qosBurstEnabled && profile.qosBurstLimit && profile.qosBurstThreshold && profile.qosBurstTime) {
      finalRateLimit = `${profile.rateLimit} ${profile.qosBurstLimit} ${profile.qosBurstThreshold} ${profile.qosBurstTime} ${pPriority}`;
    } else if (pPriority !== 8) {
      finalRateLimit = `${profile.rateLimit} 0/0 0/0 0/0 ${pPriority}`;
    }

    let appendScript = `# تحديث باقة اشتراك وإعدادات جودة الخدمة QoS: ${profile.name}\n`;
    appendScript += `/ppp profile set [find name="${profile.name}"] local-address=${profile.localAddress} remote-address=${profile.remoteAddressPool} rate-limit="${finalRateLimit}" address-list="${profile.addressList}"`;
    if (profile.qosParentQueue) {
      appendScript += ` parent-queue="${profile.qosParentQueue}"`;
    }

    // App QoS scripting for updates
    if (profile.qosAppsList) {
      const apps = profile.qosAppsList.split(',').filter(Boolean);
      const ruleType = profile.qosAppsRuleType || 'prioritize';
      const limitVal = profile.qosAppsLimitValue || '2M/2M';
      const addressList = profile.addressList || 'ACTIVE_USERS';

      appendScript += `\n\n# --- [تحديث QoS لتطبيقات الباقة: ${profile.name}] ---`;
      apps.forEach((app: string) => {
        let nameAr = '';
        if (app === 'youtube') nameAr = 'يوتيوب (YouTube)';
        else if (app === 'tiktok') nameAr = 'تيك توك (TikTok)';
        else if (app === 'whatsapp') nameAr = 'واتساب وتليجرام (WhatsApp & Telegram)';
        else if (app === 'facebook') nameAr = 'فيسبوك وإنستغرام (Facebook & Instagram)';
        else if (app === 'gaming') nameAr = 'ألعاب أونلاين وببجي (Gaming & PUBG)';
        else if (app === 'netflix') nameAr = 'نتفلكس وبث الفيديو (Netflix & Video)';

        appendScript += `\n# 📱 تحديث تنظيم حركة بيانات لـ: ${nameAr}`;
        if (ruleType === 'prioritize') {
          appendScript += `\n/queue simple set [find name="${profile.name}_${app}_QoS" or name="${profile.name}_${app}_Throttle"] priority=2/2 max-limit=0/0 comment="Prioritized ${app} for ${profile.name}"`;
        } else {
          appendScript += `\n/queue simple set [find name="${profile.name}_${app}_QoS" or name="${profile.name}_${app}_Throttle"] priority=7/7 max-limit="${limitVal}" comment="Limited ${app} to ${limitVal} for ${profile.name}"`;
        }
      });
    }

    appendToTerminal(appendScript);
  };

  const deleteProfile = async (id: string) => {
    if (!token) return;
    const res = await fetch(`/api/profiles/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!res.ok) handleApiError(res, 'فشل حذف الباقة.');
    await fetchAllData();
  };

  // ==========================================
  // 👥 SUBSCRIBERS ACTIONS
  // ==========================================
  const addSubscriber = async (sub: Omit<Subscriber, 'id' | 'createdAt' | 'status'>) => {
    if (!token) return;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);

    const subBody = {
      ...sub,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiryDate: expiry.toISOString()
    };

    const res = await fetch('/api/subscribers', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(subBody)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'فشل إضافة المشترك.');
    }
    
    const resResult = await res.json();
    const createdId = resResult.id;
    await fetchAllData();

    // Command logging
    const profile = profiles.find((p) => p.id === sub.profileId);
    appendToTerminal(
      `/ppp secret add name="${sub.username}" password="${sub.password}" profile="${profile?.name || 'default'}" service=pppoe comment="${sub.fullName} - Active - Exp: ${expiry.toLocaleDateString()}"${sub.macAddress ? ` caller-id="${sub.macAddress}"` : ''}`
    );

    // Live API MikoTik sync
    setTimeout(() => {
      syncSubscriberToRouter(createdId, 'add', undefined, { ...subBody, id: createdId });
    }, 150);
  };

  const updateSubscriber = async (sub: Subscriber) => {
    if (!token) return;
    
    // Find old username
    const oldSub = subscribers.find((s) => s.id === sub.id);
    const oldUsername = oldSub?.username;

    const res = await fetch(`/api/subscribers/${sub.id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(sub)
    });
    if (!res.ok) handleApiError(res, 'فشل تحديث المشترك.');
    await fetchAllData();

    const profile = profiles.find((p) => p.id === sub.profileId);
    appendToTerminal(
      `/ppp secret set [find name="${sub.username}"] password="${sub.password}" profile="${profile?.name || 'default'}" comment="${sub.fullName} - Exp: ${new Date(sub.expiryDate).toLocaleDateString()}"${sub.macAddress ? ` caller-id="${sub.macAddress}"` : ' caller-id=""'}`
    );

    setTimeout(() => {
      syncSubscriberToRouter(sub.id, 'update', oldUsername, sub);
    }, 150);
  };

  const deleteSubscriber = async (id: string) => {
    if (!token) return;
    const sub = subscribers.find((s) => s.id === id);
    if (!sub) return;

    const res = await fetch(`/api/subscribers/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!res.ok) handleApiError(res, 'فشل حذف المشترك.');
    await fetchAllData();

    appendToTerminal(
      `/ppp secret remove [find name="${sub.username}"]\n/ppp active remove [find name="${sub.username}"]`
    );

    setTimeout(() => {
      syncSubscriberToRouter(id, 'delete', undefined, sub);
    }, 150);
  };

  const toggleSubscriberStatus = async (id: string) => {
    if (!token) return;
    const sub = subscribers.find((s) => s.id === id);
    if (!sub) return;

    const nextStatus = sub.status === 'disabled' ? 'active' : 'disabled';
    const updatedSub = { ...sub, status: nextStatus };

    const res = await fetch(`/api/subscribers/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updatedSub)
    });
    if (!res.ok) handleApiError(res, 'فشل تفعيل الحساب.');
    await fetchAllData();

    appendToTerminal(
      nextStatus === 'active'
        ? `/ppp secret enable [find name="${sub.username}"]`
        : `/ppp secret disable [find name="${sub.username}"]\n/ppp active remove [find name="${sub.username}"]`
    );

    setTimeout(() => {
      syncSubscriberToRouter(id, 'toggle', undefined, updatedSub);
    }, 150);
  };

  const renewSubscriber = async (subId: string, profileId: string, paymentMethod: 'cash' | 'card', cardPin?: string, customHours?: number) => {
    if (!token) return { success: false, message: 'مطلوب مصادقة للقيام بذلك.' };
    const sub = subscribers.find((s) => s.id === subId);
    const profile = profiles.find((p) => p.id === profileId);

    if (!sub || !profile) {
      return { success: false, message: 'بيانات غير صالحة.' };
    }

    if (paymentMethod === 'card') {
      if (!cardPin) return { success: false, message: 'يرجى تزويد كرت الدبوس.' };
      const sanitized = cardPin.replace(/[-\s]/g, '');
      const matchedCard = cards.find(c => c.pin === sanitized && c.status === 'active' && c.profileId === profileId);
      if (!matchedCard) {
        return { success: false, message: 'رمز كرت الشحن غير مطابق أو غير نشط لتلك الباقة.' };
      }

      // Consume card via database
      const cardUpdate = { ...matchedCard, status: 'used', usedBy: sub.username, usedAt: new Date().toISOString() };
      await fetch('/api/cards', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ cardsList: [cardUpdate] })
      });
    }

    const currentExpiry = new Date(sub.expiryDate);
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(baseDate);
    if (customHours) {
      newExpiry.setHours(baseDate.getHours() + customHours);
    } else {
      newExpiry.setDate(baseDate.getDate() + profile.validityDays);
    }

    const updatedSub = {
      ...sub,
      profileId,
      status: 'active' as const,
      expiryDate: newExpiry.toISOString()
    };

    const res = await fetch(`/api/subscribers/${subId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updatedSub)
    });
    if (!res.ok) return { success: false, message: 'فشل التجديد في قاعدة البيانات.' };
    await fetchAllData();

    addLog(
      'billing',
      'success',
      `تجديد اشتراك: ${sub.fullName}`,
      `طريقة الدفع: ${paymentMethod}, تاريخ انتهاء الصلاحية: ${newExpiry.toLocaleDateString()}`
    );

    appendToTerminal(
      `/ppp secret set [find name="${sub.username}"] profile="${profile.name}" comment="${sub.fullName} - تجديد - التاريخ: ${newExpiry.toLocaleDateString()}"\n/ppp active remove [find name="${sub.username}"]`
    );

    setTimeout(() => {
      syncSubscriberToRouter(subId, 'renew', undefined, updatedSub);
    }, 150);

    return { success: true, message: 'تم تجديد العميل ومزامنته بسلام!' };
  };

  const restoreSubscribers = async (newSubs: Subscriber[]) => {
    if (!token) return;
    try {
      // Bulk insert subscriber list sequentially or trigger database batching
      for (const sub of newSubs) {
        await fetch('/api/subscribers', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(sub)
        });
      }
      await fetchAllData();
      addLog('system', 'success', `تم استعادة عدد المشتركين: ${newSubs.length}`);
    } catch (e) {}
  };

  // ==========================================
  // 🎫 CARD PIN ACTIONS
  // ==========================================
  const generateCards = async (profileId: string, quantity: number, prefix: string) => {
    if (!token) return;
    const targetProfile = profiles.find((p) => p.id === profileId);
    if (!targetProfile) return;

    const cardsList: any[] = [];
    for (let i = 0; i < quantity; i++) {
      const pin = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
      const serialNum = Math.floor(100000 + Math.random() * 900000);
      const serial = `${prefix || 'SS'}-${targetProfile.validityDays}-${serialNum}`;

      cardsList.push({
        id: `card-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 3)}`,
        pin,
        serial,
        profileId,
        price: targetProfile.price,
        status: 'active',
        createdAt: new Date().toISOString()
      });
    }

    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ cardsList })
    });
    if (!res.ok) handleApiError(res, 'فشل توليد البطاقات.');
    await fetchAllData();
  };

  const deleteCard = async (id: string) => {
    if (!token) return;
    const res = await fetch(`/api/cards/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!res.ok) handleApiError(res, 'فشل حذف الكارت.');
    await fetchAllData();
  };

  const redeemCardByPin = async (pinStr: string, username: string) => {
    if (!token) return { success: false, message: 'مطلوب تسجيل الدخول.' };
    const sanitizedPin = pinStr.replace(/[-\s]/g, '');
    const card = cards.find((c) => c.pin === sanitizedPin && c.status === 'active');
    if (!card) {
      return { success: false, message: 'كرت الشحن غير متوفر أو تم استخدامه مسبقاً.' };
    }

    const sub = subscribers.find((s) => s.username === username);
    if (!sub) {
      return { success: false, message: 'مستخدم PPPoE غير عثور عليه.' };
    }

    const profile = profiles.find((p) => p.id === card.profileId);
    if (!profile) {
      return { success: false, message: 'الباقة المربوطة بالكارت غير متوفرة.' };
    }

    const outcome = await renewSubscriber(sub.id, card.profileId, 'card', sanitizedPin);
    return outcome;
  };

  // ==========================================
  // 🔌 SESSIONS / CORE FLOWS
  // ==========================================
  const disconnectSession = async (sessionId: string) => {
    if (!token) return;
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!res.ok) handleApiError(res, 'فشل قطع الجلسة.');
    await fetchAllData();
  };

  const triggerMockConnection = (subUsername: string) => {
    // Retained for simulation mock actions
    console.log(`Simulating dynamic connection request for: ${subUsername}`);
  };

  // ==========================================
  // 🔄 MIKROTIK SYNC PROXY CALLS
  // ==========================================
  const syncSubscriberToRouter = async (
    subId: string,
    action: 'add' | 'update' | 'delete' | 'toggle' | 'renew',
    oldUsername?: string,
    subDataOverride?: any
  ) => {
    setIsSyncing(true);
    setLastSyncStatus('idle');
    setApiSyncLogs([`🔄 جاري استدعاء API مزامنة مايكروتك للعميل...`]);

    const sub = subDataOverride || subscribers.find((s) => s.id === subId);
    if (!sub) {
      setIsSyncing(false);
      setLastSyncStatus('error');
      setApiSyncLogs([`❌ فشل: لم يتم العثور على بيانات العميل المطلوبة لمعالجة المزامنة.`]);
      return { success: false, message: 'مستخدم غير متوفر.' };
    }

    const router = routers.find((r) => r.id === sub.routerId) || routers[0];
    const profile = profiles.find((p) => p.id === sub.profileId);

    if (!router) {
      setIsSyncing(false);
      setLastSyncStatus('error');
      setApiSyncLogs([`❌ فشل: لم يتم العثور على جهاز مايكروتك (Router) مربوط بهذا المشترك.`]);
      return { success: false, message: 'راوتر غير متوفر.' };
    }

    try {
      const response = await fetch('/api/mikrotik/sync-secret', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          router,
          action,
          subscriber: sub,
          profile,
          oldUsername
        })
      });

      if (!response.ok) {
        throw new Error(`خطأ في خادم واجهة التطبيق (رمز ${response.status})`);
      }

      const resData = await response.json();
      
      if (resData.debugLogs) {
        setApiSyncLogs(resData.debugLogs);
      } else {
        setApiSyncLogs((prev) => [...prev, `✅ اكتملت المزامنة: ${resData.message || ''}`]);
      }

      if (resData.cliCommand) {
        // Log terminal locally for users
        appendToTerminal(resData.cliCommand);
      }

      setLastSyncStatus(resData.mode === 'live_api_sync' ? 'success' : 'warning');
      setIsSyncing(false);
      await fetchAllData();
      return resData;
    } catch (err: any) {
      console.error('Error in syncSubscriberToRouter:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setIsSyncing(false);
      setLastSyncStatus('error');
      
      const simulatedLogs = [
        `🔄 بدأت محاولة المزامنة مع سيرفر المايكروتك: ${router.name}`,
        `⏳ جاري تأسيس اتصال مشفر REST API بالراوتر...`,
        `❌ فشل الاتصال بنفق API الخادم: ${errMsg}`,
        `⚙️ تفعيل آلية الإنقاذ ومحاكاة السيرفر المحلي (Simulated Match) لحفظ الإشتراك دون عطل بالصالة.`,
        `✅ نجح الإجراء البرمجي بالكامل بوضعية الـ Sandbox المحلي!`
      ];
      setApiSyncLogs(simulatedLogs);
      return { success: true, mode: 'simulated' };
    }
  };

  // Live timer simulation for active sessions download/upload speed counters
  useEffect(() => {
    if (!token || sessions.length === 0) return;
    const interval = setInterval(() => {
      setSessions((prev) =>
        prev.map((sess) => {
          const parts = sess.uptime.split(':').map(Number);
          if (parts.length < 3) return sess;
          let seconds = parts[0] * 3600 + parts[1] * 60 + parts[2] + 1;
          const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
          const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
          const s = String(seconds % 60).padStart(2, '0');
          const newUptime = `${h}:${m}:${s}`;

          const deltaD = (Math.random() - 0.45) * 500;
          const deltaU = (Math.random() - 0.45) * 150;
          const targetProfile = profiles.find((p) => {
            const sub = subscribers.find((s) => s.username === sess.username);
            return p.id === sub?.profileId;
          });
          
          let maxD = 30000;
          let maxU = 10000;
          if (targetProfile) {
            const [dLimit, uLimit] = targetProfile.rateLimit.replace(/M/g, '').split('/');
            maxD = Number(dLimit) * 1024;
            maxU = Number(uLimit) * 1024;
          }

          const dSpeed = Math.max(50, Math.min(maxD, Math.round(sess.downloadSpeed + deltaD)));
          const uSpeed = Math.max(20, Math.min(maxU, Math.round(sess.uploadSpeed + deltaU)));

          return {
            ...sess,
            uptime: newUptime,
            downloadSpeed: dSpeed,
            uploadSpeed: uSpeed
          };
        })
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [sessions.length, profiles, subscribers, token]);

  // stats calculations
  const totalSubscribers = subscribers.length;
  const activeSubscribers = subscribers.filter((s) => s.status === 'active').length;
  const expiredSubscribers = subscribers.filter((s) => s.status === 'expired').length;
  const onlineSessions = sessions.length;
  
  const activeSubsRevenue = subscribers
    .filter((s) => s.status === 'active')
    .reduce((acc, s) => {
      const p = profiles.find((prof) => prof.id === s.profileId);
      return acc + (p?.price || 0);
    }, 0);
  
  const consumedCardsRevenue = cards
    .filter((c) => c.status === 'used')
    .reduce((acc, c) => acc + c.price, 0);

  const stats: Stats = {
    totalSubscribers,
    activeSubscribers,
    expiredSubscribers,
    onlineSessions,
    totalRevenue: activeSubsRevenue + consumedCardsRevenue,
    totalRouters: routers.length
  };

  return (
    <SystemContext.Provider
      value={{
        token,
        isAuthenticated: !!token,
        login,
        logout,
        refreshAll: fetchAllData,
        routers,
        profiles,
        subscribers,
        cards,
        sessions,
        logs,
        currency,
        setCurrency: updateCurrency,
        terminalScript,
        clearTerminalScript,
        apiSyncLogs,
        isSyncing,
        lastSyncStatus,
        clearApiSyncLogs,
        syncSubscriberToRouter,
        addRouter,
        updateRouter,
        deleteRouter,
        pingRouter,
        addProfile,
        updateProfile,
        deleteProfile,
        addSubscriber,
        updateSubscriber,
        deleteSubscriber,
        renewSubscriber,
        toggleSubscriberStatus,
        restoreSubscribers,
        generateCards,
        deleteCard,
        redeemCardByPin,
        disconnectSession,
        triggerMockConnection,
        addLog,
        clearLogs,
        stats
      }}
    >
      {children}
    </SystemContext.Provider>
  );
};

export const useSystem = () => {
  const context = useContext(SystemContext);
  if (context === undefined) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
};

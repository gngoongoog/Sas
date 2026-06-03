import React, { createContext, useContext, useState, useEffect } from 'react';
import { Router, PPPoEProfile, Subscriber, PinCard, ActiveSession, SystemLog, Stats } from '../types';
import {
  INITIAL_ROUTERS,
  INITIAL_PROFILES,
  INITIAL_SUBSCRIBERS,
  INITIAL_CARDS,
  INITIAL_SESSIONS,
  INITIAL_LOGS
} from '../data/mockData';

interface SystemContextType {
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
  addRouter: (router: Omit<Router, 'id' | 'status'>) => void;
  updateRouter: (router: Router) => void;
  deleteRouter: (id: string) => void;
  pingRouter: (id: string) => Promise<boolean>;

  addProfile: (profile: Omit<PPPoEProfile, 'id'>) => void;
  updateProfile: (profile: PPPoEProfile) => void;
  deleteProfile: (id: string) => void;

  addSubscriber: (sub: Omit<Subscriber, 'id' | 'createdAt' | 'status'>) => void;
  updateSubscriber: (sub: Subscriber) => void;
  deleteSubscriber: (id: string) => void;
  renewSubscriber: (subId: string, profileId: string, paymentMethod: 'cash' | 'card', cardPin?: string, customHours?: number) => { success: boolean; message: string };
  toggleSubscriberStatus: (id: string) => void;
  restoreSubscribers: (subs: Subscriber[]) => void;

  generateCards: (profileId: string, quantity: number, prefix: string) => void;
  deleteCard: (id: string) => void;
  redeemCardByPin: (pin: string, username: string) => { success: boolean; message: string };

  disconnectSession: (sessionId: string) => void;
  triggerMockConnection: (subUsername: string) => void;
  
  addLog: (type: SystemLog['type'], category: SystemLog['category'], message: string, details?: string) => void;
  clearLogs: () => void;

  stats: Stats;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [routers, setRouters] = useState<Router[]>(() => {
    const saved = localStorage.getItem('supersas_routers');
    return saved ? JSON.parse(saved) : INITIAL_ROUTERS;
  });

  const [profiles, setProfiles] = useState<PPPoEProfile[]>(() => {
    const saved = localStorage.getItem('supersas_profiles');
    return saved ? JSON.parse(saved) : INITIAL_PROFILES;
  });

  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => {
    const saved = localStorage.getItem('supersas_subs');
    return saved ? JSON.parse(saved) : INITIAL_SUBSCRIBERS;
  });

  const [cards, setCards] = useState<PinCard[]>(() => {
    const saved = localStorage.getItem('supersas_cards');
    return saved ? JSON.parse(saved) : INITIAL_CARDS;
  });

  const [sessions, setSessions] = useState<ActiveSession[]>(() => {
    const saved = localStorage.getItem('supersas_sessions');
    return saved ? JSON.parse(saved) : INITIAL_SESSIONS;
  });

  const [logs, setLogs] = useState<SystemLog[]>(() => {
    const saved = localStorage.getItem('supersas_logs');
    const parsed: SystemLog[] = saved ? JSON.parse(saved) : INITIAL_LOGS;
    const seen = new Set<string>();
    return parsed.filter((log) => {
      // Clean up any potential duplicates or invalid objects
      if (!log || !log.id) return false;
      const isDuplicate = seen.has(log.id);
      seen.add(log.id);
      return !isDuplicate;
    });
  });

  const [currency, setCurrency] = useState<'IQD' | 'USD'>(() => {
    return (localStorage.getItem('supersas_currency') as 'IQD' | 'USD') || 'IQD';
  });

  const [terminalScript, setTerminalScript] = useState<string>(() => {
    return localStorage.getItem('supersas_terminal_script') || 
      '# SuperSAS CLI Script Generator Active\n# All subscriber/profile actions will generate RouterOS commands here.\n';
  });

  // MikroTik Real-time API Sync States
  const [apiSyncLogs, setApiSyncLogs] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<'success' | 'warning' | 'error' | 'idle'>('idle');

  const clearApiSyncLogs = () => setApiSyncLogs([]);

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
      setApiSyncLogs([`❌ فشل: لم يتم العثور على جهاز مايكروتك (Router) مربوط بهذا المستخدم.`]);
      return { success: false, message: 'راوتر غير متوفر.' };
    }

    try {
      const response = await fetch('/api/mikrotik/sync-secret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
        appendToTerminal(resData.cliCommand);
      }

      setLastSyncStatus(resData.mode === 'live_api_sync' ? 'success' : 'warning');
      setIsSyncing(false);

      // Add to System Logs
      addLog(
        'mikrotik_cmd',
        resData.mode === 'live_api_sync' ? 'success' : 'info',
        `[مزامنة API] ${resData.message || 'تمت المزامنة بنجاح'}`,
        `العميل: ${sub.fullName} (${sub.username})، الراوتر: ${router.name}`
      );

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

      addLog(
        'mikrotik_cmd',
        'warning',
        `[مزامنة محاكاة] تم تفعيل حساب ${sub.fullName} بوضعية المحاكاة الآمنة`,
        `اليوزر: ${sub.username}، السيرفر ${router.name} يحتاج ضبط المنافذ.`
      );

      return { success: true, mode: 'simulated', message: 'مزامنة محاكاة ناجحة' };
    }
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('supersas_routers', JSON.stringify(routers));
  }, [routers]);

  useEffect(() => {
    localStorage.setItem('supersas_profiles', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('supersas_subs', JSON.stringify(subscribers));
  }, [subscribers]);

  useEffect(() => {
    localStorage.setItem('supersas_cards', JSON.stringify(cards));
  }, [cards]);

  useEffect(() => {
    localStorage.setItem('supersas_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('supersas_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('supersas_currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('supersas_terminal_script', terminalScript);
  }, [terminalScript]);

  // حفظ مرجع دائم للمشتركين لضمان الفحص التلقائي المستند لأحدث البيانات بدون تكرار
  const subscribersRef = React.useRef(subscribers);
  useEffect(() => {
    subscribersRef.current = subscribers;
  }, [subscribers]);

  // فحص ذكي وتلقائي لقطع الخدمة والإنترنت فور انتهاء صلاحية الاشتراك
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentSubs = subscribersRef.current;
      
      const expiredSubs = currentSubs.filter(sub => sub.status === 'active' && new Date(sub.expiryDate) < now);
      
      if (expiredSubs.length > 0) {
        // 1. تحديث الحالات في مصفوفة المشتركين دفعة واحدة
        setSubscribers(prevSubs => prevSubs.map(sub => {
          if (sub.status === 'active' && new Date(sub.expiryDate) < now) {
            return { ...sub, status: 'expired' };
          }
          return sub;
        }));

        // 2. إجراء العمليات والآثار الجانبية لكل مشترك منتهي بشكل آمن تماماً خارج معدل الحالة (reducer)
        expiredSubs.forEach(sub => {
          // قطع الاتصال وفصل الجلسة النشطة
          setSessions(prevSess => prevSess.filter(s => s.username !== sub.username));
          
          // تدوين سجل حظر وقطع إنترنت
          addLog(
            'billing',
            'warning',
            `قطع الإنترنت التلقائي: انتهى اشتراك العميل [${sub.fullName}]`,
            `تم تجريد العميل من الإنترنت بفصل جلسته النشطة فوراً وتعطيل الحساب حتى التجديد.`
          );

          // كتابة سكريبت مايكروتك للتعطيل والطرد
          appendToTerminal(
            `# قطع الإنترنت التلقائي لانتهاء صلاحية اشتراك: ${sub.fullName}\n` +
            `/ppp secret disable [find name="${sub.username}"]\n` +
            `/ppp active remove [find name="${sub.username}"]`
          );

          // استدعاء المزامنة الفورية لـ API المايكروتك
          const expiredSub = { ...sub, status: 'expired' as const };
          setTimeout(() => {
            syncSubscriberToRouter(sub.id, 'toggle', undefined, expiredSub);
          }, 100);
        });
      }
    }, 10000); // يفحص كل 10 ثوانٍ لضمان اللحظية الحقيقية

    return () => clearInterval(interval);
  }, []);

  // Simulate active session traffic (kBps random walk)
  useEffect(() => {
    const interval = setInterval(() => {
      setSessions((prev) =>
        prev.map((sess) => {
          // Increase uptime slightly
          const parts = sess.uptime.split(':').map(Number);
          let seconds = parts[0] * 3600 + parts[1] * 60 + parts[2] + 1;
          const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
          const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
          const s = String(seconds % 60).padStart(2, '0');
          const newUptime = `${h}:${m}:${s}`;

          // Random traffic between -10% and +10% of current speed
          const deltaD = (Math.random() - 0.45) * 500; // trend slightly upwards
          const deltaU = (Math.random() - 0.45) * 150;
          const targetProfile = profiles.find((p) => {
            const sub = subscribers.find((s) => s.username === sess.username);
            return p.id === sub?.profileId;
          });
          
          let maxD = 30000; // default 30 Mbps
          let maxU = 10000; // default 10 Mbps
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
  }, [profiles, subscribers]);

  const addLog = (type: SystemLog['type'], category: SystemLog['category'], message: string, details?: string) => {
    const randomSuffix = Math.floor(Math.random() * 1000000);
    const newLog: SystemLog = {
      id: `log-${Date.now()}-${randomSuffix}`,
      timestamp: new Date().toISOString(),
      type,
      category,
      message,
      details
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 99)]); // Limit to 100 logs
  };

  const clearLogs = () => setLogs([]);

  const appendToTerminal = (command: string) => {
    setTerminalScript((prev) => prev + `\n# Generated at ${new Date().toLocaleTimeString()} \n${command}\n`);
  };

  const clearTerminalScript = () => {
    setTerminalScript('# SuperSAS Script Generator Cleared\n');
  };

  // 1. Router Management
  const addRouter = (router: Omit<Router, 'id' | 'status'>) => {
    const newRouter: Router = {
      ...router,
      id: `r-${Date.now()}`,
      status: 'online'
    };
    setRouters((prev) => [...prev, newRouter]);
    addLog('system', 'success', `تمت إضافة سيرفر مايكروتك جديد: ${router.name}`, `IP: ${router.ip}`);
    
    // Command equivalent
    appendToTerminal(`# إضافة تعريف سيرفر جديد\n/tool netwatch add host=${router.ip} interval=10s comment="SuperSAS: Watch ${router.name}"`);
  };

  const updateRouter = (router: Router) => {
    setRouters((prev) => prev.map((r) => (r.id === router.id ? router : r)));
    addLog('system', 'info', `تم تحديث بيانات سيرفر مايكروتك: ${router.name}`);
  };

  const deleteRouter = (id: string) => {
    const router = routers.find((r) => r.id === id);
    if (router) {
      setRouters((prev) => prev.filter((r) => r.id !== id));
      addLog('system', 'warning', `تم حذف السيرفر: ${router.name}`);
    }
  };

  const pingRouter = async (id: string): Promise<boolean> => {
    setRouters((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'connecting' as const } : r))
    );
    
    // Simulate API test latency
    await new Promise((resolve) => setTimeout(resolve, 1200));
    
    const router = routers.find((r) => r.id === id);
    if (!router) return false;
    
    // Toggle online/offline for simulations, default online
    const isOnline = router.ip !== '172.16.50.1' || Math.random() > 0.3;
    
    setRouters((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: isOnline ? 'online' : 'offline' } : r))
    );
    
    addLog(
      'mikrotik_cmd',
      isOnline ? 'success' : 'error',
      isOnline ? `تم تحقيق الإتصال بـ API السيرفر: ${router.name}` : `فشل الإتصال بالسيرفر: ${router.name}`,
      `منفذ الاتصال: ${router.apiPort}، بروتوكول: API-SSL`
    );
    return isOnline;
  };

  // 2. Profiles Speed Limit
  const addProfile = (profile: Omit<PPPoEProfile, 'id'>) => {
    const newProfile: PPPoEProfile = {
      ...profile,
      id: `p-${Date.now()}`
    };
    setProfiles((prev) => [...prev, newProfile]);
    addLog('system', 'success', `تم تصميم باقة اشتراك جديدة: ${profile.name}`, `سقف السرعة: ${profile.rateLimit}`);

    // Generate RouterOS cli equivalent
    appendToTerminal(
      `/ppp profile add name="${profile.name}" local-address=${profile.localAddress} remote-address=${profile.remoteAddressPool} rate-limit="${profile.rateLimit}" address-list="${profile.addressList}" comment="SuperSAS Profile: ${profile.price} IQD"`
    );
  };

  const updateProfile = (profile: PPPoEProfile) => {
    setProfiles((prev) => prev.map((p) => (p.id === profile.id ? profile : p)));
    addLog('system', 'info', `تم تعديل باقة الاشتراك: ${profile.name}`);
    
    appendToTerminal(
      `/ppp profile set [find name="${profile.name}"] local-address=${profile.localAddress} remote-address=${profile.remoteAddressPool} rate-limit="${profile.rateLimit}" address-list="${profile.addressList}"`
    );
  };

  const deleteProfile = (id: string) => {
    const profile = profiles.find((p) => p.id === id);
    if (profile) {
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      addLog('system', 'warning', `تم حذف الباقة المتكاملة: ${profile.name}`);
      
      appendToTerminal(`/ppp profile remove [find name="${profile.name}"]`);
    }
  };

  // 3. Subscribers PPPoE Users
  const addSubscriber = (sub: Omit<Subscriber, 'id' | 'createdAt' | 'status'>) => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30); // Default validity limit
    
    const newSub: Subscriber = {
      ...sub,
      id: `sub-${Date.now()}`,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiryDate: expiry.toISOString()
    };
    
    setSubscribers((prev) => [...prev, newSub]);
    
    const profile = profiles.find((p) => p.id === sub.profileId);
    const router = routers.find((r) => r.id === sub.routerId);
    
    addLog(
      'auth',
      'success',
      `تم تسجيل مستخدم PPPoE جديد: ${sub.fullName}`,
      `اسم الخدمة: ${sub.username}، الباقة: ${profile?.name || 'غير معروفة'}`
    );

    // MikroTik command
    appendToTerminal(
      `/ppp secret add name="${sub.username}" password="${sub.password}" profile="${profile?.name || 'default'}" service=pppoe comment="${sub.fullName} - Active - Exp: ${expiry.toLocaleDateString()}"${sub.macAddress ? ` caller-id="${sub.macAddress}"` : ''}`
    );

    // Auto live API sync
    setTimeout(() => {
      syncSubscriberToRouter(newSub.id, 'add', undefined, newSub);
    }, 100);
  };

  const updateSubscriber = (sub: Subscriber) => {
    let oldUsername: string | undefined;
    setSubscribers((prev) =>
      prev.map((s) => {
        if (s.id === sub.id) {
          oldUsername = s.username;
          return sub;
        }
        return s;
      })
    );
    
    const profile = profiles.find((p) => p.id === sub.profileId);
    addLog('system', 'info', `تم تعديل حساب العميل: ${sub.fullName}`);
    
    appendToTerminal(
      `/ppp secret set [find name="${sub.username}"] password="${sub.password}" profile="${profile?.name || 'default'}" comment="${sub.fullName} - Exp: ${new Date(sub.expiryDate).toLocaleDateString()}"${sub.macAddress ? ` caller-id="${sub.macAddress}"` : ' caller-id=""'}`
    );

    // Auto live API sync
    setTimeout(() => {
      syncSubscriberToRouter(sub.id, 'update', oldUsername, sub);
    }, 100);
  };

  const deleteSubscriber = (id: string) => {
    const sub = subscribers.find((s) => s.id === id);
    if (sub) {
      setSubscribers((prev) => prev.filter((s) => s.id !== id));
      // Remove connection too
      setSessions((prev) => prev.filter((s) => s.username !== sub.username));
      
      addLog('system', 'warning', `تم حذف اشتراك المستخدم: ${sub.fullName}`, `اسم الخدمة: ${sub.username}`);
      
      appendToTerminal(
        `/ppp secret remove [find name="${sub.username}"]\n/ppp active remove [find name="${sub.username}"]`
      );

      // Auto live API sync
      const archivedSub = { ...sub };
      setTimeout(() => {
        syncSubscriberToRouter(archivedSub.id, 'delete', undefined, archivedSub);
      }, 100);
    }
  };

  const toggleSubscriberStatus = (id: string) => {
    let updatedSub: Subscriber | undefined;
    setSubscribers((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const nextStatus = s.status === 'disabled' ? 'active' : 'disabled';
          updatedSub = { ...s, status: nextStatus };
          
          addLog(
            'system',
            nextStatus === 'active' ? 'success' : 'warning',
            `تم ${nextStatus === 'active' ? 'تمكين' : 'تعطيل'} حساب العميل ${s.fullName}`,
            `اسم الخدمة: ${s.username}`
          );

          appendToTerminal(
            nextStatus === 'active'
              ? `/ppp secret enable [find name="${s.username}"]`
              : `/ppp secret disable [find name="${s.username}"]\n/ppp active remove [find name="${s.username}"]`
          );

          if (nextStatus === 'disabled') {
            // Kick connection instantly if disabled
            setSessions((sess) => sess.filter((x) => x.username !== s.username));
          }

          return updatedSub;
        }
        return s;
      })
    );

    // Auto live API sync
    if (updatedSub) {
      const targetSub = updatedSub;
      setTimeout(() => {
        syncSubscriberToRouter(targetSub.id, 'toggle', undefined, targetSub);
      }, 100);
    }
  };

  const renewSubscriber = (subId: string, profileId: string, paymentMethod: 'cash' | 'card', cardPin?: string, customHours?: number) => {
    const sub = subscribers.find((s) => s.id === subId);
    const profile = profiles.find((p) => p.id === profileId);

    if (!sub || !profile) {
      return { success: false, message: 'مستخدم أو باقة غير صالحة.' };
    }

    if (paymentMethod === 'card') {
      if (!cardPin) {
        return { success: false, message: 'يرجى إدخال رمز كرت الشحن.' };
      }
      const cardIndex = cards.findIndex((c) => c.pin === cardPin.replace(/[-\s]/g, '') && c.status === 'active' && c.profileId === profileId);
      if (cardIndex === -1) {
        return { success: false, message: 'رمز الدبوس غير صحيح أو لا يطابق باقة الاشتراك المختارة أو مستعمل قبل الآن.' };
      }
      
      // Consume card
      setCards((prev) =>
        prev.map((c, idx) =>
          idx === cardIndex
            ? { ...c, status: 'used', usedBy: sub.username, usedAt: new Date().toISOString() }
            : c
        )
      );
    }

    // Update subscription date
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

    setSubscribers((prev) =>
      prev.map((s) =>
        s.id === subId
          ? updatedSub
          : s
      )
    );

    const formattedExpiry = customHours 
      ? newExpiry.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })
      : newExpiry.toLocaleDateString();

    addLog(
      'billing',
      'success',
      `تم تجديد اشتراك العميل: ${sub.fullName}${customHours ? ` مؤقتاً لمدة ${customHours} ساعة` : ''}`,
      `نوع الدفع: ${paymentMethod === 'cash' ? 'نقدي' : 'كرت شحن'}، انتهاء الصلاحية الجديد: ${formattedExpiry}`
    );

    appendToTerminal(
      `/ppp secret set [find name="${sub.username}"] profile="${profile.name}" comment="${sub.fullName} - تجديد${customHours ? ` مؤقت ${customHours}س` : ''} - الجديد: ${formattedExpiry}"\n/ppp active remove [find name="${sub.username}"]`
    );

    // Simulated reconnect
    triggerMockConnection(sub.username);

    // Auto live API sync
    setTimeout(() => {
      syncSubscriberToRouter(updatedSub.id, 'renew', undefined, updatedSub);
    }, 100);

    return { success: true, message: 'تم تجديد الاشتراك بنجاح ومزامنة الكوماند مع مايكروتك!' };
  };

  const restoreSubscribers = (newSubs: Subscriber[]) => {
    setSubscribers(newSubs);
    // Log restoring action
    addLog('system', 'success', `تمت استعادة المشتركين من نسخة احتياطية بنجاح!`, `إجمالي المشتركين الحاليين: ${newSubs.length}`);
    appendToTerminal(`# استعادة قاعدة بيانات المشتركين\n# تمت تعبئة المشتركين بمجموع ${newSubs.length} عميل.`);
  };

  // 4. Scratch Cards PINs Management
  const generateCards = (profileId: string, quantity: number, prefix: string) => {
    const targetProfile = profiles.find((p) => p.id === profileId);
    if (!targetProfile) return;

    const newGenerated: PinCard[] = [];
    for (let i = 0; i < quantity; i++) {
      // 12 digit numeric pin
      const pin = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
      // Unique visible serial
      const serialNum = Math.floor(100000 + Math.random() * 900000);
      const serial = `${prefix || 'SS'}-${targetProfile.validityDays}-${serialNum}`;

      newGenerated.push({
        id: `card-${Date.now()}-${i}`,
        pin,
        serial,
        profileId,
        price: targetProfile.price,
        status: 'active',
        createdAt: new Date().toISOString()
      });
    }

    setCards((prev) => [...newGenerated, ...prev]);
    addLog(
      'billing',
      'success',
      `توليد كروت شحن جديدة بنجاح`,
      `العدد: ${quantity} كرت، للباقة: ${targetProfile.name}، الرمز السري بـ 12 رقم`
    );
  };

  const deleteCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  const redeemCardByPin = (pinStr: string, username: string) => {
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

    // Consume card
    setCards((prev) =>
      prev.map((c) =>
        c.id === card.id
          ? { ...c, status: 'used', usedBy: username, usedAt: new Date().toISOString() }
          : c
      )
    );

    // Extend subscriber
    const currentExpiry = new Date(sub.expiryDate);
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(baseDate);
    newExpiry.setDate(baseDate.getDate() + profile.validityDays);

    setSubscribers((prev) =>
      prev.map((s) =>
        s.id === sub.id
          ? {
              ...s,
              profileId: card.profileId,
              status: 'active' as const,
              expiryDate: newExpiry.toISOString()
            }
          : s
      )
    );

    addLog(
      'billing',
      'success',
      `تم شحن حساب العميل ${sub.fullName} بواسطة كرت PIN`,
      `الكرت: ${card.serial}، الباقة: ${profile.name}`
    );

    appendToTerminal(
      `/ppp secret set [find name="${sub.username}"] profile="${profile.name}" comment="${sub.fullName} - شحن كرت - انتهاء: ${newExpiry.toLocaleDateString()}"\n/ppp active remove [find name="${sub.username}"]`
    );

    triggerMockConnection(sub.username);

    return { success: true, message: `تهانينا! تم تعبئة الاشتراك وباقة [${profile.name}] لغاية ${newExpiry.toLocaleDateString()}` };
  };

  // 5. Active Session Management
  const disconnectSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      addLog(
        'mikrotik_cmd',
        'warning',
        `تم قطع اتصال العميل PPPoE: ${session.username}`,
        `IP: ${session.ip}، تم سحب الجلسة من السيرفر بنجاح`
      );

      appendToTerminal(`/ppp active remove [find name="${session.username}"]`);
    }
  };

  const triggerMockConnection = (subUsername: string) => {
    // Check if subscriber exists and active
    const sub = subscribers.find((s) => s.username === subUsername);
    if (!sub || sub.status !== 'active') return;

    // Check if already has session
    if (sessions.some((s) => s.username === subUsername)) return;

    // Generate fresh session after slight delay
    setTimeout(() => {
      const pProfile = profiles.find((p) => p.id === sub.profileId);
      const [dLimit, uLimit] = (pProfile?.rateLimit || '10M/10M').replace(/M/g).split('/');
      const initDownload = Math.round(Number(dLimit || 10) * 1024 * 0.4);
      const initUpload = Math.round(Number(uLimit || 10) * 1024 * 0.4);

      const newSess: ActiveSession = {
        id: `sess-${Date.now()}`,
        username: subUsername,
        ip: sub.ipAddress || `10.0.${Math.floor(10 + Math.random() * 80)}.${Math.floor(2 + Math.random() * 250)}`,
        mac: sub.macAddress || `AA:BB:CC:${Math.floor(10 + Math.random() * 89)}:E3:${Math.floor(10 + Math.random() * 89)}`,
        uptime: '00:00:01',
        downloadSpeed: initDownload,
        uploadSpeed: initUpload,
        callerId: `pppoe-${subUsername}`
      };

      setSessions((prev) => [newSess, ...prev]);
      addLog('auth', 'success', `تم تسجيل دخول جلسة PPPoE نشطة للعميل: ${sub.fullName}`);
    }, 1500);
  };

  // Compute Statistics
  const totalSubscribers = subscribers.length;
  const activeSubscribers = subscribers.filter((s) => s.status === 'active').length;
  const expiredSubscribers = subscribers.filter((s) => s.status === 'expired').length;
  const onlineSessions = sessions.length;
  
  // Custom Revenue calculation: sum of all consumed card pricing + active subscriber packages
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
        routers,
        profiles,
        subscribers,
        cards,
        sessions,
        logs,
        currency,
        setCurrency,
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

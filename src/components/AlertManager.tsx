import React, { useState, useEffect } from 'react';
import { useSystem } from '../context/SystemContext';
import { SystemAlert, Router, Subscriber } from '../types';
import { 
  Bell, 
  Send, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Settings, 
  ShieldAlert, 
  Play, 
  RefreshCw, 
  Trash2, 
  Eye, 
  EyeOff, 
  Check, 
  Plus, 
  BellRing, 
  Server, 
  Info, 
  Flame 
} from 'lucide-react';

export function AlertManager() {
  const { 
    routers, 
    subscribers, 
    updateRouter, 
    updateSubscriber, 
    addLog,
    profiles
  } = useSystem();

  // Telegram Config state (persisted in localStorage)
  const [telegramConfig, setTelegramConfig] = useState(() => {
    const saved = localStorage.getItem('supersas_telegram_config');
    if (saved) return JSON.parse(saved);
    return {
      botToken: '',
      chatId: '',
      enabledTriggers: {
        expiryWarning: true,
        failedPayment: true,
        deviceOffline: true,
        deviceOnline: true
      }
    };
  });

  // Alerts list state (persisted in localStorage)
  const [alerts, setAlerts] = useState<SystemAlert[]>(() => {
    const saved = localStorage.getItem('supersas_alerts');
    if (saved) return JSON.parse(saved);

    // Initial default alerts for placeholder demo data
    return [
      {
        id: 'alert-1',
        type: 'device_offline',
        title: 'انقطاع اتصال خادم مايكروتك',
        message: 'الخادم: RB-3011 (الفرع الجنوبي) لم يستجب لنداءات الفحص الآلي (OFFLINE). يرجى فحص الطاقة أو خط الإدخال.',
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString(), // 3 hours ago
        sentToTelegram: false,
        status: 'unread'
      },
      {
        id: 'alert-2',
        type: 'failed_payment',
        title: 'محاولة شحن فاشلة برمز PIN',
        message: 'حاول العميل مقتدى حميد (m_hameed) شحن حسابه برمز كرت منتهي أو غير صالح: "90412841285". تم حظر المحاولة بعد التكرار الرابع لضمان الأمان.',
        timestamp: new Date(Date.now() - 3600000 * 8).toISOString(), // 8 hours ago
        sentToTelegram: false,
        status: 'resolved'
      }
    ];
  });

  const [showToken, setShowToken] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('supersas_telegram_config', JSON.stringify(telegramConfig));
  }, [telegramConfig]);

  useEffect(() => {
    localStorage.setItem('supersas_alerts', JSON.stringify(alerts));
  }, [alerts]);

  // Handle send Telegram API post fetch
  const sendTelegramMessage = async (messageText: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!telegramConfig.botToken || !telegramConfig.chatId) {
        return { success: false, error: 'لم يتم إعداد Token أو Chat ID للـ Bot' };
      }

      const response = await fetch('/api/alerts/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botToken: telegramConfig.botToken,
          chatId: telegramConfig.chatId,
          message: messageText
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || data.details || 'فشل التوصيل بالتلغرام' };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  };

  // Test connection function
  const handleTestConnection = async () => {
    setTestLoading(true);
    setTestStatus(null);

    const testMsg = `🔔 <b>فحص اتصال لوحة SuperSAS 4</b>\n\n✅ تم إعداد الاتصال بنجاح مع روبوت التنبيهات.\nالحالة السيرفرية: 🟢 متصل وبأفضل أداء.\nالوقت الحالي: <code>${new Date().toLocaleString('ar-IQ')}</code>\n\n<i>هذه الرسالة تؤكد جاهزية نظام المراقبة الفورية لتوجيه إنذارات الفصل والاتصال ومرمى تعبئة الكروت آلياً.</i>`;

    const res = await sendTelegramMessage(testMsg);
    setTestLoading(false);
    
    if (res.success) {
      setTestStatus({ success: true, message: 'تم إرسال رسالة فحص بنجاح إلى قناتك أو حسابك المباشر في تلغرام!' });
      addLog('system', 'success', 'اختبار اتصال التنبيهات بـ Telegram ناجح', 'تم توجيه رسالة اختبار بنجاح.');
    } else {
      setTestStatus({ success: false, message: res.error || 'حدث خطأ غير معروف.' });
      addLog('system', 'error', 'فشل اختبار اتصال التنبيهات بـ Telegram', res.error);
    }
  };

  // Create alert and option to push to telegram
  const createAlert = async (
    type: SystemAlert['type'], 
    title: string, 
    message: string,
    rawTextForTelegram: string
  ) => {
    const isTriggerEnabled = 
      (type === 'expiration_warning' && telegramConfig.enabledTriggers.expiryWarning) ||
      (type === 'failed_payment' && telegramConfig.enabledTriggers.failedPayment) ||
      (type === 'device_offline' && telegramConfig.enabledTriggers.deviceOffline) ||
      (type === 'device_online' && telegramConfig.enabledTriggers.deviceOnline);

    let sentToTelegram = false;

    if (isTriggerEnabled && telegramConfig.botToken && telegramConfig.chatId) {
      const res = await sendTelegramMessage(rawTextForTelegram);
      sentToTelegram = res.success;
    }

    const newAlert: SystemAlert = {
      id: `alert-${Date.now()}`,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      sentToTelegram,
      status: 'unread'
    };

    setAlerts((prev) => [newAlert, ...prev]);
  };

  // 1. Run immediate Network Subscription Scan
  const handleScanSubscribersAndDevices = async () => {
    setScanning(true);
    setScanResult(null);

    // Simulate crawl latency
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let detectedAlertsCount = 0;
    const now = new Date();

    // Scan expirations: Find users whose expiry is in less than 7 days, and are active
    const expiringUsers = subscribers.filter((sub) => {
      if (sub.status !== 'active') return false;
      const expiry = new Date(sub.expiryDate);
      const diffTime = expiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= 7;
    });

    for (const sub of expiringUsers) {
      const expiry = new Date(sub.expiryDate);
      const diffDays = Math.max(1, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Check if alert already exists recently to avoid spam
      const alreadyAlerted = alerts.some(
        (a) => a.type === 'expiration_warning' && a.message.includes(sub.username) && (now.getTime() - new Date(a.timestamp).getTime() < 3600000 * 24) // within 24 hours
      );

      if (!alreadyAlerted) {
        const profile = profiles.find((p) => p.id === sub.profileId);
        const alertTitle = `قرب انتهاء اشتراك: ${sub.fullName}`;
        const alertMessage = `باقي ${diffDays} أيام فقط على انتهاء صلاحية اشتراك العميل (${sub.fullName}) باسم يوزر (${sub.username}). الباقة: ${profile?.name || 'غير معروفة'}. سيتم فصل العميل تلقائياً بتاريخ ${new Date(sub.expiryDate).toLocaleDateString('ar-IQ')}.`;

        const telegramText = `⚠️ <b>تنبيه قرب انتهاء الاشتراك (لوحة SuperSAS)</b>\n\n👤 العميل: <b>${sub.fullName}</b>\n🔑 اسم اليوزر: <code>${sub.username}</code>\n📦 باقة السرعة: <b>${profile?.name || 'الافتراضية'}</b>\n📅 تاريخ انتهائه: <b>${new Date(sub.expiryDate).toLocaleDateString('ar-IQ')}</b>\n⏱️ الوقت المتبقي: 🔴 <b>${diffDays} أيام فقط</b>\n\n<i>يرجى تنبيه العميل بضرورة التعبئة قبل هذا التاريخ لتجنب انقطاع الخدمة المؤقت.</i>`;

        await createAlert('expiration_warning', alertTitle, alertMessage, telegramText);
        addLog('billing', 'warning', `كشف قرب انتهاء اشتراك العميل: ${sub.fullName}`, `يوزر: ${sub.username}، متبقي: ${diffDays} يوم/أيام`);
        detectedAlertsCount++;
      }
    }

    // Scan router statuses
    const offlineRouters = routers.filter((r) => r.status === 'offline');
    for (const r of offlineRouters) {
      const alreadyAlerted = alerts.some(
        (a) => a.type === 'device_offline' && a.message.includes(r.name) && (now.getTime() - new Date(a.timestamp).getTime() < 3600000 * 4) // within 4 hours
      );

      if (!alreadyAlerted) {
        const title = `انقطاع اتصال سيرفر المايكروتك: ${r.name}`;
        const message = `الخادم الموثق (${r.name}) تحت المعرف IP: ${r.ip} خارج الخدمة تماماً (OFFLINE). محاولة الاتصال بـ API-SSL فشلت عبر المنفذ ${r.apiPort}.`;
        
        const telegramText = `🚨 <b>انقطاع اتصال خادم مايكروتك (SuperSAS)</b>\n\n🖥️ اسم الخادم: <b>${r.name}</b>\n🌐 عنوان الآي بي: <code>${r.ip}</code>\n🔌 المنفذ المستهدف: <code>${r.apiPort}</code>\n📊 الحالة: 🔴 <b>سقوط الاتصال/خارج التغطية</b>\n\n<i>يرجى معالجة العارض فوراً وإعادة تشغيل الجهاز أو تفقد شبكة الربط لعودة تأمين الكروت والجلسات.</i>`;

        await createAlert('device_offline', title, message, telegramText);
        addLog('system', 'error', `انقطاع اتصال السيرفر المكتشف: ${r.name}`, `IP: ${r.ip}`);
        detectedAlertsCount++;
      }
    }

    setScanning(false);
    if (detectedAlertsCount > 0) {
      setScanResult(`تم إنهاء الفحص بنجاح. تم رصد وتسجيل ${detectedAlertsCount} تنبيهات/مخاطر جديدة وإرسالها إلى قنوات التلغرام المهيئة!`);
    } else {
      setScanResult('تم الفحص بنجاح. لا توجد تنبيهات جديدة لم يتم تسجيلها مسبقاً (جميع الاشتراكات والسلفرات تعمل بشكل مستقر!).');
    }
  };

  // 2. Simulation Sandbox Handlers
  const handleSimulateDeviceOffline = async () => {
    if (routers.length === 0) return;
    const target = routers[0];
    
    // Set status to offline
    const updated: Router = { ...target, status: 'offline' };
    updateRouter(updated);

    const title = `سقوط اتصال خادم مايكروتك: ${target.name}`;
    const message = `سجل نظام المراقبة الفنية انقطاعاً مفاجئاً لخط الربط مع سيرفر ${target.name} (IP: ${target.ip}). توقف تمرير تفويق جلسات PPPoE بالكامل على هذا الخادم.`;
    
    const telegramText = `🚨 <b>تنبيه حرج: سقوط خادم مايكروتك</b>\n\n🖥️ الخادم: <b>${target.name}</b>\n🌐 العنوان: <code>${target.ip}</code>\n🔌 المنفذ: <code>${target.apiPort}</code>\n📊 الحالة: 🔴 <b>OFFLINE (غير متصل)</b>\n📅 تاريخ العارض: <b>${new Date().toLocaleString('ar-IQ')}</b>\n\n<i>تحذير: لا يمكن للعملاء تسجيل الدخول حالياً عبر هذا السيرفر حتى إصلاح المشكلة وتحديث المسار.</i>`;

    await createAlert('device_offline', title, message, telegramText);
    addLog('system', 'error', `محاكاة: سقوط سيرفر مايكروتك ${target.name}`, `IP: ${target.ip}`);
  };

  const handleSimulateDeviceOnline = async () => {
    if (routers.length === 0) return;
    const target = routers[0];
    
    // Set status to online
    const updated: Router = { ...target, status: 'online' };
    updateRouter(updated);

    const title = `استعادة اتصال سيرفر مايكروتك: ${target.name}`;
    const message = `تم استعادة الاتصال مع السيرفر الرئيسي ${target.name} (IP: ${target.ip}) بنجاح. زالت مؤشرات الانقطاع واستجابت خدمات الـ API وتأمين حزم التجديد.`;
    
    const telegramText = `✅ <b>استئناف عمل خادم مايكروتك بنجاح</b>\n\n🖥️ الخادم: <b>${target.name}</b>\n🌐 العنوان: <code>${target.ip}</code>\n📊 الحالة: 🟢 <b>ONLINE (متصل حالياً)</b>\n⏱️ الاستجابة: <code>14ms</code>\n\n<i>تمت استعادة كافة صلاحيات المزامنة وتصفح العملاء وربط الجلسات اللحظية.</i>`;

    await createAlert('device_online', title, message, telegramText);
    addLog('system', 'success', `محاكاة: استعادة اتصال سيرفر مايكروتك ${target.name}`, `IP: ${target.ip}`);
  };

  const handleSimulateFailedPayment = async () => {
    const title = `فشل عملية تفعيل اشتراك للعميل (سيف العبيدي)`;
    const message = `تنبيه: محاولة تجديد كرت PIN فاشلة متكررة للعميل سيف العبيدي (saif_ob) بسبب استخدام رمز تعبئة منتهي الصلاحية أو خاضع للتلف: "8204-1294-1184".`;
    
    const telegramText = `❌ <b>فشل عملية دفع وتفعيل اشتراك (SuperSAS)</b>\n\n👤 اسم العميل: <b>سيف العبيدي</b>\n🔑 اسم اليوزر: <code>saif_ob</code>\n💳 الرمز الخاطئ: <code>820412941184</code>\n⚠️ السبب: <b>مدرج تحت الكشوفات كرمز PIN منتهي أو مستعمل مسبقاً</b>\n\n<i>يرجى مراجعة عمليات الشحن اليدوي لمقاومة محاولات الهندسة الاجتماعية.</i>`;

    await createAlert('failed_payment', title, message, telegramText);
    addLog('billing', 'error', 'محاكاة: فشل تفعيل كرت شحن PIN لليوزر saif_ob', 'تكرار خاطئ للكود.');
  };

  const handleSimulateSubscriptionExpiring = async () => {
    if (subscribers.length === 0) return;
    // Let's grab the first active subscriber, mutate their expiryDate to 6 days remaining
    const sub = subscribers[0];
    const shortExpiry = new Date();
    shortExpiry.setDate(shortExpiry.getDate() + 6); // Exactly 6 days remaining

    const updated: Subscriber = {
      ...sub,
      expiryDate: shortExpiry.toISOString()
    };
    updateSubscriber(updated);

    const title = `قرب انتهاء اشتراك العميل: ${sub.fullName}`;
    const message = `باقي 6 أيام فقط على تجديد اشتراك العميل المباشر ${sub.fullName} (يوزر: ${sub.username}). تاريخ الانتهاء المجدول لقطع الخدمة هو ${shortExpiry.toLocaleDateString('ar-IQ')}.`;
    
    const telegramText = `⚠️ <b>تنبيه قرب انتهاء الاشتراك (محاكاة)</b>\n\n👤 اسم المشترك: <b>${sub.fullName}</b>\n🔑 يوزر الـ PPPoE: <code>${sub.username}</code>\n📅 تاريخ الانتهاء: <b>${shortExpiry.toLocaleDateString('ar-IQ')}</b>\n⏱️ المتبقي: 🔴 <b>6 أيام فقط</b>\n\n<i>تم إدراج التنبيه وجاري صياغة رسالة تحذير تظهر في صفحة التصفح الخاصة بالعميل.</i>`;

    await createAlert('expiration_warning', title, message, telegramText);
    addLog('billing', 'warning', `محاكاة: اشتراك عميل يوشك على الانتهاء: ${sub.fullName}`, `يوزر: ${sub.username} متبقي 6 أيام.`);
  };

  // Actions on Alerts
  const markAlertResolved = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'resolved' as const } : a))
    );
  };

  const deleteAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const resendAlertToTelegram = async (alertItem: SystemAlert) => {
    let rawText = '';
    if (alertItem.type === 'device_offline') {
      rawText = `🚨 <b>إعادة توجيه تنبيه: سقوط خادم مايكروتك</b>\n\n📟 التنبيه: ${alertItem.title}\n📝 التفاصيل: ${alertItem.message}\n⏲️ الزمن الأصلي: ${new Date(alertItem.timestamp).toLocaleString('ar-IQ')}`;
    } else if (alertItem.type === 'failed_payment') {
      rawText = `❌ <b>إعادة توجيه تنبيه: فشل عملية الدفع</b>\n\n📟 التنبيه: ${alertItem.title}\n📝 التفاصيل: ${alertItem.message}\n⏲️ الزمن الأصلي: ${new Date(alertItem.timestamp).toLocaleString('ar-IQ')}`;
    } else {
      rawText = `⚠️ <b>إعادة توجيه تنبيه: قرب انتهاء اشتراك عميل</b>\n\n📟 التنبيه: ${alertItem.title}\n📝 التفاصيل: ${alertItem.message}\n⏲️ الزمن الأصلي: ${new Date(alertItem.timestamp).toLocaleString('ar-IQ')}`;
    }

    const res = await sendTelegramMessage(rawText);
    if (res.success) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertItem.id ? { ...a, sentToTelegram: true } : a))
      );
      addLog('system', 'success', 'إعادة إرسال التنبيه لـ Telegram بنجاح', `تنبيه: ${alertItem.title}`);
    } else {
      addLog('system', 'error', 'فشل إعادة إرسال التنبيه لـ Telegram', res.error);
      window.alert('فشل الإرسال: ' + res.error);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Title Header Card */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-sans flex items-center gap-2">
            <span className="p-1 px-2.5 bg-red-50 text-red-500 rounded-lg text-xs font-mono">LIVE</span>
            نظام المراقبة وتنبيهات Telegram الفورية
          </h2>
          <p className="text-xs text-slate-500 mt-1">ضبط فحص ملقمات المايكروتك، مراقبة صلاحيات المشتركين، وإشعار الوكلاء فورياً عبر روبوت Telegram (Bot API).</p>
        </div>
        <button
          onClick={handleScanSubscribersAndDevices}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md shadow-slate-900/10 disabled:opacity-55"
        >
          <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'جاري الفحص المباشر...' : 'فحص فوري للاشتراكات والشبكة'}
        </button>
      </div>

      {scanResult && (
        <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800 leading-relaxed">
            <p className="font-bold">نتائج الفحص التلقائي الأخير:</p>
            <p className="mt-1">{scanResult}</p>
          </div>
        </div>
      )}

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Right side (60% width on large screens): Active Alerts Monitoring & Feed */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Quick Alert Counters */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-[10px] font-bold block mb-1">الإنذارات الحرجة</span>
                <span className="text-xl font-black text-rose-600 font-mono">
                  {alerts.filter(a => a.type === 'device_offline' && a.status === 'unread').length}
                </span>
              </div>
              <div className="p-2 bg-rose-50 text-rose-500 rounded-lg">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-[10px] font-bold block mb-1">تنبيهات الصلاحية</span>
                <span className="text-xl font-black text-amber-500 font-mono">
                  {alerts.filter(a => a.type === 'expiration_warning' && a.status === 'unread').length}
                </span>
              </div>
              <div className="p-2 bg-amber-50 text-amber-500 rounded-lg">
                <BellRing className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-[10px] font-bold block mb-1">التنبيهات المحلولة</span>
                <span className="text-xl font-black text-emerald-600 font-mono">
                  {alerts.filter(a => a.status === 'resolved').length}
                </span>
              </div>
              <div className="p-2 bg-emerald-50 text-emerald-500 rounded-lg">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Sandbox & Simulation Center */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-sans">
                <Flame className="w-4.5 h-4.5 text-orange-500 animate-pulse快速" />
                صندوق محاكاة الأخطاء واختبار البوت (Alert Sandbox)
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">بما أن الأجهزة الفعلية مستقرة حالياً، استخدم هذه الأزرار التفاعلية لمحاكاة وتوليد الأحداث الحرجة للتأكد من وصول إشعارات التلغرام لشبكتك فوراً:</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Simulate Device Offline */}
              <button
                onClick={handleSimulateDeviceOffline}
                className="flex items-center justify-between p-3 bg-rose-50/50 hover:bg-rose-50 border border-rose-200/50 hover:border-rose-300 rounded-lg text-right group transition-all cursor-pointer"
              >
                <div className="space-y-0.5">
                  <span className="block text-xs font-bold text-rose-800">محاكاة سقوط سيرفر</span>
                  <span className="block text-[10px] text-rose-600">تحويل مايكروتك لـ offline وإرساله</span>
                </div>
                <Play className="w-3.5 h-3.5 text-rose-500 group-hover:translate-x-[-2px] transition-transform" />
              </button>

              {/* Simulate Device Recovery */}
              <button
                onClick={handleSimulateDeviceOnline}
                className="flex items-center justify-between p-3 bg-emerald-55/40 hover:bg-emerald-50 border border-emerald-200/50 hover:border-emerald-300 rounded-lg text-right group transition-all cursor-pointer"
              >
                <div className="space-y-0.5">
                  <span className="block text-xs font-bold text-emerald-800">محاكاة عودة السيرفر للعمل</span>
                  <span className="block text-[10px] text-emerald-600">تنبيه عودة اتصال مايكروتك آلياً</span>
                </div>
                <Play className="w-3.5 h-3.5 text-emerald-500 group-hover:translate-x-[-2px] transition-transform" />
              </button>

              {/* Simulate Failed Voucher Scratch */}
              <button
                onClick={handleSimulateFailedPayment}
                className="flex items-center justify-between p-3 bg-purple-50/40 hover:bg-purple-50 border border-purple-200/50 hover:border-purple-300 rounded-lg text-right group transition-all cursor-pointer"
              >
                <div className="space-y-0.5">
                  <span className="block text-xs font-bold text-purple-800">محاكاة محاولة شحن كود خاطئ</span>
                  <span className="block text-[10px] text-purple-600">إنتاج تنبيه كروت فاشل وإشعار البوت</span>
                </div>
                <Play className="w-3.5 h-3.5 text-purple-500 group-hover:translate-x-[-2px] transition-transform" />
              </button>

              {/* Simulate approaching expiry */}
              <button
                onClick={handleSimulateSubscriptionExpiring}
                className="flex items-center justify-between p-3 bg-amber-50/40 hover:bg-amber-50 border border-amber-200/50 hover:border-amber-300 rounded-lg text-right group transition-all cursor-pointer"
              >
                <div className="space-y-0.5">
                  <span className="block text-xs font-bold text-amber-800">محاكاة اشتراك متبقي 6 أيام</span>
                  <span className="block text-[10px] text-amber-600">تعديل حساب العميل وكشفه تلقائياً</span>
                </div>
                <Play className="w-3.5 h-3.5 text-amber-500 group-hover:translate-x-[-2px] transition-transform" />
              </button>
            </div>
          </div>

          {/* Active Alerts List */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center bg-slate-50/60 p-2.5 rounded-lg">
              <h3 className="text-xs font-bold text-slate-800">سجل التنبيهات والإنذارات الحالية</h3>
              <span className="text-[10px] text-slate-500 font-mono">آخر التحديثات</span>
            </div>

            {alerts.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Bell className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-sans mt-2">لا توجد تنبيهات نشطة حالياً. الشبكة تعمل بكفاءة 100%! <br />يمكنك تشغيل إحدى المحاكيات في الأعلى لتجربة البث.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto">
                {alerts.map((item) => {
                  let borderClass = 'border-slate-200 bg-white';
                  let iconElement = <Info className="w-4.5 h-4.5 text-blue-500" />;
                  let typeText = 'معلومة';

                  if (item.type === 'device_offline') {
                    borderClass = 'border-rose-100 bg-rose-50/10 hover:bg-rose-50/25';
                    iconElement = <XCircle className="w-4.5 h-4.5 text-rose-500 animate-pulse" />;
                    typeText = 'حرج - انقطاع خادم';
                  } else if (item.type === 'failed_payment') {
                    borderClass = 'border-red-100 bg-red-50/5 hover:bg-red-50/15';
                    iconElement = <AlertTriangle className="w-4.5 h-4.5 text-red-500" />;
                    typeText = 'تهديد - فشل دفع';
                  } else if (item.type === 'expiration_warning') {
                    borderClass = 'border-amber-100 bg-amber-50/10 hover:bg-amber-50/20';
                    iconElement = <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />;
                    typeText = 'إنذار - صلاحية العميل';
                  } else if (item.type === 'device_online') {
                    borderClass = 'border-emerald-100 bg-emerald-50/10 hover:bg-emerald-50/20';
                    iconElement = <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />;
                    typeText = 'استعادة - تعافي الاتصال';
                  }

                  if (item.status === 'resolved') {
                    borderClass = 'border-slate-100 bg-slate-50/30 opacity-75';
                  }

                  return (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-xl border ${borderClass} transition-colors flex gap-3 text-right`}
                    >
                      <div className="shrink-0 mt-0.5">{iconElement}</div>
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block tracking-tight">{typeText}</span>
                            <h4 className="text-xs font-bold text-slate-800 leading-tight mt-0.5">{item.title}</h4>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(item.timestamp).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed font-sans pt-1">
                          {item.message}
                        </p>

                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 mt-2 flex-wrap gap-2 text-[10px]">
                          <div className="flex items-center gap-1.5 font-sans">
                            {item.sentToTelegram ? (
                              <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <Send className="w-2.5 h-2.5" />
                                مرسل لتلغرام بنجاح
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                غير مرسل لتلغرام
                              </span>
                            )}

                            {item.status === 'resolved' && (
                              <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                <Check className="w-2.5 h-2.5" />
                                تم الحل
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {item.status === 'unread' && (
                              <button
                                onClick={() => markAlertResolved(item.id)}
                                className="px-2 py-0.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100/80 rounded-sm font-semibold transition-colors cursor-pointer"
                              >
                                تحديد كمقروء/تم الحل
                              </button>
                            )}
                            <button
                              onClick={() => resendAlertToTelegram(item)}
                              className="px-2 py-0.5 text-blue-600 bg-blue-50 hover:bg-blue-100/80 rounded-sm font-semibold transition-colors cursor-pointer"
                            >
                              إعادة توجيه للبوت 🔄
                            </button>
                            <button
                              onClick={() => deleteAlert(item.id)}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
        </div>

        {/* Left side (40% width on large screens): Bot configuration & Instructions */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Telegram Settings form */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 font-sans">
              <Settings className="w-4 h-4 text-blue-600" />
              إعدادات بوت التلغرام (Telegram API Settings)
            </h3>

            <div className="space-y-4 pt-1">
              {/* Bot token */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">رابط توكن البوت (Telegram Bot Token)</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    placeholder="مثل: 5821034105:AAF39u..."
                    value={telegramConfig.botToken}
                    onChange={(e) => setTelegramConfig({ ...telegramConfig, botToken: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-10 text-xs font-mono text-left focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute left-3 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Chat ID */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">معرف المحادثة أو القناة (Telegram Chat ID)</label>
                <input
                  type="text"
                  placeholder="رقم المعرف المباشر مثل: -1001593410"
                  value={telegramConfig.chatId}
                  onChange={(e) => setTelegramConfig({ ...telegramConfig, chatId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-mono text-left focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-hidden"
                />
              </div>

              {/* Active Triggers checklist */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <span className="block text-xs font-bold text-slate-800 mb-1">الإنذارات التي يتم إشراكها تلقائياً بالتلغرام:</span>
                
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2 text-slate-600 hover:text-slate-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={telegramConfig.enabledTriggers.expiryWarning}
                      onChange={(e) => setTelegramConfig({
                        ...telegramConfig,
                        enabledTriggers: { ...telegramConfig.enabledTriggers, expiryWarning: e.target.checked }
                      })}
                      className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500/30"
                    />
                    <span>إنذار قرب انتهاء صلاحيات العملاء (متبقي &lt;= 7 أيام)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-600 hover:text-slate-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={telegramConfig.enabledTriggers.failedPayment}
                      onChange={(e) => setTelegramConfig({
                        ...telegramConfig,
                        enabledTriggers: { ...telegramConfig.enabledTriggers, failedPayment: e.target.checked }
                      })}
                      className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500/30"
                    />
                    <span>محاولات التفعيل الفاشلة (مثال: محاولات كروت PIN المنتهية)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-600 hover:text-slate-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={telegramConfig.enabledTriggers.deviceOffline}
                      onChange={(e) => setTelegramConfig({
                        ...telegramConfig,
                        enabledTriggers: { ...telegramConfig.enabledTriggers, deviceOffline: e.target.checked }
                      })}
                      className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500/30"
                    />
                    <span>إنذار حرج عند خروج مخدم مايكروتك عن الخدمة (Offline)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-600 hover:text-slate-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={telegramConfig.enabledTriggers.deviceOnline}
                      onChange={(e) => setTelegramConfig({
                        ...telegramConfig,
                        enabledTriggers: { ...telegramConfig.enabledTriggers, deviceOnline: e.target.checked }
                      })}
                      className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500/30"
                    />
                    <span>إشعار بالتعافي وعودة خادم مايكروتك للعمل (Online)</span>
                  </label>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testLoading || !telegramConfig.botToken || !telegramConfig.chatId}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/10"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testLoading ? 'جاري الفحص المباشر...' : 'إرسال رسالة اختبار للبوت'}
                </button>
              </div>

              {testStatus && (
                <div className={`p-3 rounded-lg text-xs leading-relaxed ${testStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {testStatus.success ? (
                    <p className="flex items-center gap-1.5 font-bold">
                      <span>🟢</span> {testStatus.message}
                    </p>
                  ) : (
                    <div>
                      <p className="font-bold">🔴 فشل الاختبار العابر للشبكة:</p>
                      <p className="mt-1 opacity-90">{testStatus.message}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Setup Tutorial */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5 font-sans">
              <span className="p-1 bg-amber-100 text-amber-800 rounded-md">💡</span>
              دليل التلغرام السريع: كيف تبدأ في دقيقة واحده؟
            </h4>
            
            <div className="text-xs text-amber-800 space-y-2 leading-relaxed font-sans">
              <p>لتلقي الإنذارات الحرجة لشبكتك على التلغرام، اتبع هذه الخطوات البسيطة:</p>
              
              <ol className="list-decimal list-inside space-y-1.5 font-medium">
                <li>
                  ابحث في تطبيق تلغرام عن البوت الرسمي <b>@BotFather</b> وفعل المحادثة معه بالضغط على <code className="bg-amber-100/70 px-1 py-0.5 rounded text-amber-900">/start</code>.
                </li>
                <li>
                  اكتب له الأمر <code className="bg-amber-100/70 px-1 py-0.5 rounded text-amber-900">/newbot</code> ثم أدخل إسماً للبوت ويوزراً ينتهي بـ <code className="font-mono">_bot</code>.
                </li>
                <li>
                  انسخ توكن البوت (Bot Token) الذي يبدأ بأرقام وضعه في حقل الدبوس بالأعلى.
                </li>
                <li>
                  للحصول على معرفك (Chat ID)، ابحث عن البوت <b>@userinfobot</b> واضغط له <code className="bg-amber-100/70 px-1 py-0.5 rounded text-amber-900">/start</code>، وسيرسل لك رقم الآيدي الخاص بك فوراً لتبدأ الاستماع.
                </li>
              </ol>

              <div className="bg-amber-100/50 p-2 text-[10px] rounded-lg border border-amber-202 italic mt-1 font-sans">
                <b>ملاحظة للغرف الجماعية:</b> إذا أردت استلام إشعارات المخدم مع وكلائك في مجموعة مشتركة، فقط أضف البوت المنشأ كعضو مشرف في مجموعتكم، وضع Chat ID المجموعة (والذي يبدأ غالباً بـ <code className="font-mono">-100</code>) في خانة المعرف باليسار.
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

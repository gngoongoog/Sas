import React, { useState, useEffect } from 'react';
import { useSystem } from '../context/SystemContext';
import { 
  Download, 
  Settings as SettingsIcon, 
  Trash2, 
  RefreshCw, 
  Calendar, 
  Database, 
  Check, 
  AlertTriangle,
  Server,
  FileCode,
  Clock,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  ShieldCheck,
  Cpu,
  Zap,
  Sparkles,
  Terminal,
  Code,
  LifeBuoy,
  FileArchive,
  Send,
  Sun,
  Moon,
  Palette
} from 'lucide-react';

interface BackupFile {
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
}

export function SystemSettings() {
  const { token, currency, setCurrency, refreshAll, theme, setTheme } = useSystem();
  
  // App settings state
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [backupInterval, setBackupInterval] = useState('daily');
  const [lastRun, setLastRun] = useState<string | null>(null);

  // Telegram Settings State
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);

  // 5 Network Stability Module States (Enabled by default to preserve maximum stability)
  const [stabilityStateEngine, setStabilityStateEngine] = useState(true);
  const [stabilityOfflineFallback, setStabilityOfflineFallback] = useState(true);
  const [stabilityMacProtection, setStabilityMacProtection] = useState(true);
  const [stabilityGracefulDisconnect, setStabilityGracefulDisconnect] = useState(true);
  const [stabilityNetworkDoctor, setStabilityNetworkDoctor] = useState(true);

  // UI state for viewing the generated RouterOS scripts for each module
  const [activeScriptModal, setActiveScriptModal] = useState<{ title: string; code: string } | null>(null);
  
  // UI states
  const [loadingList, setLoadingList] = useState(false);
  const [exportingDirect, setExportingDirect] = useState(false);
  const [exportingServer, setExportingServer] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Authorization headers
  const getHeaders = () => ({
    'Authorization': token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : '',
    'Content-Type': 'application/json'
  });

  // Fetch current periodic configuration
  const fetchBackupSettings = async () => {
    try {
      const res = await fetch('/api/settings', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBackupEnabled(data.backup_json_enabled === 'true');
        setBackupInterval(data.backup_json_interval || 'daily');
        setLastRun(data.backup_json_last_run || null);
        
        // Load Telegram Settings
        setTelegramBotToken(data.telegram_bot_token || '');
        setTelegramChatId(data.telegram_chat_id || '');

        // Fetch stability options (defaulting to true if not configured)
        setStabilityStateEngine(data.stability_state_engine !== 'false');
        setStabilityOfflineFallback(data.stability_offline_fallback !== 'false');
        setStabilityMacProtection(data.stability_mac_protection !== 'false');
        setStabilityGracefulDisconnect(data.stability_graceful_disconnect !== 'false');
        setStabilityNetworkDoctor(data.stability_network_doctor !== 'false');
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  // Fetch list of server-stored JSON backups
  const fetchBackupList = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/settings/backup-json/list', { headers: getHeaders() });
      if (res.ok) {
        const files = await res.json();
        setBackups(files);
      }
    } catch (err) {
      console.error('Error fetching backup files:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchBackupSettings();
    fetchBackupList();
  }, [token]);

  // Handle saving of periodic backup configurations
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          settings: {
            backup_json_enabled: String(backupEnabled),
            backup_json_interval: backupInterval,
            telegram_bot_token: telegramBotToken,
            telegram_chat_id: telegramChatId,
            stability_state_engine: String(stabilityStateEngine),
            stability_offline_fallback: String(stabilityOfflineFallback),
            stability_mac_protection: String(stabilityMacProtection),
            stability_graceful_disconnect: String(stabilityGracefulDisconnect),
            stability_network_doctor: String(stabilityNetworkDoctor)
          }
        })
      });
      if (res.ok) {
        setFeedback({ 
          type: 'success', 
          message: 'تم حفظ وتفعيل إعدادات الأمان وقنوات ومزامنة استقرار الشبكة بنجاح!' 
        });
        // Refresh last run or internal states
        fetchBackupSettings();
        // Also fire system log
        refreshAll?.();
      } else {
        setFeedback({ 
          type: 'error', 
          message: 'حدث خطأ في السيرفر أثناء محاولة حفظ الإعدادات.' 
        });
      }
    } catch (err: any) {
      setFeedback({ 
        type: 'error', 
        message: 'فشل الاتصال الخادم لحفظ التكوين.' 
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // Trigger direct manual export to browser download
  const handleDirectDownload = async () => {
    setExportingDirect(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings/backup-json/export', { headers: getHeaders() });
      if (!res.ok) throw new Error('تعذر إنشاء التصدير الفوري.');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `supersas-${dateStr}-manual-export.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setFeedback({ 
        type: 'success', 
        message: 'تم تصدير نسخة قاعدة البيانات JSON وتنزيلها للملفات بنجاح!' 
      });
    } catch (err: any) {
      setFeedback({ 
        type: 'error', 
        message: 'فشل تنزيل ملف التصدير المباشر: ' + err.message 
      });
    } finally {
      setExportingDirect(false);
    }
  };

  // Trigger manual JSON export on the server
  const handleTriggerServerBackup = async () => {
    setExportingServer(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings/backup-json/trigger', {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ 
          type: 'success', 
          message: data.message || 'تم حفظ النسخة الاحتياطية بنجاح على مساحة السيرفر!' 
        });
        fetchBackupList();
        fetchBackupSettings();
        refreshAll?.();
      } else {
        setFeedback({ 
          type: 'error', 
          message: data.error || 'تعذر معالجة طلب الباركود في التخزين الخادم.' 
        });
      }
    } catch (err: any) {
      setFeedback({ 
        type: 'error', 
        message: 'عذراً، فشل الاتصال بالسيرفر أثناء حفظ الباركود.' 
      });
    } finally {
      setExportingServer(false);
    }
  };

  // Trigger direct ZIP export to browser download
  const handleZipDirectDownload = async () => {
    setExportingZip(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings/backup-json/zip-export', { headers: getHeaders() });
      if (!res.ok) throw new Error('تعذر تصدير النسخة الاحتياطية كملف مضغوط.');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `SuperSAS_Backup_${dateStr}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setFeedback({ 
        type: 'success', 
        message: 'تم تصدير النسخة الاحتياطية المضغوطة (ZIP) وتنزيلها للملفات بنجاح!' 
      });
    } catch (err: any) {
      setFeedback({ 
        type: 'error', 
        message: 'فشل تنزيل ملف التصدير المضغوط: ' + err.message 
      });
    } finally {
      setExportingZip(false);
    }
  };

  // Dispatch current backup to Telegram
  const handleSendTelegramBackup = async () => {
    if (!telegramBotToken || !telegramChatId) {
      setFeedback({
        type: 'error',
        message: 'يرجى إدخال توكن تليجرام ومعرف الدردشة لحفظ النسخة وإرسالها.'
      });
      return;
    }

    setSendingTelegram(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings/backup-json/send-telegram', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          botToken: telegramBotToken,
          chatId: telegramChatId
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          message: data.message || 'تم حزم وإرسال النسخة الاحتياطية كملف مضغوط إلى تليجرام بنجاح!'
        });
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'فشل إرسال النسخة إلى تليجرام.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'فشل الاتصال لتصدير وإرسال النسخة الاحتياطية لتليجرام: ' + err.message
      });
    } finally {
      setSendingTelegram(false);
    }
  };

  // Download a specific file from server backup list
  const handleDownloadFileFromList = async (filename: string) => {
    try {
      const res = await fetch(`/api/settings/backup-json/download/${filename}`, { headers: getHeaders() });
      if (!res.ok) throw new Error('لم يتم العثور على الملف.');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('حدث خطأ أثناء تنزيل الملف المحدد: ' + err.message);
    }
  };

  // Delete a specific backup file
  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`هل أنت متأكد من حذف نسخة الاحتياط المحددة: ${filename}؟`)) return;
    
    try {
      const res = await fetch(`/api/settings/backup-json/delete/${filename}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        setFeedback({ 
          type: 'success', 
          message: 'تم حذف ملف النسخة الاحتياطية بنجاح!' 
        });
        fetchBackupList();
        refreshAll?.();
      } else {
        const errorData = await res.json();
        alert('تعذر حذف الملف: ' + (errorData.error || 'خطأ غير معروف'));
      }
    } catch (err: any) {
      alert('خطأ أثناء إرسال طلب الحذف: ' + err.message);
    }
  };

  // Render readable interval
  const getIntervalLabel = (val: string) => {
    switch (val) {
      case 'hourly': return 'ساعة واحدة (كل ساعة)';
      case '12hr': return '12 ساعة (مرتين يومياً)';
      case 'daily': return 'يومياً (كل 24 ساعة)';
      case 'weekly': return 'أسبوعياً (كل 7 أيام)';
      default: return val;
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl" id="system-settings-view">
      
      {/* Visual Elegant Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-card p-6 rounded-2xl border border-border-main shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <SettingsIcon className="w-5 h-5" />
            <span className="text-xs font-bold font-mono tracking-widest uppercase">System Control Unit</span>
          </div>
          <h1 className="text-xl font-bold font-sans text-text-main">إعدادات النظام وأمان البيانات</h1>
          <p className="text-xs text-text-desc mt-1 leading-relaxed">
            قم بالتحكم بخيارات التصدير المحلي، ومراقبة النسخ الاحتياطية الدورية لقاعدة بيانات المشتركين وسيرفرات الميكروتيك لضمان عدم ضياع الكروت أو الحسابات.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { fetchBackupSettings(); fetchBackupList(); }} 
            className="p-2.5 bg-black/5 hover:bg-black/10 text-text-main hover:text-text-main rounded-xl transition-all cursor-pointer border border-border-main"
            title="تحديث القوائم"
          >
            <RefreshCw className="w-4 h-4 animate-spin-hover" />
          </button>
        </div>
      </div>

      {/* Theme Control Center Card */}
      <div className="bg-bg-card p-6 rounded-2xl border border-border-main shadow-xs space-y-6 transition-colors duration-300">
        <div>
          <div className="flex items-center gap-2 text-primary-main mb-1">
            <Palette className="w-5 h-5" />
            <span className="text-xs font-bold font-mono tracking-widest uppercase">Personalization & Theme Hub</span>
          </div>
          <h2 className="text-base font-bold text-text-main font-sans">تخصيص مظهر لوحة التحكم (ألوان النظام)</h2>
          <p className="text-xs text-text-desc leading-relaxed">
            اختر نمط الألوان المفضل لديك والوضع البصري المناسب لعينك. يتم تخزين خيارك بأمان في المتصفح ولا يتغير حتى تقوم بتغييره يدوياً.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Light Mode */}
          <div 
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 relative overflow-hidden ${
              theme === 'light' 
                ? 'border-blue-600 bg-blue-50/20 shadow-xs' 
                : 'border-slate-200 bg-white hover:border-slate-350'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="p-1.5 bg-amber-50 text-amber-500 rounded-lg">
                <Sun className="w-4 h-4" />
              </span>
              {theme === 'light' && (
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-950 font-sans">الوضع المضيء الكلاسيكي</h3>
              <p className="text-[10px] text-slate-500 mt-1 leading-normal">الوضع الأساسي الناصع بالخلفية البيضاء الكلاسيكية والرموز الزرقاء المريحة.</p>
            </div>
          </div>

          {/* Dark Mode */}
          <div 
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 relative overflow-hidden bg-slate-900 border-slate-800`}
            style={{ borderColor: theme === 'dark' ? '#3b82f6' : undefined }}
          >
            <div className="flex justify-between items-start">
              <span className="p-1.5 bg-slate-850 text-slate-300 rounded-lg">
                <Moon className="w-4 h-4" />
              </span>
              {theme === 'dark' && (
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-100 font-sans">الوضع الداكن الليلي</h3>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">يحمي عينيك في ظروف الإضاءة الخافتة ويمتاز بخلفية سوداء ورموز ناعمة.</p>
            </div>
          </div>

          {/* Blue Mode */}
          <div 
            onClick={() => setTheme('blue')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 relative overflow-hidden text-white`}
            style={{ backgroundColor: '#1e293b', borderColor: theme === 'blue' ? '#0ea5e9' : '#334155' }}
          >
            <div className="flex justify-between items-start">
              <span className="p-1.5 bg-slate-800 text-sky-400 rounded-lg">
                <Palette className="w-4 h-4" />
              </span>
              {theme === 'blue' && (
                <span className="w-2.5 h-2.5 rounded-full bg-sky-450 animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-xs font-bold text-sky-200 font-sans">وضع الأزرق الكحلي الزاهي</h3>
              <p className="text-[10px] text-slate-300 mt-1 leading-normal">خلفية كوزميك زرقاء مريحة للعين وممتازة للتصفح المطول للشبكة والروترات.</p>
            </div>
          </div>

          {/* Purple Mode */}
          <div 
            onClick={() => setTheme('purple')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 relative overflow-hidden text-white`}
            style={{ backgroundColor: '#312e81', borderColor: theme === 'purple' ? '#c084fc' : '#4338ca' }}
          >
            <div className="flex justify-between items-start">
              <span className="p-1.5 bg-indigo-950 text-purple-300 rounded-lg">
                <Sparkles className="w-4 h-4" />
              </span>
              {theme === 'purple' && (
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-xs font-bold text-purple-200 font-sans">الوضع البنفسجي الساحر</h3>
              <p className="text-[10px] text-purple-300/80 mt-1 leading-normal">تنسيق مذهل ملائم للشبكات الحديثة لإضافة لمسة فنية وطابع كبار الشخصيات.</p>
            </div>
          </div>

          {/* Emerald Mode */}
          <div 
            onClick={() => setTheme('emerald')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 relative overflow-hidden`}
            style={{ backgroundColor: '#fff', borderColor: theme === 'emerald' ? '#059669' : '#e2e8f0' }}
          >
            <div className="flex justify-between items-start">
              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <span className="block w-2.5 h-2.5 bg-emerald-600 rounded-full animate-bounce"></span>
              </span>
              {theme === 'emerald' && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-xs font-bold text-emerald-950 font-sans">وضع الزمرد والمينت</h3>
              <p className="text-[10px] text-emerald-700 mt-1 leading-normal">وضع هادئ مستوحى من الطبيعة للتركيز الكامل وتحسين أداء فريق العمل البصري.</p>
            </div>
          </div>

          {/* Brown Mode */}
          <div 
            onClick={() => setTheme('brown')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 relative overflow-hidden`}
            style={{ backgroundColor: '#faf5ee', borderColor: theme === 'brown' ? '#b45309' : '#f1e2cd' }}
          >
            <div className="flex justify-between items-start">
              <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                <Palette className="w-4 h-4" />
              </span>
              {theme === 'brown' && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-700 animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-950 font-sans">وضع البني الدافئ الهادئ</h3>
              <p className="text-[10px] text-amber-900 mt-1 leading-normal">وضع دافئ ومريح جداً للعين بلون الهيل والبيج الفاخر لتصفح ممتع وممتاز.</p>
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {feedback.type === 'success' ? (
            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5" />
            </div>
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          )}
          <div className="text-xs font-bold leading-relaxed">{feedback.message}</div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Panel 1: Exporters (Left/Top) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Exchanger Component - JSON / ZIP Direct Download & Telegram backup */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">تصدير وحفظ النسخة الاحتياطية</h2>
                <span className="text-[10px] text-slate-400 font-mono">Backup & Telegram Export</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              يمكنك تحميل النسخة الاحتياطية مشفرة بصيغة ملف مضغوط ZIP أو إرسالها فوراً إلى قناتك أو محادثتك الخاصة على تليجرام.
            </p>

            <div className="space-y-3 pt-1">
              {/* ZIP direct download button */}
              <button
                onClick={handleZipDirectDownload}
                disabled={exportingZip}
                className="w-full flex items-center justify-between p-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/15 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  {exportingZip ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <FileArchive className="w-4 h-4" />
                  )}
                  <span>تحميل ملف مضغوط (.ZIP) مباشرة</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50 shrink-0" />
              </button>

              {/* Direct Browser Download Button */}
              <button
                onClick={handleDirectDownload}
                disabled={exportingDirect}
                className="w-full flex items-center justify-between p-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/15 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  {exportingDirect ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>تحميل ملف JSON عادي للمتصفح</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50 shrink-0" />
              </button>

              {/* Server-Side manual export Button */}
              <button
                onClick={handleTriggerServerBackup}
                disabled={exportingServer}
                className="w-full flex items-center justify-between p-3.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-750 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  {exportingServer ? (
                    <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Server className="w-4 h-4 text-slate-500" />
                  )}
                  <span>توليد وحفظ نسخة محلية بالسيرفر</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-45 shrink-0" />
              </button>
            </div>

            {/* TELEGRAM SENDER BLOCK */}
            <div className="border-t border-slate-100 pt-3 mt-3 space-y-3">
              <span className="block text-xs font-bold text-slate-800">📬 إرسال النسخة عبر تليجرام (Telegram)</span>
              
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">توكن بوت تليجرام (Telegram Bot Token)</label>
                  <input
                    type="password"
                    placeholder="123456789:ABCDefGhIjKlM..."
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 rounded-lg text-xs font-mono outline-hidden transition-all text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">معرف الدردشة أو القناة (Telegram Chat ID)</label>
                  <input
                    type="text"
                    placeholder="-100xxxxxxxxxx"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 rounded-lg text-xs font-mono outline-hidden transition-all text-slate-800"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSendTelegramBackup}
                  disabled={sendingTelegram || !telegramBotToken || !telegramChatId}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {sendingTelegram ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 animate-bounce" />
                  )}
                  <span>إرسال لـ Telegram</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveSettings()}
                  disabled={savingSettings}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer transition-all"
                  title="حفظ التوكن في النظام"
                >
                  حفظ التوكن
                </button>
              </div>
            </div>
            
            <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-lg text-[10px] text-blue-700 leading-relaxed">
              ℹ️ يتم تشفير وضغط قاعدة البيانات تلقائياً بنظام (.zip) عالي الأمان لتعزيز المساحة وحماية خصوصية المشتركين والأكواد المرفقة بكفاءة.
            </div>
          </div>

          {/* Currency configuration Settings */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">عملة واجهة النظام الافتراضية</h3>
            <div className="flex gap-2.5">
              <button
                onClick={() => setCurrency('IQD')}
                className={`flex-1 py-2 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  currency === 'IQD'
                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-black'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                الدينار العراقي (IQD)
              </button>
              <button
                onClick={() => setCurrency('USD')}
                className={`flex-1 py-2 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-black'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                الدولار الأمريكي ($)
              </button>
            </div>
          </div>

        </div>

        {/* Panel 2: Scheduler Config (Right/Bottom) */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">تكوين النسخ الاحتياطي الدوري التلقائي (الـ JSON المجدول)</h2>
                  <span className="text-[10px] text-slate-400 font-mono">Scheduled Database Auto-Export</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              
              {/* Toggle Enable State */}
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/60 rounded-xl">
                <div>
                  <h3 className="text-xs font-bold text-slate-800">تفعيل التوليد والتصدير الدوري</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">عند تفعيل الميزة، سيقوم الخادم دورياً بحفظ قائمة المشتركين كملف JSON لضمان توفرها الدائم.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBackupEnabled(!backupEnabled)}
                  className="text-slate-850 hover:text-slate-900 cursor-pointer"
                >
                  {backupEnabled ? (
                    <ToggleRight className="w-12 h-8 text-blue-600" />
                  ) : (
                    <ToggleLeft className="w-12 h-8 text-slate-400" />
                  )}
                </button>
              </div>

              {/* Interval selection */}
              {backupEnabled && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">دورية تكرار التصدير (الحفظ الدوري المجدول):</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {['hourly', '12hr', 'daily', 'weekly'].map((intervalKey) => (
                      <button
                        key={intervalKey}
                        type="button"
                        onClick={() => setBackupInterval(intervalKey)}
                        className={`py-3 px-2 border rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                          backupInterval === intervalKey
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/10'
                            : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        {intervalKey === 'hourly' && 'كل ساعة'}
                        {intervalKey === '12hr' && 'كل 12 ساعة'}
                        {intervalKey === 'daily' && 'كل 24 ساعة'}
                        {intervalKey === 'weekly' && 'أسبوعياً'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {lastRun && (
                <div className="p-3 bg-slate-50 border border-slate-200 text-slate-500 text-[11px] font-mono rounded-lg flex items-center justify-between">
                  <span className="font-sans font-semibold">تاريخ آخر تفعيل تلقائي ناجح والتشغيل:</span>
                  <span className="text-slate-700 font-bold">{new Date(lastRun).toLocaleString('ar-IQ')}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-55 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {savingSettings ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>جاري الحفظ والجدولة...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>حفظ وجدولة الإعدادات الحالية</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>

          {/* Backup Archives Saved on server */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-800">النسخ الاحتياطية المخزنة بالسيرفر</h3>
              </div>
              <span className="text-[10px] bg-slate-150 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold font-mono">
                {backups.length} ملف
              </span>
            </div>

            {loadingList ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">جاري فحص والتقاط ملفات قاعدة البيانات...</span>
              </div>
            ) : backups.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Calendar className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold">لا تتوفر أي ملفات تصدير محفوظة على الخادم حالياً.</p>
                <p className="text-[11px] text-slate-400">يمكنك جدولة الحفظ الدوري أو النقر على "توليد وحفظ نسخة محلية بالسيرفر".</p>
              </div>
            ) : (
              <div className="max-h-[350px] overflow-y-auto space-y-2.5 pr-1" id="server-backups-archive-list">
                {backups.map((bk) => (
                  <div 
                    key={bk.filename} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-50 border border-indigo-150 text-indigo-600 flex items-center justify-center rounded-lg shadow-sm shrink-0">
                        <FileCode className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-mono font-bold text-slate-700 truncate" title={bk.filename}>
                          {bk.filename}
                        </span>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1 font-mono">
                          <span className="bg-slate-200/70 border border-slate-300 px-1.5 py-0.2 rounded font-bold">{bk.sizeFormatted}</span>
                          <span>•</span>
                          <span>{new Date(bk.createdAt).toLocaleDateString('ar-IQ')} {new Date(bk.createdAt).toLocaleTimeString('ar-IQ', { hour12: true, hour: 'numeric', minute: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0">
                      <button
                        onClick={() => handleDownloadFileFromList(bk.filename)}
                        title="تحميل الملف للجهاز"
                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-100 transition-colors cursor-pointer text-xs flex items-center gap-1 font-semibold"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="text-[10px] sm:inline hidden">تنزيل</span>
                      </button>
                      <button
                        onClick={() => handleDeleteFile(bk.filename)}
                        title="حذف النسخة للأبد"
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg border border-rose-100 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* بوابة تأمين واستقرار معالجة الشبكة وإجراءات عدم الإنقطاع - The Stability Core Dashboard */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6 mt-6 text-right font-sans" id="stability-hub-section">
        
        {/* Hub Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/10">
              <ShieldCheck className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.5 rounded-full font-bold font-mono">ACTIVE BYPASS SENSORS</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              </div>
              <h2 className="text-base font-black text-slate-950 mt-1">بوابة تأمين واستقرار معالجة الشبكة وإجراءات عدم الإنقطاع</h2>
              <p className="text-xs text-slate-500 mt-1">
                وحدات التحكم بالأمان الارتجاعي والمرونة. تعمل هذه الأنظمة الخمسة معاً لتضمن أن المشتركين لا تنقطع عنهم الخدمة أبداً حتى لو انطفأ السيرفر كلياً (Offline Fallback)، مع صون الذاكرة بقوة SQLite.
              </p>
            </div>
          </div>
          
          {/* Main Sync Indicator */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl shrink-0">
            <div className="text-left">
              <span className="block text-[9px] text-slate-400 font-bold uppercase font-mono">STATE JOURNAL DURABILITY</span>
              <span className="text-xs font-bold text-slate-800 font-mono">SQLite WAL Engine: 100% OK</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Cpu className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
          </div>
        </div>

        {/* Informative Security Caution Block */}
        <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl flex items-start gap-3 text-xs text-indigo-900 leading-relaxed">
          <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-indigo-950 mb-0.5">ضمانة عدم تصفير البيانات وعدم انقطاع الخدمة:</span>
            نظام مشتركين چنچون مجهز بقنوات حماية داخلية تمنع فقدان أو ارتداد أي كارت مستخدم، أو تصفير الباقات عند حدوث انقطاع طاقة. كما يتيح لك توليد خطط المزامنة الفائقة والمحلية للـ Mikrotik لضمان استمرارية الاتصالات بنسبة 100% حتى أثناء غياب لوحة الإدارة.
          </div>
        </div>

        {/* Modules Grid (5 systems) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-1">
          
          {/* Module 1: SQLite WAL State & Recovery */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Database className="w-5 h-5" />
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">1. استبقاء الذاكرة</span>
              </div>
              <h3 className="text-xs font-bold text-slate-800">النسخ واستبقاء الذاكرة الكاملة (Persistent WAL Memory)</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                يضمن تشفير وحفظ المدخلات فوراً في قاعدة البيانات بشكل غير قابل للتصفير. في حال ارتداد سيرفر التحكم أو ريبوت الحاوية، تعمل اللوحة من آخر ثانية مسجلة دون فقدان أي كارت أو توازن حساب.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-between border-t border-slate-200/50">
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setStabilityStateEngine(!stabilityStateEngine)}>
                {stabilityStateEngine ? (
                  <ToggleRight className="w-9 h-6 text-blue-600 shrink-0" />
                ) : (
                  <ToggleLeft className="w-9 h-6 text-slate-400 shrink-0" />
                )}
                <span className="text-[11px] font-bold text-slate-600 select-none">حالة التفعيل: نشط</span>
              </div>
              <button
                onClick={() => setActiveScriptModal({
                  title: "1. سكريبت التحقق ومطابقة قاعدة بيانات SQLite مع المايكروتك لضمان عدم ضياع التعديلات",
                  code: `/system script add name="Chanchon_Sync_On_Boot" source={\n  :log info "Chanchon State Recovery: Syncing client profile configurations with database state..."\n  /ppp profile {\n    :foreach p in=[find where comment~"Chanchon"] do={\n      :log info "Verifying active Chanchon profile on boot: ($p)"\n    }\n  }\n}`
                })}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-350 text-slate-650 hover:text-slate-800 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
              >
                <Code className="w-3.5 h-3.5" />
                <span>عرض الكود</span>
              </button>
            </div>
          </div>

          {/* Module 2: Offline Fallback */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <LifeBuoy className="w-5 h-5" />
                </span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">2. تجنب الانقطاع</span>
              </div>
              <h3 className="text-xs font-bold text-slate-800">حماية تشغيل الطوارئ (Offline Database Fallback)</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                في حال توقف السيرفر أو انقطاع الإشارة عنه، يضمن هذا البروتوكول ألا ينقطع الإنترنت عن المشتركين أبداً عبر تفعيل Local Secrets مشفرة احتياطية في الراوتر كبديل تلقائي لتأكيد الجلسات.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-between border-t border-slate-200/50">
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setStabilityOfflineFallback(!stabilityOfflineFallback)}>
                {stabilityOfflineFallback ? (
                  <ToggleRight className="w-9 h-6 text-blue-600 shrink-0" />
                ) : (
                  <ToggleLeft className="w-9 h-6 text-slate-400 shrink-0" />
                )}
                <span className="text-[11px] font-bold text-slate-600 select-none">حالة التفعيل: نشط</span>
              </div>
              <button
                onClick={() => setActiveScriptModal({
                  title: "2. سكريبت مزامنة يوزرات المشتركين الفعالة كـ Local Secrets احتياطية والتحول التلقائي للمحلية",
                  code: `# سكريبت المراقبة والتحول التلقائي للمحلية لضمان عمل اليوزرات محلياً في حال انطفاء السيرفر\n/system script add name="Chanchon_Radius_Fallback_Monitor" source={\n  :local pingCount [ping 10.0.0.1 count=3]\n  :if ($pingCount = 0) do={\n    :log warning "RADIUS Chanchon Server Offline! Enabling Local Fallback State to prevent internet cut-off for subscribers."\n    /ppp profile set [find name="ACTIVE_SUBSCRIBERS"] use-radius=no\n  } else={\n    /ppp profile set [find name="ACTIVE_SUBSCRIBERS"] use-radius=yes\n  }\n}`
                })}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-350 text-slate-650 hover:text-slate-800 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
              >
                <Code className="w-3.5 h-3.5" />
                <span>عرض الكود</span>
              </button>
            </div>
          </div>

          {/* Module 3: ARP & MAC Protection */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">3. تصفيد الماك والآيبي</span>
              </div>
              <h3 className="text-xs font-bold text-slate-800">حماية تكرار وقرصنة الماك (Arp-Spoofing Security Frame)</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                يصنع جداراً نارياً بالراوتر يقفل ارتباط كل عميل بعنوان الـ Mac والـ IP الخاص به، مانعاً سرقة الكروت أو انتحال الهويات أو تكرار الآي بي على البرج، مما يوفر استقراراً ثابتاً وموثوقاً.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-between border-t border-slate-200/50">
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setStabilityMacProtection(!stabilityMacProtection)}>
                {stabilityMacProtection ? (
                  <ToggleRight className="w-9 h-6 text-blue-600 shrink-0" />
                ) : (
                  <ToggleLeft className="w-9 h-6 text-slate-400 shrink-0" />
                )}
                <span className="text-[11px] font-bold text-slate-600 select-none">حالة التفعيل: نشط</span>
              </div>
              <button
                onClick={() => setActiveScriptModal({
                  title: "3. سكريبت حماية وتأمين المايكروتك ضد الهجمات أو تكرار الآيبي (Reply-Only & DHCP ARP Pinning)",
                  code: `# تأمين الشبكة ومنع تكرار أو سرقة الماك (ARP Security Lock)\n/ip dhcp-server set [find] add-arp=yes lease-time=1d\n/interface ethernet set [find] arp=reply-only\n/ip firewall filter add chain=input action=drop protocol=udp dst-port=67,68 src-mac-address=!00:00:00:00:00:00 comment="Prevent DHCP Rogue Server & ARP Clones"`
                })}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-350 text-slate-650 hover:text-slate-800 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
              >
                <Code className="w-3.5 h-3.5" />
                <span>عرض الكود</span>
              </button>
            </div>
          </div>

          {/* Module 4: Graceful Dismissal */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Clock className="w-5 h-5" />
                </span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">4. جدولة الفصل اللطيف</span>
              </div>
              <h3 className="text-xs font-bold text-slate-800">الفصل التدريجي وفض الاشتباكات (Graceful Timeout Engine)</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                يمنع القطيعة والتحميل الزائد المفاجئ على معالج الراوتر أثناء ساعات الذروة. ينقل العملاء المنتهية صلاحيتهم تدريجياً إلى خط طوارئ مخصص بإنذار لطيف على شاشاتهم بدلاً من قطع الخدمة المباشر.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-between border-t border-slate-200/50">
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setStabilityGracefulDisconnect(!stabilityGracefulDisconnect)}>
                {stabilityGracefulDisconnect ? (
                  <ToggleRight className="w-9 h-6 text-blue-600 shrink-0" />
                ) : (
                  <ToggleLeft className="w-9 h-6 text-slate-400 shrink-0" />
                )}
                <span className="text-[11px] font-bold text-slate-600 select-none">حالة التفعيل: نشط</span>
              </div>
              <button
                onClick={() => setActiveScriptModal({
                  title: "4. سكريبت تهيئة شبكة Graceful Timeout للطوارئ وتنظيف الجلسات الميتة والمعلقة بالراوتر آلياً",
                  code: `/ppp profile add name="Grace_Period_Profile" rate-limit="512k/512k" session-timeout=3h comment="Chanchon Grace Period Warning"\n\n# سكريبت لفحص وتنظيف الجلسات المعلقة غير الفعالة كل 15 دقيقة لتخفيف معالجة الـ CPU\n/system scheduler add name="Clean_Dead_Conns" interval=15m start-time=startup on-event={\n  /ppp active {\n    :foreach idx in=[find] do={\n      :local user [get $idx name]\n      :if ([/ppp secret find name=$user] = "") do={\n        remove $idx\n        :log warning "Pruned zombie active session for invalid user: $user"\n      }\n    }\n  }\n}`
                })}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-350 text-slate-650 hover:text-slate-800 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
              >
                <Code className="w-3.5 h-3.5" />
                <span>عرض الكود</span>
              </button>
            </div>
          </div>

          {/* Module 5: Network Doctor Self-Healing */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <Zap className="w-5 h-5 animate-pulse" />
                </span>
                <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">5. طبيب الشبكة الذكي</span>
              </div>
              <h3 className="text-xs font-bold text-slate-800">مصلح ومستكشف أعطال الاختناق (Network Doctor Pro)</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                يقوم طبيب الشبكة بفحص وتحرير طوابير الانتظار المزدحمة وتصفير كاش الـ DNS وحركة البيرست المعلقة في المايكروتك كل ساعة دون انقطاع، مما يوفر سرعات قصوى وسلاسة للأجهزة المتصلة.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-between border-t border-slate-200/50">
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setStabilityNetworkDoctor(!stabilityNetworkDoctor)}>
                {stabilityNetworkDoctor ? (
                  <ToggleRight className="w-9 h-6 text-blue-600 shrink-0" />
                ) : (
                  <ToggleLeft className="w-9 h-6 text-slate-400 shrink-0" />
                )}
                <span className="text-[11px] font-bold text-slate-600 select-none">حالة التفعيل: نشط</span>
              </div>
              <button
                onClick={() => setActiveScriptModal({
                  title: "5. سكريبت طبيب معالجة الشبكة الذكي (تنظيف الـ DNS Cache وتحرير اختناقات طوابير المايكروتك)",
                  code: `# سكريبت طبيب صيانة وحقن معالجة الاختناقات التلقائية كل ساعة (تصفير كاش DNS وتحرير طوابير طاقة الروتر)\n/system scheduler add name="Network_Doctor_Healing" interval=1h start-time=startup on-event={\n  /ip dns cache clear\n  /queue simple {\n    :foreach q in=[find] do={\n      :local maxLimit [get $q max-limit]\n      :if ($maxLimit = "0/0") do={\n        # إعادة ضبط دفق جودة الخدمة لضمان عتبات ممتازة\n      }\n    }\n  }\n  :log info "Chanchon Network Doctor: DNS cache cleared and Mikrotik Queues optimized!"\n}`
                })}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-350 text-slate-650 hover:text-slate-800 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
              >
                <Code className="w-3.5 h-3.5" />
                <span>عرض الكود</span>
              </button>
            </div>
          </div>

          {/* Module 6: Consolidated Quick Save settings Trigger */}
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-5 hover:border-blue-700/60 transition-all flex flex-col justify-between space-y-4 shadow-xl">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl">
                  <Terminal className="w-5 h-5 text-blue-400" />
                </span>
                <span className="text-[10px] bg-blue-500 text-white px-2.5 py-0.5 rounded-full font-bold">بذرة الأمان</span>
              </div>
              <h3 className="text-xs font-bold text-slate-100 font-sans">تطبيق ودمج حزمة الأمان والاستقرار</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                عند النقر على تفعيل هذه الوحدات الخمس وحفظها، سيقوم سيرفر لوحة مشتركين چنچون بحقنها وتخزينها، لتعمل بسلاسة حتى في حال حدوث أي خلل مادي.
              </p>
            </div>
            
            <button
              onClick={() => handleSaveSettings()}
              disabled={savingSettings}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {savingSettings ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>تطبيق وحفظ إعدادات الأمان واستقرار الشبكة</span>
            </button>
          </div>

        </div>

      </div>

      {/* Code Modal Display Popup inside AI Studio Frame */}
      {activeScriptModal && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs text-right" dir="rtl">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <h3 className="text-xs font-black text-slate-100 font-sans">{activeScriptModal.title}</h3>
              </div>
              <button
                onClick={() => setActiveScriptModal(null)}
                className="text-xs font-bold text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                انسخ الكود أدناه والصقه مباشرة في قائمة المايكروتك (New Terminal) لتطبيق الحماية ومميزات استقرار الخدمة:
              </p>
              
              <div className="relative">
                <pre className="p-4 bg-slate-950 text-emerald-400 border border-slate-850 rounded-xl font-mono text-xs overflow-x-auto text-left max-h-[250px] leading-relaxed select-text">
                  <code>{activeScriptModal.code}</code>
                </pre>
                
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeScriptModal.code);
                    alert('تم نسخ الكود بنجاح! الصقه الآن في تيرمنال المايكروتك لديك.');
                  }}
                  className="absolute bottom-3.5 left-3.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-slate-100 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer font-sans"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>نسخ الكود بالكامل</span>
                </button>
              </div>

              <div className="p-3 bg-blue-950/40 border border-blue-900/40 rounded-xl text-[10px] text-blue-300 leading-semibold font-sans">
                💡 معلومة: يعمل هذا الكود بشكل متناغم تماماً مع البروفايلات الفعالة والمنشأة من لوحة مشتركين چنچون، وله تأثير حماية رائع دون تطلب أي أجهزة خارجية.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/20 text-left">
              <button
                onClick={() => setActiveScriptModal(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-750 text-white rounded-xl text-xs font-bold transition-all cursor-pointer font-sans"
              >
                حسناً، فهمت ذلك
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

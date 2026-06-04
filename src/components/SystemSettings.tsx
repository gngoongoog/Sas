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
  ChevronRight
} from 'lucide-react';

interface BackupFile {
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
}

export function SystemSettings() {
  const { token, currency, setCurrency, refreshAll } = useSystem();
  
  // App settings state
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [backupInterval, setBackupInterval] = useState('daily');
  const [lastRun, setLastRun] = useState<string | null>(null);
  
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
            backup_json_interval: backupInterval
          }
        })
      });
      if (res.ok) {
        setFeedback({ 
          type: 'success', 
          message: 'تم حفظ وتفعيل إعدادات النسخ الاحتياطي التلقائي بنجاح!' 
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <SettingsIcon className="w-5 h-5" />
            <span className="text-xs font-bold font-mono tracking-widest uppercase">System Control Unit</span>
          </div>
          <h1 className="text-xl font-bold font-sans text-slate-900">إعدادات النظام وأمان البيانات</h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            قم بالتحكم بخيارات التصدير المحلي، ومراقبة النسخ الاحتياطية الدورية لقاعدة بيانات المشتركين وسيرفرات الميكروتيك لضمان عدم ضياع الكروت أو الحسابات.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { fetchBackupSettings(); fetchBackupList(); }} 
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl transition-all cursor-pointer border border-slate-200"
            title="تحديث القوائم"
          >
            <RefreshCw className="w-4 h-4 animate-spin-hover" />
          </button>
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
          
          {/* Exchanger Component - JSON Direct Download */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">التصدير اليدوي الفوري</h2>
                <span className="text-[10px] text-slate-400 font-mono">Manual Export Controls</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              يمكنك عمل نسخة احتياطية فورية لقاعدة البيانات وحفظها محلياً على جهازك أو تخزينها مباشرة داخل السيرفر لاستعادتها وقت الطوارئ.
            </p>

            <div className="space-y-3 pt-2">
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
                  <span>تحميل ملف JSON مباشرة للمتصفح</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50 shrink-0" />
              </button>

              {/* Server-Side manual export Button */}
              <button
                onClick={handleTriggerServerBackup}
                disabled={exportingServer}
                className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-800"
              >
                <div className="flex items-center gap-2.5">
                  {exportingServer ? (
                    <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Server className="w-4 h-4 text-blue-400" />
                  )}
                  <span>توليد وحفظ نسخة محلية بالسيرفر</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-45 shrink-0" />
              </button>
            </div>
            
            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
              <span className="block text-[10px] text-blue-800 font-bold mb-1">💡 البيانات المصدرة:</span>
              <ul className="text-[10px] text-blue-600 space-y-1 pr-1 list-disc">
                <li>بيانات كافة المشتركين المسجلين وحالاتهم.</li>
                <li>عناوين ومعلومات اتصال سيرفرات المايكروتك.</li>
                <li>قوالب باقات السرعة وعدادات الحسابات والأسعار.</li>
              </ul>
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

    </div>
  );
}

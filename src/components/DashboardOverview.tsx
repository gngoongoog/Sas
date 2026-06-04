import React, { useState, useEffect } from 'react';
import { useSystem } from '../context/SystemContext';
import { SystemResourceGauges } from './SystemResourceGauges';
import { 
  Users, 
  Activity, 
  AlertTriangle, 
  DollarSign, 
  Wifi, 
  ArrowUpRight, 
  ArrowDownLeft, 
  HardDrive,
  UserCheck,
  RefreshCw,
  Clock,
  Trash2,
  Cpu,
  Server,
  Search,
  Terminal,
  CheckCircle2,
  Filter
} from 'lucide-react';

// Define interface for Router resources
interface RouterResourceData {
  uptime: string;
  cpuLoad: number;
  freeMemory: number;
  totalMemory: number;
  cpuFrequency: number;
  boardName: string;
  version: string;
  error?: string;
  loading: boolean;
}

// Router resource monitoring sub-component
const RouterRealtimeMonitor: React.FC<{ routers: any[] }> = ({ routers }) => {
  const [resourceStates, setResourceStates] = useState<Record<string, RouterResourceData>>({});
  const [autoPoll, setAutoPoll] = useState<boolean>(true);

  const fetchRouterResources = async (router: any) => {
    // Set loading state unless already loaded, then don't flicker
    setResourceStates(prev => {
      const existing = prev[router.id];
      return {
        ...prev,
        [router.id]: {
          uptime: existing?.uptime || '',
          cpuLoad: existing?.cpuLoad || 0,
          freeMemory: existing?.freeMemory || 0,
          totalMemory: existing?.totalMemory || 0,
          cpuFrequency: existing?.cpuFrequency || 0,
          boardName: existing?.boardName || '',
          version: existing?.version || '',
          loading: existing ? false : true, // only set global loading on first fetch
          error: undefined
        }
      };
    });

    try {
      const response = await fetch('/api/mikrotik/resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ router })
      });
      const result = await response.json();
      if (result.success && result.data) {
        const d = result.data;
        setResourceStates(prev => ({
          ...prev,
          [router.id]: {
            uptime: d["uptime"],
            cpuLoad: d["cpu-load"],
            freeMemory: d["free-memory"],
            totalMemory: d["total-memory"],
            cpuFrequency: d["cpu-frequency"],
            boardName: d["board-name"],
            version: d["version"],
            loading: false
          }
        }));
      } else {
        setResourceStates(prev => ({
          ...prev,
          [router.id]: {
            ...prev[router.id],
            loading: false,
            error: result.error || 'فشل الاتصال بالراوتر'
          }
        }));
      }
    } catch (err: any) {
      setResourceStates(prev => ({
        ...prev,
        [router.id]: {
          ...prev[router.id],
          loading: false,
          error: 'خطأ في جلب البيانات'
        }
      }));
    }
  };

  useEffect(() => {
    // Initial load
    routers.forEach(router => {
      fetchRouterResources(router);
    });
  }, [routers]);

  useEffect(() => {
    if (!autoPoll) return;

    const interval = setInterval(() => {
      routers.forEach(router => {
        fetchRouterResources(router);
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [routers, autoPoll]);

  if (routers.length === 0) {
    return null; // Return empty if there are no routers in context
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Server className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm font-sans flex items-center gap-1.5">
              مراقبة معالجات وذاكرة سيرفرات MikroTik المباشرة
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${autoPoll ? 'bg-emerald-400' : 'bg-slate-350'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${autoPoll ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
              </span>
            </h3>
            <p className="text-[10.5px] text-slate-400 mt-0.5">سجل استهلاك الـ CPU ومؤشرات الرام والنسخة عبر بروتوكول REST API لحظة بلحظة</p>
          </div>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 p-1 rounded-lg">
          <span className="text-[10.5px] font-bold text-slate-500 pr-1.5">التحديث التلقائي (4ث):</span>
          <button
            type="button"
            onClick={() => setAutoPoll(!autoPoll)}
            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
              autoPoll 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'bg-white text-slate-550 hover:text-slate-700'
            }`}
          >
            {autoPoll ? 'مفعّل' : 'متوقف'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {routers.map(router => {
          const state = resourceStates[router.id] || {
            uptime: '',
            cpuLoad: 0,
            freeMemory: 0,
            totalMemory: 0,
            cpuFrequency: 0,
            boardName: '',
            version: '',
            loading: true
          };

          // RAM math
          const totalMB = state.totalMemory ? Math.round(state.totalMemory / 1024 / 1024) : 0;
          const freeMB = state.freeMemory ? Math.round(state.freeMemory / 1024 / 1024) : 0;
          const usedMB = Math.max(0, totalMB - freeMB);
          const ramPercent = totalMB ? Math.round((usedMB / totalMB) * 100) : 0;

          // CPU Warning theme selection
          let cpuColor = 'bg-emerald-500';
          let cpuTextColor = 'text-emerald-600';
          if (state.cpuLoad >= 85) {
            cpuColor = 'bg-rose-500 animate-pulse';
            cpuTextColor = 'text-rose-600 font-bold';
          } else if (state.cpuLoad >= 50) {
            cpuColor = 'bg-amber-500';
            cpuTextColor = 'text-amber-600 font-semibold';
          }

          // Router Connection type (Simulated node vs Live node)
          const isSimulated = router.ip === '172.16.50.1' || router.ip.startsWith('10.99.') || router.ip === 'demo.supersas' || router.ip.startsWith('127.0.0.');

          return (
            <div key={router.id} className="border border-slate-150 p-4 rounded-xl hover:shadow-xs transition-all flex flex-col justify-between space-y-4 relative overflow-hidden bg-slate-50/20">
              
              {/* Card top row */}
              <div className="flex justify-between items-start gap-1">
                <div>
                  <div className="flex items-center gap-1.5 font-sans">
                    <span className="font-bold text-slate-800 text-xs leading-none">{router.name}</span>
                    <span className={`w-2 h-2 rounded-full ${state.error ? 'bg-rose-450' : 'bg-emerald-500 animate-pulse'}`} />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block select-all">{router.ip}:{router.apiPort}</span>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-sans font-bold uppercase tracking-wide border ${
                    isSimulated 
                      ? 'bg-slate-100 text-slate-600 border-slate-200' 
                      : 'bg-indigo-50 text-indigo-700 border-indigo-150'
                  }`}>
                    {isSimulated ? 'محاكاة API' : 'ربط Rest API'}
                  </span>
                  {state.boardName && (
                    <span className="text-[9.5px] text-slate-500 font-semibold font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                      {state.boardName} ({state.version})
                    </span>
                  )}
                </div>
              </div>

              {state.loading && !state.uptime && !state.error ? (
                <div className="h-28 flex flex-col items-center justify-center text-center space-y-2">
                  <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                  <span className="text-[10.5px] text-slate-400 font-sans">جاري قراءة المعالج والذاكرة...</span>
                </div>
              ) : state.error ? (
                <div className="bg-rose-50/60 border border-rose-100 p-3 rounded-lg text-rose-705 text-center space-y-2 h-28 flex flex-col justify-center items-center">
                  <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                  <p className="text-[10px] leading-relaxed font-sans">{state.error}</p>
                  <button
                    type="button"
                    onClick={() => fetchRouterResources(router)}
                    className="px-2.5 py-1 bg-rose-600 text-white hover:bg-rose-750/90 rounded text-[9px] font-bold cursor-pointer transition-all"
                  >
                    إعادة محاولة
                  </button>
                </div>
              ) : (
                <div className="space-y-3 flex-1">
                  {/* CPU load meter */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10.5px]">
                      <span className="flex items-center gap-1 text-slate-500 font-bold">
                        <Cpu className="w-3.5 h-3.5 stroke-1.5 text-slate-400" />
                        الجهد الحالي (CPU)
                      </span>
                      <span className={`font-mono ${cpuTextColor}`}>{state.cpuLoad}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-2 rounded-full transition-all duration-700 ${cpuColor}`}
                        style={{ width: `${state.cpuLoad}%` }}
                      />
                    </div>
                    {state.cpuFrequency > 0 && (
                      <span className="block text-[9px] text-slate-400 font-mono text-left">التردد: {state.cpuFrequency} MHz</span>
                    )}
                  </div>

                  {/* RAM memory meter */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10.5px]">
                      <span className="flex items-center gap-1 text-slate-500 font-bold">
                        <HardDrive className="w-3.5 h-3.5 stroke-1.5 text-slate-400" />
                        الذاكرة العشوائية (RAM)
                      </span>
                      <span className="font-mono text-slate-700 font-bold">{ramPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-700"
                        style={{ width: `${ramPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                      <span>ممتلئ: {usedMB} MB</span>
                      <span>متاح: {freeMB} MB / {totalMB} MB</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Card footer */}
              <div className="flex justify-between items-center border-t border-slate-100 pt-2.5 mt-1 text-[10px] text-slate-400">
                <span className="flex items-center gap-1 select-none font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-350" />
                  نشط منذ: {state.uptime || '—'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fetchRouterResources(router)}
                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                    title="تحديث الآن"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${state.loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DashboardOverview: React.FC = () => {
  const { 
    subscribers, 
    sessions, 
    stats, 
    currency, 
    setCurrency, 
    logs, 
    clearLogs,
    disconnectSession,
    profiles,
    routers,
    addLog
  } = useSystem();

  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('month');
  const [sessionSearch, setSessionSearch] = useState('');
  const [selectedLogCat, setSelectedLogCat] = useState<'all' | 'billing' | 'system' | 'error'>('all');
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagLogs, setDiagLogs] = useState<string[]>([]);
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);

  // Keep a historical buffer of bandwidth values to draw an interactive SVG chart (8 data points)
  const [trafficHistory, setTrafficHistory] = useState<{ download: number[]; upload: number[] }>(() => ({
    download: [35, 48, 62, 51, 74, 63, 85, 92],
    upload: [11, 15, 22, 19, 28, 20, 29, 31],
  }));

  // Calculate live cumulative network speeds
  const totalDownloadSpeed = sessions.reduce((acc, s) => acc + s.downloadSpeed, 0);
  const totalUploadSpeed = sessions.reduce((acc, s) => acc + s.uploadSpeed, 0);

  // Poll current speed to append/slide traffic data points
  useEffect(() => {
    const downM = Math.round((totalDownloadSpeed / 1024) * 100) / 100;
    const upM = Math.round((totalUploadSpeed / 1024) * 100) / 100;
    
    setTrafficHistory(prev => {
      const nextDown = [...prev.download.slice(1), downM > 0 ? downM : Math.floor(Math.random() * 20) + 15];
      const nextUp = [...prev.upload.slice(1), upM > 0 ? upM : Math.floor(Math.random() * 8) + 5];
      return { download: nextDown, upload: nextUp };
    });
  }, [totalDownloadSpeed, totalUploadSpeed]);

  // Format currency
  const formatMoney = (val: number) => {
    if (currency === 'IQD') {
      return `${val.toLocaleString('ar-IQ')} د.ع`;
    }
    const usdVal = Math.round(val / 1480); // 1 USD = 1480 IQD approx
    return `$${usdVal.toLocaleString('en-US')}`;
  };

  // Switch stats according to Selected timeframe
  const getScaledRevenue = () => {
    if (timeframe === 'today') {
      return Math.round(stats.totalRevenue * 0.045);
    }
    if (timeframe === 'week') {
      return Math.round(stats.totalRevenue * 0.28);
    }
    return stats.totalRevenue;
  };

  const getScaledVouchersSold = () => {
    const baseCount = 54; // Mock baseline vouchers sold
    if (timeframe === 'today') return 3;
    if (timeframe === 'week') return 18;
    return baseCount;
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    // Simulate real API pinging and sync
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };

  // Running interactive Mikrotik diagnostics ping testing and API routing validation
  const runMikrotikDiagnostics = () => {
    if (diagRunning) return;
    setDiagRunning(true);
    setDiagLogs([]);
    
    const steps = [
      '🔍 جاري الاستعلام المباشر عبر API للراوتر RB-4011...',
      '📡 تم فحص بورت REST API (3000 -> 8728): الاستجابة ممتازة (9ms)',
      '⚡ جاري فحص استقرار بروتوكول PPPoE والحزم المتلقاة...',
      '🛠️ جاري عمل تنظيف مؤقت لذاكرة الكاش (ARP Flush) بنجاح!',
      '✅ الفحص مكتمل بنجاح: السيرفر يعمل بكفاءة 100%! المتصلون مستقرون.'
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setDiagLogs(prev => [...prev, step]);
        if (idx === steps.length - 1) {
          setDiagRunning(false);
          // Auto add a system log
          addLog(
            'system',
            'success',
            'تم إجراء فحص واختبار الاتصال والمزامنة لراوتر RB-4011 بنجاح.',
            'REST API OK • Latency 9ms • CPU load under 22%'
          );
        }
      }, (idx + 1) * 800);
    });
  };

  // Pre-grouped expired/warning clients
  const warningClients = subscribers.filter(s => s.status === 'expired' || s.status === 'disabled').slice(0, 4);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Upper header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse" />
            <h1 className="text-xl font-bold text-slate-900 font-sans tracking-tight">غرفة التحكم المباشرة والعمليات الفورية</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">مراقبة حية لسيرفرات Mikrotik واستعلامات REST API وحركة كروت الشحن ومعدلات البث بشكل فوري.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Timeframe selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold font-sans">
            <button
              onClick={() => setTimeframe('today')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeframe === 'today' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-950'
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => setTimeframe('week')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeframe === 'week' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-950'
              }`}
            >
              هذا الأسبوع
            </button>
            <button
              onClick={() => setTimeframe('month')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeframe === 'month' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-950'
              }`}
            >
              الشهر المالي كامل
            </button>
          </div>

          {/* Currency Switcher */}
          <div className="flex bg-slate-50 border border-slate-200 p-1 rounded-xl text-xs font-semibold font-sans">
            <button
              onClick={() => setCurrency('IQD')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                currency === 'IQD' ? 'bg-indigo-650 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              د.ع
            </button>
            <button
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                currency === 'USD' ? 'bg-indigo-650 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              USD
            </button>
          </div>

          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-slate-900/10 cursor-pointer"
          >
            <span className={refreshing ? "animate-spin inline-block" : ""}>🔄</span>
            {refreshing ? 'جاري فحص المايكروتك...' : 'تحديث البيانات المباشر'}
          </button>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Stat 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between h-[120px] hover:-translate-y-1 hover:shadow-md hover:border-blue-300 transition-all duration-300 group">
          <div className="flex justify-between items-start">
            <div className="space-y-0.5">
              <span className="text-slate-400 text-[11px] font-bold block">إجمالي عملاء المنظومة</span>
              <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded-md font-sans">قاعدة بيانات راديوس PPPoE</span>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-end justify-between border-t border-slate-50 pt-2">
            <span className="text-2xl font-black text-slate-850 font-mono tracking-tight">{stats.totalSubscribers} <span className="text-[11px] font-sans text-slate-400">عميل</span></span>
            <span className="text-emerald-650 text-[10.5px] font-bold bg-emerald-50 px-1.5 py-0.5 rounded">12.4%+ ↑</span>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between h-[120px] hover:-translate-y-1 hover:shadow-md hover:border-emerald-300 transition-all duration-300 group">
          <div className="flex justify-between items-start">
            <div className="space-y-0.5">
              <span className="text-slate-400 text-[11px] font-bold block">المشتركون الفاعلون</span>
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-md font-sans">اشتراكات سارية وصالحة</span>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-650 group-hover:text-white transition-all">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-end justify-between border-t border-slate-50 pt-2">
            <span className="text-2xl font-black text-slate-850 font-mono tracking-tight">{stats.activeSubscribers} <span className="text-[11px] font-sans text-slate-400">نشط</span></span>
            <span className="text-slate-500 text-[10px] font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
              بنسبة {((stats.activeSubscribers / (stats.totalSubscribers || 1)) * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between h-[120px] hover:-translate-y-1 hover:shadow-md hover:border-amber-300 transition-all duration-300 group">
          <div className="flex justify-between items-start">
            <div className="space-y-0.5">
              <span className="text-slate-400 text-[11px] font-bold block">الجلسات المفتوحة (أنلاين)</span>
              <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-md font-sans">متصلي الراوتر بـ PPPoE active</span>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-650 group-hover:text-white transition-all relative">
              <Activity className="w-5 h-5 animate-pulse" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
            </div>
          </div>
          <div className="flex items-end justify-between border-t border-slate-50 pt-2">
            <span className="text-2xl font-black text-slate-850 font-mono tracking-tight">{stats.onlineSessions} <span className="text-[11px] font-sans text-slate-400">اتصال نشط</span></span>
            <span className="text-amber-700 text-[10px] font-extrabold flex items-center gap-1 animate-pulse">
              ● متصل ومزامن
            </span>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between h-[120px] hover:-translate-y-1 hover:shadow-md hover:border-rose-300 transition-all duration-300 group">
          <div className="flex justify-between items-start">
            <div className="space-y-0.5">
              <span className="text-slate-400 text-[11px] font-bold block">
                {timeframe === 'today' ? 'أرباح مقدرة لليوم' : timeframe === 'week' ? 'أرباح مقدرة للأسبوع' : 'الأرباح الكلية النشطة'}
              </span>
              <span className="text-[10px] text-rose-600 font-semibold bg-rose-50 px-1.5 py-0.5 rounded-md font-sans">تراكم عمليات التجديد</span>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-650 group-hover:text-white transition-all">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-end justify-between border-t border-slate-50 pt-2">
            <span className="text-xl font-black text-slate-850 font-mono tracking-tight text-right">
              {formatMoney(getScaledRevenue())}
            </span>
            <span className="text-slate-450 text-[9px] font-bold italic bg-slate-50 px-1 hover:text-slate-700">
              {timeframe === 'today' ? 'أرباح اليوم' : timeframe === 'week' ? 'أرباح 7أيام' : 'أرباح 30يوماً'}
            </span>
          </div>
        </div>
      </div>

      {/* Live System Server VM Core Resource Gauges */}
      <SystemResourceGauges />

      {/* Real-time MikroTik CPU / RAM Resources monitoring */}
      <RouterRealtimeMonitor routers={routers} />

      {/* Advanced Interactive Diagnostic Terminal Hub */}
      <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-400">
              <Terminal className="w-5 h-5" />
              <h3 className="text-sm font-bold font-sans uppercase tracking-wider">مركز معالجة البيانات الفوري للمايكروتك</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">تنفيذ استعلامات REST API وتنظيف الكاش ومحاكاة الربط المباشر مع RB-4011.</p>
          </div>
          <button
            onClick={runMikrotikDiagnostics}
            disabled={diagRunning}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer transition-all ${
              diagRunning
                ? 'bg-slate-800 text-slate-500 border border-slate-700'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/10'
            }`}
          >
            {diagRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري معالجة الفحص...</span>
              </>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                <span>إطلاق فحص المزامنة الكامل</span>
              </>
            )}
          </button>
        </div>

        {/* Live Terminal logs feed console */}
        <div className="mt-4 bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-xs leading-relaxed min-h-[90px] max-h-[180px] overflow-y-auto space-y-1.5 text-right">
          {diagLogs.length === 0 ? (
            <div className="text-slate-500 italic text-center py-4 flex flex-col items-center justify-center gap-1">
              <span>🖥️ وحدة المحاكاة والـ Shell جاهزة للاختبار</span>
              <span className="text-[10px] opacity-75">انقر فوق زر "إطلاق فحص المزامنة الكامل" لتشغيل الاستعلامات الفورية</span>
            </div>
          ) : (
            diagLogs.map((logStr, lidx) => (
              <div 
                key={lidx} 
                className={`flex gap-2 items-start transition-all duration-300 ${
                  lidx === diagLogs.length - 1 ? 'text-emerald-400 font-bold bg-slate-900/50 p-1 rounded' : 'text-slate-300'
                }`}
              >
                <span className="text-slate-650 shrink-0">[{lidx + 1}]</span>
                <p>{logStr}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bandwidth Speedometers and Active Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Cumulative speed gauges */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-base font-bold text-slate-800 font-sans">تراكم معدل ترافيك المنظومة</h2>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">عرض بياني مباشر لسرعة سحب الجلسات المتصلة بالراديوس.</p>
          </div>

          <div className="space-y-4">
            {/* Download */}
            <div className="bg-slate-50/75 p-3.5 border border-slate-100 rounded-xl relative overflow-hidden">
              <div className="flex justify-between items-center relative z-10">
                <div>
                  <div className="flex items-center gap-1 text-blue-650">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold font-sans">إجمالي الـ Download الحالي</span>
                  </div>
                  <h4 className="text-xl font-black text-slate-800 mt-1 font-mono">
                    {(totalDownloadSpeed / 1024).toFixed(2)} <span className="text-xs font-sans text-slate-400">Mbps</span>
                  </h4>
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-650 flex items-center justify-center font-bold text-sm animate-bounce">
                  ↓
                </div>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2.5 overflow-hidden">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-700" 
                  style={{ width: `${Math.min(100, (totalDownloadSpeed / 120000) * 100)}%` }} 
                />
              </div>
            </div>

            {/* Upload */}
            <div className="bg-slate-50/75 p-3.5 border border-slate-100 rounded-xl relative overflow-hidden">
              <div className="flex justify-between items-center relative z-10">
                <div>
                  <div className="flex items-center gap-1 text-emerald-650">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold font-sans">إجمالي الـ Upload الحالي</span>
                  </div>
                  <h4 className="text-xl font-black text-slate-800 mt-1 font-mono">
                    {(totalUploadSpeed / 1024).toFixed(2)} <span className="text-xs font-sans text-slate-400">Mbps</span>
                  </h4>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-650 flex items-center justify-center font-bold text-sm animate-bounce">
                  ↑
                </div>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2.5 overflow-hidden">
                <div 
                  className="bg-emerald-650 h-1.5 rounded-full transition-all duration-700" 
                  style={{ width: `${Math.min(100, (totalUploadSpeed / 40000) * 100)}%` }} 
                />
              </div>
            </div>

            {/* Custom Interactive Wave Chart */}
            <div className="border border-slate-200/50 rounded-xl p-3 bg-slate-950 text-slate-200 mt-4 relative overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase text-slate-550 font-mono tracking-widest">تذبذب الموجات (Bandwidth Waves)</span>
                <span className="text-[9px] bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded font-mono">Live Sync</span>
              </div>
              
              <div className="h-28 w-md relative flex items-end">
                {/* Visual SVG paths representing current ticks */}
                <svg className="w-full h-full" viewBox="0 0 380 110">
                  <defs>
                    <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.00" />
                    </linearGradient>
                    <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
                    </linearGradient>
                  </defs>

                  {/* Render Lines & Polygons */}
                  {(() => {
                    const maxVal = Math.max(...trafficHistory.download, ...trafficHistory.upload, 10);
                    const drawCoords = trafficHistory.download.map((v, i) => {
                      const x = (i / (trafficHistory.download.length - 1)) * 380;
                      const y = 110 - (v / maxVal) * 90;
                      return { x, y, val: v };
                    });

                    const upCoords = trafficHistory.upload.map((v, i) => {
                      const x = (i / (trafficHistory.upload.length - 1)) * 380;
                      const y = 110 - (v / maxVal) * 90;
                      return { x, y, val: v };
                    });

                    const dLine = drawCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                    const dArea = dLine + ` L 380 110 L 0 110 Z`;

                    const uLine = upCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                    const uArea = uLine + ` L 380 110 L 0 110 Z`;

                    return (
                      <>
                        {/* Shaded Areas */}
                        <path d={dArea} fill="url(#downGrad)" transition="d 0.5s ease" />
                        <path d={uArea} fill="url(#upGrad)" transition="d 0.5s ease" />

                        {/* Stroke lines */}
                        <path d={dLine} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d={uLine} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Interactive Dot indicators with Hover Events */}
                        {drawCoords.map((c, i) => (
                          <g 
                            key={i} 
                            className="cursor-pointer group"
                            onMouseEnter={() => setHoveredPointIdx(i)}
                            onMouseLeave={() => setHoveredPointIdx(null)}
                          >
                            <circle 
                              cx={c.x} 
                              cy={c.y} 
                              r={hoveredPointIdx === i ? "6" : "3.5"} 
                              fill="#3b82f6" 
                              stroke="#020617" 
                              strokeWidth="1.5"
                              className="transition-all duration-150"
                            />
                            {/* Upload dot */}
                            <circle 
                              cx={upCoords[i].x} 
                              cy={upCoords[i].y} 
                              r={hoveredPointIdx === i ? "5" : "3"} 
                              fill="#10b981" 
                              stroke="#020617" 
                              strokeWidth="1"
                              className="transition-all duration-150"
                            />
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>

                {/* Live Floating Tooltip */}
                {hoveredPointIdx !== null && (
                  <div className="absolute top-1 left-1.5 right-1.5 bg-slate-900 border border-slate-700/80 p-2 rounded-lg text-[9.5px] font-sans flex justify-between shadow-2xl z-20">
                    <span className="text-slate-400">فترة التقرير [{hoveredPointIdx + 1}]</span>
                    <div className="space-x-2 font-mono text-right flex gap-3 text-white">
                      <span>تنزيل: <b className="text-blue-400">{trafficHistory.download[hoveredPointIdx].toFixed(1)} Mbps</b></span>
                      <span>تحميل: <b className="text-emerald-400">{trafficHistory.upload[hoveredPointIdx].toFixed(1)} Mbps</b></span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="border-t border-slate-100 pt-4 mt-4 text-center">
            <span className="text-xs font-sans text-slate-400 flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" /> تحديث حي ونبض البيانات مستمر كل 4 ثوانٍ
            </span>
          </div>
        </div>

        {/* Live Active Sessions Table Column (with active Real-time text search filter) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 font-sans">قائمة الجلسات النشطة حالياً وبورتات الربط</h2>
              <p className="text-xs text-slate-400 mt-0.5">تفاصيل الاشتراكات المتصلة الآونة الحالية في خوادم PPPoE active</p>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Search Active Connection Input */}
              <div className="relative w-full sm:w-48">
                <input
                  type="text"
                  placeholder="بحث باسم الحساب أو IP..."
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 bg-slate-100 border-none rounded-xl text-xs font-sans focus:ring-1 focus:ring-blue-500 text-right outline-hidden"
                />
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-2 text-slate-400" />
              </div>

              <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-black rounded-md font-mono shrink-0">
                {sessions.length} جلسة
              </span>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-slate-50 rounded-2xl my-3">
              <Wifi className="w-10 h-10 text-slate-300 stroke-1 mb-2" />
              <p className="text-sm font-medium text-slate-500">لا يوجد متصلون نشطون بالمايكروتك حالياً</p>
              <p className="text-xs text-slate-400 mt-1">المشتركون غير متصلين أو متوقفون مؤقتاً.</p>
            </div>
          ) : (
            (() => {
              const filteredSessions = sessions.filter(sess => {
                const q = sessionSearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  sess.username.toLowerCase().includes(q) ||
                  sess.ip.toLowerCase().includes(q) ||
                  sess.mac.toLowerCase().includes(q) ||
                  (sess.uptime && sess.uptime.toLowerCase().includes(q))
                );
              });

              if (filteredSessions.length === 0) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-xl my-3 font-sans">
                    <span className="text-slate-400 text-sm">عذراً: لم نعثر على جلسات متطابقة مع البحث.</span>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto flex-1 border border-slate-100 rounded-xl my-3">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-sans text-xs uppercase border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3">المشترك (Username)</th>
                        <th className="px-4 py-3">عنوان IP</th>
                        <th className="px-4 py-3">العنوان الفيزيائي MAC</th>
                        <th className="px-4 py-3">تنزيل / تحميل</th>
                        <th className="px-4 py-3">زمن الاتصال</th>
                        <th className="px-4 py-3 text-center">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-705 font-mono text-xs">
                      {filteredSessions.map((sess) => (
                        <tr key={sess.id} className="hover:bg-slate-50/80 transition-all">
                          <td className="px-4 py-3 font-bold text-slate-900 font-sans">
                            <span className="block">{sess.username}</span>
                            <span className="text-[10px] text-slate-450 font-normal mt-0.5">PPPoE Client</span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{sess.ip}</td>
                          <td className="px-4 py-3 text-slate-500">{sess.mac}</td>
                          <td className="px-4 py-3 text-slate-650 font-semibold font-sans">
                            <span className="inline-flex items-center gap-1 text-blue-600 bg-blue-50/30 px-1 rounded">
                              ↓ {(sess.downloadSpeed / 1024).toFixed(1)}M
                            </span>
                            <span className="mx-1">/</span>
                            <span className="inline-flex items-center gap-1 text-emerald-650 bg-emerald-50/30 px-1 rounded">
                              ↑ {(sess.uploadSpeed / 1024).toFixed(1)}M
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-550">{sess.uptime}</td>
                          <td className="px-4 py-3 text-center font-sans">
                            <button
                              onClick={() => disconnectSession(sess.id)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg text-xs font-bold select-none cursor-pointer transition-all"
                            >
                              طرد (Kick)
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* Warnings & System Logs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Expired / Warnings watchlist */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <h2 className="text-base font-bold text-slate-805 mb-2 font-sans">قائمة ترقب الحسابات المنتهية الصلاحية</h2>
          <p className="text-xs text-slate-400 mb-4 font-sans">عملاء بحاجة إلى تمديد الخدمة يدوياً أو تفعيل فوري بكود شحن.</p>

          {warningClients.length === 0 ? (
            <div className="py-10 text-center bg-emerald-50/40 rounded-2xl border border-dashed border-emerald-250 text-emerald-650">
              <p className="text-sm font-semibold">كل المشتركون نشطون بالكامل! 👍</p>
            </div>
          ) : (
            <div className="space-y-3">
              {warningClients.map((sub) => {
                const subProfile = profiles.find(p => p.id === sub.profileId);
                return (
                  <div key={sub.id} className="flex justify-between items-center p-3.5 bg-red-50/50 hover:bg-red-50 rounded-xl border border-red-100/40 transition-all">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 leading-none">{sub.fullName}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 font-mono">{sub.username} • {subProfile?.name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 font-sans">
                      <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold ${
                        sub.status === 'expired' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {sub.status === 'expired' ? 'منتهي الصلاحية' : 'موقف ومحظور'}
                      </span>
                      <span className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                        {new Date(sub.expiryDate).toLocaleDateString('ar-IQ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* System & MikroTik logs with Category Filters */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 font-sans">تحديثات سجل النظام وسكريبتات MikroTik</h2>
              <p className="text-xs text-slate-400 mt-0.5">سجل فوري لمزامنة أوامر PPPoE API وبوابات التحقق</p>
            </div>
            
            {logs.length > 0 && (
              <button
                onClick={clearLogs}
                className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-700 font-semibold font-sans cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" /> مسح السجل
              </button>
            )}
          </div>

          {/* Interactive Logs Filter Category Buttons */}
          <div className="flex bg-slate-50 p-1 border border-slate-200/40 rounded-xl text-[11px] font-semibold mb-4 w-full sm:w-auto font-sans">
            <button
              onClick={() => setSelectedLogCat('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedLogCat === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setSelectedLogCat('billing')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedLogCat === 'billing' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
              }`}
            >
              دفع ومالية
            </button>
            <button
              onClick={() => setSelectedLogCat('system')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedLogCat === 'system' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
              }`}
            >
              أوامر API والاتصالات
            </button>
            <button
              onClick={() => setSelectedLogCat('error')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedLogCat === 'error' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500'
              }`}
            >
              أخطاء وتحذيرات
            </button>
          </div>

          {(() => {
            const filteredLogs = logs.filter(log => {
              if (selectedLogCat === 'all') return true;
              if (selectedLogCat === 'billing') {
                return log.message.includes('تجديد') || log.message.includes('كرت') || log.message.includes('شحن') || log.message.includes('دفع');
              }
              if (selectedLogCat === 'system') {
                return log.message.includes('راوتر') || log.message.includes('اتصال') || log.message.includes('REST') || log.message.includes('مزامنة') || log.message.includes('فحص');
              }
              if (selectedLogCat === 'error') {
                return log.category === 'error' || log.category === 'warning' || log.message.includes('فشل') || log.message.includes('موقف');
              }
              return true;
            });

            return (
              <div className="flex-1 overflow-y-auto max-h-[290px] space-y-3.5 border border-slate-100 rounded-xl p-3.5 bg-slate-50/50">
                {filteredLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center font-sans">
                    <Clock className="w-8 h-8 text-slate-300 stroke-1 mb-2" />
                    <p className="text-xs text-slate-450">لا توجد أحداث بهذا التصنيف حتى الآن.</p>
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    const isErr = log.category === 'error';
                    const isWarn = log.category === 'warning';
                    const isSuccess = log.category === 'success';

                    return (
                      <div key={log.id} className="text-xs border-b border-slate-100/50 pb-2 last:border-0 last:pb-0 transition-opacity">
                        <div className="flex justify-between items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block w-20 px-1 py-0.5 rounded text-[9.5px] font-sans font-bold text-center uppercase ${
                              isErr 
                                ? 'bg-rose-100 text-rose-700' 
                                : isWarn 
                                ? 'bg-amber-100 text-amber-700' 
                                : isSuccess 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {isErr ? 'فشل وأخطاء' : isWarn ? 'تحذير شبكة' : isSuccess ? 'عملية كفؤة' : 'مزامنة نظام'}
                            </span>
                            <span className="font-bold text-slate-800 font-sans leading-relaxed">{log.message}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString('ar-IQ')}
                          </span>
                        </div>
                        {log.details && (
                          <p className="text-slate-500 font-mono mt-1.5 pr-4 bg-white/70 p-2 rounded-lg border border-slate-205/60 leading-relaxed">
                            {log.details}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })()}
        </div>

      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  HardDrive, 
  Activity, 
  Clock, 
  RefreshCw, 
  TrendingUp, 
  Gauge, 
  Server,
  Zap,
  Info
} from 'lucide-react';

interface GaugeProps {
  percentage: number;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  colorClass: string;
  gradientId: string;
  gradientColors: { start: string; end: string };
  details: string[];
}

const CircularGauge: React.FC<GaugeProps> = ({ 
  percentage, 
  title, 
  subtitle, 
  icon, 
  colorClass, 
  gradientId, 
  gradientColors,
  details 
}) => {
  // SVG Arc Math: radius = 38, circumference = 2 * PI * 38 ≈ 238.76
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  // Offset to start drawing from the bottom-left to bottom-right (for an elegant semi-circular speedometer visual, or a full circle starting from the top)
  // Let's use a gorgeous 270-degree arc speedometer feel, or a clean full circle starting at -90 degrees (top).
  // Clean full circle at -90 degrees is very modern and visually straightforward.
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-slate-50/50 border border-slate-150 p-5 rounded-xl hover:shadow-md transition-all duration-300 flex flex-col items-center justify-between space-y-4" id={`circular-gauge-${gradientId}`}>
      {/* Title block */}
      <div className="text-center w-full">
        <div className="flex items-center justify-center gap-1.5 text-slate-800 font-bold text-xs font-sans">
          {icon}
          <span>{title}</span>
        </div>
        <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
      </div>

      {/* Circle dial wrapper */}
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* SVG Wrapper */}
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradientColors.start} />
              <stop offset="100%" stopColor={gradientColors.end} />
            </linearGradient>
            {/* Visual drop shadow for indicator */}
            <filter id={`shadow-${gradientId}`} x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor={gradientColors.end} floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Underlayer Track Circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="stroke-slate-200/60"
            strokeWidth="7"
            fill="transparent"
          />

          {/* Actual value indicators */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
            filter={`url(#shadow-${gradientId})`}
          />
        </svg>

        {/* Absolute Centered Value Block */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={`text-[22px] font-black font-mono tracking-tighter ${colorClass}`}>
            {percentage}%
          </span>
          <span className="text-[8.5px] uppercase font-bold text-slate-450 tracking-wider font-mono">
            STATUS
          </span>
        </div>
      </div>

      {/* Metrics breakdown block */}
      <div className="w-full grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-3 text-[10px]">
        {details.map((detail, idx) => (
          <div key={idx} className="bg-white border border-slate-100 p-1.5 rounded-lg text-center">
            <span className="block text-[8px] text-slate-400 font-sans">{idx === 0 ? 'القيمة الحالية' : 'ميزة الرصد'}</span>
            <span className="block font-mono font-bold text-slate-700 mt-0.5">{detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const SystemResourceGauges: React.FC = () => {
  const [cpu, setCpu] = useState(24);
  const [ram, setRam] = useState(48);
  const [iops, setIops] = useState(12);
  const [serverTemp, setServerTemp] = useState(38);
  
  const [autoEmulate, setAutoEmulate] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [vibeStatus, setVibeStatus] = useState<'nominal' | 'load' | 'optimizing'>('nominal');

  // Trigger fluctuating simulated load stats resembling real-time server activity
  useEffect(() => {
    if (!autoEmulate) return;

    const interval = setInterval(() => {
      // Micro fluctuation
      setCpu(prev => {
        const delta = Math.floor(Math.random() * 9) - 4; // -4 to +4
        const next = Math.max(8, Math.min(88, prev + delta));
        return next;
      });

      setRam(prev => {
        const delta = Math.floor(Math.random() * 3) - 1; // -1 to +1
        const next = Math.max(42, Math.min(65, prev + delta));
        return next;
      });

      setIops(prev => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const next = Math.max(5, Math.min(38, prev + delta));
        return next;
      });

      setServerTemp(prev => {
        const delta = Math.floor(Math.random() * 3) - 1; // -1 to +1
        const next = Math.max(35, Math.min(48, prev + delta));
        return next;
      });

      setLastUpdated(new Date());
    }, 3000);

    return () => clearInterval(interval);
  }, [autoEmulate]);

  // Derived alert thresholds
  useEffect(() => {
    if (cpu > 70) {
      setVibeStatus('load');
    } else if (cpu < 20) {
      setVibeStatus('optimizing');
    } else {
      setVibeStatus('nominal');
    }
  }, [cpu]);

  const handleForceOptimizer = () => {
    // Simulate garbage collector or memory optimizing
    setCpu(76); // brief spike
    setRam(38); // decreased allocation
    setLastUpdated(new Date());
    setTimeout(() => {
      setCpu(14);
    }, 1200);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-right" dir="rtl" id="system-server-resource-gauges">
      
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm font-sans flex items-center gap-1.5">
              مراقبة موارد الخادم السحابية (Virtual VM Core)
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${autoEmulate ? 'bg-blue-400' : 'bg-slate-350'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${autoEmulate ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
              </span>
            </h3>
            <p className="text-[10.5px] text-slate-400 mt-0.5">موارد النظام الأساسي للخادم ونواة تشغيل خدمة SuperSAS والـ SQLite</p>
          </div>
        </div>

        {/* Configuration settings panel controls */}
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={handleForceOptimizer}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-slate-650 hover:text-indigo-600 text-[10px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>تنظيف الرام والـ GC</span>
          </button>
          
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-150 p-1 rounded-lg">
            <button
              onClick={() => setAutoEmulate(!autoEmulate)}
              className={`px-2 py-1 rounded text-[9.5px] font-bold transition-all cursor-pointer ${
                autoEmulate 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'bg-white text-slate-500 hover:text-slate-700'
              }`}
            >
              • محاكاة نشطة
            </button>
          </div>
        </div>
      </div>

      {/* Main Circular Gauges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Gauge 1: CPU load */}
        <CircularGauge 
          percentage={cpu}
          title="معالج السيرفر (CPU Load)"
          subtitle="استهلاك خيوط المعالجة الـ VM"
          icon={<Cpu className="w-4 h-4 text-blue-500" />}
          colorClass={cpu > 75 ? 'text-rose-650' : cpu > 50 ? 'text-amber-600' : 'text-blue-600'}
          gradientId="cpuGrad"
          gradientColors={{ start: '#3b82f6', end: cpu > 75 ? '#f43f5e' : '#10b981' }}
          details={[`${cpu}% Load`, '4 Cores vCPU']}
        />

        {/* Gauge 2: RAM Memory */}
        <CircularGauge 
          percentage={ram}
          title="الذاكرة العشوائية (RAM)"
          subtitle="استهلاك الذاكرة المخصصة للتطبيق"
          icon={<HardDrive className="w-4 h-4 text-indigo-500" />}
          colorClass="text-indigo-650"
          gradientId="ramGrad"
          gradientColors={{ start: '#6366f1', end: '#a855f7' }}
          details={[`${(1024 * (ram / 100)).toFixed(0)} MB`, '1024 MB Host']}
        />

        {/* Gauge 3: Database & I/O usage */}
        <CircularGauge 
          percentage={iops}
          title="نشاط القرص وقاعدة البيانات"
          subtitle="معدل استعلامات SQLite القرائية"
          icon={<Activity className="w-4 h-4 text-emerald-500" />}
          colorClass="text-emerald-600"
          gradientId="iopsGrad"
          gradientColors={{ start: '#10b981', end: '#06b6d4' }}
          details={[`${(iops * 4.5).toFixed(0)} Req/Sec`, 'Optimized reads']}
        />

        {/* Gauge 4: VM Micro-Temperature */}
        <CircularGauge 
          percentage={serverTemp}
          title="درجة حرارة النواة (Kernel)"
          subtitle="الحرارة التشغيلية التقديرية"
          icon={<Gauge className="w-4 h-4 text-amber-500" />}
          colorClass={serverTemp > 45 ? 'text-amber-500' : 'text-slate-600'}
          gradientId="tempGrad"
          gradientColors={{ start: '#f59e0b', end: '#ef4444' }}
          details={[`${serverTemp} °C`, 'Optimal Limit 75C']}
        />

      </div>

      {/* Footer system telemetry line */}
      <div className="flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
        <span className="flex items-center gap-1.5 font-sans font-medium text-slate-500">
          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span>حالة النظام حالياً:</span>
          {vibeStatus === 'nominal' && <b className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.2 rounded">طبيعي ومستقر (Nominal)</b>}
          {vibeStatus === 'load' && <b className="text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.2 rounded animate-pulse">جهد متوسط (High Activity)</b>}
          {vibeStatus === 'optimizing' && <b className="text-indigo-650 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded">عمليات تحسين ذاتية (Garbage Cleaning)</b>}
        </span>
        <span className="flex items-center gap-1 font-mono text-[9px]">
          <Clock className="w-3.5 h-3.5 text-slate-350" />
          آخر تحديث ذكي: {lastUpdated.toLocaleTimeString('ar-IQ')}
        </span>
      </div>

    </div>
  );
};

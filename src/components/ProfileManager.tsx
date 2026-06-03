import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { PPPoEProfile } from '../types';
import { 
  Plus, 
  Layers, 
  Wifi, 
  DollarSign, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Trash2, 
  Edit,
  Sliders,
  AlertCircle,
  Users,
  Info,
  Activity,
  Server,
  HelpCircle,
  TrendingUp,
  LineChart,
  Settings
} from 'lucide-react';

export const ProfileManager: React.FC = () => {
  const {
    profiles,
    addProfile,
    updateProfile,
    deleteProfile,
    currency,
    subscribers
  } = useSystem();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PPPoEProfile | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    localAddress: '',
    remoteAddressPool: '',
    rateLimit: '', // "10M/10M" (Up / Down)
    addressList: '',
    price: 0,
    validityDays: 30
  });

  // Navigation tab for Profile Manager internally
  const [pmTab, setPmTab] = useState<'profiles' | 'calculator'>('profiles');

  // Bandwidth calculator planning states
  const [contentionRatio, setContentionRatio] = useState<number>(10); // 1:10 Contention is standard ISP residential ratio
  const [concurrencyRate, setConcurrencyRate] = useState<number>(75); // 75% active subscribers at peak hour
  const [simulatedSubscribers, setSimulatedSubscribers] = useState<Record<string, number>>({});
  
  // Custom temporary speed plans for simulation
  const [customTiers, setCustomTiers] = useState<Array<{ id: string; name: string; downloadMbps: number; uploadMbps: number; count: number }>>([
    { id: 'custom-1', name: 'باقة منزلية سريعة 15 Mbps', downloadMbps: 15, uploadMbps: 5, count: 120 },
    { id: 'custom-2', name: 'باقة ذهبية فائقة 30 Mbps', downloadMbps: 30, uploadMbps: 10, count: 30 }
  ]);

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('باقة مخصصة جديدة');
  const [customDl, setCustomDl] = useState(20);
  const [customUl, setCustomUl] = useState(5);
  const [customCount, setCustomCount] = useState(25);

  const handleOpenAdd = () => {
    setEditingProfile(null);
    setFormData({
      name: '',
      localAddress: '10.0.10.1',
      remoteAddressPool: 'Economy_Pool',
      rateLimit: '15M/15M',
      addressList: 'ACTIVE_SUBSCRIBERS',
      price: 15000,
      validityDays: 30
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (profile: PPPoEProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      localAddress: profile.localAddress,
      remoteAddressPool: profile.remoteAddressPool,
      rateLimit: profile.rateLimit,
      addressList: profile.addressList,
      price: profile.price,
      validityDays: profile.validityDays
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.rateLimit || formData.price <= 0) {
      alert('الرجاء تعبئة بيانات الباقة المطلوبة بشكل صحيح.');
      return;
    }

    if (editingProfile) {
      updateProfile({
        ...editingProfile,
        ...formData
      });
    } else {
      addProfile(formData);
    }
    setModalOpen(false);
  };

  const formatPrice = (val: number) => {
    if (currency === 'IQD') {
      return `${val.toLocaleString('ar-IQ')} د.ع`;
    }
    return `$${Math.round(val / 1480)}`;
  };

  // Get count of registered users for a profile
  const getSubscribersCount = (profileId: string) => {
    return subscribers.filter(s => s.profileId === profileId).length;
  };

  // Helper to parse speed limits to numerical Mbps values (defaults to 15 Mbps if unable to parse)
  const parseSpeedToMbps = (rateLimit: string) => {
    try {
      const clean = rateLimit.trim().toLowerCase();
      // Expecting standard "upload/download" or just a single rate like "15M"
      const parts = clean.split('/');
      // In Mikrotik, rate-limit is usually "rx/tx" which is "upload/download"
      const rxPart = parts[0] || '10m';
      const txPart = parts[1] || parts[0] || '10m';

      const parseSingle = (str: string) => {
        const val = parseFloat(str) || 15;
        if (str.includes('k')) return val / 1000;
        if (str.includes('g')) return val * 1000;
        return val;
      };

      return {
        upload: parseSingle(rxPart),
        download: parseSingle(txPart)
      };
    } catch {
      return { upload: 5, download: 15 };
    }
  };

  const getSimulatedCount = (profileId: string) => {
    if (simulatedSubscribers[profileId] !== undefined) {
      return simulatedSubscribers[profileId];
    }
    return getSubscribersCount(profileId);
  };

  const updateSimulatedCount = (profileId: string, count: number) => {
    setSimulatedSubscribers(prev => ({
      ...prev,
      [profileId]: Math.max(0, count)
    }));
  };

  // Calculate aggregate metrics
  const calculateMetrics = () => {
    let totalDlTheoretical = 0;
    let totalUlTheoretical = 0;
    let totalSubscribersSimulated = 0;

    // 1. Official database profiles
    profiles.forEach(p => {
      const count = getSimulatedCount(p.id);
      const speeds = parseSpeedToMbps(p.rateLimit);
      totalDlTheoretical += count * speeds.download;
      totalUlTheoretical += count * speeds.upload;
      totalSubscribersSimulated += count;
    });

    // 2. Extra custom study profiles
    customTiers.forEach(t => {
      totalDlTheoretical += t.count * t.downloadMbps;
      totalUlTheoretical += t.count * t.uploadMbps;
      totalSubscribersSimulated += t.count;
    });

    // Peak demand considering sharing ratio & concurrency rate
    const activeDlWithContention = totalDlTheoretical / contentionRatio;
    const peakDlRequired = activeDlWithContention * (concurrencyRate / 100);

    const activeUlWithContention = totalUlTheoretical / contentionRatio;
    const peakUlRequired = activeUlWithContention * (concurrencyRate / 100);

    // Protocol & standard overhead buffer (10% extra)
    const overheadMultiplier = 1.1; 
    const finalDlWithOverhead = peakDlRequired * overheadMultiplier;
    const finalUlWithOverhead = peakUlRequired * overheadMultiplier;

    return {
      totalSubscribersSimulated,
      totalDlTheoretical,
      totalUlTheoretical,
      peakDlRequired,
      peakUlRequired,
      finalDlWithOverhead,
      finalUlWithOverhead
    };
  };

  const metrics = calculateMetrics();

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Upper sub-tabs navigation */}
      <div className="flex border-b border-slate-205 gap-6 font-sans text-xs -mb-2">
        <button
          onClick={() => setPmTab('profiles')}
          className={`pb-2.5 font-bold transition-all relative cursor-pointer ${
            pmTab === 'profiles' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          📋 قائمة باقات الاشتراك الحالية ({profiles.length})
        </button>
        <button
          onClick={() => setPmTab('calculator')}
          className={`pb-2.5 font-bold transition-all relative cursor-pointer flex items-center gap-1.5 ${
            pmTab === 'calculator' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-blue-500" />
          🧮 حاسبة النطاق الترددي وتثمين قدرة المايكروتك (CCR1009)
        </button>
      </div>

      {pmTab === 'profiles' ? (
        <>
          {/* Upper header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all duration-200 animate-in fade-in">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-sans">باقات السرعة وتحديد الاستهلاك</h2>
              <p className="text-xs text-slate-500 mt-0.5">تصميم وإدارة باقات الـ PPPoE وتحديد سرعة الرفع/التنزيل (Bandwidth Control) تلقائياً بالمايكروتك.</p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer shadow-md shadow-blue-500/20"
            >
              <Plus className="w-4 h-4 text-white" />
              تصميم باقة جديدة
            </button>
          </div>

          {/* Speed profiles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 transition-all duration-300 animate-in fade-in">
            {profiles.map(p => {
              // split speed rateLimit e.g. "15M/15M" -> [15M, 15M] -> upload limit, download limit
              const limits = p.rateLimit.split('/');
              const uploadLim = limits[0] || '15M';
              const downloadLim = limits[1] || '15M';
              
              const userCount = getSubscribersCount(p.id);

              return (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
                  {/* background speed decoration */}
                  <div className="absolute top-0 left-0 w-24 h-24 bg-slate-50 rounded-br-3xl -z-10 flex items-center justify-center text-slate-200 font-mono text-xs font-bold font-mono">
                    {p.rateLimit}
                  </div>

                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 font-sans">{p.name}</h3>
                        <p className="text-xs text-slate-400 mt-1 font-sans">معين لـ <span className="text-blue-600 font-semibold font-mono">{userCount}</span> مشترك نشط</p>
                      </div>
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg font-mono">
                        {formatPrice(p.price)}
                      </span>
                    </div>

                    {/* Speed Rates visualization */}
                    <div className="grid grid-cols-2 gap-3 my-6">
                      
                      {/* Download speed indicator */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                          <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
                          التحميل (Download)
                        </div>
                        <div className="text-lg font-bold text-slate-800 font-mono mt-1">{downloadLim}</div>
                      </div>

                      {/* Upload speed indicator */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                          الرفع (Upload)
                        </div>
                        <div className="text-lg font-bold text-slate-800 font-mono mt-1">{uploadLim}</div>
                      </div>

                    </div>

                    {/* Additional parameters list */}
                    <div className="space-y-2 border-t border-b border-slate-50 py-3 text-xs font-mono text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">حوض الآيبيهات (Remote Pool):</span>
                        <span className="text-slate-800 leading-none">{p.remoteAddressPool}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">الآي بي المحلي (Local Gateway):</span>
                        <span className="text-slate-800">{p.localAddress}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">قائمة العناوين (Address List):</span>
                        <span className="text-indigo-600 leading-none">{p.addressList || 'بدون'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">الأيام الصالحة (Validity Days):</span>
                        <span className="text-slate-800 font-sans">{p.validityDays} يوم</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-50 text-xs font-sans">
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-150 border border-slate-200 text-slate-700 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Edit className="w-3.5 h-3.5" /> تعديل الباقة
                    </button>
                    <button
                      onClick={() => {
                        if (userCount > 0) {
                          alert(`عذراً: لا يمكن حذف الباقة لأن هناك [${userCount}] مشترك مربوطين بها حالياً. قم بتحويلهم أولاً.`);
                          return;
                        }
                        if (confirm(`هل توافق على حذف الباقة [${p.name}] نهائياً من الشبكة؟`)) {
                          deleteProfile(p.id);
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-600 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> حذف
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Render Bandwidth Calculator Section */
        <div className="space-y-6 transition-all duration-300 animate-in fade-in">
          
          {/* Calculator Info Block */}
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-1/4 w-72 h-72 bg-blue-600/10 rounded-full filter blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1.5">
                <span className="inline-block px-2.5 py-0.5 bg-blue-500/15 border border-blue-500/30 rounded-md text-[10px] font-bold text-blue-400 font-mono tracking-wide">
                  ISP BANDWIDTH PLANNING ENGINE (75% PEAK STANDARD)
                </span>
                <h3 className="text-lg font-bold font-sans">حاسبة تقدير النطاق الترددي وتثمين جودة وأحمال البث</h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl font-sans">
                  تساعدك هذه الحاسبة في التقدير الرياضي الدقيق لحجم خط السحب الخارجي المغذي للشبكة (WAN Upstream Feed) بناءً على إجمالي عدد المشتركين المسجلين، نوع الباقات النشطة، ومعدل المشاركة (Contention Ratio) لضمان تقديم خدمة متزنة دون بطء في أوقات الذروة.
                </p>
              </div>
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-center shrink-0 min-w-36 font-mono">
                <span className="text-[10px] text-slate-450 block font-sans">إجمالي المشتركين قيد الدراسة</span>
                <span className="text-2xl font-black text-blue-400">{metrics.totalSubscribersSimulated}</span>
                <span className="text-[9px] text-slate-500 block mt-0.5 font-sans">مشترك نشط</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column (8 cols): Adjusters & Speed Tiers list */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Sliders Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <h4 className="text-xs font-bold text-slate-850 font-sans border-b border-slate-100 pb-2.5 flex items-center gap-1">
                  <Settings className="w-4 h-4 text-blue-600" />
                  إعدادات التشارك ومزامنات الذروة (Oversubscription Setup)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Contention Ratio */}
                  <div className="space-y-2 text-right">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">معدل تشارك القناة (Contention Ratio):</span>
                      <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                        1:{contentionRatio}
                      </span>
                    </div>
                    
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="1"
                      value={contentionRatio}
                      onChange={(e) => setContentionRatio(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600 mr-0 mt-2"
                    />

                    <p className="text-[10px] text-slate-450 leading-relaxed font-sans">
                      تشارك القناة يعني كم مشترك يشاركون سعة الميجا الواحدة بالتزامن. <strong>1:1</strong> خط ذهبي مخصص، <strong>1:5</strong> متميز فائق، <strong>1:10</strong> منزلي طبيعي متزن، <strong>1:15</strong> اقتصادي مقيد السرعات.
                    </p>

                    {/* Presets Grid */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1.5">
                      {[1, 5, 8, 10, 12, 15].map(ratio => {
                        const labels: Record<number, string> = { 1: 'مخصص', 5: 'فائق', 8: 'مميز', 10: 'منزلي', 12: 'اقتصادي', 15: 'محدود' };
                        return (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => setContentionRatio(ratio)}
                            className={`px-1 py-1.5 text-[9px] font-bold rounded-lg border text-center transition-all cursor-pointer ${
                              contentionRatio === ratio
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            1:{ratio} ({labels[ratio] || ratio})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Concurrency rate */}
                  <div className="space-y-2 text-right">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">معدل الاستخدام المتزامن الأقصى (Concurrency Rate):</span>
                      <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {concurrencyRate}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={concurrencyRate}
                      onChange={(e) => setConcurrencyRate(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600 mr-0 mt-2"
                    />

                    <p className="text-[10px] text-slate-450 leading-relaxed font-sans">
                      النسبة المتوقعة للمشتركين الذين يقومون بسحب البيانات وتصفح الإنترنت بكثافة قصوى في نفس اللحظة (وقت ذروة المساء). النسبة المعتدلة عالمياً هي <strong>70% - 80%</strong>.
                    </p>

                    <div className="grid grid-cols-3 gap-1.5 pt-1.5">
                      {[50, 75, 90].map(p => {
                        const labels: Record<number, string> = { 50: 'نشاط متدني', 75: 'ذروة طبيعية', 90: 'ذروة مكثفة' };
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setConcurrencyRate(p)}
                            className={`px-1.5 py-1.5 text-[9px] font-bold rounded-lg border text-center transition-all cursor-pointer ${
                              concurrencyRate === p
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {p}% ({labels[p] || p})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>

              {/* Tiers distribution */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-2.5">
                  <div className="text-right">
                    <h4 className="text-xs font-bold text-slate-850 font-sans flex items-center gap-1">
                      <Users className="w-4 h-4 text-indigo-500" />
                      توزيع المشتركين على حزم السرعة (Subscriber Speed Allocation)
                    </h4>
                    <p className="text-[10px] text-slate-450 font-sans mt-0.5">حدّد عدد المشتركين التقريبي لكل فئة سرعة لمحاكاة أحمالك وذروة الاستهلاك</p>
                  </div>

                  <button
                    onClick={() => setShowCustomForm(!showCustomForm)}
                    className="px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-150 border border-slate-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 select-none font-sans whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + إضافة باقة سرعة مخصصة للمحاكاة
                  </button>
                </div>

                {/* Simulated Extra Custom Tiers */}
                {showCustomForm && (
                  <div className="p-4 bg-slate-50 border border-dashed border-slate-250 rounded-xl space-y-3 font-sans text-xs transition-all duration-200">
                    <span className="font-bold text-slate-850 block">إدخال حزمة سرعة مخصصة للدراسة (تخيلية):</span>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-450 block mb-1">اسم الباقة المقترح</label>
                        <input
                          type="text"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-sans text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-450 block mb-1">سرعة التحميل (DL Mbps)</label>
                        <input
                          type="number"
                          value={customDl}
                          onChange={(e) => setCustomDl(Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-mono text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-450 block mb-1">سرعة الرفع (UL Mbps)</label>
                        <input
                          type="number"
                          value={customUl}
                          onChange={(e) => setCustomUl(Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-mono text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-450 block mb-1">عدد المستخدمين</label>
                        <input
                          type="number"
                          value={customCount}
                          onChange={(e) => setCustomCount(Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-mono text-slate-800"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setShowCustomForm(false)}
                        className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-[10px] font-sans text-slate-600"
                      >
                        إلغاء الأمر
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!customName) return;
                          setCustomTiers(prev => [
                            ...prev,
                            {
                              id: `custom-${Date.now()}`,
                              name: customName,
                              downloadMbps: customDl,
                              uploadMbps: customUl,
                              count: customCount
                            }
                          ]);
                          setShowCustomForm(false);
                        }}
                        className="px-3 py-1 bg-indigo-650 text-white rounded-md text-[10px] font-bold font-sans"
                      >
                        إضافة للتجربة
                      </button>
                    </div>
                  </div>
                )}

                {/* Plans List with Tactile controls */}
                <div className="space-y-3">
                  
                  {/* Official DB profiles */}
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
                    📋 باقات المشتركين الحقيقية في قاعدة البيانات (Live Sync Profiles):
                  </div>

                  {profiles.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">لا توجد باقات منشأة حتى الآن باللوحة.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {profiles.map(p => {
                        const currentVal = getSimulatedCount(p.id);
                        const speeds = parseSpeedToMbps(p.rateLimit);

                        return (
                          <div key={p.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                            <div className="space-y-0.5 text-right">
                              <span className="font-bold text-slate-800 font-sans block leading-snug">{p.name}</span>
                              <span className="text-[10px] text-slate-500 font-sans block">
                                سرعة محددة بالباقة: <code className="font-mono text-blue-600 bg-blue-50/60 px-1 py-0.5 rounded">{p.rateLimit}</code> (التنزيل الأساسي: <strong className="font-mono">{speeds.download} Mbps</strong>)
                              </span>
                            </div>

                            {/* Tactile adjustment */}
                            <div className="flex items-center gap-3">
                              <div className="text-right shrink-0">
                                <span className="text-[9px] text-slate-400 font-sans block select-none">عدد المشتركين:</span>
                                <span className="font-mono font-bold text-slate-700 text-xs">{currentVal} مستخدم</span>
                              </div>

                              <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0 shadow-3xs">
                                <button
                                  type="button"
                                  onClick={() => updateSimulatedCount(p.id, currentVal - 10)}
                                  className="px-2 py-1.5 hover:bg-slate-100 text-[10px] font-bold font-mono text-slate-400 hover:text-slate-800 border-l border-slate-150 transition-all cursor-pointer"
                                  title="طرح 10 مشتركين"
                                >
                                  -10
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateSimulatedCount(p.id, currentVal - 1)}
                                  className="px-2.5 py-1.5 hover:bg-slate-100 text-xs font-bold text-slate-500 border-l border-slate-150 transition-all cursor-pointer"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  value={currentVal}
                                  onChange={(e) => updateSimulatedCount(p.id, parseInt(e.target.value) || 0)}
                                  className="w-11 text-center py-1 bg-white text-xs font-mono font-bold text-slate-800 select-all focus:outline-hidden"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateSimulatedCount(p.id, currentVal + 1)}
                                  className="px-2.5 py-1.5 hover:bg-slate-100 text-xs font-bold text-slate-500 border-r border-slate-150 transition-all cursor-pointer"
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateSimulatedCount(p.id, currentVal + 10)}
                                  className="px-2 py-1.5 hover:bg-slate-100 text-[10px] font-bold font-mono text-slate-400 hover:text-slate-800 border-r border-slate-150 transition-all cursor-pointer"
                                  title="إضافة 10 مشتركين"
                                >
                                  +10
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Extra simulated custom tiers display */}
                  {customTiers.length > 0 && (
                    <>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans pt-3 border-t border-slate-100 mt-4">
                        🧪 باقات محاكاة إضافية للدراسة (Extra Study Tiers):
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {customTiers.map(t => (
                          <div key={t.id} className="p-3 bg-indigo-50/40 border border-indigo-100/60 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                            <div className="space-y-0.5 text-right">
                              <span className="font-bold text-slate-900 font-sans block flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                {t.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-sans block">
                                سرعة افتراضية: تنزيل <strong className="font-mono">{t.downloadMbps}M</strong> / رفع <strong className="font-mono">{t.uploadMbps}M</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right shrink-0">
                                <span className="text-[9px] text-slate-450 font-sans block select-none">عدد المستخدمين:</span>
                                <span className="font-mono font-bold text-indigo-700 text-xs">{t.count} مشترك</span>
                              </div>

                              <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0 shadow-3xs">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomTiers(prev => prev.map(item => item.id === t.id ? { ...item, count: Math.max(0, item.count - 10) } : item));
                                  }}
                                  className="px-2 py-1.5 hover:bg-indigo-50/50 text-[10px] font-mono font-bold text-slate-400 border-l border-slate-150 transition-all cursor-pointer"
                                >
                                  -10
                                </button>
                                <input
                                  type="number"
                                  value={t.count}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setCustomTiers(prev => prev.map(item => item.id === t.id ? { ...item, count: Math.max(0, val) } : item));
                                  }}
                                  className="w-11 text-center py-1 bg-white text-xs font-mono font-bold text-slate-800 focus:outline-hidden"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomTiers(prev => prev.map(item => item.id === t.id ? { ...item, count: item.count + 10 } : item));
                                  }}
                                  className="px-2 py-1.5 hover:bg-indigo-50/50 text-[10px] font-mono font-bold text-slate-400 border-r border-slate-150 transition-all cursor-pointer"
                                >
                                  +10
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomTiers(prev => prev.filter(item => item.id !== t.id));
                                  }}
                                  className="p-1 px-3 border-r border-slate-150 text-rose-500 hover:bg-rose-50 text-[11px] font-bold font-sans transition-all cursor-pointer"
                                >
                                  حذف
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                </div>
              </div>

            </div>

            {/* Right Column (4 cols): Calculation Outcomes Card */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Output Details Panel */}
              <div className="bg-slate-950 text-slate-100 p-5 rounded-2xl border border-slate-850 shadow-md space-y-4">
                <div className="border-b border-slate-850 pb-3">
                  <h4 className="text-xs font-bold text-blue-400 font-sans tracking-tight">🎯 نتائج النمذجة الإحصائية (ISP Output Capacity)</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-sans">تخمينات ذروة سحب البيانات لبرجك بالكامل</p>
                </div>

                <div className="space-y-4">
                  
                  {/* Theoretical Peak aggregate */}
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-[9.5px] text-slate-450 block font-sans">السرعة الإجمالية النظرية القصوى (Theoretical Max):</span>
                    <span className="text-lg font-bold font-mono text-slate-200 block text-left">
                      {metrics.totalDlTheoretical.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-xs text-slate-400 font-sans">Mbps</span>
                    </span>
                    <span className="text-[9px] text-slate-500 font-sans block leading-normal pt-1 border-t border-slate-850/60">
                      افتراض سحب جميع الـ {metrics.totalSubscribersSimulated} مستخدم لكامل سعاتهم في مجرى واحد بالمتزامن.
                    </span>
                  </div>

                  {/* Real WAN feed required */}
                  <div className="p-4 bg-blue-950/45 border border-blue-900/40 rounded-xl space-y-1 relative overflow-hidden">
                    <span className="text-[10px] text-blue-300 block font-sans font-bold">الحزمة الإجمالية المغذية المطلوبة (Real Peak WAN):</span>
                    <span className="text-2xl font-black font-mono text-blue-400 block text-left">
                      {metrics.finalDlWithOverhead.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-xs font-sans tracking-tight font-bold text-blue-300">Mbps</span>
                    </span>
                    <span className="text-[9px] text-slate-400 font-sans block leading-relaxed mt-1">
                      سعة خط السحب الذي يجب شراؤه من المصدر (الفايبر أو الرابط المكرس) بافتراض نسبة تشارك <strong>1:{contentionRatio}</strong> ونشاط ذروة <strong>{concurrencyRate}%</strong>، مع حزمة حماية بروتوكولية بنسبة 10%.
                    </span>
                  </div>

                  {/* Upload speed feed */}
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-[9.5px] text-emerald-450 block font-sans">حزمة الرفع المطلوبة (Peak WAN Upload):</span>
                    <span className="text-base font-bold font-mono text-emerald-400 block text-left">
                      {metrics.finalUlWithOverhead.toLocaleString('en-US', { maximumFractionDigits: 1 })} <span className="text-xs text-slate-400 font-sans">Mbps</span>
                    </span>
                  </div>

                </div>

                {/* Hardware compatibility assessment dynamically */}
                <div className="pt-2 border-t border-slate-850 space-y-3 font-sans text-xs">
                  <span className="font-bold text-slate-350 block">🧠 تقييم توافق وتخمين حيز المعالجة بالروتر:</span>

                  {metrics.finalDlWithOverhead < 120 ? (
                    <div className="p-3.5 bg-emerald-950/50 border border-emerald-900/60 text-emerald-400 rounded-xl space-y-1 text-[11px] leading-relaxed">
                      <strong className="font-sans block flex items-center gap-1">🟢 حالة معالجة CCR / PC ممتازة وآمنة للغاية</strong>
                      <p className="text-slate-300 text-[10px]">
                        خط الإنترنت المطلوب خفيف جداً ({metrics.finalDlWithOverhead.toFixed(0)} Mbps). جهاز <strong>CCR1009</strong> ذو الـ 9 أنوية سيعمل بأقل من <strong>5% CPU</strong>. تفعيل المنظومة لو على Mini PC بسيط سيحقق استقراراً فائق السرعة وبلا أي جهد يذكر!
                      </p>
                    </div>
                  ) : metrics.finalDlWithOverhead < 380 ? (
                    <div className="p-3.5 bg-blue-950/50 border border-blue-900/60 text-blue-400 rounded-xl space-y-1 text-[11px] leading-relaxed">
                      <strong className="font-sans block flex items-center gap-1">🔵 أفضل توافق قياسي ومطابق مريح جداً</strong>
                      <p className="text-slate-300 text-[10px]">
                        خط السحب المقدر بـ ({metrics.finalDlWithOverhead.toFixed(0)} Mbps) يعتبر النطاق الذهبي والأمثل لجهاز <strong>CCR1009</strong>. سيعمل المعالج تحت حزم الـ Queues بكل رياضة ولن تزيد نسبة الـ CPU عن <strong>10% إلى 20%</strong>، مما يعني استقراراً تاماً للمشتركين وقدرتك على الدخول للومة من أي مكان بلا قيود!
                      </p>
                    </div>
                  ) : metrics.finalDlWithOverhead < 850 ? (
                    <div className="p-3.5 bg-amber-950/50 border border-amber-900/60 text-amber-500 rounded-xl space-y-1 text-[11px] leading-relaxed">
                      <strong className="font-sans block flex items-center gap-1">🟡 سعة مرتفعة: مطلوب تفعيل الـ FastPath بالمايكروتك</strong>
                      <p className="text-slate-300 text-[10px]">
                        معدل سحب البيانات ({metrics.finalDlWithOverhead.toFixed(0)} Mbps) يشكل حملاً ملحوظاً على CCR1009 (استهلاك 35%-60%). ننصح بتفعيل <strong>FastPath / Fasttrack</strong> في جدار الحماية للمايكروتك، أو توكيل مهام الـ Billing وعمليات الـ API باللوحة للـ <strong>Mini PC</strong> لتخفيف معالجة CCR1009!
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-rose-950/50 border border-rose-900/60 text-rose-400 rounded-xl space-y-1 text-[11px] leading-relaxed">
                      <strong className="font-sans block flex items-center gap-1">🔴 تنبيه: سعة كبيرة جداً تقترب من أقصى طاقة CCR1009</strong>
                      <p className="text-slate-300 text-[10px]">
                        سعة إنترنت تفوق الـ ({metrics.finalDlWithOverhead.toFixed(0)} Mbps) تتطلب ترقية جهاز المعالجة الرئيسي للمايكروتك إلى <strong>CCR2004</strong> ذو البنية رباعية النواة ARM64، أو الاعتماد على سيرفر <strong>Mini PC</strong> قوي كبوابة داتا أساسية لتوزيع الـ Queues!
                      </p>
                    </div>
                  )}

                  <div className="bg-slate-900 border border-slate-850 p-3 rounded-xl text-[10px] text-slate-400 leading-normal space-y-1">
                    <span className="font-bold text-slate-350 block leading-none">💡 خلاصة وتوصية للمنظومة:</span>
                    <p>
                      لتشغيل ما بين <strong>100 إلى 200 مشترك</strong> بسرعات عالية (15-20 ميجا لكل مستخدم)، تظهر الدراسة أن إجمالي السحب الفعلي وقت الذروة سيكون <strong>ممتازاً ومؤمناً بالكامل</strong> على جهازك الـ CCR1009 ولن تعاني المنظومة من أي بطء أو تجميد في الباقات!
                    </p>
                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* Profile Form Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-100 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-950 text-white flex justify-between items-center">
              <h3 className="font-bold text-base font-sans">
                {editingProfile ? 'تعديل تفاصيل باقة الـ PPPoE' : 'إنشاء باقة سرعة وQueue جديد'}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {/* Profile Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم باقة الاشتراك الفرعي <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="مثال: اشتراك فائق مبرمج 60 Mbps"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-sans"
                />
              </div>

              {/* RateLimit & addresslist */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تحديد السرعة (Rate Limit) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 30M/30M أو 10M/20M"
                    value={formData.rateLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, rateLimit: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal font-sans">الصيغة: الرفع/التنزيل بالمايكروتك (مثال: UploadM/DownloadM).</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تجميع في Address List</label>
                  <input
                    type="text"
                    required
                    placeholder="ACTIVE_SUBSCRIBERS"
                    value={formData.addressList}
                    onChange={(e) => setFormData(prev => ({ ...prev, addressList: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal font-sans">تسمح لك بحجب أو فلترة حركة بيانات الباقة من جدار الحماية (Firewall).</p>
                </div>
              </div>

              {/* Gateway local address and Remote DHCP pool */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الآي بي المحلي للـ Server (Local Address)</label>
                  <input
                    type="text"
                    required
                    placeholder="10.0.10.1"
                    value={formData.localAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, localAddress: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حوض التوزيع البعيد (Remote Address Pool)</label>
                  <input
                    type="text"
                    required
                    placeholder="DHCP_Pool_Premium"
                    value={formData.remoteAddressPool}
                    onChange={(e) => setFormData(prev => ({ ...prev, remoteAddressPool: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Price and Validity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر الباقة المقدر <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="30000"
                    value={formData.price || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">صلاحية التفعيل (أيام)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.validityDays}
                    onChange={(e) => setFormData(prev => ({ ...prev, validityDays: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Simulated Queue disclaimer */}
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 flex items-start gap-2 text-[11px] text-amber-800 leading-relaxed font-sans mt-2">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  تنبيه: عند إنشاء الباقة، سيقوم نظام SuperSAS بتصدير أوامر إنشاء الـ Profile والـ Address List لمزامنتها آلياً عبر API أو كود الطرفية في صفحة المايكروتك بنقرة واحدة.
                </div>
              </div>

              {/* Submits */}
              <div className="border-t border-slate-100 pt-4 mt-6 flex justify-end gap-2 text-sm font-sans">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer font-medium"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer font-semibold shadow-xs"
                >
                  حفظ وتزامن الباقة
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

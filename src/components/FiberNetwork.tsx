import React, { useState, useEffect } from 'react';
import { useSystem } from '../context/SystemContext';
import { OltDevice, OnuSignal } from '../types';
import { 
  Network, 
  Wifi, 
  RefreshCw, 
  PlusCircle, 
  Settings, 
  Check, 
  Trash2, 
  Plug, 
  Info, 
  Search, 
  Link, 
  Cpu, 
  AlertTriangle, 
  Signal, 
  MapPin, 
  Zap, 
  CheckCircle,
  HelpCircle,
  AlertOctagon,
  Loader2
} from 'lucide-react';

export default function FiberNetwork() {
  const { subscribers, token } = useSystem();
  
  // Data State
  const [oltDevices, setOltDevices] = useState<OltDevice[]>([]);
  const [onuSignals, setOnuSignals] = useState<OnuSignal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingAll, setSyncingAll] = useState<boolean>(false);
  const [syncingOltId, setSyncingOltId] = useState<string | null>(null);
  const [testingOltId, setTestingOltId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Filtering / Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'excellent' | 'good' | 'warning' | 'critical' | 'offline'>('all');

  // Modal State
  const [oltModalOpen, setOltModalOpen] = useState<boolean>(false);
  const [editingOlt, setEditingOlt] = useState<OltDevice | null>(null);
  const [oltForm, setOltForm] = useState({
    name: '',
    ip: '',
    port: 22,
    username: 'admin',
    password: '',
    model: 'VSOL V1600G1'
  });

  // Subscriber Link Dropdown State
  const [linkingSignalId, setLinkingSignalId] = useState<string | null>(null);

  // Auth Headers helper
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  // Fetch OLT & Signals Data
  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = getHeaders();
      const [oltRes, signalsRes] = await Promise.all([
        fetch('/api/olt', { headers }),
        fetch('/api/olt/signals/all', { headers })
      ]);

      if (oltRes.ok) {
        const olts = await oltRes.json();
        setOltDevices(olts);
      }
      if (signalsRes.ok) {
        const sigs = await signalsRes.json();
        setOnuSignals(sigs);
      }
    } catch (err: any) {
      setErrorMessage('فشل في استرداد بيانات شبكة الألياف: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh automatically every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync All OLTs
  const handleSyncAll = async () => {
    if (oltDevices.length === 0) return;
    try {
      setSyncingAll(true);
      setErrorMessage('');
      setSuccessMessage('');
      let totalSynced = 0;

      for (const olt of oltDevices) {
        const headers = getHeaders();
        const res = await fetch(`/api/olt/${olt.id}/sync`, { method: 'POST', headers });
        if (res.ok) {
          const data = await res.json();
          totalSynced += (data.synced || 0);
        }
      }

      setSuccessMessage(`تمت المزامنة بنجاح لجميع الأجهزة: تم فحص وإدخال ${totalSynced} حساب ONU.`);
      fetchData();
    } catch (err: any) {
      setErrorMessage('خطأ أثناء المزامنة الجماعية: ' + err.message);
    } finally {
      setSyncingAll(false);
    }
  };

  // Sync Single OLT
  const handleSyncSingle = async (id: string, name: string) => {
    try {
      setSyncingOltId(id);
      setErrorMessage('');
      setSuccessMessage('');
      
      const headers = getHeaders();
      const res = await fetch(`/api/olt/${id}/sync`, { method: 'POST', headers });
      const data = await res.json();

      if (res.ok) {
        setSuccessMessage(`تمت مزامنة جهاز (${name}) بنجاح: تم تحديث ${data.synced || 0} حسابات ONU.`);
        fetchData();
      } else {
        setErrorMessage(data.error || `فشل في مزامنة الجهاز ${name}`);
      }
    } catch (err: any) {
      setErrorMessage('خطأ أثناء المزامنة: ' + err.message);
    } finally {
      setSyncingOltId(null);
    }
  };

  // Test Single Connection
  const handleTestConnection = async (id: string, name: string) => {
    try {
      setTestingOltId(id);
      setErrorMessage('');
      setSuccessMessage('');

      const headers = getHeaders();
      const res = await fetch(`/api/olt/${id}/test`, { method: 'POST', headers });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage(data.message || `تم الاتصال بنجاح بجهاز OLT (${name}) وقراءة بيانات النظام.`);
        fetchData();
      } else {
        setErrorMessage(data.message || `فشل اختبار الاتصال بجهاز ${name}. تأكد من بيانات الاعتماد وعنوان IP.`);
        fetchData();
      }
    } catch (err: any) {
      setErrorMessage('فشل في إجراء الاختبار: ' + err.message);
    } finally {
      setTestingOltId(null);
    }
  };

  // Create or Update OLT
  const handleSubmitOlt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setErrorMessage('');
      const headers = getHeaders();
      const isEdit = !!editingOlt;
      const url = isEdit ? `/api/olt/${editingOlt?.id}` : '/api/olt';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(oltForm)
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(isEdit ? 'تم تعديل جهاز OLT وحفظ التغييرات بنجاح.' : 'تم إضافة جهاز OLT جديد بنجاح.');
        setOltModalOpen(false);
        setEditingOlt(null);
        fetchData();
      } else {
        setErrorMessage(data.error || 'حدث خطأ أثناء حفظ الجهاز.');
      }
    } catch (err: any) {
      setErrorMessage('فشل الحفظ: ' + err.message);
    }
  };

  // Edit OLT Intent Setup
  const openEditModal = (olt: OltDevice) => {
    setEditingOlt(olt);
    setOltForm({
      name: olt.name,
      ip: olt.ip,
      port: olt.port,
      username: olt.username,
      password: '', // masked input behavior for password security
      model: olt.model
    });
    setOltModalOpen(true);
  };

  // Delete OLT
  const handleDeleteOlt = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف جهاز OLT (${name})؟ سيؤدي ذلك أيضاً إلى إزالة كافة إشارات الأجهزة التابعة له.`)) {
      return;
    }
    try {
      setErrorMessage('');
      const headers = getHeaders();
      const res = await fetch(`/api/olt/${id}`, { method: 'DELETE', headers });
      
      if (res.ok) {
        setSuccessMessage(`تم حذف جهاز OLT (${name}) بنجاح.`);
        fetchData();
      } else {
        const data = await res.json();
        setErrorMessage(data.error || 'فشل حذف جهاز OLT.');
      }
    } catch (err: any) {
      setErrorMessage('فشل الحذف: ' + err.message);
    }
  };

  // Link ONU Signal to Subscriber
  const handleLinkSubscriber = async (signalId: string, subId: string | null) => {
    try {
      setErrorMessage('');
      const headers = getHeaders();
      const res = await fetch(`/api/olt/signals/${signalId}/link`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ subscriberId: subId })
      });

      if (res.ok) {
        setSuccessMessage('تم ربط حساب الـ ONU بالمشترك بنجاح.');
        setLinkingSignalId(null);
        fetchData();
      } else {
        const data = await res.json();
        setErrorMessage(data.error || 'فشل ربط جهاز ONU.');
      }
    } catch (err: any) {
      setErrorMessage('خطأ في عملية الربط: ' + err.message);
    }
  };

  // Reset Modal Form
  const openAddModal = () => {
    setEditingOlt(null);
    setOltForm({
      name: '',
      ip: '',
      port: 22,
      username: 'admin',
      password: '',
      model: 'VSOL V1600G1'
    });
    setOltModalOpen(true);
  };

  // --- Calculations for Summaries ---
  const totalOnus = onuSignals.length;
  const onlineOnus = onuSignals.filter(s => s.status === 'active').length;
  const offlineOnus = onuSignals.filter(s => s.status === 'offline').length;
  const warningOrCriticalOnus = onuSignals.filter(s => {
    const isOnline = s.status === 'active';
    const rx = s.rxPower;
    return isOnline && rx !== null && rx < -20; // Warn + Critical count (any rx less than excellent -20dBm)
  }).length;

  // Filter and search logic
  const filteredSignals = onuSignals.filter(s => {
    // 1. Filter by quality
    if (activeFilter !== 'all') {
      if (activeFilter === 'offline') {
        if (s.status !== 'offline' && s.rxPower !== null) return false;
      } else if (s.signalQuality !== activeFilter) {
        return false;
      }
    }

    // 2. Filter by search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const subName = (s.subscriberName || '').toLowerCase();
      const subUser = (s.subscriberUsername || '').toLowerCase();
      const serial = (s.onuSerial || '').toLowerCase();
      const port = (s.oltPort || '').toLowerCase();
      
      return subName.includes(q) || subUser.includes(q) || serial.includes(q) || port.includes(q);
    }

    return true;
  });

  // Quality badge formatter
  const renderQualityBadge = (quality?: 'excellent' | 'good' | 'warning' | 'critical' | 'offline') => {
    switch (quality) {
      case 'excellent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" /> ممتازة
          </span>
        );
      case 'good':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Check className="w-3.5 h-3.5" /> جيدة
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" /> تحذير متدني
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 animate-bounce">
            <AlertOctagon className="w-3.5 h-3.5" /> إشارة حرجة
          </span>
        );
      case 'offline':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
            <Plug className="w-3.5 h-3.5" /> غير متصل
          </span>
        );
    }
  };

  // Row coding dynamic styles
  const getRowStyle = (quality?: 'excellent' | 'good' | 'warning' | 'critical' | 'offline') => {
    switch (quality) {
      case 'excellent':
        return 'bg-emerald-50/10 hover:bg-emerald-50/20 text-slate-800';
      case 'good':
        return 'bg-blue-50/10 hover:bg-blue-50/20 text-slate-800';
      case 'warning':
        return 'bg-amber-50/20 hover:bg-amber-50/30 text-slate-800 font-medium';
      case 'critical':
        return 'bg-rose-50/20 hover:bg-rose-50/30 text-rose-900 font-bold';
      case 'offline':
      default:
        return 'bg-slate-50/50 hover:bg-slate-50 text-slate-400';
    }
  };

  // Signal Power Display colorizer
  const renderPower = (power: number | null, limit: 'rx' | 'tx') => {
    if (power === null) return <span className="text-slate-400 font-mono">-</span>;
    let colorClass = 'text-slate-600';
    
    if (limit === 'rx') {
      if (power >= -20) colorClass = 'text-emerald-600 font-black';
      else if (power >= -25) colorClass = 'text-blue-600 font-bold';
      else if (power >= -27) colorClass = 'text-amber-600 font-bold';
      else colorClass = 'text-rose-600 font-black';
    }

    return (
      <span className={`font-mono text-xs ${colorClass}`}>
        {power.toFixed(2)} dBm
      </span>
    );
  };

  // Distance formatter
  const renderDistance = (distance: number | null) => {
    if (distance === null) return <span className="text-slate-400">-</span>;
    if (distance < 1000) {
      return <span className="font-mono text-slate-700">{distance} م</span>;
    } else {
      return <span className="font-mono text-slate-700">{(distance / 1000).toFixed(2)} كم</span>;
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 justify-end sm:justify-start">
            <h1 className="text-2xl font-extrabold text-slate-900 font-sans tracking-tight">شبكة الألياف البصرية (GPON)</h1>
            <div className="bg-blue-100 text-blue-700 p-1.5 rounded-lg">
              <Network className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1">مراقبة مستويات الإشارات والمسافات لأجهزة الألياف OLT — قراءة فقط</p>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={handleSyncAll}
            disabled={syncingAll || oltDevices.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-extrabold rounded-xl transition duration-200 text-sm cursor-pointer shadow-sm active:scale-98"
          >
            {syncingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            مزامنة الكل
          </button>
          
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition duration-200 text-sm cursor-pointer shadow-sm active:scale-98"
          >
            <PlusCircle className="w-4 h-4" />
            إضافة جهاز OLT
          </button>
        </div>
      </div>

      {/* SAFETY WARNING BANNER */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200/50 p-4 rounded-xl text-blue-800 text-sm shadow-xs leading-relaxed">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold text-blue-900 block mb-0.5">ℹ️ هذا القسم للمراقبة فقط — لا يُجري أي تغيير على إعدادات الـ OLT</span>
          <span className="text-xs text-blue-700">للأمان الأقصى وحماية أجهزتك، يُنصح دائماً بإنشاء حساب وصلاحيات للقراءة فقط (Read-Only User) على الـ VSOL واستخدامه هنا بدل حساب الأدمن الكامل لضمان حظر أي أوامر عرضية بشكل حاسم.</span>
        </div>
      </div>

      {/* FEEDBACK MASSAGES */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800 text-sm flex items-center justify-between gap-2">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="p-1 hover:bg-rose-100 rounded text-rose-900 font-bold">×</button>
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 text-sm flex items-center justify-between gap-2">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="p-1 hover:bg-emerald-100 rounded text-emerald-900 font-bold">×</button>
        </div>
      )}

      {/* OLT DEVICES SHEETS LIST */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5 justify-start">
          <Cpu className="w-4 h-4 text-slate-500" />
          أجهزة OLT المضافة والمتاحة للاتصال ({oltDevices.length})
        </h2>

        {oltDevices.length === 0 ? (
          <div className="bg-white border border-slate-200 border-dashed p-10 rounded-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 border border-slate-200/60 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Network className="w-8 h-8" />
            </div>
            <div>
              <p className="font-extrabold text-slate-800">لا توجد أجهزة OLT مضافة حتى الآن</p>
              <p className="text-xs text-slate-400 mt-1">اضغط على زر (إضافة جهاز OLT) للبدء في ربط ومراقبة شبكة الألياف الخاصة بك</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {oltDevices.map((olt) => (
              <div key={olt.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition gap-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    {/* Status Badge */}
                    {olt.status === 'online' ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold">● متصل</span>
                    ) : olt.status === 'error' ? (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs px-2.5 py-0.5 rounded-full font-bold">● خطأ اتصال</span>
                    ) : (
                      <span className="bg-slate-50 text-slate-500 border border-slate-200 text-xs px-2.5 py-0.5 rounded-full font-medium">● غير متصل</span>
                    )}

                    <div className="text-right">
                      <h3 className="font-extrabold text-slate-800">{olt.name}</h3>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{olt.model}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/40 text-xs space-y-1.5 font-mono text-slate-600 text-left">
                    <div className="flex justify-between">
                      <span className="font-bold">{olt.ip}:{olt.port}</span>
                      <span className="text-slate-400">IP ADDRESS:</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">{olt.username}</span>
                      <span className="text-slate-400">SSH USER:</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span className="font-mono text-slate-500">
                      {olt.lastSync ? new Date(olt.lastSync).toLocaleString('ar-YE', {hour:'2-digit',minute:'2-digit'}) : 'لم يسبق المزامنة'}
                    </span>
                    <span>آخر مزامنة:</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 pt-1">
                    {/* Sync Button */}
                    <button
                      onClick={() => handleSyncSingle(olt.id, olt.name)}
                      disabled={syncingOltId === olt.id}
                      title="مزامنة قراءة الأجهزة"
                      className="px-2 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:bg-slate-50 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {syncingOltId === olt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </button>

                    {/* Test Connection Button */}
                    <button
                      onClick={() => handleTestConnection(olt.id, olt.name)}
                      disabled={testingOltId === olt.id}
                      title="اختبار اتصال SSH"
                      className="px-2 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:bg-slate-50 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {testingOltId === olt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => openEditModal(olt)}
                      title="تعديل الإعدادات"
                      className="px-2 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteOlt(olt.id, olt.name)}
                      title="حذف الجهاز"
                      className="px-2 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SUMMARY CARDS METRICS BAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total ONUs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs text-slate-400 font-bold">إجمالي أجهزة ONUs</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-800 font-mono">{totalOnus}</span>
            <div className="bg-slate-100 text-slate-600 p-1 rounded-lg">
              <Network className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Active ONUs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs text-slate-400 font-bold">متصلة ونشطة</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-emerald-600 font-mono">{onlineOnus}</span>
            <div className="bg-emerald-50 text-emerald-600 p-1 rounded-lg">
              <Wifi className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Warning + Critical ONUs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs text-slate-400 font-bold">مستويات إشارة متدنية</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-amber-500 font-mono">{warningOrCriticalOnus}</span>
            <div className="bg-amber-50 text-amber-500 p-1 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Offline ONUs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs text-slate-400 font-bold">غير متصلة (Offline)</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-400 font-mono">{offlineOnus}</span>
            <div className="bg-slate-100 text-slate-400 p-1 rounded-lg">
              <Plug className="w-4 h-4" />
            </div>
          </div>
        </div>

      </div>

      {/* FILTER BUTTONS & FILTERS ROW */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Search box */}
          <div className="relative w-full md:max-w-md">
            <input
              type="text"
              placeholder="بحث بالمشترك، السيريال، المنفذ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-right"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Quality filters */}
          <div className="flex flex-wrap items-center gap-1 justify-end">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 cursor-pointer ${activeFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              الكل ({onuSignals.length})
            </button>
            
            <button
              onClick={() => setActiveFilter('excellent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 cursor-pointer ${activeFilter === 'excellent' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100'}`}
            >
              إشارة ممتازة ({onuSignals.filter(s => s.signalQuality === 'excellent').length})
            </button>

            <button
              onClick={() => setActiveFilter('good')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 cursor-pointer ${activeFilter === 'good' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100'}`}
            >
              إشارة جيدة ({onuSignals.filter(s => s.signalQuality === 'good').length})
            </button>

            <button
              onClick={() => setActiveFilter('warning')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 cursor-pointer ${activeFilter === 'warning' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100'}`}
            >
              تحذير ({onuSignals.filter(s => s.signalQuality === 'warning').length})
            </button>

            <button
              onClick={() => setActiveFilter('critical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 cursor-pointer ${activeFilter === 'critical' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100'}`}
            >
              مستوى حرج ({onuSignals.filter(s => s.signalQuality === 'critical').length})
            </button>

            <button
              onClick={() => setActiveFilter('offline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 cursor-pointer ${activeFilter === 'offline' ? 'bg-slate-500 text-white' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}`}
            >
              غير متصل ({onuSignals.filter(s => s.status === 'offline').length})
            </button>
          </div>

        </div>

        {/* ONU SIGNALS TABLE */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-right border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <th className="p-3 text-center">#</th>
                <th className="p-3">منفذ OLT</th>
                <th className="p-3">رقم السيريال (Serial)</th>
                <th className="p-3">المشترك المرتبط</th>
                <th className="p-3 text-center">الجودة والتقييم</th>
                <th className="p-3 text-center">مستوى الاستقبال (RX)</th>
                <th className="p-3 text-center">مستوى الإرسال (TX)</th>
                <th className="p-3 text-center">المسافة</th>
                <th className="p-3 text-left">آخر تحديث</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Skeletons count
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-slate-100">
                    <td className="p-4 text-center"><div className="h-4 bg-slate-200 rounded-sm w-4 mx-auto"></div></td>
                    <td className="p-4"><div className="h-4 bg-slate-200 rounded-sm w-20"></div></td>
                    <td className="p-4"><div className="h-4 bg-slate-200 rounded-sm w-36"></div></td>
                    <td className="p-4"><div className="h-4 bg-slate-200 rounded-sm w-44"></div></td>
                    <td className="p-4 text-center"><div className="h-6 bg-slate-200 rounded-full w-24 mx-auto"></div></td>
                    <td className="p-4 text-center"><div className="h-4 bg-slate-200 rounded-sm w-16 mx-auto"></div></td>
                    <td className="p-4 text-center"><div className="h-4 bg-slate-200 rounded-sm w-16 mx-auto"></div></td>
                    <td className="p-4 text-center"><div className="h-4 bg-slate-200 rounded-sm w-12 mx-auto"></div></td>
                    <td className="p-4 text-left"><div className="h-4 bg-slate-200 rounded-sm w-24 mr-auto"></div></td>
                  </tr>
                ))
              ) : filteredSignals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-sans">
                    لا تتوفر أي إشارات مطابقة لبحثك أو أن الأجهزة لم تجرِ أي مزامنة بعد.
                  </td>
                </tr>
              ) : (
                filteredSignals.map((sig, idx) => (
                  <tr key={sig.id} className={`border-b border-slate-100 ${getRowStyle(sig.signalQuality)} transition`}>
                    <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-mono text-xs font-bold text-slate-800">
                        {sig.oltPort} <span className="text-slate-400">/ ID: {sig.onuIndex}</span>
                      </div>
                      {sig.oltName && <p className="text-[10px] text-slate-400">{sig.oltName}</p>}
                    </td>
                    <td className="p-3 font-mono text-xs uppercase tracking-wider text-slate-600">{sig.onuSerial}</td>
                    
                    {/* Subscriber link column */}
                    <td className="p-3">
                      {sig.subscriberId ? (
                        <div className="flex items-center gap-2 justify-start group">
                          <div>
                            <span className="font-extrabold text-blue-800 block text-xs">{sig.subscriberName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">PPPoE: {sig.subscriberUsername}</span>
                          </div>
                          
                          <button
                            onClick={() => setLinkingSignalId(sig.id)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded bg-slate-100 opacity-0 group-hover:opacity-100 transition duration-150 cursor-pointer"
                            title="تغيير الربط بمشترك آخر"
                          >
                            <Link className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          {linkingSignalId === sig.id ? (
                            <div className="relative flex items-center gap-1 max-w-[240px]">
                              <select
                                onChange={(e) => handleLinkSubscriber(sig.id, e.target.value || null)}
                                defaultValue=""
                                className="w-full text-xs bg-white border border-slate-300 rounded p-1 focus:outline-none"
                              >
                                <option value="">-- اختر مشترك --</option>
                                {subscribers.map((sub) => (
                                  <option key={sub.id} value={sub.id}>
                                    {sub.fullName} ({sub.username})
                                  </option>
                                ))}
                                <option value="clear">إلغاء الربط</option>
                              </select>
                              <button
                                onClick={() => setLinkingSignalId(null)}
                                className="px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-700 bg-slate-50 border border-slate-200 rounded"
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setLinkingSignalId(sig.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-black bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg transition duration-150 cursor-pointer"
                            >
                              <Link className="w-3.5 h-3.5" />
                              ربط بمشترك
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="p-3 text-center">{renderQualityBadge(sig.signalQuality)}</td>
                    <td className="p-3 text-center">{renderPower(sig.rxPower, 'rx')}</td>
                    <td className="p-3 text-center">{renderPower(sig.txPower, 'tx')}</td>
                    <td className="p-3 text-center font-mono text-xs">{renderDistance(sig.distance)}</td>
                    <td className="p-3 text-left font-mono text-[11px] text-slate-400">
                      {sig.lastUpdated ? new Date(sig.lastUpdated).toLocaleString('ar-YE', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit'}) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT OLT MODAL */}
      {oltModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-right animate-in zoom-in-95 duration-150">
            
            {/* Modal Title */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setOltModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                ×
              </button>
              <h3 className="font-extrabold text-base text-slate-800">
                {editingOlt ? `تعديل إعدادات الجهاز: ${editingOlt.name}` : 'إضافة جهاز OLT جديد'}
              </h3>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitOlt} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-600">اسم الجهاز OLT</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: جهاز OLT برج الكرادة"
                    value={oltForm.name}
                    onChange={(e) => setOltForm({ ...oltForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">عنوان IP الخاص بالجهاز</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 192.168.100.10"
                    value={oltForm.ip}
                    onChange={(e) => setOltForm({ ...oltForm, ip: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-left font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">منفذ SSH (Port)</label>
                  <input
                    type="number"
                    required
                    value={oltForm.port}
                    onChange={(e) => setOltForm({ ...oltForm, port: parseInt(e.target.value) || 22 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-left font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">اسم مستخدم SSH</label>
                  <input
                    type="text"
                    required
                    value={oltForm.username}
                    onChange={(e) => setOltForm({ ...oltForm, username: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-left font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">كلمة مرور SSH</label>
                  <input
                    type="password"
                    placeholder={editingOlt ? '•••••••• (دون تغيير)' : 'أدخل كلمة المرور'}
                    required={!editingOlt}
                    value={oltForm.password}
                    onChange={(e) => setOltForm({ ...oltForm, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-left font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-600">موديل جهاز OLT</label>
                  <select
                    value={oltForm.model}
                    onChange={(e) => setOltForm({ ...oltForm, model: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="VSOL V1600G1">VSOL V1600G1</option>
                  </select>
                </div>
              </div>

              {/* Reminder Banner */}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-800 text-[11px] leading-relaxed">
                🚨 يُنصح باستخدام حساب قراءة فقط (Read-Only) تم إنشاؤه مسبقاً على الـ OLT بدل حساب الأدمن الكامل لضمان عدم إمكانية إجراء أي تعديل للشبكة.
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOltModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  إلغاء وإغلاق
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs active:scale-98"
                >
                  {editingOlt ? 'حفظ التغييرات' : 'إضافة وحفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { Subscriber } from '../types';
import { 
  Users, 
  Search, 
  UserPlus, 
  Edit, 
  Trash2, 
  Power, 
  RefreshCw, 
  Check, 
  X, 
  Info,
  Calendar,
  Layers,
  Server,
  Zap,
  Lock,
  Unlock,
  Phone,
  ArrowRightLeft,
  DollarSign,
  UserCheck,
  AlertCircle
} from 'lucide-react';

export function DashboardSubscriberConsole() {
  const {
    subscribers,
    profiles,
    routers,
    addSubscriber,
    updateSubscriber,
    deleteSubscriber,
    renewSubscriber,
    toggleSubscriberStatus,
    syncSubscriberToRouter,
    currency
  } = useSystem();

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'disabled'>('all');
  const [profileFilter, setProfileFilter] = useState('all');

  // Form States
  const [showForm, setShowForm] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscriber | null>(null);
  
  const [formFullName, setFormFullName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formProfileId, setFormProfileId] = useState('');
  const [formRouterId, setFormRouterId] = useState('');
  const [formIpAddress, setFormIpAddress] = useState('');
  const [formMacAddress, setFormMacAddress] = useState('');
  const [formDays, setFormDays] = useState(30);

  // Quick Renew Modal/Panel state
  const [renewingSub, setRenewingSub] = useState<Subscriber | null>(null);
  const [renewMethod, setRenewMethod] = useState<'cash' | 'card'>('cash');
  const [renewCardPin, setRenewCardPin] = useState('');
  const [renewCustomHours, setRenewCustomHours] = useState(720); // 30 days is 720 hours

  // Feedback State
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Helper: Format Dates and remaining days left
  const getRemainingDaysInfo = (expiryDateStr: string) => {
    const exp = new Date(expiryDateStr);
    const now = new Date();
    const difMs = exp.getTime() - now.getTime();
    const diffDays = Math.ceil(difMs / (1000 * 3600 * 24));
    return {
      days: diffDays,
      isExpired: diffDays <= 0,
      label: diffDays <= 0 
        ? 'منتهي الصلاحية' 
        : `تبقي ${diffDays} يوم`,
      colorClass: diffDays <= 0 
        ? 'text-rose-600 bg-rose-50 border-rose-100' 
        : diffDays <= 3 
        ? 'text-amber-600 bg-amber-50 border-amber-100' 
        : 'text-emerald-700 bg-emerald-50 border-emerald-100'
    };
  };

  // Helper to generate automatic random security credentials (ideal for ISPs)
  const handleGenerateCredentials = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const randomUser = `client-${randomNum}`;
    const randomPass = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    setFormUsername(randomUser);
    setFormPassword(randomPass);
  };

  // Trigger Edit state
  const handleStartEdit = (sub: Subscriber) => {
    setEditingSub(sub);
    setFormFullName(sub.fullName);
    setFormPhone(sub.phone || '');
    setFormUsername(sub.username);
    setFormPassword(sub.password);
    setFormProfileId(sub.profileId);
    setFormRouterId(sub.routerId);
    setFormIpAddress(sub.ipAddress || '');
    setFormMacAddress(sub.macAddress || '');
    
    // Set custom expiry date to days from now
    const now = new Date();
    const exp = new Date(sub.expiryDate);
    const diffMs = exp.getTime() - now.getTime();
    const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 3600 * 24)));
    setFormDays(diffDays);

    setShowForm(true);
    setFeedback(null);
  };

  // Reset form states
  const handleCancelForm = () => {
    setShowForm(false);
    setEditingSub(null);
    setFormFullName('');
    setFormPhone('');
    setFormUsername('');
    setFormPassword('');
    setFormProfileId('');
    setFormRouterId('');
    setFormIpAddress('');
    setFormMacAddress('');
    setFormDays(30);
  };

  // Submit Handler: Core Add / Edit flow
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName || !formUsername || !formPassword || !formProfileId || !formRouterId) {
      showFeedback('error', 'يرجى ملء جميع الحقول المطلوبة واختيار الباقة والسيرفر.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingSub) {
        // Edit mode
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + Number(formDays));

        const updatedSub: Subscriber = {
          ...editingSub,
          fullName: formFullName,
          phone: formPhone,
          username: formUsername,
          password: formPassword,
          profileId: formProfileId,
          routerId: formRouterId,
          ipAddress: formIpAddress || undefined,
          macAddress: formMacAddress || undefined,
          expiryDate: expiry.toISOString()
        };

        await updateSubscriber(updatedSub);
        showFeedback('success', `تم تعديل بيانات المشترك "${formFullName}" بنجاح وتحديث إعداداته على راوتر المايكروتك!`);
      } else {
        // Add mode
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + Number(formDays));

        const newSub = {
          fullName: formFullName,
          phone: formPhone,
          username: formUsername,
          password: formPassword,
          profileId: formProfileId,
          routerId: formRouterId,
          ipAddress: formIpAddress || undefined,
          macAddress: formMacAddress || undefined,
          expiryDate: expiry.toISOString()
        };

        await addSubscriber(newSub);
        showFeedback('success', `تم تسجيل وتفعيل المشترك الجديد "${formFullName}" وتوليد حساب PPPoE الخاص به في المايكروتك بنجاح.`);
      }
      handleCancelForm();
    } catch (err: any) {
      showFeedback('error', err.message || 'حدث خطأ في السيرفر أثناء معالجة الطلب.');
    } finally {
      setSubmitting(false);
    }
  };

  // Live Sync Client parameters to Bound Router
  const handleForceSync = async (sub: Subscriber) => {
    try {
      await syncSubscriberToRouter(sub.id, 'update', undefined, sub);
      showFeedback('success', `تمت إعادة مزامنة وتأكيد حساب PPPoE للعميل "${sub.fullName}" يدوياً في راوتر المايكروتك.`);
    } catch (err: any) {
      showFeedback('error', `فشلت المزامنة المباشرة: ${err.message}`);
    }
  };

  // Change Subscriber status (Blocked <-> Active)
  const handleToggleStatus = async (sub: Subscriber) => {
    try {
      await toggleSubscriberStatus(sub.id);
      showFeedback('success', `تم تغيير حالة حساب العميل "${sub.fullName}" وتحديث صلاحية اشتراكه بالكامل.`);
    } catch (err: any) {
      showFeedback('error', `تعذر تعديل حالة العميل: ${err.message}`);
    }
  };

  // Handle Quick Expiry Renewal
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingSub) return;

    setSubmitting(true);
    try {
      const customDays = Math.ceil(renewCustomHours / 24);
      const res = await renewSubscriber(
        renewingSub.id,
        renewingSub.profileId,
        renewMethod,
        renewMethod === 'card' ? renewCardPin : undefined,
        renewCustomHours
      );

      if (res.success) {
        showFeedback('success', `تم بنجاح تجديد واشتراك المشترك "${renewingSub.fullName}" لمدة ${customDays} يوم وإرسال إشعار تفعيل.`);
        setRenewingSub(null);
        setRenewCardPin('');
      } else {
        showFeedback('error', res.message || 'فشلت عملية التجديد المالي.');
      }
    } catch (err: any) {
      showFeedback('error', `خطأ في سيرفرات التجديد الراديوس: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Safe delete subscriber with confirmation
  const handleDeleteSub = async (sub: Subscriber) => {
    if (confirm(`تحذير أمني: هل أنت متأكد تماماً من حذف المشترك "${sub.fullName}" نهائياً من قاعدة بيانات الراديوس وجميع الراوترات؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      try {
        await deleteSubscriber(sub.id);
        showFeedback('success', 'تم حذف ملف المشترك وإزالة كروت الراديوس والـ PPPoE الخاص به نهائياً.');
      } catch (err: any) {
        showFeedback('error', `فشل حذف المشترك: ${err.message}`);
      }
    }
  };

  // Filter Subscribers Logic
  const filteredSubscribers = subscribers.filter(sub => {
    // Search keyword match
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch = !q || 
      sub.fullName.toLowerCase().includes(q) ||
      sub.username.toLowerCase().includes(q) ||
      (sub.phone && sub.phone.includes(q)) ||
      (sub.ipAddress && sub.ipAddress.includes(q));

    // Status Filter
    const daysInfo = getRemainingDaysInfo(sub.expiryDate);
    let matchesStatus = true;
    if (statusFilter === 'active') {
      matchesStatus = sub.status === 'active' && !daysInfo.isExpired;
    } else if (statusFilter === 'expired') {
      matchesStatus = daysInfo.isExpired;
    } else if (statusFilter === 'disabled') {
      matchesStatus = sub.status === 'disabled';
    }

    // Profile select filter
    const matchesProfile = profileFilter === 'all' || sub.profileId === profileFilter;

    return matchesSearch && matchesStatus && matchesProfile;
  });

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSubs = filteredSubscribers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredSubscribers.length / itemsPerPage);

  const formatPrice = (val: number) => {
    if (currency === 'IQD') {
      return `${val.toLocaleString('ar-IQ')} د.ع`;
    }
    const usdVal = Math.round(val / 1480);
    return `$${usdVal.toLocaleString('en-US')}`;
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 text-right" dir="rtl" id="dashboard-subscriber-control-console">
      
      {/* Visual Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-blue-650">
            <Users className="w-5 h-5" />
            <span className="text-xs font-bold font-mono tracking-widest uppercase">Radius PPPoE Provisioning GUI</span>
          </div>
          <h2 className="text-base font-bold text-slate-800 font-sans mt-0.5">بوابة التحكم التفاعلية بمشتركي الراديوس والـ PPPoE</h2>
          <p className="text-xs text-slate-400">إدارة حسابات المشتركين، تعديل باقاتهم، تعيين إعدادات الـ PPPoE، قفل الماك، والتجديد الفوري.</p>
        </div>

        {/* Form toggles */}
        {!showForm && (
          <button
            onClick={() => {
              handleCancelForm();
              setShowForm(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/10 flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة وتكوين مشترك جديد</span>
          </button>
        )}
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
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          )}
          <div className="text-xs font-bold leading-relaxed">{feedback.message}</div>
        </div>
      )}

      {/* Floating Subscriber Configuration Drawer/Form */}
      {showForm && (
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              {editingSub ? `تعديل إعدادات المشترك: ${editingSub.fullName}` : 'تكوين حساب PPPoE جديد'}
            </span>
            <button 
              onClick={handleCancelForm}
              className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Customer Profile info */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">الاسم الكامل للمشترك *</label>
                <input
                  type="text"
                  required
                  placeholder="محمد علي عبد الله"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-250 rounded-lg focus:border-blue-500 outline-none text-right font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">رقم الهاتف (لإشعارات واتساب)</label>
                <input
                  type="text"
                  placeholder="964770000000"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-250 rounded-lg focus:border-blue-500 outline-none text-right font-mono"
                />
              </div>

              {/* Bound Router choice */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">سيرفر المايكروتك المستهدف (MikroTik Router) *</label>
                <select
                  required
                  value={formRouterId}
                  onChange={(e) => setFormRouterId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-250 rounded-lg focus:border-blue-500 outline-none text-right"
                >
                  <option value="">-- اختر راوتر الاتصال --</option>
                  {routers.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.ip})</option>
                  ))}
                </select>
              </div>

            </div>

            {/* PPPoE Credentials Block */}
            <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-3.5">
              <div className="flex justify-between items-center text-slate-500 font-bold">
                <span>🔐 تكوين بيانات المصادقة (PPPoE Secret Settings)</span>
                <button
                  type="button"
                  onClick={handleGenerateCredentials}
                  className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <Zap className="w-3.5 h-3.5" /> توليد بيانات عشوائية مؤمنة
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">اسم مستخدم PPPoE *</label>
                  <input
                    type="text"
                    required
                    placeholder="user123"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-lg focus:border-blue-500 outline-none font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">كلمة مرور PPPoE *</label>
                  <input
                    type="text"
                    required
                    placeholder="XYZ789"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-lg focus:border-blue-500 outline-none font-mono text-left"
                    dir="ltr"
                  />
                </div>

                {/* Subscriptions Plans */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">خطة الاشتراك (PPPoE Profile) *</label>
                  <select
                    required
                    value={formProfileId}
                    onChange={(e) => setFormProfileId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-lg focus:border-blue-500 outline-none"
                  >
                    <option value="">-- اختر باقة السرعة --</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - ({p.rateLimit}) [{formatPrice(p.price)}]</option>
                    ))}
                  </select>
                </div>

                {/* Expiry Period days */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">مدة الصلاحية بالأيام</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={formDays}
                    onChange={(e) => setFormDays(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-lg focus:border-blue-500 outline-none font-mono text-center"
                  />
                </div>

              </div>

              {/* Extra advanced bindings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-3.5">
                
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="block font-bold text-slate-700">عنوان IP ساكن (Static IP Address)</span>
                    <span className="text-[10px] text-slate-400 font-normal select-none">(اختياري)</span>
                  </div>
                  <input
                    type="text"
                    placeholder="192.168.100.25"
                    value={formIpAddress}
                    onChange={(e) => setFormIpAddress(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-lg focus:border-blue-500 outline-none font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="block font-bold text-slate-700">قفل الماك أدرس للعميل (MAC Lock / Caller ID)</span>
                    <span className="text-[10px] text-slate-400 font-normal select-none">(اختياري)</span>
                  </div>
                  <input
                    type="text"
                    placeholder="11:22:33:AA:BB:CC"
                    value={formMacAddress}
                    onChange={(e) => setFormMacAddress(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-lg focus:border-blue-500 outline-none font-mono text-left"
                    dir="ltr"
                  />
                </div>

              </div>

            </div>

            {/* Form actions */}
            <div className="flex gap-2 justify-end border-t border-slate-200/50 pt-3">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
              >
                إلغاء التعديل
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري تدوين الإعدادات...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{editingSub ? 'حفظ التعديلات وتحديث السيرفر' : 'إنشاء وتفعيل حساب الـ PPPoE'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Renew Dialog panel overlay */}
      {renewingSub && (
        <div className="bg-emerald-50/60 border border-emerald-250 p-5 rounded-2xl space-y-4">
          <div className="flex justify-between items-center border-b border-emerald-150 pb-2">
            <span className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              تجديد صلاحية المشترك يدوياً: {renewingSub.fullName}
            </span>
            <button 
              onClick={() => setRenewingSub(null)}
              className="p-1 text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleRenewSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              <div className="space-y-1">
                <label className="block font-bold text-emerald-800">طريقة الدفع المالي</label>
                <select
                  value={renewMethod}
                  onChange={(e) => setRenewMethod(e.target.value as 'cash' | 'card')}
                  className="w-full p-2.5 bg-white border border-emerald-200 rounded-lg text-emerald-900 outline-none"
                >
                  <option value="cash">نقداً (كاش - تسليم المشرف)</option>
                  <option value="card">تفعيل بكارت شحن (Pin Code)</option>
                </select>
              </div>

              {renewMethod === 'card' ? (
                <div className="space-y-1">
                  <label className="block font-bold text-emerald-800">رقم الكارت السري (PIN)</label>
                  <input
                    type="text"
                    required
                    placeholder="PIN-XXXXXX"
                    value={renewCardPin}
                    onChange={(e) => setRenewCardPin(e.target.value)}
                    className="w-full p-2.5 bg-white border border-emerald-200 rounded-lg outline-none font-mono text-center text-sm font-semibold"
                    dir="ltr"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block font-bold text-emerald-800">فترة التمديد (بالساعات)</label>
                  <select
                    value={renewCustomHours}
                    onChange={(e) => setRenewCustomHours(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-emerald-200 rounded-lg outline-none font-mono"
                  >
                    <option value={720}>شهر كامل (30 يوم / 720 ساعة)</option>
                    <option value={360}>نصف شهر (15 يوم / 360 ساعة)</option>
                    <option value={168}>أسبوع واحد (7 أيام / 168 ساعة)</option>
                    <option value={24}>يوم واحد تجريبي (24 ساعة)</option>
                  </select>
                </div>
              )}

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري المعالجة...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>تأكيد وقبض الدفع للتجديد</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </form>
        </div>
      )}

      {/* Filter Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl">
        
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="بحث بالاسم، الباسوورد، أو الـ IP..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 text-right font-sans"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none"
          >
            <option value="all">كل المشتركين والأحوال</option>
            <option value="active">النشطون والفاعلون فقط</option>
            <option value="expired">منتهو الصلاحية</option>
            <option value="disabled">المحظورون يدوياً</option>
          </select>
        </div>

        {/* Profiles/Plans Filter */}
        <div>
          <select
            value={profileFilter}
            onChange={(e) => {
              setProfileFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none"
          >
            <option value="all">كل باقات السرعة</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.rateLimit})</option>
            ))}
          </select>
        </div>

        {/* Quick count indicator badge */}
        <div className="flex items-center justify-end font-sans text-xs text-slate-500 font-bold px-1.5">
          <span>نتائج الفلترة: <b className="text-blue-600 font-mono">{filteredSubscribers.length}</b> من أصل <b className="text-slate-700 font-mono">{subscribers.length}</b></span>
        </div>

      </div>

      {/* Main Responsive Customer Grid / Table */}
      {filteredSubscribers.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50 space-y-2">
          <Users className="w-8 h-8 mx-auto text-slate-350 stroke-1" />
          <p className="text-xs font-bold text-slate-500">عذراً، لم نعثر على أي مشتركين يطابقون هذه الفلاتر.</p>
          <span className="block text-[10px] text-slate-400">انقر فوق "إضافة وتكوين مشترك جديد" لتجربة تسجيل مستخدم.</span>
        </div>
      ) : (
        <div className="space-y-3">
          
          {/* Table Container desktop view */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 text-[11px] font-sans border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">معلومات المشترك</th>
                  <th className="px-4 py-3 text-center">أوراق اعتماد PPPoE</th>
                  <th className="px-4 py-3">خطة الاشتراك والسيرفر</th>
                  <th className="px-4 py-3 text-center">الحالة والصلاحية</th>
                  <th className="px-4 py-3 text-center">التحكم والعمليات السريعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {currentSubs.map((sub) => {
                  const subProfile = profiles.find(p => p.id === sub.profileId);
                  const subRouter = routers.find(r => r.id === sub.routerId);
                  const daysInfo = getRemainingDaysInfo(sub.expiryDate);

                  // Calculate visual percentage matching progress bar
                  const maxDays = 30;
                  const percentWidth = Math.min(100, Math.max(0, (daysInfo.days / maxDays) * 100));

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/55 transition-all text-slate-700">
                      
                      {/* Name Card with WhatsApp Quick trigger */}
                      <td className="px-4 py-3.5 font-sans">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold leading-none shrink-0 text-xs">
                            {sub.fullName.substring(0, 1)}
                          </div>
                          <div>
                            <span className="block font-bold text-slate-905">{sub.fullName}</span>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-450 mt-0.5 font-mono">
                              {sub.phone ? (
                                <a 
                                  href={`https://wa.me/${sub.phone.replace(/[^0-9]/g, '')}`}
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="flex items-center gap-1 text-emerald-600 hover:underline hover:text-emerald-700"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>{sub.phone}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400">بدون هاتف</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Username credentials and bind info */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-block bg-slate-50 border border-slate-150 rounded-lg p-2 text-right">
                          <div className="text-[10px] flex items-center gap-1 justify-end">
                            <span className="text-slate-400">User:</span>
                            <b className="text-slate-800 font-bold font-mono text-xs">{sub.username}</b>
                          </div>
                          <div className="text-[10px] flex items-center gap-1 justify-end mt-0.5">
                            <span className="text-slate-400">Pass:</span>
                            <span className="text-slate-600 font-mono text-xs font-semibold">{sub.password}</span>
                          </div>
                          {(sub.ipAddress || sub.macAddress) && (
                            <div className="border-t border-slate-100 mt-1 pt-1 flex justify-between gap-2 text-[9px] text-slate-400 text-left font-mono">
                              {sub.ipAddress && <span className="text-blue-600" title="Static IP">IP: {sub.ipAddress}</span>}
                              {sub.macAddress && <span className="text-indigo-650" title="MAC Lock">MAC: {sub.macAddress}</span>}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Assign Plan and Bind Router details */}
                      <td className="px-4 py-3.5 font-sans">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-750 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-150">
                            <Layers className="w-3 h-3 text-indigo-500" />
                            {subProfile?.name || 'سائق افتراضي'} ({subProfile?.rateLimit || 'M / M'})
                          </span>
                          <div className="text-[10px] text-slate-450 font-medium flex items-center gap-1 mt-0.5 font-mono">
                            <Server className="w-3.5 h-3.5 text-slate-350 shrink-0" />
                            <span>السيرفر: {subRouter?.name || 'تلقائي'} ({subRouter?.ip})</span>
                          </div>
                        </div>
                      </td>

                      {/* Expiration bar calculations */}
                      <td className="px-4 py-3.5 font-sans">
                        <div className="flex flex-col items-center justify-center space-y-1.5 w-32 mx-auto">
                          
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border text-center block w-full ${daysInfo.colorClass}`}>
                            {sub.status === 'disabled' ? 'محظور مغلق' : daysInfo.label}
                          </span>

                          {sub.status !== 'disabled' && (
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-1.5 rounded-full transition-all duration-500 ${
                                  daysInfo.isExpired 
                                    ? 'bg-rose-500' 
                                    : daysInfo.days <= 3 
                                    ? 'bg-amber-500 animate-pulse' 
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${percentWidth}%` }}
                              />
                            </div>
                          )}
                          <span className="block text-[9px] text-slate-400 font-mono">
                            حتى: {new Date(sub.expiryDate).toLocaleDateString('ar-IQ')}
                          </span>
                        </div>
                      </td>

                      {/* Quick Operations Button Console */}
                      <td className="px-4 py-3.5 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* Toggle Active status */}
                          <button
                            onClick={() => handleToggleStatus(sub)}
                            title={sub.status === 'disabled' ? 'تفعل الحساب' : 'حظر الحساب'}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              sub.status === 'disabled'
                                ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-150 text-emerald-600'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Edit */}
                          <button
                            onClick={() => handleStartEdit(sub)}
                            title="تعديل إعدادات المشترك"
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-150 text-blue-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Instant re-sync to server */}
                          <button
                            onClick={() => handleForceSync(sub)}
                            title="مزامنة مع المايكروتك"
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-650 rounded-lg transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Fast Extender Renew */}
                          <button
                            onClick={() => {
                              setRenewingSub(sub);
                              setRenewCardPin('');
                            }}
                            title="تجديد الاشتراك المالي"
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 text-emerald-650 rounded-lg transition-colors cursor-pointer"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Account */}
                          <button
                            onClick={() => handleDeleteSub(sub)}
                            title="حذف المشترك نهائياً"
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Simple Pagination Footer controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 select-none">
              <span className="text-[10px] text-slate-400 font-sans">
                الصفحة <b className="text-slate-700 font-mono">{currentPage}</b> من أصل <b className="text-slate-700 font-mono">{totalPages}</b> صفحات
              </span>
              <div className="flex gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-50 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-lg cursor-pointer font-sans"
                >
                  السابق
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-50 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-lg cursor-pointer font-sans"
                >
                  التالي
                </button>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

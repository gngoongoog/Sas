import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { 
  CreditCard, 
  Printer, 
  Layers, 
  TrendingUp, 
  RotateCcw, 
  Plus, 
  Check, 
  Eye, 
  Trash2,
  Lock,
  Scissors,
  Bookmark,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Hash
} from 'lucide-react';

export const VoucherManager: React.FC = () => {
  const {
    cards,
    profiles,
    subscribers,
    generateCards,
    deleteCard,
    redeemCardByPin,
    currency
  } = useSystem();

  // Generator form states
  const [targetProfileId, setTargetProfileId] = useState(profiles[0]?.id || '');
  const [quantity, setQuantity] = useState(10);
  const [prefix, setPrefix] = useState('SAS');

  // Fast redeem states
  const [redeemPin, setRedeemPin] = useState('');
  const [redeemUsername, setRedeemUsername] = useState(subscribers[0]?.username || '');
  const [redeemMessage, setRedeemMessage] = useState({ success: false, text: '' });

  // Filter
  const [profileFilter, setProfileFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Print Mode State
  const [isPrintMode, setIsPrintMode] = useState(false);

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProfileId || quantity <= 0) return;
    generateCards(targetProfileId, quantity, prefix);
    alert(`امتثل للأوامر! تم توليد ${quantity} كرت شحن سري ومزمن بنجاح.`);
  };

  const handleRedeemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemPin || !redeemUsername) return;
    
    setRedeemMessage({ success: false, text: '' });
    const res = redeemCardByPin(redeemPin, redeemUsername);
    
    setRedeemMessage({
      success: res.success,
      text: res.message
    });

    if (res.success) {
      setRedeemPin('');
    }
  };

  const filteredCards = cards.filter(c => {
    const matchesProfile = profileFilter === 'all' || c.profileId === profileFilter;
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesProfile && matchesStatus;
  });

  const getProfileName = (id: string) => {
    return profiles.find(p => p.id === id)?.name || 'باقة غير معينة';
  };

  const formatPrice = (val: number) => {
    if (currency === 'IQD') {
      return `${val.toLocaleString('ar-IQ')} د.ع`;
    }
    return `$${Math.round(val / 1480)}`;
  };

  // Printable template voucher renderer
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-sans">توليد وطباعة كروت الشحن (Vouchers)</h2>
          <p className="text-xs text-slate-500 mt-0.5">شحن وتعبئة يوزرات PPPoE عبر كود شحن سري ومطبوع شبيه بنظام الكروت الذكي في SAS4.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsPrintMode(!isPrintMode)}
            className={`flex items-center gap-1.5 px-4 py-2 border rounded-xl text-xs font-semibold select-none transition-all cursor-pointer ${
              isPrintMode
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Printer className="w-4 h-4" />
            {isPrintMode ? 'رؤية الجدول الاعتيادي' : 'عرض نافذة طباعة الكروت'}
          </button>
        </div>
      </div>

      {!isPrintMode ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Generator Widget & Redeem Widget container */}
          <div className="space-y-6 lg:col-span-1">
            
            {/* 1. Generator Block */}
            <div className="bg-white p-5 rounded-2xl border border-slate-105 shadow-xs">
              <div className="flex items-center gap-2 text-slate-800 font-bold mb-4">
                <Plus className="w-5 h-5 text-blue-600" />
                <span>توليد كروت دفعة واحدة (Bulk)</span>
              </div>

              <form onSubmit={handleGenerateSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">حدد باقة السرعة المراد ربطها بالكود</label>
                  <select
                    value={targetProfileId}
                    onChange={(e) => setTargetProfileId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({formatPrice(p.price)})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">الكمية المطلوبة</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="100"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">سابقة السيريال (Prefix)</label>
                    <input
                      type="text"
                      required
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer transition-all shadow-xs block text-center"
                >
                  ⚡ توليد الكروت وحفظها بالسيرفر
                </button>
              </form>
            </div>

            {/* 2. Fast Redeem Emulator Widget */}
            <div className="bg-white p-5 rounded-2xl border border-slate-105 shadow-xs">
              <div className="flex items-center gap-2 text-slate-800 font-bold mb-4">
                <Check className="w-5 h-5 text-emerald-600" />
                <span>شحن كرت لمشترك PPPoE (شحن سريع)</span>
              </div>

              <form onSubmit={handleRedeemSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اختر العميل المُراد تجديده</label>
                  <select
                    value={redeemUsername}
                    onChange={(e) => setRedeemUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    {subscribers.map(s => (
                      <option key={s.id} value={s.username}>{s.fullName} ({s.username})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">أدخل رمز الـ PIN المكوّن من 12 رقم</label>
                  <input
                    type="text"
                    required
                    placeholder="2981-2291..."
                    value={redeemPin}
                    onChange={(e) => setRedeemPin(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono tracking-widest text-center focus:border-emerald-500 outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer transition-all shadow-xs"
                >
                  Confirm Card Activation
                </button>

                {redeemMessage.text && (
                  <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                    redeemMessage.success 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-800 font-semibold' 
                      : 'bg-rose-50 border-rose-100 text-rose-800 font-bold'
                  }`}>
                    {redeemMessage.success ? '🏆 ' : '❌ '}{redeemMessage.text}
                  </div>
                )}
              </form>
            </div>

          </div>

          {/* Generated Cards Table */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-105 shadow-xs flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-slate-800">سجل الكروت المتوفرة بالسيرفر</h3>
              <div className="flex gap-2">
                
                {/* Profile filter */}
                <select
                  value={profileFilter}
                  onChange={(e) => setProfileFilter(e.target.value)}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer font-sans"
                >
                  <option value="all">كل الباقات من الكروت</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                {/* status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer font-sans"
                >
                  <option value="all">كل الكروت</option>
                  <option value="active">جاهزة للتوزيع (Active)</option>
                  <option value="used font-sans">مستعملة بالفعل (Used)</option>
                </select>

              </div>
            </div>

            {filteredCards.length === 0 ? (
              <div className="text-center p-12 flex-1 flex flex-col items-center justify-center">
                <CreditCard className="w-12 h-12 text-slate-200 mb-2 stroke-1" />
                <p className="text-sm font-semibold text-slate-450">لا توجد كروت شحن مطابقة للتصفية</p>
                <p className="text-xs text-slate-400 mt-0.5">قم بتوليد كروت جديدة بإدخال قيم الباقات أولاً.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase border-b border-slate-100 font-sans">
                    <tr>
                      <th className="px-4 py-3 text-right">السيريال (Serial)</th>
                      <th className="px-4 py-3 text-right">رمز الكرت السري PIN</th>
                      <th className="px-4 py-3 text-right">باقة التفعيل المربوطة</th>
                      <th className="px-4 py-3 text-right">القيمة المالية الكرت</th>
                      <th className="px-4 py-3 text-right">تاريخ الانشاء</th>
                      <th className="px-4 py-3 text-right text-center">حالة الاستخدام</th>
                      <th className="px-4 py-3 text-center">إجراء حذف الكرت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-105 font-mono">
                    {filteredCards.map(c => {
                      const isActive = c.status === 'active';
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-4 py-3 font-semibold text-slate-500 font-sans">{c.serial}</td>
                          <td className="px-4 py-3 font-bold text-slate-900 text-sm select-all">
                            {c.pin.replace(/(\d{4})(\d{4})(\d{4})/g, '$1-$2-$3')}
                          </td>
                          <td className="px-4 py-3 text-slate-700 font-sans">{getProfileName(c.profileId)}</td>
                          <td className="px-4 py-3 text-blue-600 font-semibold">{formatPrice(c.price)}</td>
                          <td className="px-4 py-3 text-slate-400 text-[10px] font-sans">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-center font-sans">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isActive 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {isActive ? 'جاهز للتفعيل' : `مستعمل من: ${c.usedBy}`}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => {
                                if (confirm('هل ترغب بحذف كرت الشحن هذا نهائياً؟')) deleteCard(c.id);
                              }}
                              className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* Visual Printable Cards Layout */
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-205">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-sm text-slate-800">معاينة طباعة الكروت الدفعة</h3>
              <p className="text-xs text-slate-500 mt-1">كروت مقصقصة بمقاييس قياسية جاهزة للتوزيع والبيع المحلي.</p>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer shadow-indigo-100 shadow-md"
            >
              <Printer className="w-4 h-4" />
              اطبع الكروت الآن (Ctrl+P)
            </button>
          </div>

          {filteredCards.filter(c => c.status === 'active').length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-sm font-semibold text-slate-400">لا يوجد كروت بحالة "جاهزة للتفعيل" لطباعتها.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print-grid">
              {filteredCards.filter(c => c.status === 'active').map(c => (
                <div key={c.id} className="bg-white p-4 rounded-xl border-2 border-dashed border-slate-350 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[160px] cursor-pointer hover:border-blue-500 transition-all">
                  
                  {/* Card head decoration */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-2 mb-2">
                    <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs font-sans">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>كارت شحن مشتركين چنچون</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">S/N: {c.serial}</span>
                  </div>

                  {/* Body values */}
                  <div className="space-y-1 my-2">
                    <div className="text-[10px] font-sans text-slate-400">باقة السرعة (Plan):</div>
                    <div className="font-bold text-slate-900 text-xs font-sans">{getProfileName(c.profileId)}</div>

                    <div className="bg-slate-100/80 p-2.5 rounded-lg border border-slate-200/50 mt-1.5 text-center font-mono">
                      <div className="text-[9px] font-sans text-slate-400 leading-none mb-1">رمز الدبوس السري (PIN CODE)</div>
                      <div className="text-base font-bold text-slate-950 font-mono tracking-widest select-all">
                        {c.pin?.replace(/(\d{4})(\d{4})(\d{4})/g, '$1-$2-$3')}
                      </div>
                    </div>
                  </div>

                  {/* Foot rates */}
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-150 text-[10px] font-sans">
                    <div className="font-bold text-indigo-700 text-sm font-sans">{formatPrice(c.price)}</div>
                    <div className="text-slate-400">صالحة لـ 30 يوم من الشحن</div>
                  </div>

                  {/* Cut icon decoration */}
                  <div className="absolute top-1/2 left-0 -translate-y-1/2 transform text-slate-300 pointer-events-none scale-x-[-1]">
                    <Scissors className="w-3 h-3" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

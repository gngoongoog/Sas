import React, { useState, useEffect } from 'react';
import { SystemProvider, useSystem } from './context/SystemContext';
import { DashboardOverview } from './components/DashboardOverview';
import { SubscriberManager } from './components/SubscriberManager';
import { ProfileManager } from './components/ProfileManager';
import { VoucherManager } from './components/VoucherManager';
import { RouterConfig } from './components/RouterConfig';
import { ScriptTerminal } from './components/ScriptTerminal';
import { AiCopilot } from './components/AiCopilot';
import { AlertManager } from './components/AlertManager';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { SystemSettings } from './components/SystemSettings';

import { 
  Users, 
  Layers, 
  CreditCard, 
  Server, 
  Terminal as TerminalIcon, 
  Bot, 
  Gauge, 
  Wifi, 
  Settings, 
  Clock, 
  User, 
  TrendingUp, 
  Sliders,
  Bell,
  Lock,
  Unlock,
  LogOut,
  ShieldCheck
} from 'lucide-react';

function AppContent() {
  const { isAuthenticated, login, logout, stats } = useSystem();
  
  // Login flow states
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'subscribers' | 'profiles' | 'vouchers' | 'routers' | 'scripts' | 'ai' | 'alerts' | 'settings'>('dashboard');
  const [dateStr, setDateStr] = useState('');

  // Handle Login submission hitting the SQLite express endpoint
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!username.trim() || !password.trim()) {
      setLoginError('الرجاء إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    try {
      const result = await login(username.trim(), password);
      if (!result.success) {
        setLoginError(result.error || 'عذراً: بيانات الاعتماد المدخلة خاطئة.');
      } else {
        setLoginError('');
      }
    } catch (err: any) {
      setLoginError('فشل الاتصال بسيرفر التحكم الآمن.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm('هل ترغب حقاً في تسجيل الخروج قاصداً تأمين الجلسة؟')) {
      logout();
      setPassword('');
      setLoginError('');
    }
  };

  // Setup current server time clock
  useEffect(() => {
    let baseTime = Date.now();
    
    const interval = setInterval(() => {
      baseTime += 1000;
      const d = new Date(baseTime);
      setDateStr(d.toLocaleDateString('ar-IQ') + ' ' + d.toLocaleTimeString('ar-IQ', { hour12: true }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!isAuthenticated) {
    return (
      <div 
        className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden text-right select-none" 
        dir="rtl"
      >
        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full filter blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full filter blur-3xl pointer-events-none animate-pulse" />
        
        {/* Particle grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.5px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex p-4 bg-blue-600/10 border border-blue-500/20 text-blue-500 rounded-2xl shadow-xl shadow-blue-500/5">
              <ShieldCheck className="w-10 h-10 animate-pulse" />
            </div>
            <div>
              <h1 className="text-white font-black text-2xl font-sans tracking-tight">منظومة SuperSAS v4</h1>
              <span className="inline-block mt-1 text-[11px] font-bold text-slate-500 tracking-widest uppercase bg-slate-950 border border-slate-850 px-3 py-1 rounded-full">
                نظام إدارة المشتركين والتحكم بـ RADIUS وسيرفرات الماك
              </span>
            </div>
          </div>

          {/* Login form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            
            {loginError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-lg leading-relaxed flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0" />
                <p>{loginError}</p>
              </div>
            )}

            {/* Email/Username field */}
            <div className="space-y-1.5 text-right">
              <label className="block text-xs font-bold text-slate-400">اسم المدير الافتراضي</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full py-2.5 pl-4 pr-10 bg-slate-950/65 border border-slate-850 text-slate-100 rounded-xl text-xs font-mono outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-right"
                />
                <div className="absolute right-3.5 top-3.5 text-slate-500">
                  <User className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5 text-right">
              <div className="flex justify-between items-center text-xs">
                <label className="block font-bold text-slate-400">كلمة المرور الأمنية</label>
                <div className="text-[10px] text-slate-500 italic">مستوى تشفير AES-256 + SALTS</div>
              </div>
              
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-2.5 pl-12 pr-10 bg-slate-950/65 border border-slate-850 text-slate-100 rounded-xl text-xs font-mono outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-right"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-3 text-slate-400 hover:text-slate-100 transition-colors text-xs font-bold cursor-pointer font-sans"
                >
                  {showPassword ? 'إخفاء' : 'عرض'}
                </button>
                <div className="absolute right-3.5 top-3.5 text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* trigger submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-55 text-white text-xs font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-2 select-none"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>برجاء الانتظار، جاري مصادقة التشفير...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>تخويل الدخول الآمن</span>
                </>
              )}
            </button>

          </form>

          {/* Guidelines info */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-850 rounded-xl space-y-1 text-[11px] leading-relaxed">
            <span className="block font-bold text-blue-400 font-sans">🔑 معلومات لوحة التحكم والتحقق:</span>
            <div className="text-slate-400 font-mono space-y-0.5">
              <div>• اليوزر الافتراضي: <span className="text-white font-bold">admin</span></div>
              <div>• كلمة المرور الحقيقية: <span className="text-white font-bold">admin</span></div>
            </div>
          </div>

          <PwaInstallPrompt />

          <div className="text-center text-[10px] text-slate-600 font-mono">
            بوابة الإدارة المركزية SuperSAS المشفرة لحماية الكروت والمشتركين © {new Date().getFullYear()}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-right" dir="rtl">
    
      {/* Navigation Sidebar Drawer */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-l border-slate-800 shadow-xl shrink-0 select-none">
        <div>
          {/* Main Logo and name Header */}
          <div className="p-6 flex items-center gap-3 border-b border-slate-800 bg-slate-900/50">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20 font-sans animate-pulse">
              SAS
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight font-sans">SuperSAS v4</h1>
              <span className="inline-block px-2 py-0.5 mt-1 bg-slate-950 border border-slate-800 text-[9px] font-mono text-slate-400 rounded-full">
                SQLite Fullstack Real-Time
              </span>
            </div>
          </div>

          {/* Navigation Tabs lists */}
          <nav className="p-4 space-y-1.5 text-xs font-sans">
            
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'dashboard' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Gauge className="w-4 h-4" />
              <span>لوحة التحكم الرئيسية</span>
            </button>

            <button
              onClick={() => setActiveTab('subscribers')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'subscribers' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>إدارة المشتركين ({stats.totalSubscribers})</span>
            </button>

            <button
              onClick={() => setActiveTab('profiles')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'profiles' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>باقات السرعة (Plans)</span>
            </button>

            <button
              onClick={() => setActiveTab('vouchers')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'vouchers' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>كروت الشحن وطباعتها</span>
            </button>

            <button
              onClick={() => setActiveTab('routers')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'routers' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>سيرفرات المايكروتك ({stats.totalRouters})</span>
            </button>

            <button
              onClick={() => setActiveTab('scripts')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'scripts' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <TerminalIcon className="w-4 h-4" />
              <span>معالج السكريبتات</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'ai' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Bot className="w-4 h-4 text-blue-400" />
              <span>مساعد الذكاء الاصطناعي</span>
            </button>

            <button
              onClick={() => setActiveTab('alerts')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'alerts' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Bell className="w-4 h-4 text-red-400" />
              <span>التنبيهات والمراقبة</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'settings' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>إعدادات النظام وأمان البيانات</span>
            </button>

          </nav>
        </div>

        <PwaInstallPrompt minimal={true} />

        <div>
          {/* Active Server metrics */}
          <div className="p-4 border-t border-slate-850 bg-slate-950/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              </div>
              <div className="text-xs">
                <p className="text-slate-200 font-medium font-sans">قاعدة البيانات: SQLite</p>
                <p className="text-slate-500 font-mono">حالة المزامنة: متصل</p>
              </div>
            </div>
          </div>

          {/* Admin profiling card */}
          <div className="border-t border-slate-850 p-4 bg-slate-950/40 space-y-2.5">
            <div className="flex items-center justify-between gap-1.5 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded-full bg-blue-600 font-black text-[10px] flex items-center justify-center text-white font-sans animate-pulse">
                  AD
                </div>
                <div className="overflow-hidden">
                  <span className="block text-[8px] text-slate-500 uppercase font-mono tracking-tight">مشرف مصادق</span>
                  <span className="block text-[11px] font-black text-slate-200 font-mono truncate">admin</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="تسجيل الخروج وتأمين الجلسة"
                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" /> 
                <span className="truncate">{dateStr || 'جاري التحميل...'}</span>
              </div>
              <span className="text-[9px] bg-blue-600/25 border border-blue-500/20 text-blue-400 px-1 py-0.5 rounded">آمن</span>
            </div>
          </div>
        </div>

      </aside>

      {/* Major Content display views with premium header */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Header bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 md:px-8 flex items-center justify-between shadow-xs shrink-0 z-10 select-none">
          <div className="flex items-center gap-6">
            <div className="relative">
              <input 
                type="text" 
                placeholder="بحث..." 
                disabled
                className="bg-slate-100 border-none rounded-full px-10 py-1.5 text-xs w-48 md:w-64 text-right outline-hidden cursor-not-allowed opacity-50"
              />
              <svg className="w-4 h-4 absolute right-4 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <button 
              onClick={() => setActiveTab('alerts')}
              className="hidden sm:flex items-center gap-2 hover:bg-slate-50 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-xs font-semibold text-slate-600">إنذارات النظام ومراقبة تلغرام</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveTab('subscribers')}
              className="bg-blue-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              <span>إضافة مشترك جديد</span>
            </button>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs font-mono">
              SAS
            </div>
          </div>
        </header>

        {/* Content routing wrapper */}
        <main className="flex-1 p-5 md:p-8 overflow-y-auto bg-slate-50 relative">
          
          {activeTab === 'dashboard' && <DashboardOverview />}
          {activeTab === 'subscribers' && <SubscriberManager />}
          {activeTab === 'profiles' && <ProfileManager />}
          {activeTab === 'vouchers' && <VoucherManager />}
          {activeTab === 'routers' && <RouterConfig />}
          {activeTab === 'scripts' && <ScriptTerminal />}
          {activeTab === 'ai' && <AiCopilot />}
          {activeTab === 'alerts' && <AlertManager />}
          {activeTab === 'settings' && <SystemSettings />}

        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SystemProvider>
      <AppContent />
    </SystemProvider>
  );
}

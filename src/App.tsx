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
  ShieldCheck,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Database
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

  // Mobile navigation and touch gestures states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [drawerStartX, setDrawerStartX] = useState<number | null>(null);
  const [drawerCurrentX, setDrawerCurrentX] = useState<number | null>(null);
  const [showGestureHint, setShowGestureHint] = useState<boolean>(() => {
    return localStorage.getItem('dismissed_gesture_hint') !== 'true';
  });

  const tabsOrder: ('dashboard' | 'subscribers' | 'profiles' | 'vouchers' | 'routers' | 'scripts' | 'ai' | 'alerts' | 'settings')[] = [
    'dashboard', 'subscribers', 'profiles', 'vouchers', 'routers', 'scripts', 'ai', 'alerts', 'settings'
  ];

  // Detect gesture triggers for smooth swipe-to-navigate between views
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Don't swipe if touching inside form elements, scrollers or map blocks
    if (
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.closest('.no-swipe') || 
      target.closest('code') || 
      target.closest('pre') ||
      target.closest('button') ||
      target.closest('a')
    ) {
      return;
    }
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;

    // Detect horizontal swipe if larger than 75px in length and mostly orthogonal to vertical scrolling
    if (Math.abs(diffX) > 75 && Math.abs(diffX) > Math.abs(diffY) * 1.8) {
      const currentIndex = tabsOrder.indexOf(activeTab);
      if (diffX > 0) {
        // Swipe Left: Forward index in standard tabs order
        if (currentIndex < tabsOrder.length - 1) {
          setActiveTab(tabsOrder[currentIndex + 1]);
        }
      } else {
        // Swipe Right: Backward index in standard tabs order
        if (currentIndex > 0) {
          setActiveTab(tabsOrder[currentIndex - 1]);
        }
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  // Close sliding drawer using drag-right (coordinates increase)
  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    setDrawerStartX(e.targetTouches[0].clientX);
  };

  const handleDrawerTouchMove = (e: React.TouchEvent) => {
    setDrawerCurrentX(e.targetTouches[0].clientX);
  };

  const handleDrawerTouchEnd = () => {
    if (drawerStartX === null || drawerCurrentX === null) return;
    const dragDistance = drawerCurrentX - drawerStartX;
    if (dragDistance > 65) {
      setIsDrawerOpen(false);
    }
    setDrawerStartX(null);
    setDrawerCurrentX(null);
  };

  const dismissGestureHint = () => {
    localStorage.setItem('dismissed_gesture_hint', 'true');
    setShowGestureHint(false);
  };

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
              <h1 className="text-white font-black text-2xl font-sans tracking-tight">مشتركين چنچون</h1>
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
            بوابة الإدارة المركزية لمشتركي چنچون لحماية الكروت والمستخدمين © {new Date().getFullYear()}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-right overflow-x-hidden" 
      dir="rtl"
    >
      {/* 1. Desktop Persistent Sidebar Drawer (Hidden on Mobile) */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 flex-col justify-between border-l border-slate-800 shadow-xl shrink-0 select-none">
        <div>
          {/* Main Logo and name Header */}
          <div className="p-6 flex items-center gap-3 border-b border-slate-800 bg-slate-900/50">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20 font-sans animate-pulse">
              چنچون
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight font-sans">مشتركين چنچون</h1>
              <span className="inline-block px-2 py-0.5 mt-1 bg-slate-950 border border-slate-800 text-[9px] font-mono text-slate-400 rounded-full">
                SQLite Fullstack Real-Time
              </span>
            </div>
          </div>

          {/* Navigation Tabs lists */}
          <nav className="p-4 space-y-1.5 text-xs font-sans">
            <button
              onClick={() => { setActiveTab('dashboard'); setIsDrawerOpen(false); }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'dashboard' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Gauge className="w-4 h-4 text-sky-400" />
              <span>لوحة التحكم الرئيسية</span>
            </button>

            <button
              onClick={() => { setActiveTab('subscribers'); setIsDrawerOpen(false); }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'subscribers' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>إدارة المشتركين ({stats.totalSubscribers})</span>
            </button>

            <button
              onClick={() => { setActiveTab('profiles'); setIsDrawerOpen(false); }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'profiles' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>باقات السرعة (Plans)</span>
            </button>

            <button
              onClick={() => { setActiveTab('vouchers'); setIsDrawerOpen(false); }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'vouchers' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <span>كروت الشحن وطباعتها</span>
            </button>

            <button
              onClick={() => { setActiveTab('routers'); setIsDrawerOpen(false); }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'routers' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Server className="w-4 h-4 text-amber-500" />
              <span>سيرفرات المايكروتك ({stats.totalRouters})</span>
            </button>

            <button
              onClick={() => { setActiveTab('scripts'); setIsDrawerOpen(false); }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'scripts' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <TerminalIcon className="w-4 h-4 text-purple-400" />
              <span>معالج السكريبتات</span>
            </button>

            <button
              onClick={() => { setActiveTab('ai'); setIsDrawerOpen(false); }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors select-none cursor-pointer text-right ${
                activeTab === 'ai' 
                  ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-600/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Bot className="w-4 h-4 text-rose-400" />
              <span>مساعد الذكاء الاصطناعي</span>
            </button>

            <button
              onClick={() => { setActiveTab('alerts'); setIsDrawerOpen(false); }}
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
              onClick={() => { setActiveTab('settings'); setIsDrawerOpen(false); }}
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

      {/* 2. Mobile Bottom Tab Bar (Sticky bottom navigation for rapid touches on smartphones) */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950 border-t border-slate-850 flex justify-around items-center pt-2 pb-5 px-2 rounded-t-2xl shadow-2xl shadow-blue-500/10 select-none pb-safe-bottom"
        id="mobile-bottom-navigation-bar"
      >
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-all rounded-xl cursor-pointer ${
            activeTab === 'dashboard' ? 'text-blue-400 scale-105 font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Gauge className="w-5 h-5" />
          <span className="text-[10px]">الرئيسية</span>
        </button>

        <button
          onClick={() => setActiveTab('subscribers')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-all rounded-xl cursor-pointer ${
            activeTab === 'subscribers' ? 'text-blue-400 scale-105 font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px]">المشتركين</span>
        </button>

        <button
          onClick={() => setActiveTab('vouchers')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-all rounded-xl cursor-pointer ${
            activeTab === 'vouchers' ? 'text-blue-400 scale-105 font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px]">الكروت</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-all rounded-xl cursor-pointer ${
            activeTab === 'ai' ? 'text-blue-400 scale-105 font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Bot className="w-5 h-5 text-indigo-400 animate-pulse" />
          <span className="text-[10px]">الذكاء</span>
        </button>

        <button
          onClick={() => setIsDrawerOpen(true)}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-all rounded-xl text-slate-500 hover:text-slate-350 cursor-pointer ${
            isDrawerOpen ? 'text-blue-400 scale-105' : ''
          }`}
        >
          <Menu className="w-5 h-5 text-amber-500 animate-bounce" style={{ animationDuration: '4s' }} />
          <span className="text-[10px] font-bold">المزيد</span>
        </button>
      </nav>

      {/* 3. Drag-to-Dismiss Sliding Side Drawer (For Mobile Deep Configuration Links) */}
      <div 
        className={`fixed inset-0 z-50 transition-opacity duration-300 md:hidden ${
          isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop overlay filter */}
        <div 
          className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs"
          onClick={() => setIsDrawerOpen(false)}
        />

        {/* Sliding Panel */}
        <div 
          onTouchStart={handleDrawerTouchStart}
          onTouchMove={handleDrawerTouchMove}
          onTouchEnd={handleDrawerTouchEnd}
          className={`absolute inset-y-0 right-0 w-80 bg-slate-900 border-l border-slate-800 text-slate-300 flex flex-col justify-between transition-transform duration-300 ease-out shadow-2xl ${
            isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{
            // Apply real-time sliding offset during user drag gesture if any
            transform: drawerStartX !== null && drawerCurrentX !== null && (drawerCurrentX - drawerStartX) > 0
              ? `translateX(${Math.max(0, drawerCurrentX - drawerStartX)}px)`
              : undefined
          }}
        >
          <div>
            {/* Drawer Header with Gestures indicator line */}
            <div className="p-5 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                  چنچون
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">القائمة الكاملة</h3>
                  <span className="text-[9px] text-blue-400 font-mono">اسحب إلى اليسار أو اضغط خارجاً للإغلاق</span>
                </div>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tactile gesture swipe grab handle for the drawer visual feedback */}
            <div className="h-1.5 w-16 bg-slate-800 hover:bg-slate-700/80 rounded-full mx-auto my-3 cursor-grab flex items-center justify-center shrink-0">
              <div className="w-10 h-0.5 bg-slate-600 rounded-full"></div>
            </div>

            {/* List links */}
            <nav className="p-4 space-y-1.5 text-xs font-sans max-h-[60vh] overflow-y-auto">
              <button
                onClick={() => { setActiveTab('dashboard'); setIsDrawerOpen(false); }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all ${
                  activeTab === 'dashboard' ? 'bg-blue-600/15 text-blue-400 font-bold border border-blue-600/20' : 'hover:bg-slate-850 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Gauge className="w-4 h-4 text-sky-400" />
                  <span>لوحة التحكم الرئيسية</span>
                </div>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => { setActiveTab('subscribers'); setIsDrawerOpen(false); }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all ${
                  activeTab === 'subscribers' ? 'bg-blue-600/15 text-blue-400 font-bold border border-blue-600/20' : 'hover:bg-slate-850 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>إدارة المشتركين ({stats.totalSubscribers})</span>
                </div>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => { setActiveTab('profiles'); setIsDrawerOpen(false); }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all ${
                  activeTab === 'profiles' ? 'bg-blue-600/15 text-blue-400 font-bold border border-blue-600/20' : 'hover:bg-slate-850 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>باقات السرعة (Plans)</span>
                </div>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => { setActiveTab('vouchers'); setIsDrawerOpen(false); }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all ${
                  activeTab === 'vouchers' ? 'bg-blue-600/15 text-blue-400 font-bold border border-blue-600/20' : 'hover:bg-slate-850 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-indigo-400" />
                  <span>كروت الشحن وطباعتها</span>
                </div>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => { setActiveTab('routers'); setIsDrawerOpen(false); }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all ${
                  activeTab === 'routers' ? 'bg-blue-600/15 text-blue-400 font-bold border border-blue-600/20' : 'hover:bg-slate-850 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Server className="w-4 h-4 text-amber-500" />
                  <span>سيرفرات المايكروتك ({stats.totalRouters})</span>
                </div>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => { setActiveTab('scripts'); setIsDrawerOpen(false); }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all ${
                  activeTab === 'scripts' ? 'bg-blue-600/15 text-blue-400 font-bold border border-blue-600/20' : 'hover:bg-slate-850 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <TerminalIcon className="w-4 h-4 text-purple-400" />
                  <span>معالج السكريبتات</span>
                </div>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => { setActiveTab('ai'); setIsDrawerOpen(false); }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all ${
                  activeTab === 'ai' ? 'bg-blue-600/15 text-blue-400 font-bold border border-blue-600/20' : 'hover:bg-slate-850 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bot className="w-4 h-4 text-rose-400" />
                  <span>مساعد الذكاء الاصطناعي</span>
                </div>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => { setActiveTab('alerts'); setIsDrawerOpen(false); }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all ${
                  activeTab === 'alerts' ? 'bg-blue-600/15 text-blue-400 font-bold border border-blue-600/20' : 'hover:bg-slate-850 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-red-400" />
                  <span>التنبيهات والمراقبة</span>
                </div>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => { setActiveTab('settings'); setIsDrawerOpen(false); }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all ${
                  activeTab === 'settings' ? 'bg-blue-600/15 text-blue-400 font-bold border border-blue-600/20' : 'hover:bg-slate-850 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>إعدادات النظام وأمان البيانات</span>
                </div>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </nav>
          </div>

          {/* Drawer footer metrics */}
          <div className="p-4 border-t border-slate-850 bg-slate-950/40 space-y-3">
            <div className="flex items-center justify-between gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800 text-[11px]">
              <span className="text-slate-500 font-mono">مشرف مصادق: admin</span>
              <button 
                onClick={() => { setIsDrawerOpen(false); handleLogout(); }}
                className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خروج</span>
              </button>
            </div>
            
            <div className="text-[9px] text-slate-500 text-center font-mono select-none">
              مأمن بـ SQLite ومحمي بتكامل الـ RADIUS دائم العطاء
            </div>
          </div>
        </div>
      </div>

      {/* Major Content display views with premium header */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden pb-16 md:pb-0">
        
        {/* Modern Header bar (Responsive styled) */}
        <header className="h-14 md:h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shadow-xs shrink-0 z-10 select-none">
          <div className="flex items-center gap-3 md:gap-6">
            {/* Logo display on smartphones instead of search */}
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-800 cursor-pointer animate-pulse"
                title="افتح القائمة"
              >
                <Menu className="w-5 h-5 text-indigo-600" />
              </button>
              
              <div className="flex flex-col text-right">
                <span className="text-xs font-black text-slate-950 font-sans tracking-tight leading-none">لوحة چنچون</span>
                <span className="text-[8px] text-slate-500 font-mono">M.U.S Control v1.02</span>
              </div>
            </div>

            {/* Default desktop SearchBar */}
            <div className="hidden md:relative md:block">
              <input 
                type="text" 
                placeholder="بحث عام آمن..." 
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

          <div className="flex items-center gap-2 md:gap-3">
            {/* Quick action button */}
            <button 
              onClick={() => setActiveTab('subscribers')}
              className="bg-blue-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20 cursor-pointer scale-95 md:scale-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              <span className="hidden xs:inline">إضافة مشترك</span>
              <span className="xs:hidden">إضافة</span>
            </button>

            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs font-mono">
              SAS
            </div>
          </div>
        </header>

        {/* Content routing wrapper - Supporting full swipe gestures and drag interactions */}
        <main 
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50 relative selection:bg-blue-100 transition-all select-none"
        >
          {/* Swipe gesture tutorial pill (displayed only once to help network admins navigate effortlessly) */}
          {showGestureHint && (
            <div className="md:hidden mb-4 p-3.5 bg-blue-600 text-white rounded-2xl shadow-xl flex items-center justify-between gap-3 text-xs leading-relaxed transition-all">
              <div className="flex items-center gap-2.5">
                <span className="animate-bounce">👉</span>
                <p>
                  <strong>ميزة التنقل الذكي:</strong> يمكنك الآن السحب بإصبعك (يميناً أو يساراً) على أي مكان بالشاشة للتنقل السلس والسريع والمباشر بين النوافذ!
                </p>
              </div>
              <button 
                onClick={dismissGestureHint}
                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl text-[10px] font-bold shrink-0 cursor-pointer"
              >
                فهمت
              </button>
            </div>
          )}
          
          <div className="no-swipe">
            {activeTab === 'dashboard' && <DashboardOverview />}
            {activeTab === 'subscribers' && <SubscriberManager />}
            {activeTab === 'profiles' && <ProfileManager />}
            {activeTab === 'vouchers' && <VoucherManager />}
            {activeTab === 'routers' && <RouterConfig />}
            {activeTab === 'scripts' && <ScriptTerminal />}
            {activeTab === 'ai' && <AiCopilot />}
            {activeTab === 'alerts' && <AlertManager />}
            {activeTab === 'settings' && <SystemSettings />}
          </div>

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

import React, { useState, useEffect } from 'react';
import { Download, Monitor, Smartphone, Check, HelpCircle, ChevronDown, ChevronUp, Share, AppWindow } from 'lucide-react';

export function PwaInstallPrompt({ minimal = false }: { minimal?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'ios' | 'android' | 'desktop'>('ios');

  useEffect(() => {
    // Detect if already running in standalone display mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
    
    if (isStandalone) {
      setIsInstalled(true);
    }

    // Capture the PWA install event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsReady(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Capture the appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsReady(false);
      console.log('[SuperSAS PWA] App was successfully installed in standalone!');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerNativePrompt = async () => {
    if (!deferredPrompt) return;
    
    // Trigger browser install dialog
    deferredPrompt.prompt();
    
    // Await User interaction choice
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[SuperSAS PWA] User prompt decision outcome: ${outcome}`);
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsReady(false);
    }
  };

  // Skip showing if already running locally in standalone frame
  if (isInstalled) {
    if (minimal) return null;
    return (
      <div id="pwa-status" className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-right">
        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
          <Check className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="block text-[11px] font-bold text-emerald-400">منظومة SuperSAS مثبتة حالياً</span>
          <span className="block text-[10px] text-slate-400">تستمتع بتجربة تطبيق كامل ومستقل وآمن</span>
        </div>
      </div>
    );
  }

  // Minimal version for Sidebar list
  if (minimal) {
    return (
      <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/40 space-y-2">
        <button
          onClick={isReady ? triggerNativePrompt : () => { setShowGuide(!showGuide); }}
          className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 hover:text-white text-white text-[11px] font-bold rounded-lg transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer select-none"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isReady ? 'تثبيت اللوحة كتطبيق' : 'تحميل اللوحة كـ App'}</span>
          <span className="text-[9px] bg-blue-500 px-1.5 py-0.5 rounded-full text-white animate-pulse">مستقل</span>
        </button>
        
        {showGuide && (
          <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-400 leading-relaxed space-y-1">
            <div className="flex justify-between items-center text-[11px] font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1">
              <span>إرشادات التثبيت المخصصة</span>
              <button onClick={() => setShowGuide(false)} className="text-slate-500 hover:text-slate-300">أغلق</button>
            </div>
            <p>• <b>على آيفون:</b> افتح من سفاري، اضغط <Share className="inline w-3 h-3 text-blue-400" /> ثم <b>"إضافة للشاشة الرئيسية"</b>.</p>
            <p>• <b>على أندرويد:</b> اضغط زر القائمة بالمتصفح ثم اختر <b>"تثبيت التطبيق"</b>.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="pwa-install-card" className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4 text-right">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
            <AppWindow className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white text-xs font-black">تشغيل كـ تطبيق مستقل (اختياري)</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">يمكنك تشغيل اللوحة دون شريط المتصفح حتى تحت تأثير الـ VPN.</p>
          </div>
        </div>
        
        {isReady && (
          <button
            onClick={triggerNativePrompt}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-all shadow-lg hover:shadow-blue-500/10 cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تثبيت الآن</span>
          </button>
        )}
      </div>

      {/* Manual installation collapse toggler button */}
      <button
        onClick={() => setShowGuide(!showGuide)}
        className="w-full flex items-center justify-between py-1 bg-slate-950/45 px-3 rounded-lg border border-slate-805/30 hover:bg-slate-950/80 transition-all text-[11px] font-bold text-slate-300 cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>لا يظهر زر التثبيت؟ دليل التثبيت اليدوي للهاتف والكمبيوتر</span>
        </span>
        {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Interactive Tabs manual Guide block */}
      {showGuide && (
        <div className="pt-2 border-t border-slate-805/4s0 space-y-3.5">
          {/* Guide selection switcher tabs */}
          <div className="flex border-b border-slate-800 text-[10px] font-sans">
            <button
              onClick={() => setActiveGuideTab('ios')}
              className={`flex-1 py-1.5 text-center font-bold border-b-2 transition-all ${
                activeGuideTab === 'ios'
                  ? 'border-blue-500 text-blue-400 bg-slate-800/20'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="flex items-center justify-center gap-1">
                <Smartphone className="w-3 h-3" />
                <span>iPhone / iPad</span>
              </span>
            </button>
            <button
              onClick={() => setActiveGuideTab('android')}
              className={`flex-1 py-1.5 text-center font-bold border-b-2 transition-all ${
                activeGuideTab === 'android'
                  ? 'border-blue-500 text-blue-400 bg-slate-800/20'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="flex items-center justify-center gap-1">
                <Smartphone className="w-3 h-3" />
                <span>Android / أندرويد</span>
              </span>
            </button>
            <button
              onClick={() => setActiveGuideTab('desktop')}
              className={`flex-1 py-1.5 text-center font-bold border-b-2 transition-all ${
                activeGuideTab === 'desktop'
                  ? 'border-blue-500 text-blue-400 bg-slate-800/20'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="flex items-center justify-center gap-1">
                <Monitor className="w-3 h-3" />
                <span>الكمبيوتر / Windows</span>
              </span>
            </button>
          </div>

          {/* Guide content */}
          <div className="bg-slate-950/60 p-3.5 border border-slate-850 rounded-xl text-slate-300 text-[11px] leading-relaxed space-y-2">
            
            {activeGuideTab === 'ios' && (
              <div className="space-y-2 font-sans">
                <p className="font-bold text-blue-300">🍎 خطوات التثبيت على أجهزة ابل (iPhone & iPad):</p>
                <div className="space-y-1.5 text-slate-400">
                  <p>1. افتح متصفح <b>Safari</b> وتوجه إلى رابط منظومة SuperSAS.</p>
                  <p>2. اضغط على أيقونة <b>"مشاركة" (Share)</b> <Share className="inline w-3 h-3 mx-1 text-slate-250" /> في شريط المتصفح السفلي.</p>
                  <p>3. اسحب القائمة لأعلى واضغط على خيار <b>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</b>.</p>
                  <p>4. اترك الاسم كما هو "SuperSAS" واضغط <b>إضافة (Add)</b> في الأعلى.</p>
                  <p className="text-[10px] text-emerald-400 bg-emerald-500/5 px-2 py-1 rounded inline-block">✅ الآن ستفتح اللوحة كأيقونة تطبيق كامل لتأمين الدخول حتى في حال اتصالك بـ VPN.</p>
                </div>
              </div>
            )}

            {activeGuideTab === 'android' && (
              <div className="space-y-2 font-sans">
                <p className="font-bold text-blue-300">🤖 خطوات التثبيت على أجهزة Android:</p>
                <div className="space-y-1.5 text-slate-400">
                  <p>1. افتح متصفح <b>Google Chrome</b> على هاتفك.</p>
                  <p>2. اضغط على زر القائمة الجانبية <b>(الثلاث نقاط ⋮)</b> في الزاوية العلوية.</p>
                  <p>3. اضغط على خيار <b>"تثبيت التطبيق" (Install App)</b> أو <b>"إضافة للشاشة الرئيسية"</b>.</p>
                  <p>4. أكد العملية بالضغط على <b>"تثبيت"</b> وسيبدأ الهاتف بتثبيت الأيقونة والملفات في الخلفية.</p>
                </div>
              </div>
            )}

            {activeGuideTab === 'desktop' && (
              <div className="space-y-2 font-sans">
                <p className="font-bold text-blue-300">💻 خطوات التثبيت على الكمبيوتر (Windows / MacOS):</p>
                <div className="space-y-1.5 text-slate-400">
                  <p>1. باستخدام متصفح <b>Google Chrome</b> أو <b>Microsoft Edge</b>.</p>
                  <p>2. ستشاهد أيقونة <b>"شاشة كمبيوتر صغيرة مع سهم تحميل"</b> في نهاية شريط العنوان (URL Bar) بالأعلى.</p>
                  <p>3. اضغط على الأيقونة ثم اختر <b>تثبيت (Install)</b>.</p>
                  <p>4. سيقوم النظام بإنشاء اختصار لـ SuperSAS على سطح المكتب وقائمة Start ليعمل كنافذة كاملة.</p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { 
  Terminal, 
  Copy, 
  Trash2, 
  FileCode, 
  Flame, 
  Lightbulb, 
  Layers, 
  Check, 
  Play, 
  Save 
} from 'lucide-react';

export const ScriptTerminal: React.FC = () => {
  const { terminalScript, clearTerminalScript } = useSystem();
  const [copied, setCopied] = useState(false);
  
  // Custom script templates dropdown
  const [selectedTemplate, setSelectedTemplate] = useState('block-expired');

  const templates: { [key: string]: { title: string; desc: string; code: string } } = {
    'block-expired': {
      title: 'سكريبت حجب وتنبيه المشتركين المنتهيين',
      desc: 'سكريبت متطور يضيف يوزرات PPPoE المنتهية الصالحية تلقائياً في قائمة عناوين (Address-List) مخصصة لتحويلهم لصفحة إخطار من المايكروتك.',
      code: `# سكريبت تحويل المشتركين منتهي الصلاحية
/ip firewall mangle
add chain=prerouting action=add-src-to-address-list address-list=EXP_SUBSCRIBERS address-list-timeout=1d src-address-list=ACTIVE_SUBSCRIBERS comment="SuperSAS: Group Expired"

# توجيه المشترك المنتهي لصفحة إخطار الويب المحلية على بورت 80
/ip firewall nat
add chain=dstnat protocol=tcp dst-port=80 src-address-list=EXP_SUBSCRIBERS action=redirect to-ports=8080 comment="SuperSAS: Redirect to Notification Page"`
    },
    'scheduler-cleanup': {
      title: 'جدولة مراجعة وفصل الجلسات المنتهية',
      desc: 'يقوم هذا السكريبت بفحص تعليقات Secrets ومقارنة تاريخ انتهاء الصلاحية المكتوب بالتعليق وفصل يوزرات PPPoE النشطة تلقائياً إذا انقضت باقتهم.',
      code: `# جدولة فحص التراخيص والاشتراكات الدورية
/system scheduler
add name="SuperSAS_Sub_Checker" interval=1h start-time=startup on-event={
   :local curTime [/system clock get date];
   # فحص الـ Secrets ومقارنة تعليقات لقطع اتصال من انتهت صلاحيته
   /ppp secret {
      :foreach s in=[find] do={
         :local comm [get $s comment];
         :if ($comm ~ "expired" || $comm ~ "منتهي") do={
            :local uName [get $s name];
            /ppp active remove [find name=$uName];
            :log warning "SuperSAS: Kicked expired PPPoE session: $uName";
         }
      }
   }
}`
    },
    'mangle-fasttrack': {
      title: 'تسريع اللعبة والتصفح (Mangle & FastTrack)',
      desc: 'أوامر جدار الحماية الرائجة لتخفيض الـ Ping وحقن حزم بيانات الألعاب وبروتوكول FastTrack للإنترنت المنزلي.',
      code: `# حقن مسار التصفح الفائق FastTrack لمشتركي PPPoE
/ip firewall filter
add chain=forward action=fasttrack-connection connection-state=established,related comment="SuperSAS: FastTrack Rule"
add chain=forward action=accept connection-state=established,related

# علامات الـ DSCP لترتيب أولويات الألعاب على قنوات الإرسال
/ip firewall mangle
add chain=postrouting action=change-dscp new-dscp=46 passthrough=yes protocol=udp port=27015-27030 comment="SuperSAS: Optimize Steam/Game Ping"`
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-sans">معالج سكريبتات وأكواد الطرفية (RouterOS Scripts)</h2>
          <p className="text-xs text-slate-500 mt-0.5">سجل فوري بتراميز وأكواد المايكروتك لنسخها ولصقها مباشرة في الـ Terminal الخاص بجهازك.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearTerminalScript}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg font-sans font-medium hover:bg-rose-100 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> مسح سجل المزامنة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Templates Selector Card */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white p-5 rounded-2xl border border-slate-105 shadow-xs">
            <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2 font-sans">
              <Lightbulb className="w-5 h-5 text-indigo-505 text-amber-500" />
              <span>سكريبتات جاهزة للمايكروتك</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-normal font-sans">اختر وحقن أفضل سكريبتات الحماية والمقاصة والتسريع من مكتبة SuperSAS:</p>

            <div className="space-y-3">
              {Object.keys(templates).map(key => (
                <button
                  key={key}
                  onClick={() => setSelectedTemplate(key)}
                  className={`w-full text-right p-3.5 rounded-xl border text-xs transition-all cursor-pointer flex flex-col gap-1 ${
                    selectedTemplate === key
                      ? 'bg-blue-50/50 border-blue-200 text-blue-900 font-bold'
                      : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-sans text-sm">{templates[key].title}</span>
                  <span className="text-[10px] text-slate-400 font-normal leading-normal font-sans mt-1 line-clamp-2">
                    {templates[key].desc}
                  </span>
                </button>
              ))}
            </div>

            {/* Quick Tips */}
            <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100 text-[11px] text-indigo-800 space-y-2 leading-relaxed mt-6 font-sans">
              <div className="font-bold text-indigo-900">💡 كيف أستعمل هذه السكريبتات؟</div>
              <p>1. قم بنسخ الكود المراد تطبيقه.</p>
              <p>2. افتح Winbox، واذهب لقائمة New Terminal داخل المايكروتك.</p>
              <p>3. الصق الكود بـ Click Right ثم Paste واضغط Enter للتطبيق المالي الفوري.</p>
            </div>
          </div>
        </div>

        {/* Console Outputs Viewers */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Output 1: Selected prebuilt template */}
          <div className="bg-white rounded-2xl border border-slate-105 overflow-hidden shadow-xs flex flex-col">
            <div className="px-5 py-4 bg-slate-100 flex justify-between items-center border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-slate-800 text-xs font-sans">معاينة: {templates[selectedTemplate].title}</span>
              </div>
              <button
                onClick={() => handleCopy(templates[selectedTemplate].code)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-250 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg select-none transition-all cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> {copied ? 'تم النسخ!' : 'نسخ السكريبت'}
              </button>
            </div>
            
            <div className="p-4 bg-slate-950 font-mono text-xs text-yellow-400 overflow-x-auto min-h-[160px] leading-relaxed text-left" dir="ltr">
              <pre>{templates[selectedTemplate].code}</pre>
            </div>
          </div>

          {/* Output 2: Automatic System actions terminal script compiler */}
          <div className="bg-white rounded-2xl border border-slate-105 overflow-hidden shadow-xs flex flex-col">
            <div className="px-5 py-4 bg-slate-100 flex justify-between items-center border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-800 text-xs font-sans">الأكواد المتولدة عن إجراءات النظام (المزامنة الحية)</span>
              </div>
              <button
                onClick={() => handleCopy(terminalScript)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-250 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg select-none transition-all cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> نسخ الأكواد كاملة
              </button>
            </div>

            <div className="p-4 bg-slate-900 font-mono text-xs text-slate-300 overflow-y-auto max-h-[350px] leading-relaxed text-left" dir="ltr">
              <pre>{terminalScript}</pre>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

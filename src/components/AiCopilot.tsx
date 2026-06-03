import React, { useState } from 'react';
import { 
  Send, 
  HelpCircle, 
  Bot, 
  User, 
  Sparkles, 
  Cpu, 
  Globe, 
  Wifi, 
  Terminal,
  Clock
} from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

export const AiCopilot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'ai',
      text: 'مرحباً بك في مستودع ذكاء SuperSAS المتقدم! أنا هنا لمساعدتك في توليد سكريبتات MikroTik المخصصة، وتتبع مشاكل اتصال PPPoE، وحقن قوانين جدار الحماية (Firewall) بنقرة واحدة. اسألني أي سؤال شبكات.',
      time: new Date().toLocaleTimeString()
    }
  ]);

  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);

  // Suggested pre-prompts
  const suggestions = [
    { label: 'حل مشكلة انقطاع PPPoE المتكرر', val: 'كيف يمكنني حل وفحص مشكلة انقطاع اتصال PPPoE لبعض المشتركين بشكل متكرر في سيرفر المايكروتك؟' },
    { label: 'كود سكريبت تحديد السرعة بالمواقيت', val: 'اكتب سكريبت مايكروتك RouterOS لجدولة تخفيض سرعة اشتراكات PPPoE ليلاً تلقائياً وتسريعها صباحاً.' },
    { label: 'حماية السيرفر من هجمات Brute Force', val: 'كيف يمكنني حماية سيرفر مايكروتك من هجمات الاختراق Brute Force على بورت Winbox والـ SSH باستخدام سكريبت الـ Firewall؟' }
  ];

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    // Append user message
    const userMsg: ChatMessage = {
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString()
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: textToSend })
      });

      const data = await response.json();
      
      const aiMsg: ChatMessage = {
        sender: 'ai',
        text: data.reply || 'عذراً، حدث خطأ ما أثناء معالجة الرد. يرجى مراجعة الكونسول.',
        time: new Date().toLocaleTimeString()
      };
      
      setMessages((prev) => [...prev, aiMsg]);

    } catch (error) {
      console.error('Error fetching from Copilot proxy:', error);
      
      // Intelligent Offline fallback
      setTimeout(() => {
        let fallbackText = '';
        if (textToSend.includes('انقطاع') || textToSend.includes('PPPoE')) {
          fallbackText = `💡 **دليل الـ PPPoE الاسترشادي من SuperSAS (في وضع المحاكاة):**
1. **فحص الـ MTU/MRU:** تأكد من تعيين قيمة الـ MTU في profile الـ PPPoE على \`1492\`. القيم الأعلى تسبب مشاكل سقوط الاتصال عند تصفح المواقع الكبيرة.
2. **بروتوكولات التأكيد Keep-alive:** قم بتعطيل أو تعديل قيم \`Keepalive Timeout\` في PPPoE Server لتصبح \`30\` أو \`50\` ثانية للحد من تأثير تذبذب إشارة بروتوكولات الكوابل والياف ضوئية.
3. **قفل الـ MAC (Caller-id):** تأكد من عدم تعارض عنوان الـ MAC مع كابينات مستخدمين أخرين.`;
        } else if (textToSend.includes('ليلاً') || textToSend.includes('سرعة')) {
          fallbackText = `💡 **سكريبت جدولة السرعات المطاطية (في وضع المحاكاة):**
\`\`\`
/system scheduler
add name="NightSpeed" interval=1d start-time=23:00:00 on-event={
   /ppp profile set [find name="اشتراك_اعتيادي"] rate-limit="10M/10M"
}
add name="DaySpeed" interval=1d start-time=08:00:00 on-event={
   /ppp profile set [find name="اشتراك_اعتيادي"] rate-limit="30M/30M"
}
\`\`\``;
        } else {
          fallbackText = `مرحباً! يبدو أن مفتاح السفر الخاص بالذكاء الاصطناعي \`GEMINI_API_KEY\` غير مهيأ بعد في الإعدادات أو أنك في وضع الطيران المحلي.
لكن لا تقلق، يمكنك الحصول على السكريبتات الجاهزة آلياً من تبويب **"معالج سكريبتات"**، أو تسجيل مفتاح Gemini في السحاب لتفعيل التوليد المفتوح والدردشة والذكاء الاصطناعي المتكامل.`;
        }

        const aiMsg: ChatMessage = {
          sender: 'ai',
          text: fallbackText,
          time: new Date().toLocaleTimeString()
        };
        setMessages((prev) => [...prev, aiMsg]);
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Upper header */}
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Bot className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-sans flex items-center gap-1.5">
              <span>مساعد الذكاء الاصطناعي (SuperSAS Copilot)</span>
              <span className="px-2 py-0.5 bg-blue-105 text-blue-700 text-[10px] font-bold rounded-md font-sans">Gemini 3.5 AI</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">مستشار شبكات Winbox و RouterOS متكامل يحلل المشاكل ويكتب الأكواد خصيصاً لك.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Helper Side & Prompt Suggesters */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-105 shadow-xs">
            <h3 className="font-bold text-slate-800 text-xs mb-3 flex items-center gap-1.5 font-sans">
              <Sparkles className="w-4.5 h-4.5 text-blue-500" />
              أقرب الأسئلة الشائعة المقترحة
            </h3>
            <p className="text-[11px] text-slate-400 mb-4 font-sansLeading">انقر على أحد الأسئلة المسبقة للبدء الفوري بتحليل المشكلة وتوليد الحلول:</p>

            <div className="space-y-2">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s.val)}
                  className="w-full text-right p-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-blue-200 text-xs text-slate-700 rounded-xl transition-all cursor-pointer font-sans"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-55 py-4 px-5 bg-white border border-slate-150 rounded-2xl text-xs text-slate-500 space-y-2 font-sans">
            <div className="font-bold text-slate-700 flex items-center gap-1">
              <Cpu className="w-4 h-4 text-indigo-505" />
              مواصفات الفحص الذكي
            </div>
            <p className="leading-relaxed">
              تلقائيّاً، يقوم بوت المحاكاة بقراءة الباقات والمشتركين المسجلين بلوحة SuperSAS للتفكير في السكريبت المثالي المربوط بالشبكة.
            </p>
          </div>
        </div>

        {/* Live Chat Bubble Container */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-105 shadow-xs flex flex-col min-h-[460px] overflow-hidden">
          
          {/* Chat bubble body */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[400px]">
            {messages.map((m, idx) => {
              const isAi = m.sender === 'ai';
              return (
                <div 
                  key={idx} 
                  className={`flex gap-3 max-w-[85%] ${isAi ? 'ml-auto' : 'mr-auto flex-row-reverse'}`}
                >
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs ${
                    isAi ? 'bg-blue-50 text-blue-600' : 'bg-slate-900 text-white'
                  }`}>
                    {isAi ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>

                  {/* Bubble text */}
                  <div className={`p-4 rounded-2xl text-sm ${
                    isAi 
                      ? 'bg-blue-50/50 border border-blue-100 text-slate-800 rounded-tr-none' 
                      : 'bg-slate-900 text-white rounded-tl-none font-sans'
                  }`}>
                    <div className="whitespace-pre-line leading-relaxed font-sans">{m.text}</div>
                    <span className="block text-[9px] text-slate-400 mt-2 font-mono" dir="ltr">
                      {m.time}
                    </span>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-3 max-w-[80%] ml-auto">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center animate-spin">
                  ⏳
                </div>
                <div className="bg-blue-50/30 p-4 border border-blue-50 rounded-2xl rounded-tr-none text-xs text-slate-500">
                  جاري تفحص الباقات والأكواد في مايكروتك والتفكير في الحل المثالي...
                </div>
              </div>
            )}
          </div>

          {/* Chat Input panel */}
          <div className="p-4 border-t border-slate-150 bg-slate-50/50">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputVal);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="اكتب استشارتك الفنية أو اطلب سكريبت معين هنا..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm Outline-none text-slate-800 placeholder-slate-400 outline-hidden focus:border-blue-500 transition-all font-sans"
              />
              <button
                type="submit"
                disabled={loading || !inputVal.trim()}
                className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-all shrink-0"
              >
                <Send className="w-4 h-4 text-white transform rotate-180" />
              </button>
            </form>
          </div>

        </div>

      </div>

    </div>
  );
};

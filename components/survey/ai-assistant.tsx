'use client';

import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { callGeminiAPI } from '@/lib/ai-service';
import { Camera, Send, Bot, Sparkles, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/lib/stores/app-store';
import { db } from '@/lib/db';

export function AIAssistant({ projectData }: { projectData?: any }) {
  const storeProject = useAppStore((state) => state.currentProject);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const activeProject = projectData || storeProject;

  const livePoints = useLiveQuery(
    () => db.points.where('projectId').equals(currentProjectId).sortBy('pointNumber'),
    [currentProjectId]
  );
  const points = livePoints ?? [];

  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'ai';
      text: string;
      image?: string | null;
      time: string;
    }>
  >([
    {
      role: 'ai',
      text: `مرحباً بك! أنا مستشارك الهندسي الذكي في SurveyPro AI.
يمكنني مساعدتك في:
- الاستعلام الحتمي عن المسافات والانحرافات بين نقاط المشروع (مثال: احسب المسافة بين P1 و P2)
- تدقيق ومراجعة إحداثيات ومناسيب الرفع المساحي وخلوها من الشذوذ (Outliers)
- شرح وتوضيح نتائج التحويلات الجيوديسية وحسابات الحفر والردم
- تحليل صور المخططات وشاشات أجهزة المساحة الميدانية`,
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const quickPrompts = [
    'احسب المسافة والانحراف بين P1 و P2',
    'راجع جودة بيانات المشروع الحالي والشذوذ الإحصائي',
    'ما هي شروط دقة التحويل للمرجع الإقليمي Ain el Abd 1970؟',
  ];

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setSelectedImage(result);
        const base64String = result.split(',')[1];
        setImageBase64(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const message = textToSend || inputText;
    if (!message.trim() && !imageBase64) return;

    const userMessage = message || 'حلل هذه الصورة المرفقة';

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        text: userMessage,
        image: selectedImage,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setInputText('');
    setSelectedImage(null);
    setImageBase64(null);
    setIsLoading(true);

    try {
      const fullProjectContext = {
        ...activeProject,
        pointCount: points.length,
        points: points.map((p) => ({
          pointNumber: p.pointNumber,
          easting: p.easting,
          northing: p.northing,
          elevation: p.elevation,
          description: p.description,
        })),
      };

      const aiResponse = await callGeminiAPI(userMessage, fullProjectContext, imageBase64 || undefined);

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: aiResponse,
          time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: 'عذراً، حدث خطأ أثناء معالجة الطلب. يرجى التأكد من اتصال الإنترنت.',
          time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card flex h-[620px] flex-col overflow-hidden">
      {/* منطقة عرض الرسائل */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed sm:max-w-[75%] ${
                msg.role === 'user'
                  ? 'bg-sky-500/20 border border-sky-500/30 text-sky-100 rounded-br-none'
                  : 'bg-slate-850 border border-slate-750 text-slate-200 rounded-bl-none'
              }`}
            >
              {msg.role === 'ai' && (
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-fuchsia-400">
                  <Bot className="h-4 w-4" />
                  المساعد الذكي (مدعوم بمحرك الحسابات الحتمي)
                </div>
              )}
              {msg.image && (
                <img
                  src={msg.image}
                  alt="مرفق"
                  className="mb-3 max-h-56 w-auto rounded-lg border border-slate-700 object-contain"
                />
              )}
              <p className="whitespace-pre-wrap">{msg.text}</p>
              <span className="mt-2 block text-left text-[10px] text-slate-500">{msg.time}</span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-end">
            <div className="rounded-2xl border border-slate-750 bg-slate-850 p-4 text-slate-200">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-400" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-400 [animation-delay:0.2s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-400 [animation-delay:0.4s]" />
                <span className="text-xs text-slate-400 mr-2">جاري التحليل والمطابقة الحسابية...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* الأسئلة السريعة */}
      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-800/60 bg-slate-950/40 px-4 py-2.5">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => void handleSendMessage(prompt)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-750 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-fuchsia-500/40 hover:text-fuchsia-300"
            >
              <Sparkles className="h-3 w-3 text-fuchsia-400" />
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* منطقة الإدخال */}
      <div className="border-t border-slate-800/80 bg-slate-950/60 p-4">
        {selectedImage && (
          <div className="relative mb-3 inline-block">
            <img src={selectedImage} alt="معاينة" className="h-20 rounded-lg border border-slate-700" />
            <button
              onClick={() => {
                setSelectedImage(null);
                setImageBase64(null);
              }}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow-md hover:bg-red-400"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-750 bg-slate-900 text-fuchsia-400 transition-colors hover:border-fuchsia-500/40 hover:bg-slate-800"
            title="إرفاق صورة مخطط أو جهاز"
          >
            <Camera className="h-5 w-5" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSendMessage();
            }}
            placeholder="اكتب استفسارك أو اطلب حساب مسافة وانحراف بين نقطتين (P1, P2)..."
            className="h-11 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-fuchsia-500"
          />

          <button
            onClick={() => void handleSendMessage()}
            disabled={isLoading || (!inputText.trim() && !imageBase64)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-950/40 transition-all hover:bg-fuchsia-400 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIAssistant;

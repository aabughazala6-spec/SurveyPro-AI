'use client';

import { useState } from 'react';
import {
  Check,
  ChevronLeft,
  Crown,
  Lock,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  icon: typeof Crown;
  color: string;
  bg: string;
  border: string;
  recommended: boolean;
};

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'المجانية',
    price: '0',
    period: 'مجاناً للأبد',
    description: 'للمساحين الفرديين والاستخدام الشخصي',
    features: [
      'حتى 3 مشاريع مساحية',
      'إدارة نقاط PNEZD كاملة',
      'حساب المساحة والمحيط',
      'تصدير CSV',
      'محول الإحداثيات WGS84/UTM',
      'دعم فني عبر البريد',
    ],
    icon: Zap,
    color: 'text-slate-300',
    bg: 'bg-slate-800/40',
    border: 'border-slate-700/50',
    recommended: false,
  },
  {
    id: 'pro',
    name: 'الاحترافية',
    price: '49',
    period: 'ريال / شهرياً',
    description: 'للمساحين المحترفين والمكاتب الصغيرة',
    features: [
      'مشاريع غير محدودة',
      'المساعد الذكي AI — كامل',
      'كشف الأخطاء (Outliers) تلقائياً',
      'تصدير DXF / KML / PDF',
      'الخريطة التفاعلية مع كل المزايا',
      'دعم فني ذو أولوية',
      'تقارير احترافية جاهزة',
    ],
    icon: Crown,
    color: 'text-amber-400',
    bg: 'bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900',
    border: 'border-amber-500/30',
    recommended: true,
  },
  {
    id: 'enterprise',
    name: 'الشركات',
    price: '149',
    period: 'ريال / شهرياً',
    description: 'للمؤسسات والمكاتب المساحية الكبرى',
    features: [
      'كل مزايا الخطة الاحترافية',
      'مزامنة سحابية للمشاريع',
      'إدارة فريق عمل (حتى 10 أعضاء)',
      'وصول API للمطورين',
      'تخزين غير محدود للبيانات',
      'تقارير مخصصة بالشعار',
      'مدير حساب مخصص',
    ],
    icon: Sparkles,
    color: 'text-fuchsia-400',
    bg: 'bg-slate-800/40',
    border: 'border-slate-700/50',
    recommended: false,
  },
];

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubscribe = (plan: Plan) => {
    if (plan.id === 'starter') {
      toast.success('أنت مسجل في الخطة المجانية بالفعل');
      return;
    }
    setSelectedPlan(plan);
  };

  const handlePayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsProcessing(false);
    setCardNumber('');
    setCardName('');
    setCardExpiry('');
    setCardCvc('');
    setSelectedPlan(null);
    toast.success(`تم الاشتراك في الخطة ${selectedPlan?.name} بنجاح!`, {
      description: 'مرحباً بك في SurveyPro AI — استمتع بالمزايا الكاملة',
    });
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mb-10 text-center">
        <div className="mb-3 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span>الرئيسية</span>
          <ChevronLeft className="h-3 w-3" />
          <span className="text-amber-400">الترقية والاشتراك</span>
        </div>
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/20">
          <Crown className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold text-white sm:text-4xl">ارتقِ بمساحتك الاحترافية</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-400">
          اختر الباقة المناسبة لاحتياجاتك. كل الباقات تشمل العمل بدون إنترنت، ويمكنك الترقية أو الإلغاء في أي وقت.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
        {plans.map((plan) => {
          const Icon = plan.icon;
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col overflow-hidden rounded-2xl border p-6 transition-all ${plan.border} ${plan.bg} ${plan.recommended ? 'lg:-translate-y-3 lg:scale-[1.02] shadow-2xl shadow-amber-950/20' : ''}`}
            >
              {plan.recommended && (
                <div className="absolute left-1/2 top-0 -translate-x-1/2 rounded-b-lg bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-1 text-[11px] font-bold text-white">
                  موصى بها
                </div>
              )}
              <div className="mb-5 mt-2">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${plan.recommended ? 'bg-amber-500/15' : 'bg-slate-700/30'} ${plan.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{plan.description}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="mr-2 text-sm text-slate-500">{plan.period}</span>
              </div>
              <ul className="mb-6 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.color}`} />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(plan)}
                className={`mt-auto flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${
                  plan.recommended
                    ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-950/30 hover:from-amber-300 hover:to-amber-500'
                    : plan.id === 'starter'
                    ? 'border border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800'
                    : 'border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20'
                }`}
              >
                {plan.id === 'starter' ? 'ابدأ مجاناً' : 'اشترك الآن'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex items-center justify-center gap-2 text-xs text-slate-600">
        <Lock className="h-3.5 w-3.5" />
        جميع المدفوعات مشفّرة وآمنة — إلغاء في أي وقت
      </div>

      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">الاشتراك في الخطة {selectedPlan.name}</h2>
                <p className="mt-1 text-xs text-slate-500">{selectedPlan.price} {selectedPlan.period}</p>
              </div>
              <button onClick={() => setSelectedPlan(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="إغلاق">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handlePayment} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-slate-400">الاسم على البطاقة</span>
                <input
                  required
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="محمد عبدالله"
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-amber-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-slate-400">رقم البطاقة</span>
                <input
                  required
                  dir="ltr"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  maxLength={19}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-amber-500"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-400">تاريخ الانتهاء</span>
                  <input
                    required
                    dir="ltr"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="MM/YY"
                    maxLength={5}
                    className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-amber-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-400">CVC</span>
                  <input
                    required
                    dir="ltr"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    placeholder="123"
                    maxLength={4}
                    className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-amber-500"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-800/50 p-3 text-xs text-slate-500">
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                هذه واجهة محاكاة للدفع — لا يتم خصم أي مبلغ فعلي
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-sm font-bold text-white hover:from-amber-300 hover:to-amber-500 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      جاري المعالجة...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      تأكيد الدفع
                    </>
                  )}
                </button>
                <button type="button" onClick={() => setSelectedPlan(null)} className="h-12 rounded-xl border border-slate-700 px-5 text-sm font-semibold text-slate-300 hover:bg-slate-800">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { CogoCalculator } from '@/components/survey/cogo-calculator';

export default function CogoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          محرك الحسابات المساحية والهندسية (COGO Suite)
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          حسابات المسافة والانحراف، الحساب المباشر، المنحنيات الأفقية للطرق، تدريج المسارات وميزانية المناسيب
        </p>
      </div>

      <CogoCalculator />
    </div>
  );
}

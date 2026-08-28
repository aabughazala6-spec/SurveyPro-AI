import { QAQCDashboard } from '@/components/survey/qa-qc-dashboard';

export default function QAQCPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          تدقيق الجودة المساحية (QA / QC Engine)
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          فحص أوتوماتيكي لكشف تكرار النقاط، شذوذ المناسيب، توافق الإسقاط الجغرافي وتوليد تقارير المطابقة
        </p>
      </div>

      <QAQCDashboard />
    </div>
  );
}

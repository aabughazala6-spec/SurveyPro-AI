'use client';

import { QAQCDashboard } from '@/components/survey/qa-qc-dashboard';
import { useTranslation } from '@/lib/i18n';

export default function QAQCPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {t('qaqc.title')}
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          {t('qaqc.subtitle')}
        </p>
      </div>

      <QAQCDashboard />
    </div>
  );
}

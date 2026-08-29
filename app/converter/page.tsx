'use client';

import { ChevronLeft, ChevronRight, Crosshair } from 'lucide-react';
import { CoordinateForm } from '@/components/survey/coordinate-form';
import { useTranslation } from '@/lib/i18n';

export default function ConverterPage() {
  const { t, isRtl } = useTranslation();
  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <span>{t('nav.home')}</span>
          <ChevronIcon className="h-3 w-3" />
          <span className="text-sky-400">{t('nav.crs')}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
            <Crosshair className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{t('nav.crs')}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {isRtl
                ? 'تحويل دقيق وموثوق بين WGS84 و UTM Zones 36-39N والمراجع المحلية'
                : 'Rigorous geodetic transformation between WGS84, UTM Zones 36-39N, and regional datums'}
            </p>
          </div>
        </div>
      </div>
      <CoordinateForm />
    </div>
  );
}

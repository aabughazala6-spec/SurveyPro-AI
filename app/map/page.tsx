'use client';

import dynamic from 'next/dynamic';
import { ChevronLeft, ChevronRight, Compass, Layers, Map as MapIcon } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

const SurveyMap = dynamic(() => import('@/components/survey/survey-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70vh] w-full items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-sky-500/20 border-t-sky-400" />
        <p className="text-sm font-medium text-slate-400">Loading CAD map engine & satellite layers...</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  const { t, isRtl } = useTranslation();
  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <span>{t('nav.home')}</span>
            <ChevronIcon className="h-3 w-3" />
            <span className="text-sky-400">{t('nav.map')}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <MapIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">
                {t('nav.map')}
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
                {isRtl
                  ? 'عرض وتعديل نقاط الرفع على صور الأقمار الصناعية، وحساب المسافات والانحرافات والمساحات الحقيقية'
                  : 'Interactive CAD canvas, high-resolution satellite imagery, geodesics, and live polygon digitization'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/points"
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors shadow-lg"
          >
            <Layers className="h-4 w-4 text-emerald-400" />
            <span>{t('nav.points')}</span>
          </Link>
          <Link
            href="/cogo"
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors shadow-lg"
          >
            <Compass className="h-4 w-4 text-amber-400" />
            <span>{t('nav.cogo')}</span>
          </Link>
        </div>
      </div>

      <SurveyMap />
    </div>
  );
}

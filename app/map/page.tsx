'use client';

import dynamic from 'next/dynamic';
import { ChevronLeft, Map as MapIcon } from 'lucide-react';

const SurveyMap = dynamic(() => import('@/components/survey/survey-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] w-full items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/40">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-orange-400" />
        <p className="text-sm text-slate-500">جاري تحميل الخريطة...</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <span>الأدوات</span>
          <ChevronLeft className="h-3 w-3" />
          <span className="text-orange-400">الخريطة التفاعلية</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
            <MapIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">الخريطة التفاعلية</h1>
            <p className="mt-1 text-sm text-slate-400">عرض نقاط الرفع المساحي على صور الأقمار الصناعية Esri مع تحديد موقعك الفعلي</p>
          </div>
        </div>
      </div>
      <SurveyMap />
    </div>
  );
}

'use client';

import { ChevronLeft, Ruler } from 'lucide-react';
import { UnitConverter } from '@/components/survey/unit-converter';

export default function UnitConverterPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <span>الأدوات</span>
          <ChevronLeft className="h-3 w-3" />
          <span className="text-sky-400">محول الوحدات</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
            <Ruler className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">محول الوحدات الشامل</h1>
            <p className="mt-1 text-sm text-slate-400">تحويل دقيق بين وحدات الأطوال والمساحات والأحجام</p>
          </div>
        </div>
      </div>
      <UnitConverter />
    </div>
  );
}

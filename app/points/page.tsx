'use client';

import { ChevronLeft, ClipboardList, Layers } from 'lucide-react';
import { VirtualizedPointWorkspace } from '@/components/survey/virtualized-point-workspace';

export default function PointsPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <span>الأدوات المساحية</span>
          <ChevronLeft className="h-3 w-3" />
          <span className="text-emerald-400">مساحة عمل النقاط والإسناد (Point Workspace)</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              إدارة النقاط الجيوديسية والمساحات
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              مساحة عمل متقدمة لإدارة وتعديل وتدقيق النقاط المساحية، وإزاحة المناسيب، ونقل نظم الإسناد (CRS Safety)
            </p>
          </div>
        </div>
      </div>
      <VirtualizedPointWorkspace />
    </div>
  );
}

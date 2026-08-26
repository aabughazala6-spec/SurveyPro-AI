'use client';

import { ChevronLeft, ClipboardList } from 'lucide-react';
import { PointTable } from '@/components/survey/point-table';

export default function PointsPage() {
  return <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10"><div className="mb-8"><div className="mb-3 flex items-center gap-2 text-xs text-slate-500"><span>الأدوات</span><ChevronLeft className="h-3 w-3" /><span className="text-emerald-400">النقاط والمساحات</span></div><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><ClipboardList className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold text-white sm:text-3xl">النقاط والمساحات</h1><p className="mt-1 text-sm text-slate-400">إدارة نقاط الرفع وحساب المساحة والمحيط تلقائياً</p></div></div></div><PointTable /></div>;
}

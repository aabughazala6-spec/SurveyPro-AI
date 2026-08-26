'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Calculator,
  ChevronLeft,
  ClipboardList,
  FileText,
  Layers,
  Map,
  MapPin,
  MoreHorizontal,
  MoveUpRight,
  Ruler,
  Shovel,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useAppStore } from '@/lib/stores/app-store';

const quickTools = [
  {
    title: 'محول الإحداثيات',
    description: 'تحويل WGS84 إلى UTM والعكس',
    href: '/converter',
    icon: Calculator,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'hover:border-sky-500/40',
    glow: 'rgba(14, 165, 233, 0.12)',
  },
  {
    title: 'إدارة النقاط',
    description: 'إضافة وتعديل نقاط الرفع المساحي',
    href: '/points',
    icon: Target,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'hover:border-emerald-500/40',
    glow: 'rgba(16, 185, 129, 0.12)',
  },
  {
    title: 'الحفر والردم',
    description: 'تقدير كميات الحفر والردم',
    href: '/volume',
    icon: Shovel,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'hover:border-orange-500/40',
    glow: 'rgba(249, 115, 22, 0.12)',
  },
  {
    title: 'محول الوحدات',
    description: 'تحويل الأطوال والمساحات والأحجام',
    href: '/units',
    icon: Ruler,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'hover:border-indigo-500/40',
    glow: 'rgba(99, 102, 241, 0.12)',
  },
  {
    title: 'الخريطة التفاعلية',
    description: 'عرض النقاط والمضلعات على الخريطة',
    href: '/map',
    icon: Map,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'hover:border-teal-500/40',
    glow: 'rgba(20, 184, 166, 0.12)',
  },
  {
    title: 'المساعد الذكي',
    description: 'تحليل البيانات وإعداد التقارير',
    href: '/assistant',
    icon: Sparkles,
    color: 'text-fuchsia-400',
    bg: 'bg-fuchsia-500/10',
    border: 'hover:border-fuchsia-500/40',
    glow: 'rgba(217, 70, 239, 0.12)',
  },
];

function formatNumber(value: number, decimals = 2) {
  return value.toLocaleString('ar-SA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function Home() {
  const project = useAppStore((state) => state.currentProject);
  const isOnline = useAppStore((state) => state.isOnline);
  const areaInFeddans = project.areaSquareMeters / 4200.83;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <section className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <span>الرئيسية</span><ChevronLeft className="h-3 w-3" /><span className="text-sky-400">لوحة التحكم</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">لوحة التحكم</h1>
          <p className="mt-2 text-sm text-slate-400">نظرة سريعة على أعمالك المساحية اليوم</p>
        </div>
        <div className={`flex w-fit items-center gap-2 rounded-full border px-3.5 py-2 text-xs ${isOnline ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
          <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          {isOnline ? 'أنت متصل بالإنترنت' : 'تعمل في وضع عدم الاتصال'}
        </div>
      </section>

      <section className="mb-8 overflow-hidden rounded-2xl border border-sky-500/15 bg-gradient-to-l from-sky-500/10 via-slate-900/70 to-slate-900/70 p-5 shadow-xl shadow-sky-950/10 sm:p-7">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-sky-400"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" />المشروع النشط</div>
            <div className="flex items-start gap-3">
              <div className="mt-1 hidden h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 sm:flex"><MapPin className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-bold text-white sm:text-2xl">{project.name}</h2>
                <p className="mt-1 text-sm text-slate-400">{project.location}</p>
              </div>
            </div>
          </div>
          <Link href="/projects" className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm font-semibold text-slate-200 transition-all hover:border-sky-500/50 hover:bg-slate-800 hover:text-white">
            إدارة المشروع <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-5 sm:grid-cols-4 sm:gap-0">
          <div className="border-slate-800/80 px-2 sm:border-l sm:px-5 first:sm:pr-0"><p className="mb-1 text-xs text-slate-500">المساحة الإجمالية</p><p className="text-lg font-bold text-white">{formatNumber(project.areaSquareMeters)} <span className="text-xs font-normal text-slate-500">م²</span></p><p className="mt-0.5 text-[11px] text-slate-500">≈ {formatNumber(areaInFeddans)} فدان</p></div>
          <div className="border-slate-800/80 px-2 sm:border-l sm:px-5"><p className="mb-1 text-xs text-slate-500">عدد النقاط</p><p className="text-lg font-bold text-white">{project.pointCount} <span className="text-xs font-normal text-slate-500">نقطة</span></p><p className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-400"><TrendingUp className="h-3 w-3" /> 12% هذا الأسبوع</p></div>
          <div className="border-slate-800/80 px-2 sm:border-l sm:px-5"><p className="mb-1 text-xs text-slate-500">المحيط</p><p className="text-lg font-bold text-white">{formatNumber(project.perimeter, 1)} <span className="text-xs font-normal text-slate-500">م</span></p><p className="mt-0.5 text-[11px] text-slate-500">آخر حساب تلقائي</p></div>
          <div className="px-2 sm:px-5"><p className="mb-1 text-xs text-slate-500">آخر تحديث</p><p className="text-lg font-bold text-white">نشط</p><p className="mt-0.5 text-[11px] text-slate-500">{project.updatedAt}</p></div>
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold text-white">أدوات سريعة</h2><p className="mt-1 text-xs text-slate-500">ابدأ عملك المساحي بخطوة واحدة</p></div><Ruler className="h-5 w-5 text-slate-600" /></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
          {quickTools.map((tool) => { const Icon = tool.icon; return <Link key={tool.href} href={tool.href} className={`tool-card ${tool.border} group`} style={{ '--tool-glow': tool.glow } as React.CSSProperties}><div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${tool.bg} ${tool.color} transition-transform duration-300 group-hover:scale-110`}><Icon className="h-5 w-5" /></div><h3 className="text-sm font-bold text-slate-100">{tool.title}</h3><p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{tool.description}</p><MoveUpRight className={`absolute left-4 top-5 h-4 w-4 ${tool.color} opacity-0 transition-opacity group-hover:opacity-100`} /></Link>; })}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass-card p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold text-white">نشاط المشروع</h2><p className="mt-1 text-xs text-slate-500">آخر العمليات المسجلة</p></div><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-300" aria-label="المزيد"><MoreHorizontal className="h-5 w-5" /></button></div><div className="space-y-1"><ActivityItem icon={Target} color="text-emerald-400" bg="bg-emerald-500/10" title="تمت إضافة 8 نقاط جديدة" time="منذ 12 دقيقة" /><ActivityItem icon={Calculator} color="text-sky-400" bg="bg-sky-500/10" title="تم حساب مساحة المضلع" time="منذ 35 دقيقة" /><ActivityItem icon={FileText} color="text-orange-400" bg="bg-orange-500/10" title="تم تصدير تقرير النقاط بصيغة CSV" time="أمس، 04:20 م" /></div><Link href="/projects" className="mt-5 flex items-center justify-center gap-2 border-t border-slate-800/70 pt-4 text-xs font-semibold text-sky-400 hover:text-sky-300">عرض كل النشاط <ChevronLeft className="h-3.5 w-3.5" /></Link></div>
        <div className="relative overflow-hidden rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/10 via-slate-900 to-slate-900 p-6"><div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" /><div className="relative"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-400"><Sparkles className="h-5 w-5" /></div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-fuchsia-400">مساعد SurveyPro</p><h2 className="max-w-xs text-xl font-bold leading-relaxed text-white">هل تحتاج إلى تحليل بياناتك المساحية؟</h2><p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">دع المساعد الذكي يكتشف الأخطاء ويجهز لك تقريراً احترافياً في ثوانٍ.</p><Link href="/assistant" className="mt-6 flex w-fit items-center gap-2 rounded-xl bg-fuchsia-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-fuchsia-400">ابدأ المحادثة <ArrowLeft className="h-4 w-4" /></Link></div></div>
      </section>
    </div>
  );
}

function ActivityItem({ icon: Icon, color, bg, title, time }: { icon: typeof Target; color: string; bg: string; title: string; time: string }) {
  return <div className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-slate-800/40"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg} ${color}`}><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{title}</p><p className="mt-0.5 text-[11px] text-slate-500">{time}</p></div><ChevronLeft className="h-4 w-4 text-slate-700" /></div>;
}

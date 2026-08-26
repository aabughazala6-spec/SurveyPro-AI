'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownToLine,
  ArrowLeft,
  Bot,
  Calculator,
  ChevronLeft,
  ClipboardList,
  Compass,
  FileCode2,
  FolderKanban,
  Gauge,
  Layers,
  Map,
  MapPin,
  MoveRight,
  MoveUpRight,
  Plus,
  Ruler,
  ShieldAlert,
  ShieldCheck,
  Shovel,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { db, type PointRecord } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import { calculatePolygonArea, calculatePolygonPerimeter, squareMetersToFeddans } from '@/lib/survey-calculations';
import { runSurveyQAQC } from '@/lib/qa-qc-engine';

const coreEngines = [
  {
    title: 'نقاط الرفع PNEZD',
    description: 'إدارة وتعديل وحساب المساحات والمحيط ثلاثي الأبعاد',
    href: '/points',
    icon: ClipboardList,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'hover:border-emerald-500/40',
  },
  {
    title: 'حسابات COGO الهندسية',
    description: 'المسافة والانحراف، الحساب المباشر، المنحنيات والميزانية',
    href: '/cogo',
    icon: Compass,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'hover:border-sky-500/40',
  },
  {
    title: 'تدقيق الجودة QA / QC',
    description: 'كشف تكرار النقاط، شذوذ المناسيب وفحص السلامة',
    href: '/qa-qc',
    icon: ShieldCheck,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'hover:border-amber-500/40',
  },
  {
    title: 'استيراد وتصدير DXF',
    description: 'معالج قراءة PNEZD وتصدير AutoCAD و GIS و KML',
    href: '/import',
    icon: ArrowDownToLine,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'hover:border-cyan-500/40',
  },
  {
    title: 'الحفر والردم والكميات',
    description: 'حساب مناسيب التسوية ومعاملات الدمك والانتفاش',
    href: '/volume',
    icon: Shovel,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'hover:border-orange-500/40',
  },
  {
    title: 'نظم الإحداثيات CRS',
    description: 'تحويل WGS84، UTM 36-39N، Ain el Abd والمراجع المحلية',
    href: '/converter',
    icon: Calculator,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'hover:border-indigo-500/40',
  },
  {
    title: 'الخريطة والـ GIS',
    description: 'عرض المضلعات والطبقات الفضائية Esri Satellite',
    href: '/map',
    icon: Map,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'hover:border-teal-500/40',
  },
  {
    title: 'المساعد المساحي الذكي',
    description: 'تحليل البيانات الجيوديسية وتوليد التقارير الفنية',
    href: '/assistant',
    icon: Bot,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'hover:border-purple-500/40',
  },
];

function formatNumber(value: number, decimals = 2) {
  return value.toLocaleString('ar-SA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function Home() {
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentProject = useAppStore((state) => state.currentProject);
  const isOnline = useAppStore((state) => state.isOnline);
  const activeCrs = useAppStore((state) => state.activeCrs);

  const livePoints = useLiveQuery(
    () => db.points.where('projectId').equals(currentProjectId).sortBy('pointNumber'),
    [currentProjectId]
  );
  const points = useMemo(() => livePoints ?? [], [livePoints]);

  const area = useMemo(() => calculatePolygonArea(points), [points]);
  const perimeter = useMemo(() => calculatePolygonPerimeter(points), [points]);
  const qaReport = useMemo(() => runSurveyQAQC(points), [points]);

  return (
    <div className="space-y-8">
      {/* HEADER SECTION */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <span>الرئيسية</span>
            <ChevronLeft className="h-3 w-3" />
            <span className="text-sky-400">لوحة التحكم الهندسية</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            نظام SurveyPro AI للجيوماتكس والمساحة
          </h1>
          <p className="mt-1.5 text-xs text-slate-400">
            بيئة العمل المتكاملة لمعالجة وتحليل وتدقيق بيانات الرفع المساحي والحسابات الهندسية
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
              isOnline
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            {isOnline ? 'قاعدة بيانات محلية نشطة (IndexedDB)' : 'وضع العمل الميداني المستقل'}
          </div>
        </div>
      </section>

      {/* ACTIVE PROJECT HERO */}
      <section className="glass-card overflow-hidden p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="mb-2.5 flex items-center gap-2 text-xs font-bold text-sky-400">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              المشروع النشط الحالي • {activeCrs}
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 hidden h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 sm:flex">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white sm:text-2xl">{currentProject.name}</h2>
                <p className="mt-1 text-xs text-slate-400">
                  {currentProject.description || 'مشروع الرفع المساحي الرئيسي'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/import"
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-850 px-4 py-2.5 text-xs font-bold text-slate-200 transition-all hover:bg-slate-800"
            >
              <ArrowDownToLine className="h-4 w-4 text-sky-400" />
              استيراد / تصدير DXF
            </Link>
            <Link
              href="/points"
              className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-950/40 transition-all hover:bg-sky-400"
            >
              <Plus className="h-4 w-4" />
              إدارة نقاط المشروع
            </Link>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="mt-7 grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-5 sm:grid-cols-4 sm:gap-0">
          <div className="border-slate-800/80 px-2 sm:border-l sm:px-5 first:sm:pr-0">
            <p className="mb-1 text-xs text-slate-500">المساحة الإجمالية</p>
            <p className="text-lg font-bold text-white" dir="ltr">
              {formatNumber(area)} <span className="text-xs font-normal text-slate-400">م²</span>
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              ≈ {formatNumber(squareMetersToFeddans(area), 3)} فدان
            </p>
          </div>

          <div className="border-slate-800/80 px-2 sm:border-l sm:px-5">
            <p className="mb-1 text-xs text-slate-500">عدد نقاط الرفع</p>
            <p className="text-lg font-bold text-emerald-400">{points.length} نقطة</p>
            <p className="mt-0.5 text-[11px] text-slate-400">PNEZD ثلاثي الأبعاد</p>
          </div>

          <div className="border-slate-800/80 px-2 sm:border-l sm:px-5">
            <p className="mb-1 text-xs text-slate-500">محيط المضلع</p>
            <p className="text-lg font-bold text-white" dir="ltr">
              {formatNumber(perimeter, 2)} <span className="text-xs font-normal text-slate-400">م</span>
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">إغلاق هندسي كامل</p>
          </div>

          <div className="px-2 sm:px-5">
            <p className="mb-1 text-xs text-slate-500">تدقيق الجودة QA/QC</p>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-lg font-bold ${
                  qaReport.overallScore >= 80 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {qaReport.overallScore}%
              </span>
              <span className="text-[11px] text-slate-500">({qaReport.status})</span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {qaReport.errorCount} أخطاء • {qaReport.warningCount} تنبيهات
            </p>
          </div>
        </div>
      </section>

      {/* CORE ENGINES GRID */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">منظومة الأدوات والمحركات الهندسية</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              أدوات مساحية دقيقة مبنية على خوارزميات رياضية وجيوديسية حتمية
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
          {coreEngines.map((engine) => {
            const Icon = engine.icon;
            return (
              <Link
                key={engine.href}
                href={engine.href}
                className={`glass-card group relative p-5 transition-all hover:scale-[1.02] ${engine.border}`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${engine.bg} ${engine.color} transition-transform group-hover:scale-110`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <MoveUpRight className="h-4 w-4 text-slate-600 transition-colors group-hover:text-white" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-white">{engine.title}</h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">{engine.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* RECENT POINTS & AI COPILOT BANNER */}
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        {/* POINTS SNIPPET */}
        <div className="glass-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">نقاط الرفع المساحي للمشروع</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                عرض سريع لأحدث النقاط المسجلة في المشروع
              </p>
            </div>
            <Link
              href="/points"
              className="text-xs font-semibold text-sky-400 hover:underline flex items-center gap-1"
            >
              عرض الكل ({points.length}) <ChevronLeft className="h-3 w-3" />
            </Link>
          </div>

          {points.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/60">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="p-2.5">النقطة</th>
                    <th className="p-2.5">Easting X</th>
                    <th className="p-2.5">Northing Y</th>
                    <th className="p-2.5">Z</th>
                    <th className="p-2.5">الوصف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {points.slice(0, 5).map((p) => (
                    <tr key={p.id}>
                      <td className="p-2.5 font-bold text-emerald-400">P{p.pointNumber}</td>
                      <td className="p-2.5 font-mono text-slate-300" dir="ltr">
                        {p.easting.toFixed(2)}
                      </td>
                      <td className="p-2.5 font-mono text-slate-300" dir="ltr">
                        {p.northing.toFixed(2)}
                      </td>
                      <td className="p-2.5 font-mono text-sky-400" dir="ltr">
                        {p.elevation.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-slate-400 truncate max-w-[120px]">
                        {p.description || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-36 flex-col items-center justify-center text-center">
              <ClipboardList className="h-8 w-8 text-slate-700 mb-2" />
              <p className="text-xs text-slate-500">لا توجد نقاط بالمشروع</p>
              <Link href="/points" className="mt-2 text-xs font-bold text-sky-400">
                + إضافة أول نقطة
              </Link>
            </div>
          )}
        </div>

        {/* AI BANNER */}
        <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-slate-900 to-slate-900 p-6 flex flex-col justify-between">
          <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="relative">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
              <Bot className="h-6 w-6" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
              المساعد المساحي الذكي
            </span>
            <h3 className="mt-1 text-lg font-bold text-white leading-snug">
              تحليل جيوديسي فوري واستشارات مساحية
            </h3>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              المساعد مدرك لسياق مشروعك بالكامل ({points.length} نقطة، مساحة {formatNumber(area)} م²)
              وجاهز لكتابة التقارير وتفسير تشوهات الإسقاط.
            </p>
          </div>

          <Link
            href="/assistant"
            className="mt-6 flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950/40 hover:opacity-95"
          >
            <Sparkles className="h-4 w-4" /> استشارة المساعد الآن
          </Link>
        </div>
      </section>
    </div>
  );
}

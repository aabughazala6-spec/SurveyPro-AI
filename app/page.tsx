'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownToLine,
  Bot,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Compass,
  FolderKanban,
  Gauge,
  Layers,
  Map,
  MapPin,
  MoveUpRight,
  Plus,
  Ruler,
  ShieldCheck,
  Shovel,
  Sparkles,
} from 'lucide-react';
import { db } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import { calculatePolygonArea, calculatePolygonPerimeter, squareMetersToFeddans } from '@/lib/survey-calculations';
import { runSurveyQAQC } from '@/lib/qa-qc-engine';
import { useTranslation, engFormat } from '@/lib/i18n';

export default function Home() {
  const { t, isRtl, dir } = useTranslation();
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

  const coreEngines = [
    {
      title: t('nav.points'),
      description: isRtl ? 'إدارة وتعديل وحساب المساحات والمحيط ثلاثي الأبعاد' : 'Manage, edit, and compute 3D polygon area & perimeter',
      href: '/points',
      icon: ClipboardList,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'hover:border-emerald-500/40',
    },
    {
      title: t('nav.cogo'),
      description: isRtl ? 'المسافة والانحراف، الحساب المباشر، المنحنيات والميزانية' : 'Inverse, Forward, Traverse, Circular Curves, and Leveling',
      href: '/cogo',
      icon: Compass,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
      border: 'hover:border-sky-500/40',
    },
    {
      title: t('nav.qaqc'),
      description: isRtl ? 'كشف تكرار النقاط، شذوذ المناسيب وفحص السلامة' : 'Detect duplicate points, elevation anomalies, and CRS health',
      href: '/qa-qc',
      icon: ShieldCheck,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'hover:border-amber-500/40',
    },
    {
      title: t('nav.importExport'),
      description: isRtl ? 'معالج قراءة PNEZD وتصدير AutoCAD و GIS و KML' : 'Wizard PNEZD reader and AutoCAD DXF, KML, CSV exporter',
      href: '/import',
      icon: ArrowDownToLine,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'hover:border-cyan-500/40',
    },
    {
      title: t('nav.volume'),
      description: isRtl ? 'حساب مناسيب التسوية ومعاملات الدمك والانتفاش' : 'Compute design grades, cut/fill volumes, and compaction',
      href: '/volume',
      icon: Shovel,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'hover:border-orange-500/40',
    },
    {
      title: t('nav.crs'),
      description: isRtl ? 'تحويل WGS84، UTM 36-39N، Ain el Abd والمراجع المحلية' : 'Transform WGS84, UTM 36-39N, Ain el Abd, and local datums',
      href: '/converter',
      icon: Calculator,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'hover:border-indigo-500/40',
    },
    {
      title: t('nav.map'),
      description: isRtl ? 'عرض المضلعات والطبقات الفضائية Esri Satellite' : 'Interactive CAD canvas, polygon overlays, and satellite layers',
      href: '/map',
      icon: Map,
      color: 'text-teal-400',
      bg: 'bg-teal-500/10',
      border: 'hover:border-teal-500/40',
    },
    {
      title: t('nav.assistant'),
      description: isRtl ? 'تحليل البيانات الجيوديسية وتوليد التقارير الفنية' : 'Geodetic data analysis and technical report generation',
      href: '/assistant',
      icon: Bot,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'hover:border-purple-500/40',
    },
  ];

  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-8">
      {/* HEADER SECTION */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <span>{t('nav.home')}</span>
            <ChevronIcon className="h-3 w-3" />
            <span className="text-sky-400">{t('dashboard.heroTitle')}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t('common.appName')} — {t('common.appSubtitle')}
          </h1>
          <p className="mt-1.5 text-xs text-slate-400">
            {t('dashboard.heroSubtitle')}
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
            {isOnline ? t('common.online') : t('common.offline')}
          </div>
        </div>
      </section>

      {/* ACTIVE PROJECT HERO */}
      <section className="glass-card overflow-hidden p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="mb-2.5 flex items-center gap-2 text-xs font-bold text-sky-400">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              {t('dashboard.activeProjectHero')} • {activeCrs}
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 hidden h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 sm:flex">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white sm:text-2xl">{currentProject.name}</h2>
                <p className="mt-1 text-xs text-slate-400">
                  {currentProject.description || t('projects.defaultProjectDesc')}
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
              {t('dashboard.importDxf')}
            </Link>
            <Link
              href="/points"
              className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-950/40 transition-all hover:bg-sky-400"
            >
              <Plus className="h-4 w-4" />
              {t('dashboard.managePoints')}
            </Link>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="mt-7 grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-5 sm:grid-cols-4 sm:gap-0">
          <div className={`border-slate-800/80 px-2 sm:px-5 ${isRtl ? 'sm:border-l first:sm:pr-0' : 'sm:border-r first:sm:pl-0'}`}>
            <p className="mb-1 text-xs text-slate-500">{t('dashboard.totalArea')}</p>
            <p className="text-lg font-bold text-white" dir="ltr">
              {engFormat.area(area)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              ≈ {engFormat.number(squareMetersToFeddans(area), 3, true)} {t('dashboard.feddanApprox')}
            </p>
          </div>

          <div className={`border-slate-800/80 px-2 sm:px-5 ${isRtl ? 'sm:border-l' : 'sm:border-r'}`}>
            <p className="mb-1 text-xs text-slate-500">{t('dashboard.totalPoints')}</p>
            <p className="text-lg font-bold text-emerald-400" dir="ltr">
              {points.length} {t('common.pointsCount')}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">{t('dashboard.pnezd3D')}</p>
          </div>

          <div className={`border-slate-800/80 px-2 sm:px-5 ${isRtl ? 'sm:border-l' : 'sm:border-r'}`}>
            <p className="mb-1 text-xs text-slate-500">{t('dashboard.polygonPerimeter')}</p>
            <p className="text-lg font-bold text-white" dir="ltr">
              {engFormat.distance(perimeter, 2)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">{t('dashboard.fullClosure')}</p>
          </div>

          <div className="px-2 sm:px-5">
            <p className="mb-1 text-xs text-slate-500">{t('dashboard.qaqcScore')}</p>
            <div className="flex items-center gap-1.5">
              {qaReport.overallScore !== null ? (
                <span
                  className={`text-lg font-bold ${
                    qaReport.overallScore >= 80 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                  dir="ltr"
                >
                  {qaReport.overallScore}%
                </span>
              ) : (
                <span className="text-sm font-bold text-slate-400">{t('dashboard.notEvaluated')}</span>
              )}
              <span className="text-[11px] text-slate-500">({qaReport.status})</span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400" dir="ltr">
              {qaReport.errorCount} {t('dashboard.errorsCount')} • {qaReport.warningCount} {t('dashboard.warningsCount')}
            </p>
          </div>
        </div>
      </section>

      {/* CORE ENGINES GRID */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">{t('dashboard.coreEnginesTitle')}</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {t('dashboard.coreEnginesSubtitle')}
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
              <h3 className="text-base font-bold text-white">{t('dashboard.recentPointsTitle')}</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {t('dashboard.recentPointsSubtitle')}
              </p>
            </div>
            <Link
              href="/points"
              className="text-xs font-semibold text-sky-400 hover:underline flex items-center gap-1"
            >
              {t('dashboard.viewAll')} ({points.length}) <ChevronIcon className="h-3 w-3" />
            </Link>
          </div>

          {points.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/60">
              <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="p-2.5">{t('pointsWorkspace.thPoint')}</th>
                    <th className="p-2.5">Easting (X)</th>
                    <th className="p-2.5">Northing (Y)</th>
                    <th className="p-2.5">Elevation (Z)</th>
                    <th className="p-2.5">{t('pointsWorkspace.thDesc')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {points.slice(0, 5).map((p) => (
                    <tr key={p.id}>
                      <td className="p-2.5 font-bold text-emerald-400">P{p.pointNumber}</td>
                      <td className="p-2.5 font-mono text-slate-300" dir="ltr">
                        {engFormat.coord(p.easting)}
                      </td>
                      <td className="p-2.5 font-mono text-slate-300" dir="ltr">
                        {engFormat.coord(p.northing)}
                      </td>
                      <td className="p-2.5 font-mono text-sky-400" dir="ltr">
                        {engFormat.elevation(p.elevation)}
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
              <p className="text-xs text-slate-500">{t('dashboard.noPointsTitle')}</p>
              <Link href="/points" className="mt-2 text-xs font-bold text-sky-400">
                {t('dashboard.addFirstPoint')}
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
              {t('dashboard.aiBannerTitle')}
            </span>
            <h3 className="mt-1 text-lg font-bold text-white leading-snug">
              {t('dashboard.aiBannerSubtitle')}
            </h3>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {t('dashboard.aiBannerDesc')}
            </p>
          </div>

          <Link
            href="/assistant"
            className="mt-6 flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950/40 hover:opacity-95"
          >
            <Sparkles className="h-4 w-4" /> {t('dashboard.consultAiNow')}
          </Link>
        </div>
      </section>
    </div>
  );
}

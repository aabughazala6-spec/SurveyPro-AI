'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownToLine,
  Bot,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Compass,
  Crown,
  FolderKanban,
  Gauge,
  Layers,
  Map,
  Menu,
  Ruler,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { db, ensureDefaultProject } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';

const navigation = [
  { label: 'لوحة التحكم', href: '/', icon: Gauge },
  { label: 'نقاط الرفع المساحي', href: '/points', icon: ClipboardList },
  { label: 'استيراد وتصدير', href: '/import', icon: ArrowDownToLine },
  { label: 'الحسابات الهندسية COGO', href: '/cogo', icon: Compass },
  { label: 'تدقيق الجودة QA/QC', href: '/qa-qc', icon: ShieldCheck },
  { label: 'الخريطة والـ GIS', href: '/map', icon: Map },
  { label: 'الحفر والردم والكميات', href: '/volume', icon: Layers },
  { label: 'نظم الإحداثيات CRS', href: '/converter', icon: Calculator },
  { label: 'المساعد المساحي الذكي', href: '/assistant', icon: Bot },
  { label: 'محول الوحدات', href: '/units', icon: Ruler },
  { label: 'إدارة المشاريع', href: '/projects', icon: FolderKanban },
];

const mobileNavigation = [
  { label: 'الرئيسية', href: '/', icon: Gauge },
  { label: 'النقاط', href: '/points', icon: ClipboardList },
  { label: 'COGO', href: '/cogo', icon: Compass },
  { label: 'QA/QC', href: '/qa-qc', icon: ShieldCheck },
  { label: 'المساعد', href: '/assistant', icon: Bot },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const setOnline = useAppStore((state) => state.setOnline);
  const isOnline = useAppStore((state) => state.isOnline);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const setCurrentProject = useAppStore((state) => state.setCurrentProject);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const projects = useLiveQuery(() => db.projects.toArray()) ?? [];
  const currentProject = projects.find((p) => p.id === currentProjectId) || projects[0];

  useEffect(() => {
    ensureDefaultProject();
    const updateConnection = () => setOnline(navigator.onLine);
    updateConnection();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, [setOnline]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white" dir="rtl">
      {/* SIDEBAR DESKTOP */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-[280px] flex-col border-l border-slate-800/80 bg-slate-950/95 px-4 py-5 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* LOGO */}
        <div className="mb-6 flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-lg shadow-sky-500/20">
              <Compass className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-white">
                SurveyPro <span className="text-sky-400">AI</span>
              </div>
              <div className="text-[11px] text-slate-500">نظام المساحة والجيوماتكس</div>
            </div>
          </Link>
          <button
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ACTIVE PROJECT PICKER */}
        <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span>المشروع النشط</span>
            <Link href="/projects" className="text-sky-400 hover:underline">
              تغيير
            </Link>
          </div>
          {projects.length > 0 ? (
            <select
              value={currentProjectId}
              onChange={(e) => {
                const proj = projects.find((p) => p.id === e.target.value);
                if (proj) setCurrentProject(proj);
              }}
              className="w-full truncate rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs font-semibold text-white outline-none focus:border-sky-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs font-semibold text-white truncate">
              {currentProject?.name || 'مخطط أرض النخيل'}
            </p>
          )}
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            أدوات الجيوماتكس
          </p>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs transition-all ${
                  active
                    ? 'bg-sky-500/10 font-bold text-sky-400 shadow-sm shadow-sky-950/30'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                    active ? 'text-sky-400' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
                {active && <ChevronLeft className="mr-auto h-3.5 w-3.5 text-sky-500" />}
              </Link>
            );
          })}
        </nav>

        {/* BOTTOM USER & SETTINGS */}
        <div className="space-y-1 border-t border-slate-800/80 pt-3">
          <Link
            href="/pricing"
            className="flex items-center gap-2.5 rounded-xl bg-gradient-to-l from-amber-500/10 to-transparent px-3 py-2 text-xs font-semibold text-amber-400 transition-colors hover:from-amber-500/15"
          >
            <Crown className="h-4 w-4 text-amber-400 shrink-0" />
            <span>الترقية والاشتراك</span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100"
          >
            <Settings className="h-4 w-4 text-slate-500 shrink-0" />
            <span>الإعدادات ونظام القياس</span>
          </Link>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="إغلاق القائمة"
        />
      )}

      {/* MAIN CONTAINER */}
      <main className="min-h-screen lg:mr-[280px]">
        {/* HEADER */}
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-slate-800/70 bg-slate-950/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:border-slate-700 hover:text-white lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <Compass className="h-5 w-5 text-sky-400" />
              <p className="text-sm font-bold text-white">
                SurveyPro <span className="text-sky-400">AI</span>
              </p>
            </div>
            <div className="hidden lg:block">
              <p className="text-xs text-slate-500">نظام الرفع المساحي والتحليل الجيوديسي</p>
              <p className="text-sm font-bold text-slate-200">
                {currentProject?.name || 'مخطط أرض النخيل'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1.5 sm:flex">
              <span
                className={`h-2 w-2 rounded-full ${
                  isOnline ? 'bg-emerald-400' : 'bg-red-400'
                }`}
              />
              <span className="text-[11px] text-slate-400">
                {isOnline ? 'جاهز ومتصل' : 'وضع غير متصل (IndexedDB)'}
              </span>
            </div>
            <Link
              href="/assistant"
              className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-300 hover:bg-purple-500/20"
            >
              <Bot className="h-4 w-4 text-purple-400" />
              <span className="hidden sm:inline">المساعد الذكي</span>
            </Link>
          </div>
        </header>

        {/* CONTENT */}
        <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">{children}</div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="fixed inset-x-3 bottom-3 z-30 flex h-[64px] items-center justify-around rounded-2xl border border-slate-700/70 bg-slate-900/95 px-1 shadow-2xl shadow-black/40 backdrop-blur-xl lg:hidden">
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[54px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] transition-colors ${
                active ? 'text-sky-400 font-bold' : 'text-slate-500'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : ''}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <PwaInstallBanner />
    </div>
  );
}

function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) return;
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    localStorage.setItem('pwa-install-dismissed', 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-[80px] left-3 right-3 z-40 lg:bottom-6 lg:left-[300px] lg:right-auto lg:max-w-sm">
      <div className="glass-card flex items-center gap-3 p-4 shadow-2xl shadow-black/40">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white">
          <Compass className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white">تثبيت SurveyPro AI</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            ثبّت التطبيق للوصول السريع والعمل الميداني بدون إنترنت
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

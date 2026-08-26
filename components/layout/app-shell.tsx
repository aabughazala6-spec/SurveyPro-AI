'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  Calculator,
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
  Sparkles,
  X,
} from 'lucide-react';
import { useAppStore } from '@/lib/stores/app-store';

const navigation = [
  { label: 'لوحة التحكم', href: '/', icon: Gauge },
  { label: 'المشاريع', href: '/projects', icon: FolderKanban },
  { label: 'النقاط والمساحات', href: '/points', icon: ClipboardList },
  { label: 'محول الإحداثيات', href: '/converter', icon: Calculator },
  { label: 'الحفر والردم', href: '/volume', icon: Layers },
  { label: 'محول الوحدات', href: '/units', icon: Ruler },
  { label: 'الخريطة', href: '/map', icon: Map },
  { label: 'المساعد الذكي', href: '/assistant', icon: Bot },
];

const mobileNavigation = navigation.slice(0, 5);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const setOnline = useAppStore((state) => state.setOnline);
  const isOnline = useAppStore((state) => state.isOnline);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
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
    <div className="min-h-screen bg-slate-950">
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-[272px] flex-col border-l border-slate-800/80 bg-slate-950/95 px-4 py-5 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-lg shadow-sky-500/20">
              <Compass className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-white">SurveyPro <span className="text-sky-400">AI</span></div>
              <div className="text-[11px] text-slate-500">نظام المساحة الذكي</div>
            </div>
          </Link>
          <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="إغلاق القائمة">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-400 shadow-lg shadow-emerald-400/40' : 'bg-red-400 shadow-lg shadow-red-400/40'}`} />
          <span className="text-xs font-medium text-slate-300">{isOnline ? 'متصل بالإنترنت' : 'وضع عدم الاتصال'}</span>
          <span className="mr-auto text-[10px] text-slate-600">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        <nav className="flex-1 space-y-1">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">القائمة الرئيسية</p>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all ${active ? 'bg-sky-500/10 font-semibold text-sky-400 shadow-sm shadow-sky-950/30' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}
              >
                <Icon className={`h-[19px] w-[19px] transition-transform group-hover:scale-110 ${active ? 'text-sky-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {active && <ChevronLeft className="mr-auto h-4 w-4 text-sky-500" />}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-slate-800/80 pt-4">
          <Link href="/pricing" className="flex items-center gap-3 rounded-xl bg-gradient-to-l from-amber-500/10 to-transparent px-3 py-3 text-sm text-amber-400 transition-colors hover:from-amber-500/15">
            <Crown className="h-[19px] w-[19px] text-amber-400" />
            <span>الترقية والاشتراك</span>
          </Link>
          <Link href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100">
            <Settings className="h-[19px] w-[19px] text-slate-500" />
            <span>الإعدادات</span>
          </Link>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-900/60 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-sm font-bold text-sky-400">م</div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-200">محمد المساح</p>
              <p className="truncate text-[10px] text-slate-500">الخطة الاحترافية</p>
            </div>
            <Sparkles className="mr-auto h-4 w-4 text-amber-400" />
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="إغلاق القائمة" />}

      <main className="min-h-screen lg:mr-[272px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-800/70 bg-slate-950/85 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <button className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-slate-300 hover:border-slate-700 hover:text-white lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="فتح القائمة">
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden">
              <p className="text-sm font-bold text-white">SurveyPro <span className="text-sky-400">AI</span></p>
            </div>
            <div className="hidden lg:block">
              <p className="text-xs text-slate-500">الأحد، 24 أغسطس 2026</p>
              <p className="text-sm font-semibold text-slate-200">مرحباً بك مجدداً، محمد</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1.5 sm:flex">
              <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className="text-[11px] text-slate-400">{isOnline ? 'متصل' : 'غير متصل'}</span>
            </div>
            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-sky-400 transition-colors hover:border-sky-500" aria-label="الملف الشخصي">م</button>
          </div>
        </header>
        <div className="pb-24 lg:pb-8">{children}</div>
      </main>

      <nav className="fixed inset-x-3 bottom-3 z-30 flex h-[68px] items-center justify-around rounded-2xl border border-slate-700/70 bg-slate-900/95 px-1 shadow-2xl shadow-black/40 backdrop-blur-xl lg:hidden">
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`flex min-w-[56px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] transition-colors ${active ? 'text-sky-400' : 'text-slate-500'}`}>
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
    <div className="fixed bottom-[90px] left-3 right-3 z-40 lg:bottom-6 lg:left-[296px] lg:right-auto lg:max-w-sm">
      <div className="glass-card flex items-center gap-3 p-4 shadow-2xl shadow-black/40">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white">
          <Compass className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white">تثبيت SurveyPro AI</p>
          <p className="mt-0.5 text-[11px] text-slate-400">ثبّت التطبيق للوصول السريع والعمل بدون إنترنت</p>
        </div>
        <button onClick={dismiss} className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="إغلاق">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

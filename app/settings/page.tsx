'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  ChevronLeft,
  Crown,
  Database,
  Globe,
  LogOut,
  Mail,
  Moon,
  Settings as SettingsIcon,
  Sun,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/db';

export default function SettingsPage() {
  const [isDark, setIsDark] = useState(true);
  const [language, setLanguage] = useState('ar');
  const [clearConfirm, setClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const toggleTheme = () => {
    setIsDark((prev) => {
      toast.success(prev ? 'تم التبديل إلى الوضع النهاري' : 'تم التبديل إلى الوضع الليلي');
      return !prev;
    });
  };

  const toggleLanguage = () => {
    setLanguage((prev) => {
      const next = prev === 'ar' ? 'en' : 'ar';
      toast.success(next === 'ar' ? 'تم التبديل إلى العربية' : 'Switched to English');
      return next;
    });
  };

  const clearLocalData = async () => {
    setIsClearing(true);
    try {
      await db.points.clear();
      await db.projects.clear();
      toast.success('تم مسح جميع البيانات المحلية');
    } catch {
      toast.error('تعذر مسح البيانات');
    } finally {
      setIsClearing(false);
      setClearConfirm(false);
    }
  };

  const handleLogout = () => {
    toast.success('تم تسجيل الخروج بنجاح', { description: 'إلى اللقاء!' });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <span>الرئيسية</span>
          <ChevronLeft className="h-3 w-3" />
          <span className="text-slate-300">الإعدادات</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-700/40 text-slate-300">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">الإعدادات والملف الشخصي</h1>
            <p className="mt-1 text-sm text-slate-400">إدارة حسابك وتفضيلات التطبيق</p>
          </div>
        </div>
      </div>

      <section className="glass-card mb-5 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <User className="h-5 w-5 text-sky-400" />
          <h2 className="text-base font-bold text-white">الملف الشخصي</h2>
        </div>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/15 text-2xl font-bold text-sky-400">
            م
          </div>
          <div className="flex-1 space-y-3 text-center sm:text-right">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-500">الاسم</span>
              <span className="text-sm font-semibold text-white">محمد عبدالله المساح</span>
            </div>
            <div className="flex flex-col gap-1 border-t border-slate-800/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><Mail className="h-3.5 w-3.5" /> البريد الإلكتروني</span>
              <span className="text-sm font-semibold text-white" dir="ltr">mohammed@surveypro.ai</span>
            </div>
            <div className="flex flex-col gap-1 border-t border-slate-800/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><Crown className="h-3.5 w-3.5 text-amber-400" /> نوع الاشتراك</span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-400">
                الخطة الاحترافية
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px]">نشط</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card mb-5 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-slate-300" />
          <h2 className="text-base font-bold text-white">التفضيلات</h2>
        </div>
        <div className="space-y-1">
          <SettingRow
            icon={isDark ? Moon : Sun}
            iconColor="text-indigo-400"
            title="الوضع الليلي"
            subtitle="التصميم الداكن — الافتراضي"
            action={<ToggleSwitch checked={isDark} onChange={toggleTheme} />}
          />
          <SettingRow
            icon={Globe}
            iconColor="text-emerald-400"
            title="اللغة"
            subtitle={language === 'ar' ? 'العربية (RTL)' : 'English (LTR)'}
            action={
              <button
                onClick={toggleLanguage}
                className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                تبديل
              </button>
            }
          />
          <SettingRow
            icon={Bell}
            iconColor="text-amber-400"
            title="الإشعارات"
            subtitle="تنبيهات النظام والتحديثات"
            action={<ToggleSwitch checked={true} onChange={() => toast.info('الإشعارات مفعّلة')} />}
          />
        </div>
      </section>

      <section className="glass-card mb-5 border-red-500/15 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <Database className="h-5 w-5 text-red-400" />
          <h2 className="text-base font-bold text-white">البيانات والأمان</h2>
        </div>
        <div className="space-y-1">
          <SettingRow
            icon={Trash2}
            iconColor="text-red-400"
            title="مسح البيانات المحلية"
            subtitle="حذف جميع المشاريع والنقاط من الجهاز"
            action={
              <button
                onClick={() => setClearConfirm(true)}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20"
              >
                مسح
              </button>
            }
          />
          <SettingRow
            icon={LogOut}
            iconColor="text-slate-400"
            title="تسجيل الخروج"
            subtitle="الخروج من حسابك"
            action={
              <button
                onClick={handleLogout}
                className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                خروج
              </button>
            }
          />
        </div>
      </section>

      {clearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-slate-900 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-white">تأكيد مسح البيانات</h2>
            <p className="mt-2 text-sm text-slate-400">
              سيتم حذف جميع المشاريع والنقاط المحفوظة محلياً نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => void clearLocalData()}
                disabled={isClearing}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-50"
              >
                {isClearing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {isClearing ? 'جاري المسح...' : 'مسح نهائي'}
              </button>
              <button onClick={() => setClearConfirm(false)} className="h-11 rounded-xl border border-slate-700 px-5 text-sm font-semibold text-slate-300 hover:bg-slate-800">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingRow({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  action,
}: {
  icon: typeof Moon;
  iconColor: string;
  title: string;
  subtitle: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-slate-800/30">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800/50 ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-sky-500' : 'bg-slate-700'}`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'right-0.5' : 'right-[22px]'}`}
      />
    </button>
  );
}

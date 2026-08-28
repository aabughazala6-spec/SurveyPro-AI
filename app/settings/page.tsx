'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Database,
  Globe,
  LogOut,
  Mail,
  Moon,
  Play,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { runComprehensiveRegressionSuite } from '@/lib/regression-tests';
import { useTranslation } from '@/lib/i18n';
import type { SupportedLanguage } from '@/lib/stores/app-store';

export default function SettingsPage() {
  const { t, language, setLanguage, isRtl } = useTranslation();
  const [isDark, setIsDark] = useState(true);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Regression Suite State
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<ReturnType<typeof runComprehensiveRegressionSuite> | null>(null);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      toast.success(
        next
          ? isRtl ? 'تم التبديل إلى الوضع الليلي' : 'Switched to Dark Mode'
          : isRtl ? 'تم التبديل إلى الوضع النهاري' : 'Switched to Light Mode'
      );
      return next;
    });
  };

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    if (newLang === 'ar') {
      toast.success(t('settings.langSwitchSuccessAr'));
    } else {
      toast.success(t('settings.langSwitchSuccessEn'));
    }
  };

  const clearLocalData = async () => {
    setIsClearing(true);
    try {
      await db.points.clear();
      await db.projects.clear();
      await db.auditLogs.clear();
      toast.success(t('settings.clearSuccess'));
    } catch {
      toast.error(t('settings.clearError'));
    } finally {
      setIsClearing(false);
      setClearConfirm(false);
    }
  };

  const handleRunRegression = () => {
    setIsRunningTests(true);
    try {
      const report = runComprehensiveRegressionSuite();
      setTestResults(report);
      if (report.summary.failed === 0) {
        toast.success(
          isRtl
            ? `اجتازت جميع الفحوصات الهندسية (${report.summary.passed}/${report.summary.total}) بنجاح 100%`
            : `All engineering verification tests (${report.summary.passed}/${report.summary.total}) PASSED 100%`
        );
      } else {
        toast.error(
          isRtl
            ? `فشل في ${report.summary.failed} فحص هندسي`
            : `${report.summary.failed} engineering tests failed`
        );
      }
    } catch {
      toast.error(isRtl ? 'حدث خطأ أثناء تشغيل حزمة الفحص' : 'Error running test suite');
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleLogout = () => {
    toast.success(isRtl ? 'تم تسجيل الخروج بنجاح' : 'Signed out successfully');
  };

  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <span>{t('nav.home')}</span>
          <ChevronIcon className="h-3 w-3" />
          <span className="text-slate-300">{t('nav.settings')}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-700/40 text-slate-300">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{t('settings.title')}</h1>
            <p className="mt-1 text-sm text-slate-400">{t('settings.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* AUTOMATED REGRESSION TESTS SECTION */}
      <section className="glass-card mb-5 border-emerald-500/20 p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{t('settings.regressionSection')}</h2>
              <p className="text-xs text-slate-400">
                {t('settings.regressionDesc')}
              </p>
            </div>
          </div>

          <button
            onClick={handleRunRegression}
            disabled={isRunningTests}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-400 disabled:opacity-50"
          >
            {isRunningTests ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                {t('settings.runningTests')}
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-white" />
                {t('settings.runTestsBtn')}
              </>
            )}
          </button>
        </div>

        {testResults && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs">
              <div className="flex items-center gap-2 font-bold text-white">
                <span>{t('settings.successRate')}:</span>
                <span className={testResults.summary.failed === 0 ? 'text-emerald-400' : 'text-red-400'} dir="ltr">
                  {testResults.summary.successRate.toFixed(1)}% ({testResults.summary.passed}/{testResults.summary.total})
                </span>
              </div>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                {testResults.summary.failed === 0 ? t('settings.verifiedBadge') : t('settings.failedBadge')}
              </span>
            </div>

            <div className="max-h-60 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              {testResults.results.map((res, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-xs border-b border-slate-800/40 pb-2 last:border-b-0">
                  <div className="flex items-start gap-2">
                    {res.passed ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-200">{res.testName}</span>
                      <span className="mx-2 text-[10px] text-slate-500">[{res.suite}]</span>
                      {res.details && <p className="mt-0.5 text-[11px] text-slate-400" dir="ltr">{res.details}</p>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold ${res.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                    {res.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* USER PROFILE SECTION */}
      <section className="glass-card mb-5 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <User className="h-5 w-5 text-sky-400" />
          <h2 className="text-base font-bold text-white">{t('settings.profileSection')}</h2>
        </div>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/15 text-2xl font-bold text-sky-400">
            {isRtl ? 'م' : 'S'}
          </div>
          <div className={`flex-1 space-y-3 text-center ${isRtl ? 'sm:text-right' : 'sm:text-left'}`}>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-500">{t('common.name')}</span>
              <span className="text-sm font-semibold text-white">{t('settings.surveyorRole')}</span>
            </div>
            <div className="flex flex-col gap-1 border-t border-slate-800/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><Mail className="h-3.5 w-3.5" /> {t('settings.email')}</span>
              <span className="text-sm font-semibold text-white" dir="ltr">surveyor@surveypro.ai</span>
            </div>
            <div className="flex flex-col gap-1 border-t border-slate-800/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><Crown className="h-3.5 w-3.5 text-amber-400" /> {t('settings.planType')}</span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-400">
                {t('settings.planProActive')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* PREFERENCES SECTION */}
      <section className="glass-card mb-5 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-slate-300" />
          <h2 className="text-base font-bold text-white">{t('settings.preferencesSection')}</h2>
        </div>
        <div className="space-y-1">
          <SettingRow
            icon={isDark ? Moon : Sun}
            iconColor="text-indigo-400"
            title={t('settings.darkTheme')}
            subtitle={isDark ? t('settings.darkThemeDesc') : t('settings.lightThemeDesc')}
            action={<ToggleSwitch checked={isDark} onChange={toggleTheme} isRtl={isRtl} />}
          />
          <SettingRow
            icon={Globe}
            iconColor="text-emerald-400"
            title={t('settings.language')}
            subtitle={language === 'ar' ? 'العربية (RTL - Right to Left)' : 'English (LTR - Left to Right)'}
            action={
              <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-850 p-1">
                <button
                  onClick={() => handleLanguageChange('ar')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    language === 'ar'
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  العربية
                </button>
                <button
                  onClick={() => handleLanguageChange('en')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    language === 'en'
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  English
                </button>
              </div>
            }
          />
          <SettingRow
            icon={Bell}
            iconColor="text-amber-400"
            title={t('settings.notifications')}
            subtitle={t('settings.notificationsDesc')}
            action={<ToggleSwitch checked={true} onChange={() => toast.info(t('settings.notifications'))} isRtl={isRtl} />}
          />
        </div>
      </section>

      {/* DATA & SECURITY SECTION */}
      <section className="glass-card mb-5 border-red-500/15 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <Database className="h-5 w-5 text-red-400" />
          <h2 className="text-base font-bold text-white">{t('settings.dataSecuritySection')}</h2>
        </div>
        <div className="space-y-1">
          <SettingRow
            icon={Trash2}
            iconColor="text-red-400"
            title={t('settings.clearLocalData')}
            subtitle={t('settings.clearLocalDataDesc')}
            action={
              <button
                onClick={() => setClearConfirm(true)}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20"
              >
                {t('settings.clearBtn')}
              </button>
            }
          />
          <SettingRow
            icon={LogOut}
            iconColor="text-slate-400"
            title={t('settings.logout')}
            subtitle={t('settings.logoutDesc')}
            action={
              <button
                onClick={handleLogout}
                className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                {t('settings.logout')}
              </button>
            }
          />
        </div>
      </section>

      {/* CLEAR MODAL */}
      {clearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-slate-900 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-white">{t('settings.confirmClearTitle')}</h2>
            <p className="mt-2 text-sm text-slate-400">
              {t('settings.confirmClearDesc')}
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
                {isClearing ? t('settings.clearing') : t('settings.confirmClearBtn')}
              </button>
              <button
                onClick={() => setClearConfirm(false)}
                className="h-11 rounded-xl border border-slate-700 px-5 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                {t('common.cancel')}
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

function ToggleSwitch({
  checked,
  onChange,
  isRtl,
}: {
  checked: boolean;
  onChange: () => void;
  isRtl: boolean;
}) {
  return (
    <button
      onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-sky-500' : 'bg-slate-700'}`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          isRtl
            ? checked ? 'right-0.5' : 'right-[22px]'
            : checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

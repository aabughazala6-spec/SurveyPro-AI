'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Download,
  FileCheck,
  Filter,
  Layers,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, type PointRecord } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import { runSurveyQAQC, type IssueSeverity, type QAIssue, type QAReport } from '@/lib/qa-qc-engine';
import { downloadFile } from '@/lib/dxf-generator';
import Link from 'next/link';

export function QAQCDashboard() {
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentProject = useAppStore((state) => state.currentProject);

  const livePoints = useLiveQuery(
    () => db.points.where('projectId').equals(currentProjectId).sortBy('pointNumber'),
    [currentProjectId]
  );
  const points = useMemo(() => livePoints ?? [], [livePoints]);

  const [filterSeverity, setFilterSeverity] = useState<IssueSeverity | 'ALL'>('ALL');

  const report: QAReport = useMemo(() => {
    return runSurveyQAQC(points);
  }, [points]);

  const filteredIssues = useMemo(() => {
    if (filterSeverity === 'ALL') return report.issues;
    return report.issues.filter((i) => i.severity === filterSeverity);
  }, [report.issues, filterSeverity]);

  const exportReport = () => {
    const text = `# SurveyPro AI - تقرير فحص ومطابقة الجودة المساحية (QA/QC Audit Report)
تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA')}
اسم المشروع: ${currentProject.name}
معرف المشروع: ${currentProject.id}
إجمالي نقاط الرفع المفحوصة: ${report.totalPoints} نقطة

--------------------------------------------------
ملخص التقييم الهندسي:
- درجة الجودة الكلية: ${report.overallScore !== null ? `${report.overallScore} / 100` : 'غير مُقيّم (لا توجد بيانات نقاط)'}
- حالة المشروع: ${report.status}
- خوارزمية كشف الشذوذ: Median Absolute Deviation (MAD Hybrid Engine)
- عدد الأخطاء الحرجة (Errors): ${report.errorCount}
- عدد التنبيهات (Warnings): ${report.warningCount}
- الفحوصات المطابقة (Passed): ${report.passCount}

--------------------------------------------------
الإحصائيات الجيوديسية والمناسيب:
- نطاق الإحداثي الشرقي (Easting): ${report.stats.minEasting.toFixed(3)} إلى ${report.stats.maxEasting.toFixed(3)}
- نطاق الإحداثي الشمالي (Northing): ${report.stats.minNorthing.toFixed(3)} إلى ${report.stats.maxNorthing.toFixed(3)}
- متوسط المناسيب (Mean Elevation): ${report.stats.meanElevation.toFixed(3)} م
- وسيط المناسيب (Median Elevation): ${report.stats.medianElevation.toFixed(3)} م
- تشتت المناسيب (MAD): ${report.stats.elevationMAD.toFixed(3)} م
- الانحراف المعياري للمناسيب (Std Dev): ${report.stats.elevationStdDev.toFixed(3)} م
- أدنى منسوب: ${report.stats.minElevation.toFixed(3)} م | أعلى منسوب: ${report.stats.maxElevation.toFixed(3)} م

--------------------------------------------------
قائمة الملاحظات والمطابقات الهندسية:
${report.issues
  .map(
    (issue, idx) => `
[${idx + 1}] ${issue.severity === 'ERROR' ? '❌ خطأ حرج' : issue.severity === 'WARNING' ? '⚠️ تنبيه' : '✅ فحص مطابق'} - ${issue.titleAr} (${issue.titleEn})
- التفاصيل: ${issue.descriptionAr}
- النقاط المعنية: ${issue.affectedPointNumbers.length ? issue.affectedPointNumbers.map((n) => `P${n}`).join(', ') : 'لا يوجد'}
- التوصية الهندسية: ${issue.recommendationAr}
`
  )
  .join('\n')}
--------------------------------------------------
تم إنشاؤه تلقائياً بواسطة محرك SurveyPro AI لضبط الجودة المساحية.
`;

    downloadFile(
      text,
      `SurveyPro-QAQC-Report-${currentProject.name.replace(/\s+/g, '_')}.txt`,
      'text/plain;charset=utf-8;'
    );
    toast.success('تم تصدير تقرير ضبط الجودة بنجاح');
  };

  return (
    <div className="space-y-6">
      {/* OVERALL SCORE & SUMMARY HERO */}
      <section className="glass-card overflow-hidden p-5 sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                report.status === 'EXCELLENT'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : report.status === 'GOOD'
                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                  : report.status === 'NEEDS_ATTENTION'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : report.status === 'NO_DATA'
                  ? 'bg-slate-800/60 text-slate-400 border border-slate-700'
                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
              }`}
            >
              {report.status === 'CRITICAL_ERRORS' ? (
                <ShieldAlert className="h-7 w-7" />
              ) : report.status === 'NO_DATA' ? (
                <HelpCircle className="h-7 w-7" />
              ) : (
                <ShieldCheck className="h-7 w-7" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">محرك ضبط وتدقيق الجودة المساحية (QA / QC)</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    report.status === 'EXCELLENT'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : report.status === 'GOOD'
                      ? 'bg-sky-500/20 text-sky-300'
                      : report.status === 'NEEDS_ATTENTION'
                      ? 'bg-amber-500/20 text-amber-300'
                      : report.status === 'NO_DATA'
                      ? 'bg-slate-800 text-slate-300 border border-slate-700'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {report.status === 'EXCELLENT'
                    ? 'ممتاز - معتمد'
                    : report.status === 'GOOD'
                    ? 'جيد جداً'
                    : report.status === 'NEEDS_ATTENTION'
                    ? 'يتطلب مراجعة'
                    : report.status === 'NO_DATA'
                    ? 'غير مُقيّم (NO DATA)'
                    : 'أخطاء حرجة'}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                تدقيق إحداثيات ومناسيب {report.totalPoints} نقطة في مشروع &laquo;{currentProject.name}&raquo;
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportReport}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-850 px-4 py-2.5 text-xs font-bold text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-800"
            >
              <Download className="h-4 w-4 text-sky-400" />
              تصدير تقرير التدقيق
            </button>
            <Link
              href="/assistant"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950/40 hover:opacity-95"
            >
              <Bot className="h-4 w-4" />
              استشارة المساعد في الأخطاء
            </Link>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <span className="text-xs text-slate-500">معدل الجودة الهندسي</span>
            <div className="mt-1 flex items-baseline gap-2">
              {report.overallScore !== null ? (
                <>
                  <span
                    className={`text-2xl font-bold ${
                      report.overallScore >= 85
                        ? 'text-emerald-400'
                        : report.overallScore >= 65
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}
                  >
                    {report.overallScore}%
                  </span>
                  <span className="text-[11px] text-slate-500">/ 100</span>
                </>
              ) : (
                <span className="text-lg font-bold text-slate-400">غير مُقيّم</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <span className="text-xs text-slate-500">أخطاء حرجة (Errors)</span>
            <p className="mt-1 text-2xl font-bold text-red-400">{report.errorCount}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <span className="text-xs text-slate-500">تنبيهات وفحص شذوذ</span>
            <p className="mt-1 text-2xl font-bold text-amber-400">{report.warningCount}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <span className="text-xs text-slate-500">فحوصات مطابقة (Pass)</span>
            <p className="mt-1 text-2xl font-bold text-emerald-400">{report.passCount}</p>
          </div>
        </div>
      </section>

      {/* STATISTICAL DISPERSION */}
      <section className="glass-card p-5 sm:p-7">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">التحليل الإحصائي للمناسيب والنطاق الجغرافي</h3>
          <span className="rounded-md bg-purple-500/10 px-2.5 py-1 text-[11px] font-bold text-purple-300 border border-purple-500/20">
            خوارزمية MAD + Local Spikes
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <span className="text-[11px] text-slate-500">متوسط المناسيب (Mean Z)</span>
            <p dir="ltr" className="mt-1 text-sm font-bold text-sky-300">
              {report.stats.meanElevation.toFixed(3)} م
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <span className="text-[11px] text-slate-500">وسيط المناسيب (Median Z)</span>
            <p dir="ltr" className="mt-1 text-sm font-bold text-emerald-300">
              {report.stats.medianElevation.toFixed(3)} م
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <span className="text-[11px] text-slate-500">تشتت المناسيب (MAD)</span>
            <p dir="ltr" className="mt-1 text-sm font-bold text-amber-300">
              ±{report.stats.elevationMAD.toFixed(3)} م
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <span className="text-[11px] text-slate-500">الانحراف المعياري (Std Dev σ)</span>
            <p dir="ltr" className="mt-1 text-sm font-bold text-slate-300">
              ±{report.stats.elevationStdDev.toFixed(3)} م
            </p>
          </div>
        </div>
      </section>

      {/* FILTER & ISSUES LIST */}
      <section className="glass-card p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-white">سجل نتائج الفحص والملاحظات</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              عرض تفاصيل التعارضات، الشذوذ المكاني، وتوصيات التصحيح الهندسية
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/80 p-1">
            <button
              onClick={() => setFilterSeverity('ALL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filterSeverity === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              الكل ({report.issues.length})
            </button>
            <button
              onClick={() => setFilterSeverity('ERROR')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filterSeverity === 'ERROR'
                  ? 'bg-red-500/20 text-red-300 shadow-sm'
                  : 'text-slate-400 hover:text-red-300'
              }`}
            >
              أخطاء ({report.errorCount})
            </button>
            <button
              onClick={() => setFilterSeverity('WARNING')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filterSeverity === 'WARNING'
                  ? 'bg-amber-500/20 text-amber-300 shadow-sm'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              تنبيهات ({report.warningCount})
            </button>
            <button
              onClick={() => setFilterSeverity('PASS')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filterSeverity === 'PASS'
                  ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              مطابق ({report.passCount})
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {filteredIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileCheck className="h-10 w-10 text-slate-600" />
              <p className="mt-3 text-sm font-semibold text-slate-400">لا توجد ملاحظات في هذا التصنيف</p>
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className={`rounded-2xl border p-5 transition-all ${
                  issue.severity === 'ERROR'
                    ? 'border-red-500/30 bg-red-950/15'
                    : issue.severity === 'WARNING'
                    ? 'border-amber-500/30 bg-amber-950/15'
                    : 'border-emerald-500/30 bg-emerald-950/15'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      issue.severity === 'ERROR'
                        ? 'bg-red-500/20 text-red-400'
                        : issue.severity === 'WARNING'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {issue.severity === 'ERROR' ? (
                      <AlertCircle className="h-5 w-5" />
                    ) : issue.severity === 'WARNING' ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-white">{issue.titleAr}</h4>
                      <span className="text-[11px] font-medium text-slate-400">{issue.titleEn}</span>
                    </div>

                    <p className="mt-2 text-xs leading-relaxed text-slate-300">{issue.descriptionAr}</p>

                    {issue.affectedPointNumbers.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-400">النقاط المعنية:</span>
                        {issue.affectedPointNumbers.map((num) => (
                          <span
                            key={num}
                            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-sky-300"
                          >
                            P{num}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3.5 flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <div className="text-xs text-slate-300">
                        <span className="font-semibold text-amber-300">التوصية الهندسية: </span>
                        {issue.recommendationAr}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

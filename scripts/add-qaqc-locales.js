const fs = require('fs');

const arModule = require('../locales/ar.ts');
const enModule = require('../locales/en.ts');

const ar = JSON.parse(JSON.stringify(arModule.ar));
const en = JSON.parse(JSON.stringify(enModule.en));

const qaqcAdditionsAr = {
  statusExcellent: 'ممتاز - معتمد',
  statusGood: 'جيد جداً',
  statusNeedsAttention: 'يتطلب مراجعة',
  statusNoData: 'غير مُقيّم (NO DATA)',
  statusCriticalErrors: 'أخطاء حرجة',
  auditingPointsDesc: 'تدقيق إحداثيات ومناسيب {count} نقطة في مشروع «{project}»',
  exportAuditReport: 'تصدير تقرير التدقيق',
  consultAiAssistant: 'استشارة المساعد في الأخطاء',
  qualityScore: 'معدل الجودة الهندسي',
  notEvaluated: 'غير مُقيّم',
  criticalErrorsCount: 'أخطاء حرجة (Errors)',
  warningsCount: 'تنبيهات وفحص شذوذ',
  passedChecksCount: 'فحوصات مطابقة (Pass)',
  statisticalAnalysisTitle: 'التحليل الإحصائي للمناسيب والنطاق الجغرافي',
  madAlgorithmBadge: 'خوارزمية MAD + Local Spikes',
  meanZ: 'متوسط المناسيب (Mean Z)',
  medianZ: 'وسيط المناسيب (Median Z)',
  elevationMad: 'تشتت المناسيب (MAD)',
  elevationStdDev: 'الانحراف المعياري (Std Dev σ)',
  auditLogTitle: 'سجل نتائج الفحص والملاحظات',
  auditLogSubtitle: 'عرض تفاصيل التعارضات، الشذوذ المكاني، وتوصيات التصحيح الهندسية',
  filterAllBtn: 'الكل ({count})',
  filterErrorBtn: 'أخطاء ({count})',
  filterWarningBtn: 'تنبيهات ({count})',
  filterPassBtn: 'مطابق ({count})',
  noIssuesInCategory: 'لا توجد ملاحظات في هذا التصنيف',
  affectedPoints: 'النقاط المعنية:',
  engineeringRecommendation: 'التوصية الهندسية: ',
  exportSuccess: 'تم تصدير تقرير ضبط الجودة بنجاح'
};

const qaqcAdditionsEn = {
  statusExcellent: 'Excellent - Verified',
  statusGood: 'Very Good',
  statusNeedsAttention: 'Needs Attention',
  statusNoData: 'Not Evaluated (NO DATA)',
  statusCriticalErrors: 'Critical Errors',
  auditingPointsDesc: 'Auditing coordinates and elevations of {count} points in project «{project}»',
  exportAuditReport: 'Export Audit Report',
  consultAiAssistant: 'Consult AI Assistant on Errors',
  qualityScore: 'Engineering Quality Score',
  notEvaluated: 'Not Evaluated',
  criticalErrorsCount: 'Critical Errors',
  warningsCount: 'Warnings & Anomalies',
  passedChecksCount: 'Passed Checks (Pass)',
  statisticalAnalysisTitle: 'Statistical Elevation & Geographic Range Analysis',
  madAlgorithmBadge: 'MAD Algorithm + Local Spikes',
  meanZ: 'Mean Elevation (Mean Z)',
  medianZ: 'Median Elevation (Median Z)',
  elevationMad: 'Elevation Dispersion (MAD)',
  elevationStdDev: 'Standard Deviation (Std Dev σ)',
  auditLogTitle: 'Audit Results & Findings Log',
  auditLogSubtitle: 'Detailed geometric conflicts, spatial anomalies, and engineering remediation recommendations',
  filterAllBtn: 'All ({count})',
  filterErrorBtn: 'Errors ({count})',
  filterWarningBtn: 'Warnings ({count})',
  filterPassBtn: 'Pass ({count})',
  noIssuesInCategory: 'No issues found in this category',
  affectedPoints: 'Affected Points:',
  engineeringRecommendation: 'Engineering Recommendation: ',
  exportSuccess: 'QA/QC audit report exported successfully'
};

Object.entries(qaqcAdditionsAr).forEach(([k, v]) => {
  ar.qaqc[k] = v;
});
Object.entries(qaqcAdditionsEn).forEach(([k, v]) => {
  en.qaqc[k] = v;
});

// Write back updated locales
fs.writeFileSync(
  './locales/ar.ts',
  'export const ar = ' + JSON.stringify(ar, null, 2) + ' as const;\n\nexport type TranslationKeys = typeof ar;\n'
);
fs.writeFileSync(
  './locales/en.ts',
  'import type { TranslationKeys } from "./ar";\n\nexport const en: TranslationKeys = ' +
    JSON.stringify(en, null, 2) +
    ';\n'
);

console.log('Successfully added QAQC locales.');

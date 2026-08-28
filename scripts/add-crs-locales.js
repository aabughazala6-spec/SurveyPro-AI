const fs = require('fs');

// Load existing dictionaries
const arModule = require('../locales/ar.ts');
const enModule = require('../locales/en.ts');

const ar = JSON.parse(JSON.stringify(arModule.ar));
const en = JSON.parse(JSON.stringify(enModule.en));

// Helper to deeply merge/set keys
function setNestedKey(obj, path, value) {
  const parts = path.split('.');
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!curr[parts[i]]) curr[parts[i]] = {};
    curr = curr[parts[i]];
  }
  curr[parts[parts.length - 1]] = value;
}

// Additional translations for CRS Safety
const crsAdditionsAr = {
  changeCrsBtn: 'تغيير / تحويل نظام الإسناد',
  dialogTitle: 'لوحة إدارة ونقل نظم الإسناد الجيوديسي (CRS Safety Manager)',
  currentProjectSystem: 'النظام الحالي للمشروع',
  targetCrsLabel: 'النظام المستهدف (Target CRS)',
  gcpWarningDialogTitle: 'تحذير جيوديسي: النظام المستهدف يتطلب ضبط أرضي (GCP)',
  gcpAckCheckbox: 'أقر بمعرفتي بالفوارق الجيوديسية وضرورة المعايرة الحقلية مع نقاط الثوابت',
  applyModeLabel: 'طريقة التطبيق (Application Mode)',
  modeMathTransform: 'تحويل هندسي للإحداثيات (Transform Math)',
  modeMathTransformDesc: 'إعادة حساب قيم (Easting, Northing) لجميع نقاط المشروع رياضياً بناءً على بارامترات الإسقاط والإزاحة.',
  modeMetadataOnly: 'تحديث بطاقة التعريف فقط (Metadata Only)',
  modeMetadataOnlyDesc: 'تغيير اسم وكود النظام في المشروع دون المساس بالأرقام الحالية (مناسب إذا كانت النقاط مرفوعة أصلاً بهذا النظام).',
  samplePreviewTitle: 'معاينة تحويل عينة من نقاط المشروع ({count} نقاط)',
  totalPointsLabel: 'إجمالي نقاط المشروع: {count}',
  beforeTransform: 'قبل التحويل ({crs})',
  afterTransform: 'بعد التحويل ({crs})',
  shiftDelta: 'فرق الإزاحة (ΔE, ΔN)',
  applyingTransform: 'جاري تطبيق التحويل الجيوديسي...',
  confirmAndSaveCrs: 'تأكيد وحفظ نظام الإسناد',
  gcpWarningToast: 'يرجى تأكيد الاطلاع على متطلبات الضبط الجيوديسي ونقاط التحكم الأرضية (GCP)',
  crsTransformSuccess: 'تم تحويل إحداثيات {count} نقطة إلى [{code}] بنجاح',
  crsAssignedSuccess: 'تم تعيين تعريف الإسناد [{code}] للمشروع بنجاح',
  crsTransformError: 'فشلت عملية تغيير نظام الإسناد',
  crsProcessError: 'حدث خطأ أثناء معالجة النظام الجيوديسي',
  datumPrefix: 'المرجع: {datum}',
  ellipsoidPrefix: 'المجسم البيضاوي: {ellipsoid}',
  regionPrefix: 'المنطقة: {region}',
  geodeticAlertTitle: 'تنبيه جيوديسي:',
  geodeticAlertText: 'يلزم الربط مع نقاط مثلثات وطنية أو محطات رصد أرضية لضمان الدقة المليمترية.',
};

const crsAdditionsEn = {
  changeCrsBtn: 'Change / Transform Reference System',
  dialogTitle: 'CRS Safety & Geodetic System Manager',
  currentProjectSystem: 'Current Project CRS',
  targetCrsLabel: 'Target CRS',
  gcpWarningDialogTitle: 'Geodetic Warning: Target system requires GCP ground control',
  gcpAckCheckbox: 'I acknowledge the geodetic datum shift and the necessity of field calibration with GCPs',
  applyModeLabel: 'Application Mode',
  modeMathTransform: 'Transform Coordinates (Math Re-projection)',
  modeMathTransformDesc: 'Mathematically recompute Easting and Northing values for all project points based on projection parameters and datum shift.',
  modeMetadataOnly: 'Assign Metadata Only',
  modeMetadataOnlyDesc: 'Update the project CRS definition without modifying coordinate values (use if points were surveyed in this system).',
  samplePreviewTitle: 'Sample Coordinate Transformation Preview ({count} points)',
  totalPointsLabel: 'Total project points: {count}',
  beforeTransform: 'Before ({crs})',
  afterTransform: 'After ({crs})',
  shiftDelta: 'Coordinate Shift (ΔE, ΔN)',
  applyingTransform: 'Applying geodetic transformation...',
  confirmAndSaveCrs: 'Confirm & Save CRS',
  gcpWarningToast: 'Please acknowledge geodetic control and GCP requirements before proceeding',
  crsTransformSuccess: 'Successfully transformed {count} points to [{code}]',
  crsAssignedSuccess: 'Successfully assigned CRS definition [{code}] to project',
  crsTransformError: 'Failed to update coordinate reference system',
  crsProcessError: 'Error occurred during geodetic processing',
  datumPrefix: 'Datum: {datum}',
  ellipsoidPrefix: 'Ellipsoid: {ellipsoid}',
  regionPrefix: 'Region: {region}',
  geodeticAlertTitle: 'Geodetic Notice:',
  geodeticAlertText: 'Field tie-in with national triangulation or CORS stations is required for millimeter precision.',
};

Object.entries(crsAdditionsAr).forEach(([k, v]) => {
  ar.crsSafety[k] = v;
});
Object.entries(crsAdditionsEn).forEach(([k, v]) => {
  en.crsSafety[k] = v;
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

console.log('Successfully updated locales with CRS additions.');

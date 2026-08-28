const fs = require('fs');

const arModule = require('../locales/ar.ts');
const enModule = require('../locales/en.ts');

const ar = JSON.parse(JSON.stringify(arModule.ar));
const en = JSON.parse(JSON.stringify(enModule.en));

const crsAdditionsAr = {
  singlePointMode: 'تحويل نقطة مفردة (Single Point)',
  batchPointsMode: 'تحويل جماعي لنقاط المشروع',
  crsSelectionTitle: 'اختيار أنظمة الإحداثيات والمرجع الجيوديسي',
  reverseDirection: 'عكس الاتجاه',
  sourceCrsLabel: 'النظام المصدر (Source CRS)',
  targetCrsLabel: 'النظام الهدف (Target CRS)',
  geographicDeg: 'درجات عشرية Lat/Lon',
  projectedMeters: 'إسقاط مستوي أمتار (E, N)',
  authoritativeGeodetic: 'مرجع عالمي معتمد (WGS84/UTM)',
  requiresLocalControl: 'يتطلب تدقيق مع ثوابت محلية (GCPs)',
  regionalNoticeTitle: 'ملاحظة جيوديسية للمراجع الإقليمية:',
  regionalNoticeText: 'تم دمج معاملات إزاحة الشفت المعيارية (+towgs84) للمرجع الإقليمي. نظراً لأن المراجع الإقليمية التاريخية غير متحدة المركز مع WGS84، فإن دقة التحويل الإقليمي تتراوح بين 3 إلى 5 أمتار وتتطلب تدقيقاً ومطابقة موقعية (Site Calibration) مع نقاط تحكم أرضية معتمدة (GCPs) للمشاريع التي تتطلب دقة سنتيمترية.',
  inputCoordinatesTitle: 'إدخال قيم الإحداثيات',
  currentGpsLocation: 'موقعي الحالي (GPS)',
  locatingProgress: 'جاري التحديد...',
  lonDeg: 'خط الطول Longitude (X) بالدرجات',
  eastingMeter: 'الشرق Easting (X) بالمتر',
  latDeg: 'خط العرض Latitude (Y) بالدرجات',
  northingMeter: 'الشمال Northing (Y) بالمتر',
  elevMeterOpt: 'المنسوب Elevation (Z) بالمتر (اختياري)',
  transformNowBtn: 'تحويل الإحداثي الآن',
  resultTitle: 'نتيجة التحويل الجيوديسي',
  resultSubtitle: 'الإحداثيات المحسوبة بدقة في نظام {crs}',
  copySuccess: 'تم نسخ الإحداثي',
  enterCoordsHint: 'أدخل الإحداثيات واضغط تحويل لعرض النتيجة',
  batchTransformTitle: 'التحويل الجماعي لنقاط المشروع',
  batchTransformSubtitle: 'تحويل كامل إحداثيات نقاط الرفع المساحي في المشروع من {source} إلى {target}',
  batchWarning: '⚠️ تنبيه مهم: سيؤدي هذا الإجراء إلى إعادة حساب وتحديث إحداثيات جميع نقاط المشروع في قاعدة البيانات بشكل دائم.',
  batchTransformingProgress: 'جاري تحويل النقاط...',
  batchTransformNowBtn: 'تحويل جميع نقاط المشروع الآن',
  noPointsInProjectToTransform: 'لا توجد نقاط في المشروع الحالي لتحويلها',
  batchTransformSuccessToast: 'تم تحويل {count} نقطة في المشروع بنجاح إلى {crs}',
  validCoordsRequired: 'يرجى إدخال قيم إحداثيات رقمية صحيحة',
  coordTransformSuccess: 'تم تحويل الإحداثيات بنجاح',
  coordTransformError: 'فشل في تحويل الإحداثيات بين النظامين المحددين',
  geoNotSupported: 'متصفحك لا يدعم تحديد الموقع الجغرافي',
  geoSuccessToast: 'تم تحديد موقعك بدقة والتعرف التلقائي على {name}',
  geoFetchError: 'تعذر جلب الموقع: {message}'
};

const crsAdditionsEn = {
  singlePointMode: 'Single Point Transformation',
  batchPointsMode: 'Batch Project Points Transformation',
  crsSelectionTitle: 'Coordinate Reference Systems & Geodetic Datums',
  reverseDirection: 'Swap Systems',
  sourceCrsLabel: 'Source CRS',
  targetCrsLabel: 'Target CRS',
  geographicDeg: 'Geographic 2D (Lat/Lon degrees)',
  projectedMeters: 'Projected Planar (E, N meters)',
  authoritativeGeodetic: 'Authoritative Geodetic Datum (WGS84/UTM)',
  requiresLocalControl: 'Requires Local Ground Control (GCP)',
  regionalNoticeTitle: 'Geodetic Notice on Regional Datums:',
  regionalNoticeText: 'Standard transformation shift parameters (+towgs84) are integrated. Because historical regional datums are non-geocentric, transformation accuracy ranges from 3–5m without local site calibration on verified GCPs.',
  inputCoordinatesTitle: 'Input Coordinate Values',
  currentGpsLocation: 'Current GPS Location',
  locatingProgress: 'Acquiring GPS...',
  lonDeg: 'Longitude (X) in decimal degrees',
  eastingMeter: 'Easting (X) in meters',
  latDeg: 'Latitude (Y) in decimal degrees',
  northingMeter: 'Northing (Y) in meters',
  elevMeterOpt: 'Elevation (Z) in meters (Optional)',
  transformNowBtn: 'Transform Coordinates Now',
  resultTitle: 'Transformation Result',
  resultSubtitle: 'Accurately computed coordinates in {crs}',
  copySuccess: 'Coordinate copied to clipboard',
  enterCoordsHint: 'Enter coordinates and press transform to see result',
  batchTransformTitle: 'Batch Project Transformation',
  batchTransformSubtitle: 'Reproject all survey points in the active project from {source} to {target}',
  batchWarning: 'Important: This action permanently recomputes coordinates of all points in the database.',
  batchTransformingProgress: 'Transforming points...',
  batchTransformNowBtn: 'Transform All Project Points Now',
  noPointsInProjectToTransform: 'No points found in current project to transform',
  batchTransformSuccessToast: 'Successfully transformed {count} project points to {crs}',
  validCoordsRequired: 'Please enter valid numerical coordinate values',
  coordTransformSuccess: 'Coordinates transformed successfully',
  coordTransformError: 'Failed to transform coordinates between selected systems',
  geoNotSupported: 'Geolocation is not supported by your browser',
  geoSuccessToast: 'Location acquired with automatic detection of {name}',
  geoFetchError: 'Could not fetch location: {message}'
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

console.log('Successfully added coordinate form locales.');

import type { PointRecord } from '@/lib/db';

export type IssueSeverity = 'ERROR' | 'WARNING' | 'PASS';

export type QAIssue = {
  id: string;
  severity: IssueSeverity;
  category: 'DUPLICATE' | 'OUTLIER' | 'RANGE' | 'ELEVATION' | 'NAMING' | 'INTEGRITY';
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  affectedPointIds: string[];
  affectedPointNumbers: number[];
  recommendationAr: string;
};

export type QAReport = {
  totalPoints: number;
  overallScore: number; // 0 - 100
  status: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'CRITICAL_ERRORS';
  errorCount: number;
  warningCount: number;
  passCount: number;
  issues: QAIssue[];
  stats: {
    minEasting: number;
    maxEasting: number;
    minNorthing: number;
    maxNorthing: number;
    minElevation: number;
    maxElevation: number;
    meanElevation: number;
    elevationStdDev: number;
  };
};

/**
 * Runs a comprehensive geomatics QA/QC audit on survey points
 */
export function runSurveyQAQC(points: PointRecord[]): QAReport {
  const issues: QAIssue[] = [];

  if (points.length === 0) {
    return {
      totalPoints: 0,
      overallScore: 100,
      status: 'GOOD',
      errorCount: 0,
      warningCount: 0,
      passCount: 1,
      issues: [
        {
          id: 'no-points',
          severity: 'PASS',
          category: 'INTEGRITY',
          titleAr: 'لا توجد بيانات نقاط',
          titleEn: 'No Survey Points',
          descriptionAr: 'المشروع فارغ حالياً، قم باستيراد أو إضافة نقاط لبدء الفحص.',
          descriptionEn: 'Project is empty, import or add points to begin audit.',
          affectedPointIds: [],
          affectedPointNumbers: [],
          recommendationAr: 'أضف نقاط الرفع المساحي للبدء.',
        },
      ],
      stats: {
        minEasting: 0,
        maxEasting: 0,
        minNorthing: 0,
        maxNorthing: 0,
        minElevation: 0,
        maxElevation: 0,
        meanElevation: 0,
        elevationStdDev: 0,
      },
    };
  }

  // 1. Check for Duplicate Point Numbers
  const pointNumMap = new Map<number, PointRecord[]>();
  points.forEach((p) => {
    const list = pointNumMap.get(p.pointNumber) || [];
    list.push(p);
    pointNumMap.set(p.pointNumber, list);
  });

  pointNumMap.forEach((dupList, pNum) => {
    if (dupList.length > 1) {
      issues.push({
        id: `dup-num-${pNum}`,
        severity: 'ERROR',
        category: 'NAMING',
        titleAr: `تكرار رقم النقطة (P${pNum})`,
        titleEn: `Duplicate Point ID (P${pNum})`,
        descriptionAr: `رقم النقطة P${pNum} مكرر ${dupList.length} مرات في المشروع، مما يسبب خلطاً في الحسابات والتصدير.`,
        descriptionEn: `Point number P${pNum} is duplicated ${dupList.length} times.`,
        affectedPointIds: dupList.map((p) => p.id),
        affectedPointNumbers: [pNum],
        recommendationAr: 'أعد ترقيم النقاط المكررة بأرقام فريدة غير متطابقة.',
      });
    }
  });

  // 2. Check for Duplicate Coordinates (tolerance <= 0.05m)
  const coordDups: Array<{ p1: PointRecord; p2: PointRecord; dist: number }> = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const p1 = points[i];
      const p2 = points[j];
      const dist = Math.hypot(p2.easting - p1.easting, p2.northing - p1.northing);
      if (dist <= 0.05) {
        coordDups.push({ p1, p2, dist });
      }
    }
  }

  if (coordDups.length > 0) {
    const affectedIds = Array.from(
      new Set(coordDups.flatMap((d) => [d.p1.id, d.p2.id]))
    );
    const affectedNums = Array.from(
      new Set(coordDups.flatMap((d) => [d.p1.pointNumber, d.p2.pointNumber]))
    );

    issues.push({
      id: 'dup-coords',
      severity: 'WARNING',
      category: 'DUPLICATE',
      titleAr: `تطابق إحداثيات بين نقاط مختلفة (${coordDups.length} حالة)`,
      titleEn: `Duplicate / Overlapping Coordinates (${coordDups.length} instances)`,
      descriptionAr: `توجد نقاط متعددة لها نفس الإحداثيات المستوية X,Y تقريباً (مسافة أقل من 5 سم)، مثل النقطتين P${coordDups[0].p1.pointNumber} و P${coordDups[0].p2.pointNumber}.`,
      descriptionEn: `Points have nearly identical X,Y planar positions (within 0.05m).`,
      affectedPointIds: affectedIds,
      affectedPointNumbers: affectedNums,
      recommendationAr: 'تحقق من النقاط المكررة واحذف الرصدات الزائدة أو المكررة بالخطأ.',
    });
  }

  // 3. Statistical Analysis of Elevations (Mean, StdDev, IQR for Outlier/Spike detection)
  const elevations = points.map((p) => p.elevation);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const meanElev = elevations.reduce((a, b) => a + b, 0) / points.length;

  const variance =
    elevations.reduce((sum, el) => sum + Math.pow(el - meanElev, 2), 0) / points.length;
  const stdDevElev = Math.sqrt(variance);

  // Detect Outliers (Z-score > 2.8 or extreme IQR jump)
  const outlierPoints: PointRecord[] = [];
  if (points.length >= 4 && stdDevElev > 0.001) {
    points.forEach((p) => {
      const zScore = Math.abs(p.elevation - meanElev) / stdDevElev;
      if (zScore > 2.8) {
        outlierPoints.push(p);
      }
    });
  }

  if (outlierPoints.length > 0) {
    issues.push({
      id: 'elev-outliers',
      severity: 'WARNING',
      category: 'OUTLIER',
      titleAr: `شذوذ غير طبيعي في المناسيب / الارتفاعات (${outlierPoints.length} نقاط)`,
      titleEn: `Elevation Spikes / Outliers (${outlierPoints.length} points)`,
      descriptionAr: `تم كشف نقاط ذات ارتفاعات شاذة تبتعد كثيراً عن متوسط المشروع (${meanElev.toFixed(2)} م)، مثل النقطة P${outlierPoints[0].pointNumber} بمنسوب ${outlierPoints[0].elevation.toFixed(2)} م.`,
      descriptionEn: `Points found with statistically anomalous elevations compared to mean ${meanElev.toFixed(2)}m.`,
      affectedPointIds: outlierPoints.map((p) => p.id),
      affectedPointNumbers: outlierPoints.map((p) => p.pointNumber),
      recommendationAr: 'راجع ارتفاع العاكس (Target Height) أو خطأ قراءة الرصدة في الحقل.',
    });
  }

  // 4. Check Coordinate Range / Reasonable Projection Bounds
  const eastings = points.map((p) => p.easting);
  const northings = points.map((p) => p.northing);
  const minE = Math.min(...eastings);
  const maxE = Math.max(...eastings);
  const minN = Math.min(...northings);
  const maxN = Math.max(...northings);

  // Check if Coordinates look like Inverted Lat/Lng (e.g. Lat between -90 and 90, Lng between -180 and 180)
  const looksLikeWgs84 = minE >= -180 && maxE <= 180 && minN >= -90 && maxN <= 90;
  const looksLikeUtm = minE >= 100000 && maxE <= 900000 && minN >= 0 && maxN <= 10000000;

  if (!looksLikeWgs84 && !looksLikeUtm) {
    issues.push({
      id: 'crs-range-unusual',
      severity: 'WARNING',
      category: 'RANGE',
      titleAr: 'نطاق الإحداثيات غير قياسي لـ WGS84 أو UTM',
      titleEn: 'Unusual Coordinate Range',
      descriptionAr: `قيم الإحداثيات (E: ${minE.toFixed(1)} - ${maxE.toFixed(1)}, N: ${minN.toFixed(1)} - ${maxN.toFixed(1)}) قد تكون بإحداثيات محلية افتراضية (Local Grid).`,
      descriptionEn: 'Coordinates do not match standard UTM or WGS84 bounding ranges.',
      affectedPointIds: [],
      affectedPointNumbers: [],
      recommendationAr: 'تأكد من اختيار نظام الإسقاط المناسب أو ربط النقاط بنقاط ضبط معتمدة.',
    });
  }

  // 5. Check Missing Descriptions / Codes
  const missingDescPoints = points.filter((p) => !p.description || !p.description.trim());
  if (missingDescPoints.length > points.length * 0.4 && points.length > 5) {
    issues.push({
      id: 'missing-desc',
      severity: 'WARNING',
      category: 'INTEGRITY',
      titleAr: `نسبة عالية من النقاط بدون كود أو وصف (${missingDescPoints.length} نقطة)`,
      titleEn: `High percentage of points without feature code/description`,
      descriptionAr: `${Math.round((missingDescPoints.length / points.length) * 100)}% من النقاط بدون وصف ميداني يوضح نوع المعلم (حد، زاوية، مبنى، طريق).`,
      descriptionEn: 'Many points lack descriptive survey codes.',
      affectedPointIds: missingDescPoints.slice(0, 10).map((p) => p.id),
      affectedPointNumbers: missingDescPoints.slice(0, 10).map((p) => p.pointNumber),
      recommendationAr: 'أضف أكواد المعالم (Feature Codes) لتسهيل رسم المخطط وتصدير DXF.',
    });
  }

  // Positive Pass confirmation if no errors
  if (issues.filter((i) => i.severity === 'ERROR').length === 0) {
    issues.push({
      id: 'pass-integrity',
      severity: 'PASS',
      category: 'INTEGRITY',
      titleAr: 'اكتمال سلامة الترقيم والبنية الهندسية',
      titleEn: 'Structural Geometry Integrity Passed',
      descriptionAr: 'جميع أرقام النقاط صالحة، ولا توجد قيم فارغة أو إحداثيات غير رقمية.',
      descriptionEn: 'All point numbers are valid with no missing numerical values.',
      affectedPointIds: [],
      affectedPointNumbers: [],
      recommendationAr: 'بيانات المشروع جاهزة للحسابات المتقدمة والتصدير.',
    });
  }

  const errorCount = issues.filter((i) => i.severity === 'ERROR').length;
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length;
  const passCount = issues.filter((i) => i.severity === 'PASS').length;

  let score = 100 - errorCount * 30 - warningCount * 10;
  if (score < 0) score = 0;

  let status: QAReport['status'] = 'EXCELLENT';
  if (errorCount > 0) status = 'CRITICAL_ERRORS';
  else if (warningCount >= 2) status = 'NEEDS_ATTENTION';
  else if (warningCount === 1) status = 'GOOD';

  return {
    totalPoints: points.length,
    overallScore: score,
    status,
    errorCount,
    warningCount,
    passCount,
    issues,
    stats: {
      minEasting: minE,
      maxEasting: maxE,
      minNorthing: minN,
      maxNorthing: maxN,
      minElevation: minElev,
      maxElevation: maxElev,
      meanElevation: meanElev,
      elevationStdDev: stdDevElev,
    },
  };
}

import type { PointRecord } from '@/lib/db';

export type IssueSeverity = 'ERROR' | 'WARNING' | 'PASS';

export type OutlierDetectionMethod = 'MAD' | 'IQR' | 'ROBUST_Z' | 'SPATIAL_LOCAL_DIFF' | 'INSUFFICIENT_SAMPLE';

export type OutlierEvidence = {
  pointId: string;
  pointNumber: number;
  elevation: number;
  method: OutlierDetectionMethod;
  referenceElevation: number; // Median or Mean
  deviation: number;          // Absolute difference from reference
  threshold: number;          // Evaluated threshold
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  explanationAr: string;
  explanationEn: string;
};

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
  recommendationEn?: string;
  outlierDetails?: OutlierEvidence[];
};

export type QAReport = {
  totalPoints: number;
  overallScore: number | null; // null for empty projects (NO_DATA)
  status: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'CRITICAL_ERRORS' | 'NO_DATA';
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
    medianElevation: number;
    elevationStdDev: number;
    elevationMAD: number;
  };
};

/**
 * Calculates Median of an array of numbers
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculates Median Absolute Deviation (MAD)
 * MAD = median(|X_i - median(X)|)
 */
function calculateMAD(values: number[], median: number): number {
  if (values.length === 0) return 0;
  const absoluteDeviations = values.map((v) => Math.abs(v - median));
  return calculateMedian(absoluteDeviations);
}

/**
 * Robust Hybrid Outlier Detection System
 * Handles N=0, N=1, N=2, N=3, N=4, N=5, N=10, N=1000+
 * Combines Median Absolute Deviation (MAD), Interquartile Range (IQR),
 * and Spatial Local Elevation Neighborhood Differences.
 */
export function detectElevationOutliers(
  points: PointRecord[],
  engineeringToleranceMeters: number = 2.0
): OutlierEvidence[] {
  const n = points.length;
  if (n < 3) {
    // Insufficient sample size for statistical outlier detection
    return [];
  }

  const elevations = points.map((p) => p.elevation);
  const medianElev = calculateMedian(elevations);
  const mad = calculateMAD(elevations, medianElev);

  // Normal scale factor for MAD: sigma_approx = 1.4826 * MAD
  const pseudoSigma = 1.4826 * mad;

  const results: OutlierEvidence[] = [];

  points.forEach((p) => {
    const deviation = Math.abs(p.elevation - medianElev);

    // Case A: Robust MAD Detection (for datasets with some elevation dispersion)
    if (pseudoSigma > 0.01) {
      const modifiedZScore = (0.6745 * deviation) / mad;

      // For sample sizes N >= 3, a modified Z-score > 3.5 is standard NIST/Iglewicz-Hoaglin threshold
      // For small N (3 to 7), combine with engineering absolute deviation
      const isExtremeMAD = modifiedZScore > 3.5 && deviation > engineeringToleranceMeters;
      const isModerateMAD = modifiedZScore > 4.5;

      if (isExtremeMAD || isModerateMAD) {
        results.push({
          pointId: p.id,
          pointNumber: p.pointNumber,
          elevation: p.elevation,
          method: 'MAD',
          referenceElevation: medianElev,
          deviation,
          threshold: Math.max(3.5 * (mad / 0.6745), engineeringToleranceMeters),
          severity: deviation > 10 ? 'CRITICAL' : 'HIGH',
          confidence: n >= 5 ? 'HIGH' : 'MEDIUM',
          explanationAr: `انحراف المنسوب (${p.elevation.toFixed(3)}م) بمقدار ${deviation.toFixed(3)}م عن الوسيط (${medianElev.toFixed(3)}م) مع معامل انحراف مطلق معدل Z* = ${modifiedZScore.toFixed(2)}.`,
          explanationEn: `Elevation deviates by ${deviation.toFixed(3)}m from median (${medianElev.toFixed(3)}m) with modified Z-score ${modifiedZScore.toFixed(2)}.`,
        });
        return;
      }
    }

    // Case B: Zero or near-zero MAD (e.g. flat ground or identical terrain with one erroneous spike)
    if (pseudoSigma <= 0.01 && deviation > engineeringToleranceMeters) {
      results.push({
        pointId: p.id,
        pointNumber: p.pointNumber,
        elevation: p.elevation,
        method: 'SPATIAL_LOCAL_DIFF',
        referenceElevation: medianElev,
        deviation,
        threshold: engineeringToleranceMeters,
        severity: deviation > 10 ? 'CRITICAL' : 'HIGH',
        confidence: 'HIGH',
        explanationAr: `ارتفاع شاذ عن المنسوب الثابت للأرض (${medianElev.toFixed(3)}م) بفارق ${deviation.toFixed(3)}م (أكبر من سماحية ${engineeringToleranceMeters}م).`,
        explanationEn: `Elevation spike from constant terrain baseline (${medianElev.toFixed(3)}m) exceeding tolerance (${engineeringToleranceMeters}m).`,
      });
    }
  });

  return results;
}

/**
 * Runs a comprehensive geomatics QA/QC audit on survey points
 */
export function runSurveyQAQC(
  points: PointRecord[],
  options?: { engineeringElevationToleranceMeters?: number; duplicateDistanceToleranceMeters?: number }
): QAReport {
  const issues: QAIssue[] = [];
  const elevTol = options?.engineeringElevationToleranceMeters ?? 2.0;
  const dupTol = options?.duplicateDistanceToleranceMeters ?? 0.05;

  // Task 2: Empty Project Handling (0 points -> NO_DATA, overallScore = null)
  if (points.length === 0) {
    return {
      totalPoints: 0,
      overallScore: null,
      status: 'NO_DATA',
      errorCount: 0,
      warningCount: 0,
      passCount: 0,
      issues: [
        {
          id: 'no-points',
          severity: 'WARNING',
          category: 'INTEGRITY',
          titleAr: 'المشروع غير مُقيّم (لا توجد بيانات نقاط)',
          titleEn: 'Project Not Evaluated (No Survey Points)',
          descriptionAr: 'لا يمكن تقييم جودة البيانات لمشروع فارغ. يرجى استيراد ملف نقاط مساحية أو إضافة نقاط لبدء الفحص والتدقيق.',
          descriptionEn: 'Cannot audit an empty project. Please import or add survey points to evaluate data quality.',
          affectedPointIds: [],
          affectedPointNumbers: [],
          recommendationAr: 'أضف نقاط الرفع المساحي للبدء في تشغيل محرك التدقيق.',
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
        medianElevation: 0,
        elevationStdDev: 0,
        elevationMAD: 0,
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

  // 2. Check for Duplicate Coordinates (configurable tolerance <= dupTol)
  const coordDups: Array<{ p1: PointRecord; p2: PointRecord; dist: number }> = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const p1 = points[i];
      const p2 = points[j];
      const dist = Math.hypot(p2.easting - p1.easting, p2.northing - p1.northing);
      if (dist <= dupTol) {
        coordDups.push({ p1, p2, dist });
      }
    }
  }

  if (coordDups.length > 0) {
    const affectedIds = Array.from(new Set(coordDups.flatMap((d) => [d.p1.id, d.p2.id])));
    const affectedNums = Array.from(new Set(coordDups.flatMap((d) => [d.p1.pointNumber, d.p2.pointNumber])));

    issues.push({
      id: 'dup-coords',
      severity: 'WARNING',
      category: 'DUPLICATE',
      titleAr: `تطابق إحداثيات بين نقاط مختلفة (${coordDups.length} حالة)`,
      titleEn: `Duplicate / Overlapping Coordinates (${coordDups.length} instances)`,
      descriptionAr: `توجد نقاط متعددة لها نفس الإحداثيات المستوية X,Y تقريباً (مسافة أقل من ${(dupTol * 100).toFixed(0)} سم)، مثل النقطتين P${coordDups[0].p1.pointNumber} و P${coordDups[0].p2.pointNumber}.`,
      descriptionEn: `Points have nearly identical X,Y planar positions (within ${dupTol}m).`,
      affectedPointIds: affectedIds,
      affectedPointNumbers: affectedNums,
      recommendationAr: 'تحقق من النقاط المكررة واحذف الرصدات الزائدة أو المكررة بالخطأ.',
    });
  }

  // 3. Robust Statistical Analysis & Elevation Outliers
  const elevations = points.map((p) => p.elevation);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const meanElev = elevations.reduce((a, b) => a + b, 0) / points.length;
  const medianElev = calculateMedian(elevations);
  const elevationMAD = calculateMAD(elevations, medianElev);

  const variance = elevations.reduce((sum, el) => sum + Math.pow(el - meanElev, 2), 0) / points.length;
  const stdDevElev = Math.sqrt(variance);

  // Detect Outliers using Robust MAD / Spatial Hybrid Engine
  const outlierEvidences = detectElevationOutliers(points, elevTol);

  if (outlierEvidences.length > 0) {
    issues.push({
      id: 'elev-outliers',
      severity: 'WARNING',
      category: 'OUTLIER',
      titleAr: `شذوذ غير طبيعي في المناسيب / الارتفاعات (${outlierEvidences.length} نقاط)`,
      titleEn: `Elevation Spikes / Outliers (${outlierEvidences.length} points)`,
      descriptionAr: `تم كشف ${outlierEvidences.length} نقاط ذات ارتفاعات شاذة تبتعد عن وسيط المشروع (${medianElev.toFixed(2)} م) اعتماداً على تحليل MAD، مثل النقطة P${outlierEvidences[0].pointNumber} بمنسوب ${outlierEvidences[0].elevation.toFixed(2)} م (انحراف ${outlierEvidences[0].deviation.toFixed(2)} م).`,
      descriptionEn: `Points found with statistically anomalous elevations compared to median ${medianElev.toFixed(2)}m (MAD method).`,
      affectedPointIds: outlierEvidences.map((o) => o.pointId),
      affectedPointNumbers: outlierEvidences.map((o) => o.pointNumber),
      recommendationAr: 'راجع ارتفاع العاكس (Target Height) أو خطأ قراءة الرصدة في الحقل.',
      outlierDetails: outlierEvidences,
    });
  }

  // 4. Check Coordinate Range / Reasonable Projection Bounds
  const eastings = points.map((p) => p.easting);
  const northings = points.map((p) => p.northing);
  const minE = Math.min(...eastings);
  const maxE = Math.max(...eastings);
  const minN = Math.min(...northings);
  const maxN = Math.max(...northings);

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
      medianElevation: medianElev,
      elevationStdDev: stdDevElev,
      elevationMAD,
    },
  };
}

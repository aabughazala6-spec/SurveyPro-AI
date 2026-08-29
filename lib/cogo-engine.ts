/**
 * COGO (Coordinate Geometry) Engineering Calculation Engine
 * Fully deterministic mathematical surveying algorithms
 */

export type AngleDMS = {
  degrees: number;
  minutes: number;
  seconds: number;
  formatted: string;
};

export type InverseResult = {
  horizontalDistance: number;
  slopeDistance: number;
  deltaEasting: number;
  deltaNorthing: number;
  deltaElevation: number;
  azimuthDecimal: number;
  azimuthDMS: AngleDMS;
  bearing: string;
  slopePercent: number;
  slopeRatio: string;
};

export type ForwardResult = {
  easting: number;
  northing: number;
  elevation: number;
};

export type CircularCurveResult = {
  radius: number;
  deltaAngle: number;
  deltaDMS: AngleDMS;
  arcLength: number;
  tangentLength: number;
  longChord: number;
  externalDistance: number;
  middleOrdinate: number;
  degreeOfCurve: number;
};

export type LevelingStation = {
  id: string;
  stationName: string;
  backSight?: number;
  intermediateSight?: number;
  foreSight?: number;
  heightOfInstrument?: number;
  reducedLevel?: number;
  rise?: number;
  fall?: number;
  remarks?: string;
};

export type LevelingLoopResult = {
  stations: LevelingStation[];
  sumBackSight: number;
  sumForeSight: number;
  totalRise: number;
  totalFall: number;
  startRL: number;
  finalRL: number;
  misclosure: number; // sum(BS) - sum(FS)
  isClosed: boolean;
};

/**
 * Converts Decimal Degrees to Degrees, Minutes, Seconds (DMS)
 */
export function decimalToDMS(decimal: number): AngleDMS {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesDecimal = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = (minutesDecimal - minutes) * 60;

  const sign = decimal < 0 ? '-' : '';
  const formatted = `${sign}${degrees}° ${minutes}' ${seconds.toFixed(2)}"`;

  return { degrees, minutes, seconds: Number(seconds.toFixed(2)), formatted };
}

/**
 * Converts DMS to Decimal Degrees
 */
export function dmsToDecimal(degrees: number, minutes: number, seconds: number): number {
  return degrees + minutes / 60 + seconds / 3600;
}

/**
 * Normalizes an angle to 0 - 360 range
 */
export function normalizeAzimuth(azimuth: number): number {
  let angle = azimuth % 360;
  if (angle < 0) angle += 360;
  return angle;
}

/**
 * Converts whole circle Azimuth (0-360) to Quadrant Survey Bearing (e.g., N 45° 30' 00" E)
 */
export function azimuthToBearing(azimuth: number): string {
  const norm = normalizeAzimuth(azimuth);
  const dms = decimalToDMS(norm);

  if (norm === 0 || norm === 360) return 'North 00° 00\' 00"';
  if (norm === 90) return 'East 90° 00\' 00"';
  if (norm === 180) return 'South 00° 00\' 00"';
  if (norm === 270) return 'West 90° 00\' 00"';

  if (norm > 0 && norm < 90) {
    const qDms = decimalToDMS(norm);
    return `N ${qDms.degrees}° ${qDms.minutes}' ${qDms.seconds.toFixed(1)}" E`;
  } else if (norm > 90 && norm < 180) {
    const qDms = decimalToDMS(180 - norm);
    return `S ${qDms.degrees}° ${qDms.minutes}' ${qDms.seconds.toFixed(1)}" E`;
  } else if (norm > 180 && norm < 270) {
    const qDms = decimalToDMS(norm - 180);
    return `S ${qDms.degrees}° ${qDms.minutes}' ${qDms.seconds.toFixed(1)}" W`;
  } else {
    const qDms = decimalToDMS(360 - norm);
    return `N ${qDms.degrees}° ${qDms.minutes}' ${qDms.seconds.toFixed(1)}" W`;
  }
}

/**
 * COGO INVERSE: Calculates Distance, Azimuth, Bearing and Slope between two 3D coordinates
 */
export function calculateInverse(
  p1: { easting: number; northing: number; elevation?: number },
  p2: { easting: number; northing: number; elevation?: number }
): InverseResult {
  const dE = p2.easting - p1.easting;
  const dN = p2.northing - p1.northing;
  const dZ = (p2.elevation ?? 0) - (p1.elevation ?? 0);

  const horizontalDistance = Math.hypot(dE, dN);
  const slopeDistance = Math.hypot(horizontalDistance, dZ);

  // Azimuth in radians: atan2(dE, dN)
  let azimuthRad = Math.atan2(dE, dN);
  let azimuthDeg = (azimuthRad * 180) / Math.PI;
  azimuthDeg = normalizeAzimuth(azimuthDeg);

  const azimuthDMS = decimalToDMS(azimuthDeg);
  const bearing = azimuthToBearing(azimuthDeg);

  const slopePercent = horizontalDistance > 0 ? (dZ / horizontalDistance) * 100 : 0;
  const slopeRatio =
    Math.abs(dZ) > 0.0001
      ? `1 : ${(horizontalDistance / Math.abs(dZ)).toFixed(2)}`
      : 'Flat (مستوٍ)';

  return {
    horizontalDistance,
    slopeDistance,
    deltaEasting: dE,
    deltaNorthing: dN,
    deltaElevation: dZ,
    azimuthDecimal: azimuthDeg,
    azimuthDMS,
    bearing,
    slopePercent,
    slopeRatio,
  };
}

/**
 * COGO FORWARD: Calculates coordinate of destination given Start Point, Azimuth, and Horizontal Distance
 */
export function calculateForward(
  p1: { easting: number; northing: number; elevation?: number },
  azimuthDecimal: number,
  horizontalDistance: number,
  deltaElevation = 0
): ForwardResult {
  const azimuthRad = (azimuthDecimal * Math.PI) / 180;
  const dE = horizontalDistance * Math.sin(azimuthRad);
  const dN = horizontalDistance * Math.cos(azimuthRad);

  return {
    easting: p1.easting + dE,
    northing: p1.northing + dN,
    elevation: (p1.elevation ?? 0) + deltaElevation,
  };
}

/**
 * Interpolates points along a baseline with fixed spacing (Stationing / Chainage)
 */
export function interpolateLinePoints(
  start: { easting: number; northing: number; elevation?: number },
  end: { easting: number; northing: number; elevation?: number },
  intervalDistance: number
): Array<{ station: number; easting: number; northing: number; elevation: number }> {
  const inv = calculateInverse(start, end);
  const totalDist = inv.horizontalDistance;
  if (totalDist === 0 || intervalDistance <= 0) return [];

  const points: Array<{ station: number; easting: number; northing: number; elevation: number }> = [];
  const numSteps = Math.floor(totalDist / intervalDistance);

  for (let i = 0; i <= numSteps; i++) {
    const station = i * intervalDistance;
    const ratio = station / totalDist;
    points.push({
      station,
      easting: start.easting + (end.easting - start.easting) * ratio,
      northing: start.northing + (end.northing - start.northing) * ratio,
      elevation: (start.elevation ?? 0) + ((end.elevation ?? 0) - (start.elevation ?? 0)) * ratio,
    });
  }

  // Include end point if not exact multiple
  if (totalDist % intervalDistance !== 0) {
    points.push({
      station: totalDist,
      easting: end.easting,
      northing: end.northing,
      elevation: end.elevation ?? 0,
    });
  }

  return points;
}

/**
 * Calculates Circular Horizontal Curve Parameters
 */
export function calculateCircularCurve(radius: number, deltaAngleDeg: number): CircularCurveResult {
  const deltaRad = (deltaAngleDeg * Math.PI) / 180;
  const arcLength = radius * deltaRad;
  const tangentLength = radius * Math.tan(deltaRad / 2);
  const longChord = 2 * radius * Math.sin(deltaRad / 2);
  const externalDistance = radius * (1 / Math.cos(deltaRad / 2) - 1);
  const middleOrdinate = radius * (1 - Math.cos(deltaRad / 2));
  const degreeOfCurve = (5729.578 / radius); // arc definition

  return {
    radius,
    deltaAngle: deltaAngleDeg,
    deltaDMS: decimalToDMS(deltaAngleDeg),
    arcLength,
    tangentLength,
    longChord,
    externalDistance,
    middleOrdinate,
    degreeOfCurve,
  };
}

/**
 * Reduces a Differential Leveling Loop by Height of Instrument (HI) and Rise & Fall methods
 */
export function reduceLevelingLoop(
  startBenchMarkRL: number,
  readings: Array<{
    stationName: string;
    backSight?: number;
    intermediateSight?: number;
    foreSight?: number;
    remarks?: string;
  }>
): LevelingLoopResult {
  let currentHI = startBenchMarkRL + (readings[0]?.backSight ?? 0);
  let previousRL = startBenchMarkRL;

  let sumBS = 0;
  let sumFS = 0;
  let totalRise = 0;
  let totalFall = 0;

  const reducedStations: LevelingStation[] = [];

  readings.forEach((r, idx) => {
    const id = `st-${idx + 1}`;
    let rl = previousRL;
    let hi = currentHI;
    let rise: number | undefined;
    let fall: number | undefined;

    if (idx === 0) {
      // First Station BM
      rl = startBenchMarkRL;
      if (r.backSight !== undefined) {
        sumBS += r.backSight;
        hi = rl + r.backSight;
        currentHI = hi;
      }
    } else {
      const sight = r.foreSight ?? r.intermediateSight;
      if (sight !== undefined) {
        rl = currentHI - sight;

        // Rise / Fall relative to previous station
        const diff = previousRL - rl;
        if (diff < 0) {
          rise = Math.abs(diff);
          totalRise += rise;
        } else {
          fall = diff;
          totalFall += fall;
        }
      }

      if (r.foreSight !== undefined) {
        sumFS += r.foreSight;
      }

      if (r.backSight !== undefined) {
        sumBS += r.backSight;
        // Change point / Turning point (CP)
        hi = rl + r.backSight;
        currentHI = hi;
      }
    }

    previousRL = rl;

    reducedStations.push({
      id,
      stationName: r.stationName || `St ${idx + 1}`,
      backSight: r.backSight,
      intermediateSight: r.intermediateSight,
      foreSight: r.foreSight,
      heightOfInstrument: hi,
      reducedLevel: Number(rl.toFixed(4)),
      rise: rise ? Number(rise.toFixed(4)) : undefined,
      fall: fall ? Number(fall.toFixed(4)) : undefined,
      remarks: r.remarks,
    });
  });

  const finalRL = reducedStations[reducedStations.length - 1]?.reducedLevel ?? startBenchMarkRL;
  const misclosure = sumBS - sumFS;

  return {
    stations: reducedStations,
    sumBackSight: Number(sumBS.toFixed(4)),
    sumForeSight: Number(sumFS.toFixed(4)),
    totalRise: Number(totalRise.toFixed(4)),
    totalFall: Number(totalFall.toFixed(4)),
    startRL: startBenchMarkRL,
    finalRL,
    misclosure: Number(misclosure.toFixed(4)),
    isClosed: Math.abs(misclosure) < 0.005,
  };
}

/**
 * Calculates Back Azimuth (Reverse Azimuth)
 */
export function getBackAzimuth(azimuth: number): number {
  return normalizeAzimuth(azimuth + 180);
}

export type TraverseLegInput = {
  stationName: string;
  distance: number;
  azimuth: number; // Decimal degrees
  deltaZ?: number;
};

export type TraverseLegResult = {
  stationName: string;
  distance: number;
  azimuth: number;
  rawDeltaE: number;
  rawDeltaN: number;
  corrDeltaE: number;
  corrDeltaN: number;
  adjustedEasting: number;
  adjustedNorthing: number;
  adjustedElevation: number;
};

export type TraverseAdjustmentResult = {
  isClosedLoop: boolean;
  totalPerimeter: number;
  sumRawDeltaE: number;
  sumRawDeltaN: number;
  closureErrorE: number;
  closureErrorN: number;
  linearErrorOfClosure: number;
  precisionRatio: number; // e.g. 15000 for 1:15,000
  precisionFormatted: string; // "1 : 15,200"
  closureAzimuth: number;
  closureBearing: string;
  legs: TraverseLegResult[];
  startPoint: { easting: number; northing: number; elevation: number };
  closingPoint: { easting: number; northing: number; elevation: number };
};

/**
 * Calculates and Adjusts a Survey Traverse using Bowditch's Compass Rule
 */
export function calculateTraverseBowditch(
  startPoint: { easting: number; northing: number; elevation?: number },
  legs: TraverseLegInput[],
  closingPoint?: { easting: number; northing: number; elevation?: number }
): TraverseAdjustmentResult {
  const isClosedLoop = !closingPoint;
  const targetEnd = closingPoint ?? startPoint;
  const startElevation = startPoint.elevation ?? 0;

  let totalPerimeter = 0;
  let sumRawDeltaE = 0;
  let sumRawDeltaN = 0;

  // 1. Calculate raw departures (dE) and latitudes (dN) for each leg
  const rawLegs = legs.map((leg) => {
    const azRad = (normalizeAzimuth(leg.azimuth) * Math.PI) / 180;
    const rawDeltaE = leg.distance * Math.sin(azRad);
    const rawDeltaN = leg.distance * Math.cos(azRad);

    totalPerimeter += leg.distance;
    sumRawDeltaE += rawDeltaE;
    sumRawDeltaN += rawDeltaN;

    return {
      ...leg,
      rawDeltaE,
      rawDeltaN,
    };
  });

  // 2. Compute theoretical vs actual closure differences
  const expectedTotalE = targetEnd.easting - startPoint.easting;
  const expectedTotalN = targetEnd.northing - startPoint.northing;

  const closureErrorE = sumRawDeltaE - expectedTotalE;
  const closureErrorN = sumRawDeltaN - expectedTotalN;
  const linearErrorOfClosure = Math.hypot(closureErrorE, closureErrorN);

  const precisionRatio =
    linearErrorOfClosure > 0.000001
      ? Math.round(totalPerimeter / linearErrorOfClosure)
      : 999999;
  const precisionFormatted =
    precisionRatio >= 999999 ? '1 : ∞ (مغلق تام)' : `1 : ${precisionRatio.toLocaleString('en-US')}`;

  let closureAzimuth = 0;
  let closureBearing = 'N 0° 0\' 0" E';
  if (linearErrorOfClosure > 0.00001) {
    const azRad = Math.atan2(closureErrorE, closureErrorN);
    closureAzimuth = normalizeAzimuth((azRad * 180) / Math.PI);
    closureBearing = azimuthToBearing(closureAzimuth);
  }

  // 3. Apply Bowditch (Compass Rule) corrections: Correction = - Error * (LegLength / TotalPerimeter)
  let currentE = startPoint.easting;
  let currentN = startPoint.northing;
  let currentZ = startElevation;

  const adjustedLegs: TraverseLegResult[] = rawLegs.map((leg) => {
    const proportion = totalPerimeter > 0 ? leg.distance / totalPerimeter : 0;
    const corrE = -closureErrorE * proportion;
    const corrN = -closureErrorN * proportion;

    const adjustedDeltaE = leg.rawDeltaE + corrE;
    const adjustedDeltaN = leg.rawDeltaN + corrN;

    currentE += adjustedDeltaE;
    currentN += adjustedDeltaN;
    currentZ += leg.deltaZ ?? 0;

    return {
      stationName: leg.stationName,
      distance: leg.distance,
      azimuth: leg.azimuth,
      rawDeltaE: Number(leg.rawDeltaE.toFixed(4)),
      rawDeltaN: Number(leg.rawDeltaN.toFixed(4)),
      corrDeltaE: Number(corrE.toFixed(4)),
      corrDeltaN: Number(corrN.toFixed(4)),
      adjustedEasting: Number(currentE.toFixed(4)),
      adjustedNorthing: Number(currentN.toFixed(4)),
      adjustedElevation: Number(currentZ.toFixed(4)),
    };
  });

  return {
    isClosedLoop,
    totalPerimeter: Number(totalPerimeter.toFixed(4)),
    sumRawDeltaE: Number(sumRawDeltaE.toFixed(4)),
    sumRawDeltaN: Number(sumRawDeltaN.toFixed(4)),
    closureErrorE: Number(closureErrorE.toFixed(4)),
    closureErrorN: Number(closureErrorN.toFixed(4)),
    linearErrorOfClosure: Number(linearErrorOfClosure.toFixed(4)),
    precisionRatio,
    precisionFormatted,
    closureAzimuth: Number(closureAzimuth.toFixed(4)),
    closureBearing,
    legs: adjustedLegs,
    startPoint: {
      easting: startPoint.easting,
      northing: startPoint.northing,
      elevation: startElevation,
    },
    closingPoint: {
      easting: targetEnd.easting,
      northing: targetEnd.northing,
      elevation: targetEnd.elevation ?? 0,
    },
  };
}

export type BearingBearingResult = {
  isValid: boolean;
  intersectionPoint?: { easting: number; northing: number };
  distanceFromP1?: number;
  distanceFromP2?: number;
  error?: string;
};

/**
 * Calculates Bearing-Bearing Intersection between two lines of known directions from points P1 and P2
 */
export function calculateBearingBearingIntersection(
  p1: { easting: number; northing: number },
  az1: number,
  p2: { easting: number; northing: number },
  az2: number
): BearingBearingResult {
  const theta1 = (normalizeAzimuth(az1) * Math.PI) / 180;
  const theta2 = (normalizeAzimuth(az2) * Math.PI) / 180;

  const sin1 = Math.sin(theta1);
  const cos1 = Math.cos(theta1);
  const sin2 = Math.sin(theta2);
  const cos2 = Math.cos(theta2);

  // Determinant: sin(theta1 - theta2)
  const denom = sin1 * cos2 - cos1 * sin2;

  if (Math.abs(denom) < 1e-7) {
    return { isValid: false, error: 'الخطان متوازيان أو منطبقان ولا يوجد تقاطع فريد' };
  }

  const dE = p2.easting - p1.easting;
  const dN = p2.northing - p1.northing;

  const t = (dE * cos2 - dN * sin2) / denom;
  const s = (dE * cos1 - dN * sin1) / denom;

  const intE = p1.easting + t * sin1;
  const intN = p1.northing + t * cos1;

  return {
    isValid: true,
    intersectionPoint: {
      easting: Number(intE.toFixed(4)),
      northing: Number(intN.toFixed(4)),
    },
    distanceFromP1: Number(Math.abs(t).toFixed(4)),
    distanceFromP2: Number(Math.abs(s).toFixed(4)),
  };
}

export type DistanceDistanceResult = {
  isValid: boolean;
  solution1?: { easting: number; northing: number; description: string };
  solution2?: { easting: number; northing: number; description: string };
  baselineDistance?: number;
  error?: string;
};

/**
 * Calculates Distance-Distance Intersection (Trilateration) from two stations P1 and P2 with radii R1 and R2
 */
export function calculateDistanceDistanceIntersection(
  p1: { easting: number; northing: number },
  r1: number,
  p2: { easting: number; northing: number },
  r2: number
): DistanceDistanceResult {
  const inv = calculateInverse(p1, p2);
  const d = inv.horizontalDistance;

  if (d < 1e-6) {
    return { isValid: false, error: 'النقطتان P1 و P2 متطابقتان' };
  }
  if (d > r1 + r2) {
    return { isValid: false, error: 'المسافتان لا تتقاطعان (الدائرتان متباعدتان)' };
  }
  if (d < Math.abs(r1 - r2)) {
    return { isValid: false, error: 'إحدى الدائرتين داخل الأخرى دون تقاطع' };
  }

  const a = (d * d + r1 * r1 - r2 * r2) / (2 * d);
  const hSq = r1 * r1 - a * a;
  const h = Math.sqrt(Math.max(0, hSq));

  const baseAzRad = (inv.azimuthDecimal * Math.PI) / 180;
  const cosBase = Math.cos(baseAzRad);
  const sinBase = Math.sin(baseAzRad);

  // Foot of perpendicular on baseline
  const footE = p1.easting + a * sinBase;
  const footN = p1.northing + a * cosBase;

  // Perpendicular vector (-cosBase, sinBase) and (cosBase, -sinBase)
  const sol1E = footE + h * cosBase;
  const sol1N = footN - h * sinBase;

  const sol2E = footE - h * cosBase;
  const sol2N = footN + h * sinBase;

  return {
    isValid: true,
    baselineDistance: Number(d.toFixed(4)),
    solution1: {
      easting: Number(sol1E.toFixed(4)),
      northing: Number(sol1N.toFixed(4)),
      description: 'حل يمين خط الأساس (Right Solution)',
    },
    solution2: {
      easting: Number(sol2E.toFixed(4)),
      northing: Number(sol2N.toFixed(4)),
      description: 'حل يسار خط الأساس (Left Solution)',
    },
  };
}

export type PointToBaselineOffsetResult = {
  isValid: boolean;
  station: number;
  offsetDistance: number;
  offsetSide: 'RIGHT' | 'LEFT' | 'ON_LINE';
  footPoint: { easting: number; northing: number };
  baselineLength: number;
};

/**
 * Calculates Stationing (Chainage) and Perpendicular Offset of a point relative to a Baseline
 */
export function calculatePointToBaselineOffset(
  baselineStart: { easting: number; northing: number },
  baselineEnd: { easting: number; northing: number },
  point: { easting: number; northing: number }
): PointToBaselineOffsetResult {
  const dE = baselineEnd.easting - baselineStart.easting;
  const dN = baselineEnd.northing - baselineStart.northing;
  const baselineLength = Math.hypot(dE, dN);

  if (baselineLength < 1e-6) {
    return {
      isValid: false,
      station: 0,
      offsetDistance: 0,
      offsetSide: 'ON_LINE',
      footPoint: { easting: baselineStart.easting, northing: baselineStart.northing },
      baselineLength: 0,
    };
  }

  const pE = point.easting - baselineStart.easting;
  const pN = point.northing - baselineStart.northing;

  // Projection along baseline (Station)
  const station = (pE * dE + pN * dN) / baselineLength;

  // Cross product for signed offset: positive = Right of line, negative = Left of line
  const cross = (pE * dN - pN * dE) / baselineLength;
  const offsetDistance = Math.abs(cross);
  const offsetSide = Math.abs(cross) < 1e-5 ? 'ON_LINE' : cross > 0 ? 'RIGHT' : 'LEFT';

  const t = station / baselineLength;
  const footE = baselineStart.easting + t * dE;
  const footN = baselineStart.northing + t * dN;

  return {
    isValid: true,
    station: Number(station.toFixed(4)),
    offsetDistance: Number(offsetDistance.toFixed(4)),
    offsetSide,
    footPoint: {
      easting: Number(footE.toFixed(4)),
      northing: Number(footN.toFixed(4)),
    },
    baselineLength: Number(baselineLength.toFixed(4)),
  };
}


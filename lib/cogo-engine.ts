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

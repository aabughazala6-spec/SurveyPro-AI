/**
 * Map & CAD Engine for SurveyPro AI
 * Bridges Leaflet WGS84 Display with Deterministic Project-Scoped Geodetic Calculations
 */

import proj4 from 'proj4';
import type { PointRecord } from '@/lib/db';
import { calculateInverse, decimalToDMS, azimuthToBearing, type InverseResult } from '@/lib/cogo-engine';
import {
  calculatePolygonArea,
  calculatePolygonPerimeter,
  calculatePolygonPerimeter3D,
  calculatePolygonCentroid,
  calculateBoundingBox,
  squareMetersToFeddans,
  squareMetersToHectares,
  squareMetersToAcres,
  type Centroid,
  type BoundingBox,
} from '@/lib/survey-calculations';
import { SUPPORTED_CRS, transformCoordinates } from '@/lib/crs-definitions';

export interface MapPointDTO extends PointRecord {
  lat: number;
  lng: number;
  isTransformedValid: boolean;
  elevationNormalized?: number; // 0..1 for elevation ramp
}

export interface MapMeasurementSegment {
  p1: { easting: number; northing: number; elevation?: number; label?: string };
  p2: { easting: number; northing: number; elevation?: number; label?: string };
  inverse: InverseResult;
}

export interface MapMeasurementResult {
  mode: 'distance' | 'azimuth' | 'area';
  segments: MapMeasurementSegment[];
  totalHorizontalDistance: number;
  totalSlopeDistance: number;
  areaSqm?: number;
  areaFeddans?: number;
  areaHectares?: number;
  areaAcres?: number;
  perimeter2D?: number;
  perimeter3D?: number;
  centroid?: Centroid;
}

export interface ProjectMapSummary {
  pointCount: number;
  validPointCount: number;
  flaggedCount: number;
  hasGeometry: boolean;
  boundingBox: BoundingBox;
  deltaElevation: number;
  minElevation: number;
  maxElevation: number;
  avgElevation: number;
  areaSqm: number;
  areaFeddans: number;
  areaHectares: number;
  perimeter2D: number;
  perimeter3D: number;
  centroid: Centroid;
  crsCode: string;
  crsName: string;
  datumName: string;
  validationLevel: 'AUTHORITATIVE_GEODETIC' | 'REQUIRES_CONTROL_VALIDATION';
}

/**
 * Converts project points to MapPointDTO with WGS84 (lat, lng) coordinates
 */
export function projectPointsToMapPoints(points: PointRecord[], crsCode: string): MapPointDTO[] {
  const targetCrs = 'EPSG:4326';
  const effectiveCrs = crsCode || 'EPSG:32638';

  const elevations = points.map((p) => p.elevation).filter((z) => typeof z === 'number' && !isNaN(z));
  const minZ = elevations.length ? Math.min(...elevations) : 0;
  const maxZ = elevations.length ? Math.max(...elevations) : 0;
  const deltaZ = maxZ - minZ;

  return points.map((point) => {
    try {
      let lng = point.easting;
      let lat = point.northing;

      if (effectiveCrs !== targetCrs) {
        const transformed = proj4(effectiveCrs, targetCrs, [point.easting, point.northing]);
        lng = transformed[0];
        lat = transformed[1];
      }

      // Check if resulting lat/lng is within reasonable world bounds
      const isValid =
        !isNaN(lat) &&
        !isNaN(lng) &&
        isFinite(lat) &&
        isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180;

      const normZ = deltaZ > 0.001 ? (point.elevation - minZ) / deltaZ : 0.5;

      return {
        ...point,
        lat: isValid ? lat : 0,
        lng: isValid ? lng : 0,
        isTransformedValid: isValid,
        elevationNormalized: Math.max(0, Math.min(1, normZ)),
      };
    } catch {
      return {
        ...point,
        lat: 0,
        lng: 0,
        isTransformedValid: false,
        elevationNormalized: 0.5,
      };
    }
  });
}

/**
 * Converts a map click (WGS84 Lat/Lng) to Project Grid (Easting, Northing)
 */
export function mapLatLngToProjectGrid(
  lat: number,
  lng: number,
  crsCode: string,
  elevation: number = 0
): { easting: number; northing: number; elevation: number; isValid: boolean } {
  const effectiveCrs = crsCode || 'EPSG:32638';
  try {
    if (effectiveCrs === 'EPSG:4326') {
      return { easting: lng, northing: lat, elevation, isValid: true };
    }
    const transformed = proj4('EPSG:4326', effectiveCrs, [lng, lat]);
    return {
      easting: transformed[0],
      northing: transformed[1],
      elevation,
      isValid: !isNaN(transformed[0]) && !isNaN(transformed[1]),
    };
  } catch {
    return { easting: 0, northing: 0, elevation, isValid: false };
  }
}

/**
 * Calculates deterministic project-wide map metrics
 */
export function calculateProjectMapSummary(points: PointRecord[], crsCode: string): ProjectMapSummary {
  const crsDef = SUPPORTED_CRS.find((c) => c.code === crsCode) || {
    code: crsCode,
    name: crsCode,
    datumName: 'Unknown Datum',
    validationLevel: 'AUTHORITATIVE_GEODETIC' as const,
  };

  const validPoints = points.filter(
    (p) =>
      typeof p.easting === 'number' &&
      typeof p.northing === 'number' &&
      !isNaN(p.easting) &&
      !isNaN(p.northing)
  );

  const flaggedCount = validPoints.filter((p) => p.flagged).length;

  const elevations = validPoints.map((p) => p.elevation).filter((z) => !isNaN(z));
  const minElevation = elevations.length ? Math.min(...elevations) : 0;
  const maxElevation = elevations.length ? Math.max(...elevations) : 0;
  const avgElevation = elevations.length
    ? elevations.reduce((s, z) => s + z, 0) / elevations.length
    : 0;

  const bbox = calculateBoundingBox(validPoints);
  const areaSqm = calculatePolygonArea(validPoints);
  const perimeter2D = calculatePolygonPerimeter(validPoints);
  const perimeter3D = calculatePolygonPerimeter3D(validPoints);
  const centroid = calculatePolygonCentroid(validPoints);

  return {
    pointCount: points.length,
    validPointCount: validPoints.length,
    flaggedCount,
    hasGeometry: validPoints.length >= 3,
    boundingBox: bbox,
    minElevation,
    maxElevation,
    avgElevation,
    deltaElevation: maxElevation - minElevation,
    areaSqm,
    areaFeddans: squareMetersToFeddans(areaSqm),
    areaHectares: squareMetersToHectares(areaSqm),
    perimeter2D,
    perimeter3D,
    centroid,
    crsCode: crsDef.code,
    crsName: crsDef.name,
    datumName: crsDef.datumName,
    validationLevel: crsDef.validationLevel,
  };
}

/**
 * Performs deterministic COGO distance & azimuth calculations along an arbitrary clicked path
 */
export function calculateMapPathMeasurement(
  pathPoints: Array<{ easting: number; northing: number; elevation?: number; label?: string }>,
  mode: 'distance' | 'azimuth' | 'area'
): MapMeasurementResult {
  if (pathPoints.length < 2) {
    return {
      mode,
      segments: [],
      totalHorizontalDistance: 0,
      totalSlopeDistance: 0,
    };
  }

  const segments: MapMeasurementSegment[] = [];
  let totalH = 0;
  let totalS = 0;

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const p1 = pathPoints[i];
    const p2 = pathPoints[i + 1];
    const inv = calculateInverse(p1, p2);
    segments.push({ p1, p2, inverse: inv });
    totalH += inv.horizontalDistance;
    totalS += inv.slopeDistance;
  }

  const result: MapMeasurementResult = {
    mode,
    segments,
    totalHorizontalDistance: totalH,
    totalSlopeDistance: totalS,
  };

  if (mode === 'area' && pathPoints.length >= 3) {
    const pointRecords: PointRecord[] = pathPoints.map((p, idx) => ({
      id: `measure_${idx}`,
      projectId: 'temp',
      pointNumber: idx + 1,
      easting: p.easting,
      northing: p.northing,
      elevation: p.elevation ?? 0,
      timestamp: '',
    }));

    const area = calculatePolygonArea(pointRecords);
    const p2d = calculatePolygonPerimeter(pointRecords);
    const p3d = calculatePolygonPerimeter3D(pointRecords);
    const cent = calculatePolygonCentroid(pointRecords);

    result.areaSqm = area;
    result.areaFeddans = squareMetersToFeddans(area);
    result.areaHectares = squareMetersToHectares(area);
    result.areaAcres = squareMetersToAcres(area);
    result.perimeter2D = p2d;
    result.perimeter3D = p3d;
    result.centroid = cent;
  }

  return result;
}

/**
 * Color ramp generator for elevation visualization (from Low #38bdf8 to High #ef4444)
 */
export function getElevationColor(normalized: number): string {
  // 0.0 (low) -> 0.33 (mid-low) -> 0.66 (mid-high) -> 1.0 (high)
  // cyan -> emerald -> amber -> rose
  if (normalized < 0.25) return '#38bdf8'; // Sky Blue
  if (normalized < 0.5) return '#10b981';  // Emerald
  if (normalized < 0.75) return '#f59e0b'; // Amber
  return '#ef4444';                       // Rose/Red
}

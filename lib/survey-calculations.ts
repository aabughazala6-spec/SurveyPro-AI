import type { PointRecord } from '@/lib/db';

export type BoundingBox = {
  minEasting: number;
  maxEasting: number;
  minNorthing: number;
  maxNorthing: number;
  width: number;
  height: number;
};

export type Centroid = {
  easting: number;
  northing: number;
};

/**
 * Format a number with thousands separators and fixed decimal places
 */
export function formatNumber(val: number, decimals: number = 2): string {
  if (isNaN(val) || val === null || val === undefined) return '0.00';
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Calculates Planar (2D) Polygon Area using Gauss's Area Formula (Shoelace Formula)
 */
export function calculatePolygonArea(points: PointRecord[]): number {
  if (points.length < 3) return 0;

  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    total += current.easting * next.northing - next.easting * current.northing;
  }
  return Math.abs(total) / 2;
}

/**
 * Calculates Polygon Perimeter (2D Planar and 3D Spatial)
 */
export function calculatePolygonPerimeter(points: PointRecord[]): number {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    total += Math.hypot(next.easting - current.easting, next.northing - current.northing);
  }
  return total;
}

export function calculatePolygonPerimeter3D(points: PointRecord[]): number {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const dH = Math.hypot(next.easting - current.easting, next.northing - current.northing);
    const dZ = next.elevation - current.elevation;
    total += Math.hypot(dH, dZ);
  }
  return total;
}

/**
 * Calculates Geometric Centroid of polygon (orientation-invariant: works for both CCW and CW vertex order)
 */
export function calculatePolygonCentroid(points: PointRecord[]): Centroid {
  if (points.length === 0) return { easting: 0, northing: 0 };
  if (points.length === 1) return { easting: points[0].easting, northing: points[0].northing };
  if (points.length === 2) {
    return {
      easting: (points[0].easting + points[1].easting) / 2,
      northing: (points[0].northing + points[1].northing) / 2,
    };
  }

  let signedAreaSum = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const factor = current.easting * next.northing - next.easting * current.northing;
    signedAreaSum += factor;
    cx += (current.easting + next.easting) * factor;
    cy += (current.northing + next.northing) * factor;
  }

  const signedArea = signedAreaSum / 2;

  if (Math.abs(signedArea) < 1e-7) {
    const meanE = points.reduce((s, p) => s + p.easting, 0) / points.length;
    const meanN = points.reduce((s, p) => s + p.northing, 0) / points.length;
    return { easting: meanE, northing: meanN };
  }

  return {
    easting: cx / (6 * signedArea),
    northing: cy / (6 * signedArea),
  };
}

/**
 * Calculates Bounding Box of survey points
 */
export function calculateBoundingBox(points: PointRecord[]): BoundingBox {
  if (points.length === 0) {
    return { minEasting: 0, maxEasting: 0, minNorthing: 0, maxNorthing: 0, width: 0, height: 0 };
  }

  const eastings = points.map((p) => p.easting);
  const northings = points.map((p) => p.northing);
  const minE = Math.min(...eastings);
  const maxE = Math.max(...eastings);
  const minN = Math.min(...northings);
  const maxN = Math.max(...northings);

  return {
    minEasting: minE,
    maxEasting: maxE,
    minNorthing: minN,
    maxNorthing: maxN,
    width: maxE - minE,
    height: maxN - minN,
  };
}

/**
 * Area unit conversions
 */
export function squareMetersToFeddans(sqm: number): number {
  return sqm / 4200.833;
}

export function squareMetersToQirats(sqm: number): number {
  return sqm / 175.035;
}

export function squareMetersToHectares(sqm: number): number {
  return sqm / 10000;
}

export function squareMetersToAcres(sqm: number): number {
  return sqm / 4046.8564;
}

export function squareMetersToSquareFeet(sqm: number): number {
  return sqm * 10.7639;
}

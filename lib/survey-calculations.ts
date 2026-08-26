import type { PointRecord } from '@/lib/db';

export function calculatePolygonArea(points: PointRecord[]): number {
  if (points.length < 3) return 0;

  return Math.abs(
    points.reduce((total, point, index) => {
      const nextPoint = points[(index + 1) % points.length];
      return total + point.easting * nextPoint.northing - nextPoint.easting * point.northing;
    }, 0) / 2
  );
}

export function calculatePolygonPerimeter(points: PointRecord[]): number {
  if (points.length < 2) return 0;

  return points.reduce((total, point, index) => {
    const nextPoint = points[(index + 1) % points.length];
    return total + Math.hypot(nextPoint.easting - point.easting, nextPoint.northing - point.northing);
  }, 0);
}

export function squareMetersToFeddans(squareMeters: number): number {
  return squareMeters / 4200.83;
}

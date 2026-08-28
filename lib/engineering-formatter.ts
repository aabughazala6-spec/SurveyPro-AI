/**
 * SurveyPro AI — Centralized Engineering Number Formatter
 * 
 * CRITICAL RULE:
 * Engineering numbers, coordinates, elevations, distances, areas, volumes,
 * angles, bearings, EPSG codes, and point identifiers MUST ALWAYS use
 * Western/English ASCII digits (0-9) and standard decimal dots (.) in BOTH
 * Arabic and English locales.
 * 
 * Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) and Arabic decimal commas (٫) are STRICTLY
 * FORBIDDEN for surveying & engineering data.
 */

import { dictionaries, getTranslation, type Language } from '@/locales';

export interface NumberFormatOptions {
  decimals?: number;
  useGrouping?: boolean;
  minDecimals?: number;
  prefix?: string;
  suffix?: string;
}

/**
 * Validates if string consists solely of Western ASCII digits (0-9), decimal dots, minus signs, and commas.
 */
export function isPureWesternDigits(val: string): boolean {
  return /^[0-9.,\-\s%+°a-zA-Z_/²³]+$/.test(val) && !/[\u0660-\u0669\u06F0-\u06F9]/.test(val);
}

/**
 * Returns true if the language is RTL (Arabic), false otherwise
 */
export function isRtlLanguage(lang: Language | string): boolean {
  return lang === 'ar';
}

/**
 * Wrapper for translation key retrieval with optional parameter replacement
 */
export function translateKey(
  lang: Language,
  key: string,
  params?: Record<string, string | number>
): string {
  return getTranslation(lang, key, params);
}

/**
 * Format a generic number with strict Western digits (0-9) and standard decimal dot (.)
 */
export function formatEngineeringNumber(
  value: number | null | undefined,
  decimals = 3,
  useGrouping = false
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00';
  }

  // Use standard en-US formatting to strictly enforce Western digits & dot separator
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping,
  });

  return formatted;
}

/**
 * Format an Easting or Northing coordinate with millimeter precision (3 decimal places)
 * Example: 522623.950
 */
export function formatCoordinate(value: number | null | undefined, decimals = 3): string {
  return formatEngineeringNumber(value, decimals, false);
}

/**
 * Format an Elevation (Z) with millimeter precision and meter suffix
 * Example: 84.250 m
 */
export function formatElevation(value: number | null | undefined, decimals = 3, includeUnit = true): string {
  if (value === null || value === undefined || isNaN(value)) return '0.000 m';
  const num = formatEngineeringNumber(value, decimals, false);
  return includeUnit ? `${num} m` : num;
}

/**
 * Format a Distance with precision and meter suffix
 * Example: 125.350 m
 */
export function formatDistance(value: number | null | undefined, decimals = 3, includeUnit = true): string {
  if (value === null || value === undefined || isNaN(value)) return '0.000 m';
  const num = formatEngineeringNumber(value, decimals, true);
  return includeUnit ? `${num} m` : num;
}

/**
 * Format a Surface Area with square meters suffix and standard thousands separators
 * Example: 12,540.75 m²
 */
export function formatArea(
  value: number | null | undefined,
  decimals = 2,
  unit: 'sqm' | 'feddan' | 'ha' = 'sqm'
): string {
  if (value === null || value === undefined || isNaN(value)) return '0.00 m²';
  if (unit === 'feddan') {
    const feddanVal = value / 4200.833;
    return `${formatEngineeringNumber(feddanVal, decimals, true)} feddan`;
  }
  if (unit === 'ha') {
    const haVal = value / 10000;
    return `${formatEngineeringNumber(haVal, decimals, true)} ha`;
  }
  const num = formatEngineeringNumber(value, decimals, true);
  return `${num} m²`;
}

/**
 * Format an Earthwork / Cut / Fill Volume with cubic meters suffix
 * Example: 3,450.20 m³
 */
export function formatVolume(value: number | null | undefined, decimals = 2, includeUnit = true): string {
  if (value === null || value === undefined || isNaN(value)) return '0.00 m³';
  const num = formatEngineeringNumber(value, decimals, true);
  return includeUnit ? `${num} m³` : num;
}

/**
 * Format a Decimal Angle / Azimuth with degree symbol
 * Example: 45.2500°
 */
export function formatAngle(value: number | null | undefined, decimals = 4, includeUnit = true): string {
  if (value === null || value === undefined || isNaN(value)) return '0.0000°';
  const num = formatEngineeringNumber(value, decimals, false);
  return includeUnit ? `${num}°` : num;
}

/**
 * Format a Slope / Grade percentage
 * Example: +2.50%
 */
export function formatSlope(value: number | null | undefined, decimals = 2, includeSign = false): string {
  if (value === null || value === undefined || isNaN(value)) return '0.00%';
  const num = formatEngineeringNumber(Math.abs(value), decimals, false);
  const sign = value > 0 && includeSign ? '+' : value < 0 ? '-' : '';
  return `${sign}${num}%`;
}

/**
 * Format Stationing (e.g. 150.25 -> Sta 0+150.25)
 */
export function formatStation(stationMeters: number | null | undefined, decimals = 2): string {
  if (stationMeters === null || stationMeters === undefined || isNaN(stationMeters)) return 'Sta 0+000.00';
  const sign = stationMeters < 0 ? '-' : '';
  const abs = Math.abs(stationMeters);
  const k = Math.floor(abs / 1000);
  const rem = abs % 1000;
  const remFormatted = rem.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).padStart(3 + (decimals > 0 ? decimals + 1 : 0), '0');

  return `Sta ${sign}${k}+${remFormatted}`;
}

/**
 * Point ID Formatter (e.g. 102 -> P102)
 */
export function formatPointNumber(pointNumber: number | string | null | undefined): string {
  if (pointNumber === null || pointNumber === undefined || pointNumber === '') return 'P?';
  const numStr = String(pointNumber).trim();
  return numStr.toUpperCase().startsWith('P') ? numStr : `P${numStr}`;
}

/**
 * CRS / EPSG Identifier Formatter (Preserves standard format e.g. EPSG:32636)
 */
export function formatCrsCode(code: string | null | undefined): string {
  if (!code) return 'EPSG:32638';
  return code.trim().toUpperCase();
}

/**
 * Export a consolidated namespace for engineering formatting
 */
export const engFormat = {
  number: formatEngineeringNumber,
  coord: formatCoordinate,
  elevation: formatElevation,
  distance: formatDistance,
  area: formatArea,
  volume: formatVolume,
  angle: formatAngle,
  slope: formatSlope,
  station: formatStation,
  point: formatPointNumber,
  crs: formatCrsCode,
};

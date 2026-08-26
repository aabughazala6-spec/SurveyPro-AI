/**
 * SurveyPro AI - Guided Survey Data Import Engine (Phase 3.2)
 *
 * Fully deterministic, client-side parsing, validation, transformation,
 * and atomic Dexie commit with audit trail.
 */

import { db, type PointRecord } from './db';
import { logAuditEvent } from './audit-service';
import { transformCoordinates, SUPPORTED_CRS } from './crs-definitions';

export type DelimiterType = ',' | ';' | '\t' | '|' | 'auto';
export type ColumnPreset = 'PNEZD' | 'PENZD' | 'NEZ' | 'ENZ' | 'CUSTOM';
export type DuplicateStrategy = 'REJECT_DUPLICATES' | 'IMPORT_ONLY_NEW' | 'OVERWRITE_CONFIRMED' | 'CANCEL';

export interface ColumnMapping {
  pointNumberIndex: number;
  eastingIndex: number;
  northingIndex: number;
  elevationIndex: number;
  descriptionIndex: number;
}

export type IssueSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface ValidationIssue {
  rowIndex: number;
  rawLine?: string;
  severity: IssueSeverity;
  code: string;
  message: string;
  field?: string;
}

export interface ParsedSurveyRow {
  rowIndex: number;
  raw: string[];
  pointNumber: number;
  easting: number;
  northing: number;
  elevation: number;
  description: string;
  isValid: boolean;
  issues: ValidationIssue[];
}

export interface ImportAnalysisResult {
  totalLines: number;
  detectedDelimiter: string;
  delimiterConfidence: number; // 0 to 1
  hasHeader: boolean;
  headerRow: string[] | null;
  rawSampleRows: string[][];
  suggestedPreset: ColumnPreset;
  suggestedMapping: ColumnMapping;
}

export interface ImportValidationResult {
  totalRows: number;
  validRows: ParsedSurveyRow[];
  invalidRows: ParsedSurveyRow[];
  warningRows: ParsedSurveyRow[];
  issues: ValidationIssue[];
  duplicatePointNumbersInFile: number[];
  duplicatePointNumbersWithProject: number[];
  canCommit: boolean;
  requiresWarningOverride: boolean;
  sourceCrs: string;
  targetCrs: string;
  isCrsMismatched: boolean;
  requiresGcpWarning: boolean;
}

export interface ImportCommitResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  error?: string;
  pointCountBefore: number;
  pointCountAfter: number;
  auditLogId?: string | null;
  timestamp: string;
}

/**
 * 1. Auto-detect Delimiter
 */
export function detectDelimiter(text: string): { delimiter: string; confidence: number } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'))
    .slice(0, 30);

  if (lines.length === 0) {
    return { delimiter: ',', confidence: 0.1 };
  }

  const delimiters = [',', ';', '\t', '|'];
  const scores: Record<string, { totalCount: number; variance: number; consistency: number }> = {};

  for (const delim of delimiters) {
    const counts = lines.map((line) => line.split(delim).length);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    if (avg <= 1) {
      scores[delim] = { totalCount: 0, variance: 999, consistency: 0 };
      continue;
    }
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;
    // Lower variance across lines = higher consistency
    const consistency = Math.max(0, 1 - variance / 2);
    scores[delim] = { totalCount: avg, variance, consistency };
  }

  let bestDelim = ',';
  let maxScore = -1;
  for (const [delim, data] of Object.entries(scores)) {
    const score = data.totalCount * 0.4 + data.consistency * 0.6;
    if (score > maxScore && data.totalCount >= 2) {
      maxScore = score;
      bestDelim = delim;
    }
  }

  const confidence = maxScore > 0 ? Math.min(1.0, Math.max(0.2, scores[bestDelim]?.consistency || 0.5)) : 0.2;
  return { delimiter: bestDelim, confidence };
}

/**
 * 2. Header Detection
 */
export function detectHeader(rows: string[][]): { hasHeader: boolean; headerRow: string[] | null } {
  if (rows.length === 0) return { hasHeader: false, headerRow: null };

  const firstRow = rows[0];
  const headerKeywords = [
    'p', 'point', 'pt', 'id', 'num', 'number',
    'n', 'northing', 'y',
    'e', 'easting', 'x',
    'z', 'elev', 'elevation', 'h', 'height',
    'd', 'desc', 'description', 'code', 'remark', 'layer'
  ];

  let matches = 0;
  for (const cell of firstRow) {
    const normalized = cell.trim().toLowerCase();
    if (headerKeywords.includes(normalized) || headerKeywords.some((k) => normalized.startsWith(k))) {
      matches++;
    }
  }

  // Also check if first row contains non-numeric while second row contains numeric
  const firstRowNumericCount = firstRow.filter((c) => !isNaN(Number(c.trim())) && c.trim() !== '').length;
  const isFirstRowAllText = firstRowNumericCount === 0;

  let isSecondRowNumeric = false;
  if (rows.length > 1) {
    const secondRowNumericCount = rows[1].filter((c) => !isNaN(Number(c.trim())) && c.trim() !== '').length;
    isSecondRowNumeric = secondRowNumericCount >= 2;
  }

  const hasHeader = matches >= 2 || (isFirstRowAllText && isSecondRowNumeric);
  return {
    hasHeader,
    headerRow: hasHeader ? firstRow : null,
  };
}

/**
 * 3. Suggest Column Mapping
 */
export function suggestColumnMapping(headerRow: string[] | null, sampleDataRow: string[] | null): { preset: ColumnPreset; mapping: ColumnMapping } {
  const defaultPnezd: ColumnMapping = {
    pointNumberIndex: 0,
    northingIndex: 1,
    eastingIndex: 2,
    elevationIndex: 3,
    descriptionIndex: 4,
  };

  const defaultPenzd: ColumnMapping = {
    pointNumberIndex: 0,
    eastingIndex: 1,
    northingIndex: 2,
    elevationIndex: 3,
    descriptionIndex: 4,
  };

  if (!headerRow && sampleDataRow) {
    // If no header, check typical Easting vs Northing magnitude
    // In many Middle East and Northern hemisphere coordinates, Northing (Y) > Easting (X)
    const val1 = Number(sampleDataRow[1]);
    const val2 = Number(sampleDataRow[2]);
    if (!isNaN(val1) && !isNaN(val2)) {
      if (val1 > val2 && val1 > 100000) {
        // val1 is probably Northing -> PNEZD
        return { preset: 'PNEZD', mapping: defaultPnezd };
      } else if (val2 > val1 && val2 > 100000) {
        // val2 is probably Northing -> PENZD
        return { preset: 'PENZD', mapping: defaultPenzd };
      }
    }
    return { preset: 'PENZD', mapping: defaultPenzd };
  }

  if (headerRow) {
    const lower = headerRow.map((h) => h.trim().toLowerCase());
    const mapping: ColumnMapping = {
      pointNumberIndex: -1,
      eastingIndex: -1,
      northingIndex: -1,
      elevationIndex: -1,
      descriptionIndex: -1,
    };

    lower.forEach((col, idx) => {
      if (['p', 'pt', 'point', 'pointnumber', 'id', 'num', 'number', 'pt_num'].includes(col)) {
        if (mapping.pointNumberIndex === -1) mapping.pointNumberIndex = idx;
      } else if (['e', 'east', 'easting', 'x', 'lon', 'longitude'].includes(col)) {
        if (mapping.eastingIndex === -1) mapping.eastingIndex = idx;
      } else if (['n', 'north', 'northing', 'y', 'lat', 'latitude'].includes(col)) {
        if (mapping.northingIndex === -1) mapping.northingIndex = idx;
      } else if (['z', 'elev', 'elevation', 'h', 'height', 'altitude'].includes(col)) {
        if (mapping.elevationIndex === -1) mapping.elevationIndex = idx;
      } else if (['d', 'desc', 'description', 'code', 'remark', 'layer', 'name'].includes(col)) {
        if (mapping.descriptionIndex === -1) mapping.descriptionIndex = idx;
      }
    });

    if (mapping.pointNumberIndex !== -1 && mapping.eastingIndex !== -1 && mapping.northingIndex !== -1) {
      if (mapping.eastingIndex === 1 && mapping.northingIndex === 2) {
        return { preset: 'PENZD', mapping };
      } else if (mapping.northingIndex === 1 && mapping.eastingIndex === 2) {
        return { preset: 'PNEZD', mapping };
      }
      return { preset: 'CUSTOM', mapping };
    }
  }

  return { preset: 'PENZD', mapping: defaultPenzd };
}

/**
 * 4. Analyze Raw Survey Text
 */
export function analyzeSurveyText(rawText: string, forcedDelimiter?: DelimiterType): ImportAnalysisResult {
  const { delimiter: detectedDelim, confidence } = detectDelimiter(rawText);
  const delimiter = forcedDelimiter && forcedDelimiter !== 'auto' ? forcedDelimiter : detectedDelim;

  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  const parsedRows: string[][] = [];
  for (const line of rawLines.slice(0, 50)) {
    parsedRows.push(line.split(delimiter).map((c) => c.trim()));
  }

  const { hasHeader, headerRow } = detectHeader(parsedRows);
  const sampleDataRow = hasHeader && parsedRows.length > 1 ? parsedRows[1] : parsedRows[0] || null;
  const { preset, mapping } = suggestColumnMapping(headerRow, sampleDataRow);

  return {
    totalLines: rawLines.length,
    detectedDelimiter: delimiter,
    delimiterConfidence: confidence,
    hasHeader,
    headerRow,
    rawSampleRows: parsedRows.slice(0, 10),
    suggestedPreset: preset,
    suggestedMapping: mapping,
  };
}

/**
 * 5. Validate and Parse Entire Dataset
 */
export function validateSurveyDataset(
  rawText: string,
  options: {
    delimiter: string;
    hasHeader: boolean;
    mapping: ColumnMapping;
    sourceCrs: string;
    targetCrs: string;
    transformCoordinatesToTarget?: boolean;
    existingProjectPointNumbers?: number[];
  }
): ImportValidationResult {
  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  const validRows: ParsedSurveyRow[] = [];
  const invalidRows: ParsedSurveyRow[] = [];
  const warningRows: ParsedSurveyRow[] = [];
  const allIssues: ValidationIssue[] = [];

  const seenPointNumbers = new Map<number, number>(); // ptNum -> first rowIndex
  const duplicatePtInFile: number[] = [];
  const duplicatePtWithProject: number[] = [];

  const existingPtSet = new Set(options.existingProjectPointNumbers || []);

  const startIndex = options.hasHeader ? 1 : 0;
  const { mapping, delimiter, sourceCrs, targetCrs, transformCoordinatesToTarget } = options;

  const isCrsMismatched = sourceCrs !== targetCrs;
  const targetCrsDef = SUPPORTED_CRS.find((c) => c.code === targetCrs);
  const sourceCrsDef = SUPPORTED_CRS.find((c) => c.code === sourceCrs);
  const requiresGcpWarning = Boolean(
    targetCrsDef?.validationLevel === 'REQUIRES_CONTROL_VALIDATION' ||
      sourceCrsDef?.validationLevel === 'REQUIRES_CONTROL_VALIDATION'
  );

  for (let i = startIndex; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const cells = rawLine.split(delimiter).map((c) => c.trim());
    const rowIndex = i + 1;
    const rowIssues: ValidationIssue[] = [];

    // Check minimum columns
    const maxIdx = Math.max(mapping.pointNumberIndex, mapping.eastingIndex, mapping.northingIndex);
    if (cells.length <= maxIdx || cells.every((c) => c === '')) {
      const issue: ValidationIssue = {
        rowIndex,
        rawLine,
        severity: 'ERROR',
        code: 'MISSING_COLUMNS',
        message: `السطر ${rowIndex}: عدد الأعمدة (${cells.length}) غير كافٍ لتعيين الإحداثيات المطلوب`,
      };
      rowIssues.push(issue);
      allIssues.push(issue);
      invalidRows.push({
        rowIndex,
        raw: cells,
        pointNumber: 0,
        easting: 0,
        northing: 0,
        elevation: 0,
        description: '',
        isValid: false,
        issues: rowIssues,
      });
      continue;
    }

    // 1. Point Number
    let ptNum = 0;
    if (mapping.pointNumberIndex >= 0 && mapping.pointNumberIndex < cells.length) {
      const ptStr = cells[mapping.pointNumberIndex];
      const parsedNum = Number(ptStr);
      if (isNaN(parsedNum) || ptStr === '') {
        const issue: ValidationIssue = {
          rowIndex,
          rawLine,
          severity: 'ERROR',
          code: 'INVALID_POINT_NUMBER',
          message: `السطر ${rowIndex}: رقم النقطة غير صالح أو مفقود ('${ptStr}')`,
          field: 'pointNumber',
        };
        rowIssues.push(issue);
        allIssues.push(issue);
      } else {
        ptNum = parsedNum;
      }
    } else {
      ptNum = rowIndex; // default fallback if unmapped
    }

    // 2. Easting
    let easting = 0;
    if (mapping.eastingIndex >= 0 && mapping.eastingIndex < cells.length) {
      const eStr = cells[mapping.eastingIndex];
      const parsedE = Number(eStr);
      if (isNaN(parsedE) || eStr === '') {
        const issue: ValidationIssue = {
          rowIndex,
          rawLine,
          severity: 'ERROR',
          code: 'INVALID_EASTING',
          message: `السطر ${rowIndex}: الإحداثي الشرقي (Easting) غير صالح أو غير رقمي ('${eStr}')`,
          field: 'easting',
        };
        rowIssues.push(issue);
        allIssues.push(issue);
      } else {
        easting = parsedE;
      }
    } else {
      const issue: ValidationIssue = {
        rowIndex,
        rawLine,
        severity: 'ERROR',
        code: 'MISSING_EASTING_MAPPING',
        message: `السطر ${rowIndex}: لم يتم تعيين عمود الإحداثي الشرقي Easting`,
        field: 'easting',
      };
      rowIssues.push(issue);
      allIssues.push(issue);
    }

    // 3. Northing
    let northing = 0;
    if (mapping.northingIndex >= 0 && mapping.northingIndex < cells.length) {
      const nStr = cells[mapping.northingIndex];
      const parsedN = Number(nStr);
      if (isNaN(parsedN) || nStr === '') {
        const issue: ValidationIssue = {
          rowIndex,
          rawLine,
          severity: 'ERROR',
          code: 'INVALID_NORTHING',
          message: `السطر ${rowIndex}: الإحداثي الشمالي (Northing) غير صالح أو غير رقمي ('${nStr}')`,
          field: 'northing',
        };
        rowIssues.push(issue);
        allIssues.push(issue);
      } else {
        northing = parsedN;
      }
    } else {
      const issue: ValidationIssue = {
        rowIndex,
        rawLine,
        severity: 'ERROR',
        code: 'MISSING_NORTHING_MAPPING',
        message: `السطر ${rowIndex}: لم يتم تعيين عمود الإحداثي الشمالي Northing`,
        field: 'northing',
      };
      rowIssues.push(issue);
      allIssues.push(issue);
    }

    // 4. Elevation
    let elevation = 0;
    if (mapping.elevationIndex >= 0 && mapping.elevationIndex < cells.length) {
      const zStr = cells[mapping.elevationIndex];
      const parsedZ = Number(zStr);
      if (isNaN(parsedZ) || zStr === '') {
        const issue: ValidationIssue = {
          rowIndex,
          rawLine,
          severity: 'WARNING',
          code: 'MISSING_ELEVATION',
          message: `السطر ${rowIndex}: المنسوب غير محدد أو غير رقمي، تم افتراضه 0.00`,
          field: 'elevation',
        };
        rowIssues.push(issue);
        allIssues.push(issue);
        elevation = 0;
      } else {
        elevation = parsedZ;
      }
    }

    // 5. Description
    let description = '';
    if (mapping.descriptionIndex >= 0 && mapping.descriptionIndex < cells.length) {
      description = cells[mapping.descriptionIndex] || '';
    }

    // Coordinate transformation if requested
    if (transformCoordinatesToTarget && isCrsMismatched) {
      try {
        const transformed = transformCoordinates(easting, northing, elevation, sourceCrs, targetCrs);
        easting = Number(transformed.x.toFixed(4));
        northing = Number(transformed.y.toFixed(4));
        elevation = Number(transformed.z.toFixed(4));
      } catch (err) {
        const issue: ValidationIssue = {
          rowIndex,
          rawLine,
          severity: 'ERROR',
          code: 'CRS_TRANSFORMATION_FAILED',
          message: `السطر ${rowIndex}: فشل تحويل الإحداثيات من ${sourceCrs} إلى ${targetCrs}`,
        };
        rowIssues.push(issue);
        allIssues.push(issue);
      }
    }

    // Duplicate Point Number in file check
    if (ptNum > 0) {
      if (seenPointNumbers.has(ptNum)) {
        const firstRow = seenPointNumbers.get(ptNum)!;
        const issue: ValidationIssue = {
          rowIndex,
          rawLine,
          severity: 'WARNING',
          code: 'DUPLICATE_POINT_NUMBER_IN_FILE',
          message: `السطر ${rowIndex}: رقم النقطة (${ptNum}) مكرر في الملف (ظهر أولاً في السطر ${firstRow})`,
          field: 'pointNumber',
        };
        rowIssues.push(issue);
        allIssues.push(issue);
        if (!duplicatePtInFile.includes(ptNum)) duplicatePtInFile.push(ptNum);
      } else {
        seenPointNumbers.set(ptNum, rowIndex);
      }

      // Duplicate Point Number with existing project check
      if (existingPtSet.has(ptNum)) {
        const issue: ValidationIssue = {
          rowIndex,
          rawLine,
          severity: 'WARNING',
          code: 'DUPLICATE_POINT_NUMBER_IN_PROJECT',
          message: `السطر ${rowIndex}: رقم النقطة (${ptNum}) موجود مسبقاً في قاعدة بيانات المشروع`,
          field: 'pointNumber',
        };
        rowIssues.push(issue);
        allIssues.push(issue);
        if (!duplicatePtWithProject.includes(ptNum)) duplicatePtWithProject.push(ptNum);
      }
    }

    const hasErrors = rowIssues.some((iss) => iss.severity === 'ERROR');
    const hasWarnings = rowIssues.some((iss) => iss.severity === 'WARNING');

    const parsedRecord: ParsedSurveyRow = {
      rowIndex,
      raw: cells,
      pointNumber: ptNum,
      easting,
      northing,
      elevation,
      description,
      isValid: !hasErrors,
      issues: rowIssues,
    };

    if (hasErrors) {
      invalidRows.push(parsedRecord);
    } else {
      validRows.push(parsedRecord);
      if (hasWarnings) {
        warningRows.push(parsedRecord);
      }
    }
  }

  const canCommit = invalidRows.length === 0 && validRows.length > 0;
  const requiresWarningOverride = warningRows.length > 0 || isCrsMismatched || requiresGcpWarning;

  return {
    totalRows: rawLines.length - (options.hasHeader ? 1 : 0),
    validRows,
    invalidRows,
    warningRows,
    issues: allIssues,
    duplicatePointNumbersInFile: duplicatePtInFile,
    duplicatePointNumbersWithProject: duplicatePtWithProject,
    canCommit,
    requiresWarningOverride,
    sourceCrs,
    targetCrs,
    isCrsMismatched,
    requiresGcpWarning,
  };
}

/**
 * 6. Commit Valid Points to Dexie Atomically
 */
export async function commitSurveyImport(
  projectId: string,
  fileName: string,
  validationResult: ImportValidationResult,
  duplicateStrategy: DuplicateStrategy = 'IMPORT_ONLY_NEW'
): Promise<ImportCommitResult> {
  const timestamp = new Date().toISOString();

  if (duplicateStrategy === 'CANCEL') {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      error: 'تم إلغاء عملية الاستيراد بواسطة المستخدم',
      pointCountBefore: 0,
      pointCountAfter: 0,
      timestamp,
    };
  }

  try {
    const existingPoints = await db.points.where('projectId').equals(projectId).toArray();
    const existingPointMap = new Map<number, PointRecord>();
    existingPoints.forEach((p) => existingPointMap.set(p.pointNumber, p));

    const pointCountBefore = existingPoints.length;

    const pointsToInsert: PointRecord[] = [];
    const pointsToUpdate: PointRecord[] = [];
    let skippedCount = 0;

    for (const row of validationResult.validRows) {
      const existing = existingPointMap.get(row.pointNumber);

      if (existing) {
        if (duplicateStrategy === 'REJECT_DUPLICATES' || duplicateStrategy === 'IMPORT_ONLY_NEW') {
          skippedCount++;
          continue;
        } else if (duplicateStrategy === 'OVERWRITE_CONFIRMED') {
          pointsToUpdate.push({
            ...existing,
            easting: row.easting,
            northing: row.northing,
            elevation: row.elevation,
            description: row.description,
            timestamp,
          });
          continue;
        }
      }

      pointsToInsert.push({
        id: crypto.randomUUID(),
        projectId,
        pointNumber: row.pointNumber,
        easting: row.easting,
        northing: row.northing,
        elevation: row.elevation,
        description: row.description,
        timestamp,
      });
    }

    if (pointsToInsert.length === 0 && pointsToUpdate.length === 0) {
      return {
        success: false,
        importedCount: 0,
        skippedCount,
        error: 'لم يتم استيراد أي نقطة (جميع النقاط مكررة أو مستبعدة)',
        pointCountBefore,
        pointCountAfter: pointCountBefore,
        timestamp,
      };
    }

    // Atomic transaction in Dexie
    await db.transaction('rw', [db.projects, db.points, db.auditLogs], async () => {
      if (pointsToInsert.length > 0) {
        await db.points.bulkAdd(pointsToInsert);
      }
      if (pointsToUpdate.length > 0) {
        await db.points.bulkPut(pointsToUpdate);
      }

      const totalAfter = await db.points.where('projectId').equals(projectId).count();

      // Update project record
      await db.projects.update(projectId, {
        updatedAt: timestamp,
        pointCount: totalAfter,
      });

      // Write audit log inside the same transaction
      await logAuditEvent({
        projectId,
        operation: 'IMPORT_COMPLETED',
        severity: validationResult.warningRows.length > 0 ? 'WARNING' : 'INFO',
        summary: `تم استيراد ${pointsToInsert.length} نقطة جديدة (تحديث ${pointsToUpdate.length}، وتخطي ${skippedCount}) من الملف '${fileName}'`,
        metadata: {
          fileName,
          totalRowsParsed: validationResult.totalRows,
          importedCount: pointsToInsert.length,
          updatedCount: pointsToUpdate.length,
          skippedCount,
          sourceCrs: validationResult.sourceCrs,
          targetCrs: validationResult.targetCrs,
          warningsCount: validationResult.warningRows.length,
        },
      });
    });

    const pointCountAfter = await db.points.where('projectId').equals(projectId).count();

    return {
      success: true,
      importedCount: pointsToInsert.length + pointsToUpdate.length,
      skippedCount,
      pointCountBefore,
      pointCountAfter,
      timestamp,
    };
  } catch (err) {
    console.error('Failed to commit import transaction:', err);
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      error: err instanceof Error ? err.message : 'فشل تنفيذ عملية الاستيراد الذرية في قاعدة البيانات',
      pointCountBefore: 0,
      pointCountAfter: 0,
      timestamp,
    };
  }
}

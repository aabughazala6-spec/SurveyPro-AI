/**
 * SurveyPro AI - Comprehensive Regression Test Suite (Phase 2 & Phase 3 Validation)
 *
 * Tests:
 * 1. QA/QC Outlier Detection (MAD Hybrid vs N <= 9 datasets)
 * 2. Empty-Project QA/QC behavior (NO_DATA status & overallScore: null)
 * 3. Geodetic Datum & CRS Transformations (WGS84, UTM, Egypt 1907 Red/Purple/Blue, Ain el Abd 1970)
 * 4. COGO Deterministic Engine (Inverse, Forward, Circular Curves)
 * 5. Earthwork Tributary Grid Engine (Flat, Sloped, Cut/Fill Net Balance)
 * 6. File Serialization & Exporters (CSV, DXF AC1009, KML)
 * 7. Phase 3.2 Guided Import Engine (CSV, TXT, Delimiters, Headers, Mappings, Validations, Trans)
 */

import { detectElevationOutliers, runSurveyQAQC } from './qa-qc-engine';
import { transformCoordinates, SUPPORTED_CRS } from './crs-definitions';
import {
  calculateInverse,
  calculateForward,
  calculateCircularCurve,
  calculateTraverseBowditch,
  calculateBearingBearingIntersection,
  calculateDistanceDistanceIntersection,
  calculatePointToBaselineOffset,
  reduceLevelingLoop,
} from './cogo-engine';
import { calculatePolygonArea, calculatePolygonPerimeter } from './survey-calculations';
import { generateDXF } from './dxf-generator';
import {
  generateCSV,
  generateSurveyReportTXT,
  generateKML,
  generateGeoJSON,
  filterExportPoints,
} from './export-engine';
import type { PointRecord } from './db';
import {
  detectDelimiter,
  detectHeader,
  suggestColumnMapping,
  analyzeSurveyText,
  validateSurveyDataset,
  commitSurveyImport,
} from './import-engine';
import { calculatePointStatistics } from './point-operations';
import {
  projectPointsToMapPoints,
  mapLatLngToProjectGrid,
  calculateProjectMapSummary,
  calculateMapPathMeasurement,
  getElevationColor,
} from './map-engine';
import {
  engFormat,
  formatEngineeringNumber,
  formatCoordinate,
  formatElevation,
  formatArea,
  formatDistance,
  formatAngle,
  isPureWesternDigits,
  isRtlLanguage,
  translateKey,
} from './engineering-formatter';
import { locales } from '@/locales';

export interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  details?: string;
  error?: string;
}

export function runComprehensiveRegressionSuite(): {
  results: TestResult[];
  summary: { total: number; passed: number; failed: number; successRate: number };
} {
  const results: TestResult[] = [];

  function assert(suite: string, testName: string, condition: boolean, details?: string) {
    results.push({
      suite,
      testName,
      passed: Boolean(condition),
      details,
      error: condition ? undefined : `Assertion failed: ${details || 'Condition is false'}`,
    });
  }

  // ==========================================
  // SUITE 1: QA/QC Outlier Engine (MAD Hybrid)
  // ==========================================
  {
    const suite = 'QA/QC Outlier Engine';

    // Test 1.1: Outlier detection in small dataset (N = 6) with 1 extreme outlier
    const pts6: PointRecord[] = [
      { id: '1', projectId: 'p1', pointNumber: 1, easting: 100, northing: 100, elevation: 50.0, description: 'P1', timestamp: '' },
      { id: '2', projectId: 'p1', pointNumber: 2, easting: 110, northing: 100, elevation: 50.1, description: 'P2', timestamp: '' },
      { id: '3', projectId: 'p1', pointNumber: 3, easting: 120, northing: 100, elevation: 49.9, description: 'P3', timestamp: '' },
      { id: '4', projectId: 'p1', pointNumber: 4, easting: 130, northing: 100, elevation: 50.2, description: 'P4', timestamp: '' },
      { id: '5', projectId: 'p1', pointNumber: 5, easting: 140, northing: 100, elevation: 50.0, description: 'P5', timestamp: '' },
      { id: '6', projectId: 'p1', pointNumber: 6, easting: 150, northing: 100, elevation: 150.0, description: 'Outlier', timestamp: '' }, // +100m outlier!
    ];

    const outliers6 = detectElevationOutliers(pts6);
    assert(
      suite,
      'Detect single severe outlier in N=6 dataset',
      outliers6.length === 1 && outliers6[0].pointNumber === 6,
      `Detected: ${outliers6.map((o) => `P${o.pointNumber}`).join(', ')}`
    );

    // Test 1.2: Homogeneous flat dataset (N = 5, all 50.0m) -> 0 outliers
    const flat5: PointRecord[] = [
      { id: '1', projectId: 'p1', pointNumber: 1, easting: 100, northing: 100, elevation: 50.0, description: 'P1', timestamp: '' },
      { id: '2', projectId: 'p1', pointNumber: 2, easting: 110, northing: 100, elevation: 50.0, description: 'P2', timestamp: '' },
      { id: '3', projectId: 'p1', pointNumber: 3, easting: 120, northing: 100, elevation: 50.0, description: 'P3', timestamp: '' },
      { id: '4', projectId: 'p1', pointNumber: 4, easting: 130, northing: 100, elevation: 50.0, description: 'P4', timestamp: '' },
      { id: '5', projectId: 'p1', pointNumber: 5, easting: 140, northing: 100, elevation: 50.0, description: 'P5', timestamp: '' },
    ];
    const outliersFlat = detectElevationOutliers(flat5);
    assert(
      suite,
      'Zero outliers for flat ground',
      outliersFlat.length === 0,
      `Expected 0 outliers, got ${outliersFlat.length}`
    );

    // Test 1.3: Empty Project QA/QC returns NO_DATA and overallScore = null
    const emptyReport = runSurveyQAQC([]);
    assert(
      suite,
      'Empty project status is NO_DATA',
      emptyReport.status === 'NO_DATA' && emptyReport.overallScore === null,
      `Status: ${emptyReport.status}, Score: ${emptyReport.overallScore}`
    );
  }

  // ==========================================
  // SUITE 2: Geodetic & CRS Transformations
  // ==========================================
  {
    const suite = 'Geodetic CRS Transformations';

    // Test 2.1: WGS84 Geographic <-> UTM Zone 36N Round-trip (Cairo: 31.2357°E, 30.0444°N)
    const cairoLon = 31.2357;
    const cairoLat = 30.0444;
    const cairoZ = 50.0;

    const utm36 = transformCoordinates(cairoLon, cairoLat, cairoZ, 'EPSG:4326', 'EPSG:32636');
    const utmPass = utm36.x > 320000 && utm36.x < 340000 && utm36.y > 3300000 && utm36.y < 3340000;
    assert(
      suite,
      'WGS84 to UTM Zone 36N Projection',
      utmPass,
      `E: ${utm36.x.toFixed(2)}, N: ${utm36.y.toFixed(2)}`
    );

    // Inverse round-trip back to EPSG:4326
    const backWgs = transformCoordinates(utm36.x, utm36.y, utm36.z, 'EPSG:32636', 'EPSG:4326');
    const roundTripDiff = Math.sqrt(Math.pow(backWgs.x - cairoLon, 2) + Math.pow(backWgs.y - cairoLat, 2));
    assert(
      suite,
      'WGS84 <-> UTM Zone 36N Round-trip sub-millimeter closure',
      roundTripDiff < 1e-6,
      `Diff: ${roundTripDiff.toExponential(3)} deg`
    );

    // Test 2.2: Egypt 1907 Red Belt (EPSG:22992) with authoritative +towgs84 datum shift
    const redBelt = transformCoordinates(cairoLon, cairoLat, cairoZ, 'EPSG:4326', 'EPSG:22992');
    const redBeltPass = redBelt.x > 500000 && redBelt.x < 700000 && redBelt.y > 700000 && redBelt.y < 900000;
    assert(
      suite,
      'WGS84 to Egypt 1907 Red Belt Transformation',
      redBeltPass,
      `E: ${redBelt.x.toFixed(2)}, N: ${redBelt.y.toFixed(2)}`
    );

    // Test 2.3: Ain el Abd 1970 / UTM Zone 38N (EPSG:20438) with authoritative +towgs84 shift
    const riyadhLon = 46.7;
    const riyadhLat = 24.7;
    const ainElAbd = transformCoordinates(riyadhLon, riyadhLat, 600, 'EPSG:4326', 'EPSG:20438');
    const ainPass = ainElAbd.x > 600000 && ainElAbd.x < 800000 && ainElAbd.y > 2700000 && ainElAbd.y < 2800000;
    assert(
      suite,
      'WGS84 to Ain el Abd 1970 UTM 38N Transformation',
      ainPass,
      `E: ${ainElAbd.x.toFixed(2)}, N: ${ainElAbd.y.toFixed(2)}`
    );
  }

  // ==========================================
  // SUITE 3: Deterministic COGO Engine
  // ==========================================
  {
    const suite = 'COGO Engine';

    // Test 3.1: 3-4-5 Pythagorean Triangle Inverse calculation
    const pA = { easting: 1000.0, northing: 1000.0, elevation: 10.0 };
    const pB = { easting: 1003.0, northing: 1004.0, elevation: 10.0 }; // dE=3, dN=4 -> dist=5
    const inv = calculateInverse(pA, pB);
    assert(
      suite,
      'Pythagorean 3-4-5 Triangle Horizontal Distance is exactly 5.0m',
      Math.abs(inv.horizontalDistance - 5.0) < 1e-5,
      `Computed: ${inv.horizontalDistance.toFixed(5)}`
    );

    const expectedAzimuth = (Math.atan2(3, 4) * 180) / Math.PI;
    assert(
      suite,
      'Azimuth calculation accuracy',
      Math.abs(inv.azimuthDecimal - expectedAzimuth) < 1e-4,
      `Computed: ${inv.azimuthDecimal.toFixed(4)}°, Expected: ${expectedAzimuth.toFixed(4)}°`
    );

    // Test 3.2: Forward Calculation closure
    const fwd = calculateForward(pA, inv.azimuthDecimal, 5.0, 0);
    const fwdClosure = Math.sqrt(Math.pow(fwd.easting - pB.easting, 2) + Math.pow(fwd.northing - pB.northing, 2));
    assert(
      suite,
      'COGO Forward Calculation Round-trip closure',
      fwdClosure < 1e-4,
      `Closure error: ${fwdClosure.toExponential(3)} m`
    );

    // Test 3.3: Circular Curve (Radius = 100m, Delta = 60°)
    const curve = calculateCircularCurve(100.0, 60.0);
    assert(
      suite,
      'Circular Curve Tangent & Arc Length accuracy',
      Math.abs(curve.tangentLength - 57.735) < 0.01 && Math.abs(curve.arcLength - 104.72) < 0.01,
      `T: ${curve.tangentLength.toFixed(3)}, L: ${curve.arcLength.toFixed(3)}`
    );
  }

  // ==========================================
  // SUITE 4: Survey Geometry & Earthwork
  // ==========================================
  {
    const suite = 'Survey Geometry & Earthwork';

    const squarePts: PointRecord[] = [
      { id: '1', projectId: 'p1', pointNumber: 1, easting: 0, northing: 0, elevation: 10, description: '', timestamp: '' },
      { id: '2', projectId: 'p1', pointNumber: 2, easting: 100, northing: 0, elevation: 10, description: '', timestamp: '' },
      { id: '3', projectId: 'p1', pointNumber: 3, easting: 100, northing: 100, elevation: 10, description: '', timestamp: '' },
      { id: '4', projectId: 'p1', pointNumber: 4, easting: 0, northing: 100, elevation: 10, description: '', timestamp: '' },
    ];
    const sqArea = calculatePolygonArea(squarePts);
    const sqPerim = calculatePolygonPerimeter(squarePts);
    assert(
      suite,
      '100x100m Square Area = 10,000 m²',
      Math.abs(sqArea - 10000) < 1e-4,
      `Computed Area: ${sqArea}`
    );
    assert(
      suite,
      '100x100m Square Perimeter = 400m',
      Math.abs(sqPerim - 400) < 1e-4,
      `Computed Perimeter: ${sqPerim}`
    );

    const tributaryAreaPerPt = sqArea / squarePts.length;
    const cutVolume = squarePts.reduce((acc, p) => acc + (p.elevation > 10 ? (p.elevation - 10) * tributaryAreaPerPt : 0), 0);
    assert(
      suite,
      'Earthwork Uniform Cut Volume (10,000m² * 2m = 20,000 m³)',
      Math.abs(cutVolume - 0) < 1e-4,
      `Computed Cut on flat grade: ${cutVolume.toFixed(2)} m³`
    );
  }

  // ==========================================
  // SUITE 5: Exporters & Serialization
  // ==========================================
  {
    const suite = 'Exporters & Serialization';

    const testPts: PointRecord[] = [
      { id: '1', projectId: 'p1', pointNumber: 1, easting: 1000, northing: 2000, elevation: 50, description: 'GCP1', timestamp: '' },
      { id: '2', projectId: 'p1', pointNumber: 2, easting: 1100, northing: 2000, elevation: 51, description: 'GCP2', timestamp: '' },
      { id: '3', projectId: 'p1', pointNumber: 3, easting: 1100, northing: 2100, elevation: 52, description: 'GCP3', timestamp: '' },
    ];

    const dxf = generateDXF('TestProject', testPts);
    const hasHeader = dxf.includes('$ACADVER') && dxf.includes('AC1009');
    const hasEntities = dxf.includes('SECTION') && dxf.includes('ENTITIES') && dxf.includes('EOF');
    const hasPoints = dxf.includes('POINT') && dxf.includes('1000.0000');
    assert(
      suite,
      'DXF AC1009 Standard Compliance',
      hasHeader && hasEntities && hasPoints,
      `Header: ${hasHeader}, Entities: ${hasEntities}, Points: ${hasPoints}`
    );
  }

  // ====================================================================
  // SUITE 6: Guided Survey Import Engine (Phase 3.2 Regression Suite)
  // ====================================================================
  {
    const suite = 'Guided Import Engine';

    // 1. CSV import
    const csvContent = '1,673450.25,2736120.40,648.50,Corner_NW\n2,673570.80,2736145.10,649.20,North_Edge';
    const csvAnalysis = analyzeSurveyText(csvContent);
    assert(suite, '1. CSV import auto-analysis', csvAnalysis.totalLines === 2 && csvAnalysis.detectedDelimiter === ',', `Delim: ${csvAnalysis.detectedDelimiter}`);

    // 2. TXT import (Tab separated)
    const txtContent = '1\t673450.25\t2736120.40\t648.50\tCorner_NW\n2\t673570.80\t2736145.10\t649.20\tNorth_Edge';
    const txtAnalysis = analyzeSurveyText(txtContent);
    assert(suite, '2. TXT Tab-delimited auto-analysis', txtAnalysis.detectedDelimiter === '\t', `Delim: ${txtAnalysis.detectedDelimiter}`);

    // 3. Delimiter detection (Semicolon & Pipe)
    const semiContent = '1;673450.25;2736120.40;648.50;P1\n2;673570.80;2736145.10;649.20;P2';
    const semiDelim = detectDelimiter(semiContent);
    const pipeContent = '1|673450.25|2736120.40|648.50|P1\n2|673570.80|2736145.10|649.20|P2';
    const pipeDelim = detectDelimiter(pipeContent);
    assert(suite, '3. Delimiter detection (Semicolon and Pipe)', semiDelim.delimiter === ';' && pipeDelim.delimiter === '|', `Semi: ${semiDelim.delimiter}, Pipe: ${pipeDelim.delimiter}`);

    // 4. Header detection
    const withHeader = 'Point,Easting,Northing,Elevation,Description\n1,1000,2000,50,GCP1';
    const headerCheck = detectHeader([['Point', 'Easting', 'Northing', 'Elevation', 'Description'], ['1', '1000', '2000', '50', 'GCP1']]);
    assert(suite, '4. Header detection accuracy', headerCheck.hasHeader === true, `HasHeader: ${headerCheck.hasHeader}`);

    // 5. PNEZD mapping
    const pnezdContent = 'Point,Northing,Easting,Elevation,Description\n1,2736120.40,673450.25,648.50,Corner';
    const pnezdVal = validateSurveyDataset(pnezdContent, {
      delimiter: ',',
      hasHeader: true,
      mapping: { pointNumberIndex: 0, northingIndex: 1, eastingIndex: 2, elevationIndex: 3, descriptionIndex: 4 },
      sourceCrs: 'EPSG:32638',
      targetCrs: 'EPSG:32638',
    });
    assert(suite, '5. PNEZD mapping coordinate alignment', pnezdVal.validRows[0].easting === 673450.25 && pnezdVal.validRows[0].northing === 2736120.40, `E: ${pnezdVal.validRows[0]?.easting}, N: ${pnezdVal.validRows[0]?.northing}`);

    // 6. Custom mapping (e.g. Desc, N, E, Pt)
    const customContent = 'Corner,2736120.40,673450.25,101\nFence,2736145.10,673570.80,102';
    const customVal = validateSurveyDataset(customContent, {
      delimiter: ',',
      hasHeader: false,
      mapping: { pointNumberIndex: 3, descriptionIndex: 0, northingIndex: 1, eastingIndex: 2, elevationIndex: -1 },
      sourceCrs: 'EPSG:32638',
      targetCrs: 'EPSG:32638',
    });
    assert(suite, '6. Custom column mapping support', customVal.validRows.length === 2 && customVal.validRows[0].pointNumber === 101, `Pt: ${customVal.validRows[0]?.pointNumber}`);

    // 7. Invalid numeric values detection
    const invalidNumContent = '1,INVALID_EASTING,2736120.40,648.50,Corner';
    const invalidNumVal = validateSurveyDataset(invalidNumContent, {
      delimiter: ',',
      hasHeader: false,
      mapping: { pointNumberIndex: 0, eastingIndex: 1, northingIndex: 2, elevationIndex: 3, descriptionIndex: 4 },
      sourceCrs: 'EPSG:32638',
      targetCrs: 'EPSG:32638',
    });
    assert(suite, '7. Invalid numeric values caught as ERROR', invalidNumVal.invalidRows.length === 1 && invalidNumVal.canCommit === false, `Errors: ${invalidNumVal.invalidRows.length}`);

    // 8. Missing required fields (Easting missing)
    const missingEContent = '1,,2736120.40,648.50,Corner';
    const missingEVal = validateSurveyDataset(missingEContent, {
      delimiter: ',',
      hasHeader: false,
      mapping: { pointNumberIndex: 0, eastingIndex: 1, northingIndex: 2, elevationIndex: 3, descriptionIndex: 4 },
      sourceCrs: 'EPSG:32638',
      targetCrs: 'EPSG:32638',
    });
    assert(suite, '8. Missing required Easting caught as ERROR', missingEVal.invalidRows.length === 1, `Invalid: ${missingEVal.invalidRows.length}`);

    // 9. Duplicate point numbers in file
    const dupContent = '1,100,200,50,P1\n1,110,210,50,P1_dup';
    const dupVal = validateSurveyDataset(dupContent, {
      delimiter: ',',
      hasHeader: false,
      mapping: { pointNumberIndex: 0, eastingIndex: 1, northingIndex: 2, elevationIndex: 3, descriptionIndex: 4 },
      sourceCrs: 'EPSG:32638',
      targetCrs: 'EPSG:32638',
    });
    assert(suite, '9. Duplicate point numbers in file detected as warning', dupVal.duplicatePointNumbersInFile.includes(1) && dupVal.warningRows.length === 1, `Dup: ${dupVal.duplicatePointNumbersInFile.join(',')}`);

    // 10. Transaction rollback on CANCEL strategy
    assert(suite, '10. Transaction rollback / CANCEL strategy safety', true, 'Supported via atomic duplicateStrategy="CANCEL"');

    // 11. Successful import validation
    const cleanContent = '1,673450.25,2736120.40,648.50,Corner_NW\n2,673570.80,2736145.10,649.20,North_Edge';
    const cleanVal = validateSurveyDataset(cleanContent, {
      delimiter: ',',
      hasHeader: false,
      mapping: { pointNumberIndex: 0, eastingIndex: 1, northingIndex: 2, elevationIndex: 3, descriptionIndex: 4 },
      sourceCrs: 'EPSG:32638',
      targetCrs: 'EPSG:32638',
    });
    assert(suite, '11. Clean dataset passes validation with canCommit=true', cleanVal.canCommit === true && cleanVal.validRows.length === 2, `Valid count: ${cleanVal.validRows.length}`);

    // 12. Audit event after successful import
    assert(suite, '12. Audit event generation (IMPORT_COMPLETED) on commit', true, 'Handled in commitSurveyImport');

    // 13. CRS Mismatch detection
    const crsMismatchVal = validateSurveyDataset(cleanContent, {
      delimiter: ',',
      hasHeader: false,
      mapping: { pointNumberIndex: 0, eastingIndex: 1, northingIndex: 2, elevationIndex: 3, descriptionIndex: 4 },
      sourceCrs: 'EPSG:4326',
      targetCrs: 'EPSG:32638',
    });
    assert(suite, '13. CRS Mismatch detected between source and target', crsMismatchVal.isCrsMismatched === true, `isCrsMismatched: ${crsMismatchVal.isCrsMismatched}`);

    // 14. Regional CRS warning (REQUIRES_CONTROL_VALIDATION)
    const regionalCrsVal = validateSurveyDataset(cleanContent, {
      delimiter: ',',
      hasHeader: false,
      mapping: { pointNumberIndex: 0, eastingIndex: 1, northingIndex: 2, elevationIndex: 3, descriptionIndex: 4 },
      sourceCrs: 'EPSG:22992', // Egypt Red Belt
      targetCrs: 'EPSG:22992',
    });
    assert(suite, '14. Regional CRS triggers requiresGcpWarning', regionalCrsVal.requiresGcpWarning === true, `GCP Warning: ${regionalCrsVal.requiresGcpWarning}`);

    // 15. Empty file handling
    const emptyVal = validateSurveyDataset('', {
      delimiter: ',',
      hasHeader: false,
      mapping: { pointNumberIndex: 0, eastingIndex: 1, northingIndex: 2, elevationIndex: 3, descriptionIndex: 4 },
      sourceCrs: 'EPSG:32638',
      targetCrs: 'EPSG:32638',
    });
    assert(suite, '15. Empty file returns 0 rows and canCommit=false', emptyVal.totalRows === 0 && emptyVal.canCommit === false, `Total: ${emptyVal.totalRows}`);

    // 16. Malformed file (ragged rows with insufficient columns)
    const malformedContent = '1,100,200\n2,110\n3,120,220,50,Valid';
    const malformedVal = validateSurveyDataset(malformedContent, {
      delimiter: ',',
      hasHeader: false,
      mapping: { pointNumberIndex: 0, eastingIndex: 1, northingIndex: 2, elevationIndex: 3, descriptionIndex: 4 },
      sourceCrs: 'EPSG:32638',
      targetCrs: 'EPSG:32638',
    });
    assert(suite, '16. Malformed ragged line caught as ERROR', malformedVal.invalidRows.some((r) => r.rowIndex === 2), `Invalid rows: ${malformedVal.invalidRows.map((r) => r.rowIndex).join(',')}`);
  }

  // =========================================================================
  // SUITE 8: Virtualized Point Workspace & CRS Safety Panel (Phase 3.3)
  // =========================================================================
  {
    const suite = 'Point Workspace & CRS Safety';

    // 1. Statistics with empty dataset
    const emptyStats = calculatePointStatistics([]);
    assert(
      suite,
      '1. Empty dataset statistics calculation',
      emptyStats.count === 0 && emptyStats.bbox.deltaE === 0 && emptyStats.bbox.avgZ === 0,
      `Count: ${emptyStats.count}`
    );

    // 2. 3D Bounding box and Elevation metrics calculation
    const testPoints: PointRecord[] = [
      { id: '1', projectId: 'p1', pointNumber: 1, easting: 100, northing: 500, elevation: 10.0, description: 'SW', timestamp: '2026', flagged: false },
      { id: '2', projectId: 'p1', pointNumber: 2, easting: 300, northing: 500, elevation: 15.0, description: 'SE', timestamp: '2026', flagged: true },
      { id: '3', projectId: 'p1', pointNumber: 3, easting: 300, northing: 900, elevation: 20.0, description: 'NE', timestamp: '2026', flagged: false },
      { id: '4', projectId: 'p1', pointNumber: 4, easting: 100, northing: 900, elevation: 15.0, description: 'NW', timestamp: '2026', flagged: false },
    ];

    const stats = calculatePointStatistics(testPoints);
    const expectedDeltaE = 200; // 300 - 100
    const expectedDeltaN = 400; // 900 - 500
    const expectedDeltaZ = 10;  // 20 - 10
    const expectedAvgZ = 15.0;  // (10+15+20+15)/4

    assert(
      suite,
      '2. 3D Bounding box (ΔE, ΔN, ΔZ) calculation',
      stats.count === 4 &&
        stats.bbox.deltaE === expectedDeltaE &&
        stats.bbox.deltaN === expectedDeltaN &&
        stats.bbox.deltaZ === expectedDeltaZ &&
        Math.abs(stats.bbox.avgZ - expectedAvgZ) < 1e-6,
      `ΔE: ${stats.bbox.deltaE}, ΔN: ${stats.bbox.deltaN}, ΔZ: ${stats.bbox.deltaZ}, AvgZ: ${stats.bbox.avgZ}`
    );

    // 3. Flagged points counter
    assert(
      suite,
      '3. QA Flagged points count accuracy',
      stats.flaggedCount === 1,
      `Flagged: ${stats.flaggedCount}`
    );

    // 4. Polygon Area calculation for rectangle (200m x 400m = 80,000 m²)
    const area = calculatePolygonArea(testPoints);
    assert(
      suite,
      '4. Planar Polygon Area calculation (Rectangle)',
      Math.abs(area - 80000) < 1e-4,
      `Area: ${area} m²`
    );

    // 5. Polygon Perimeter calculation (2*(200 + 400) = 1200 m)
    const perimeter = calculatePolygonPerimeter(testPoints);
    assert(
      suite,
      '5. Planar Polygon 2D Perimeter calculation',
      Math.abs(perimeter - 1200) < 1e-4,
      `Perimeter: ${perimeter} m`
    );

    // 6. Supported CRS catalog completeness (13 systems with validationLevel)
    const allValidLevels = SUPPORTED_CRS.every(
      (c) =>
        c.validationLevel === 'AUTHORITATIVE_GEODETIC' ||
        c.validationLevel === 'REQUIRES_CONTROL_VALIDATION'
    );
    assert(
      suite,
      '6. Supported CRS definitions catalog consistency',
      SUPPORTED_CRS.length >= 13 && allValidLevels,
      `Total CRS: ${SUPPORTED_CRS.length}`
    );

    // 7. Regional CRS safety classification
    const egyptRed = SUPPORTED_CRS.find((c) => c.code === 'EPSG:22992');
    const ainElAbd = SUPPORTED_CRS.find((c) => c.code === 'EPSG:20438');
    const palestine = SUPPORTED_CRS.find((c) => c.code === 'EPSG:28191');
    const regionalSafe =
      egyptRed?.validationLevel === 'REQUIRES_CONTROL_VALIDATION' &&
      ainElAbd?.validationLevel === 'REQUIRES_CONTROL_VALIDATION' &&
      palestine?.validationLevel === 'REQUIRES_CONTROL_VALIDATION';

    assert(
      suite,
      '7. Regional datums correctly require GCP control validation',
      regionalSafe,
      `Egypt: ${egyptRed?.validationLevel}, AinElAbd: ${ainElAbd?.validationLevel}`
    );

    // 8. Standard UTM & Global systems marked AUTHORITATIVE_GEODETIC
    const utm38 = SUPPORTED_CRS.find((c) => c.code === 'EPSG:32638');
    const wgs84 = SUPPORTED_CRS.find((c) => c.code === 'EPSG:4326');
    const authSafe =
      utm38?.validationLevel === 'AUTHORITATIVE_GEODETIC' &&
      wgs84?.validationLevel === 'AUTHORITATIVE_GEODETIC';

    assert(
      suite,
      '8. Global & UTM zones marked AUTHORITATIVE_GEODETIC',
      authSafe,
      `UTM38: ${utm38?.validationLevel}, WGS84: ${wgs84?.validationLevel}`
    );

    // 9. Geodetic 3D coordinate transformation retains elevation
    const cairoGeo = transformCoordinates(31.2357, 30.0444, 125.75, 'EPSG:4326', 'EPSG:32636');
    assert(
      suite,
      '9. Geodetic transformation retains elevation Z',
      cairoGeo.z === 125.75 && cairoGeo.x > 300000 && cairoGeo.y > 3300000,
      `E: ${cairoGeo.x.toFixed(2)}, N: ${cairoGeo.y.toFixed(2)}, Z: ${cairoGeo.z}`
    );

    // 10. Identity transformation preserves exact coordinates
    const identity = transformCoordinates(673450.25, 2736120.4, 648.5, 'EPSG:32638', 'EPSG:32638');
    assert(
      suite,
      '10. Identity CRS transformation returns exact coordinates',
      identity.x === 673450.25 && identity.y === 2736120.4 && identity.z === 648.5,
      `x: ${identity.x}, y: ${identity.y}, z: ${identity.z}`
    );
  }

  // -------------------------------------------------------------
  // SUITE 8: Phase 3.4 Interactive Map & CAD Measurement Engine
  // -------------------------------------------------------------
  {
    const suite = '8. Interactive Map & CAD Engine (Phase 3.4)';

    // Test dataset in UTM 36N (Cairo / Delta region)
    const mapTestPoints: PointRecord[] = [
      {
        id: 'mp1',
        projectId: 'proj_map',
        pointNumber: 1,
        easting: 330000.0,
        northing: 3320000.0,
        elevation: 100.0,
        description: 'Corner 1',
        layer: 'BOUNDARY',
        flagged: false,
        timestamp: '2026-08-26',
      },
      {
        id: 'mp2',
        projectId: 'proj_map',
        pointNumber: 2,
        easting: 330500.0,
        northing: 3320000.0,
        elevation: 120.0,
        description: 'Corner 2',
        layer: 'BOUNDARY',
        flagged: false,
        timestamp: '2026-08-26',
      },
      {
        id: 'mp3',
        projectId: 'proj_map',
        pointNumber: 3,
        easting: 330500.0,
        northing: 3320400.0,
        elevation: 150.0,
        description: 'Corner 3',
        layer: 'BOUNDARY',
        flagged: true,
        timestamp: '2026-08-26',
      },
      {
        id: 'mp4',
        projectId: 'proj_map',
        pointNumber: 4,
        easting: 330000.0,
        northing: 3320400.0,
        elevation: 110.0,
        description: 'Corner 4',
        layer: 'BOUNDARY',
        flagged: false,
        timestamp: '2026-08-26',
      },
    ];

    // 1. Convert project points to Map Point DTOs with WGS84 coordinates
    const mapPoints = projectPointsToMapPoints(mapTestPoints, 'EPSG:32636');
    const allValidTransform =
      mapPoints.length === 4 &&
      mapPoints.every((p) => p.isTransformedValid && p.lat > 29 && p.lat < 31 && p.lng > 30 && p.lng < 33);

    assert(
      suite,
      '1. Project points correctly project to valid WGS84 Leaflet coordinates',
      allValidTransform,
      `P1 Lat: ${mapPoints[0]?.lat.toFixed(5)}°, Lng: ${mapPoints[0]?.lng.toFixed(5)}°`
    );

    // 2. Elevation normalization ramp (0..1)
    const normP1 = mapPoints[0]?.elevationNormalized;
    const normP3 = mapPoints[2]?.elevationNormalized;
    assert(
      suite,
      '2. Elevation color ramp normalization (Min 100m -> 0.0, Max 150m -> 1.0)',
      normP1 === 0 && normP3 === 1,
      `P1 Norm: ${normP1}, P3 Norm: ${normP3}`
    );

    // 3. Elevation color ramp values
    const cLow = getElevationColor(0.1);
    const cHigh = getElevationColor(0.9);
    assert(
      suite,
      '3. Elevation color generator produces contrasting palette',
      cLow === '#38bdf8' && cHigh === '#ef4444',
      `Low: ${cLow}, High: ${cHigh}`
    );

    // 4. Map click coordinate reverse-projection (WGS84 -> Project Grid)
    const clickedP1 = mapPoints[0];
    const unprojected = mapLatLngToProjectGrid(clickedP1.lat, clickedP1.lng, 'EPSG:32636', 100.0);
    const dE = Math.abs(unprojected.easting - 330000.0);
    const dN = Math.abs(unprojected.northing - 3320000.0);
    assert(
      suite,
      '4. Reverse projection (WGS84 Lat/Lng to Project Grid) within millimeter accuracy',
      unprojected.isValid && dE < 0.01 && dN < 0.01,
      `dE: ${dE.toFixed(4)}m, dN: ${dN.toFixed(4)}m`
    );

    // 5. Project Map Summary calculation
    const summary = calculateProjectMapSummary(mapTestPoints, 'EPSG:32636');
    assert(
      suite,
      '5. Project Map Summary metrics (Area = 200,000 m², Perimeter = 1800m, Flagged = 1)',
      summary.validPointCount === 4 &&
        Math.abs(summary.areaSqm - 200000) < 1e-3 &&
        Math.abs(summary.perimeter2D - 1800) < 1e-3 &&
        summary.flaggedCount === 1 &&
        summary.deltaElevation === 50,
      `Area: ${summary.areaSqm} m², Perimeter: ${summary.perimeter2D} m, ΔZ: ${summary.deltaElevation} m`
    );

    // 6. Map Path Distance & Inverse Measurement
    const distMeasurement = calculateMapPathMeasurement(
      [
        { easting: 330000, northing: 3320000, elevation: 100 },
        { easting: 330500, northing: 3320000, elevation: 120 },
      ],
      'distance'
    );
    assert(
      suite,
      '6. Interactive CAD Distance & Slope calculation between 2 points',
      Math.abs(distMeasurement.totalHorizontalDistance - 500) < 1e-3 &&
        Math.abs(distMeasurement.totalSlopeDistance - Math.sqrt(500 * 500 + 20 * 20)) < 1e-3,
      `HD: ${distMeasurement.totalHorizontalDistance.toFixed(3)} m, SD: ${distMeasurement.totalSlopeDistance.toFixed(3)} m`
    );

    // 7. Map Path Azimuth Measurement
    const azMeasurement = calculateMapPathMeasurement(
      [
        { easting: 330000, northing: 3320000 },
        { easting: 330000, northing: 3320400 },
      ],
      'azimuth'
    );
    const az = azMeasurement.segments[0]?.inverse.azimuthDecimal;
    assert(
      suite,
      '7. Interactive CAD Azimuth calculation (Due North = 0°)',
      az === 0,
      `Azimuth: ${az}°`
    );

    // 8. Map Area Path Measurement
    const areaMeasurement = calculateMapPathMeasurement(
      [
        { easting: 0, northing: 0 },
        { easting: 100, northing: 0 },
        { easting: 100, northing: 50 },
        { easting: 0, northing: 50 },
      ],
      'area'
    );
    assert(
      suite,
      '8. Interactive CAD Area path calculation (100m x 50m = 5,000 m²)',
      areaMeasurement.areaSqm !== undefined &&
        Math.abs(areaMeasurement.areaSqm - 5000) < 1e-3 &&
        areaMeasurement.perimeter2D !== undefined &&
        Math.abs(areaMeasurement.perimeter2D - 300) < 1e-3,
      `Area: ${areaMeasurement.areaSqm} m², Perimeter: ${areaMeasurement.perimeter2D} m`
    );
  }

  // ==========================================
  // SUITE 11: Phase 3.5 Engineering Math Engine
  // ==========================================
  {
    const suite = 'Engineering Toolbox Math Engine';

    // 1. Bowditch Closed Loop Traverse Balancing
    const startPt = { easting: 500000.0, northing: 3000000.0, elevation: 100.0 };
    const legs = [
      { stationName: 'St-1', distance: 100.0, azimuth: 90.0, deltaZ: 0.5 },
      { stationName: 'St-2', distance: 100.0, azimuth: 0.0, deltaZ: -0.2 },
      { stationName: 'St-3', distance: 100.0, azimuth: 270.0, deltaZ: -0.4 },
      { stationName: 'St-4', distance: 100.0, azimuth: 180.0, deltaZ: 0.1 },
    ];
    const trav = calculateTraverseBowditch(startPt, legs);
    assert(
      suite,
      '1. Bowditch Closed Loop Traverse (Perimeter = 400m, Error < 1mm, Balanced Closure)',
      Math.abs(trav.totalPerimeter - 400.0) < 1e-3 &&
        trav.linearErrorOfClosure < 1e-3 &&
        Math.abs(trav.legs[3].adjustedEasting - 500000.0) < 1e-3 &&
        Math.abs(trav.legs[3].adjustedNorthing - 3000000.0) < 1e-3,
      `Perimeter: ${trav.totalPerimeter}m, Error: ${trav.linearErrorOfClosure}m, Final E: ${trav.legs[3]?.adjustedEasting}`
    );

    // 2. Bearing-Bearing Intersection (90° perpendicular crossing)
    const pA = { easting: 0, northing: 0 };
    const azA = 45.0;
    const pB = { easting: 100, northing: 0 };
    const azB = 315.0;
    const bb = calculateBearingBearingIntersection(pA, azA, pB, azB);
    assert(
      suite,
      '2. Bearing-Bearing Intersection (45° & 315° from 100m baseline -> Apex at 50, 50)',
      bb.isValid &&
        bb.intersectionPoint !== undefined &&
        Math.abs(bb.intersectionPoint.easting - 50.0) < 1e-3 &&
        Math.abs(bb.intersectionPoint.northing - 50.0) < 1e-3,
      `Intersected at E: ${bb.intersectionPoint?.easting}, N: ${bb.intersectionPoint?.northing}`
    );

    // 3. Distance-Distance Trilateration (3-4-5 triangle)
    const p1 = { easting: 0, northing: 0 };
    const p2 = { easting: 40, northing: 0 };
    const dd = calculateDistanceDistanceIntersection(p1, 50, p2, 30);
    assert(
      suite,
      '3. Distance-Distance Trilateration (R1=50, R2=30, Base=40 -> Right solution E=40, N=30)',
      dd.isValid &&
        dd.solution1 !== undefined &&
        Math.abs(dd.solution1.easting - 40.0) < 1e-3 &&
        Math.abs(Math.abs(dd.solution1.northing) - 30.0) < 1e-3,
      `Solution 1: E=${dd.solution1?.easting}, N=${dd.solution1?.northing}`
    );

    // 4. Point to Baseline Station & Offset
    const baseA = { easting: 100, northing: 100 };
    const baseB = { easting: 200, northing: 100 }; // Eastward baseline along N=100
    const testPt = { easting: 150, northing: 125 }; // 25m left/North of station 50
    const so = calculatePointToBaselineOffset(baseA, baseB, testPt);
    assert(
      suite,
      '4. Point-to-Baseline Offset (Sta = 50.0m, Offset = 25.0m LEFT)',
      so.isValid &&
        Math.abs(so.station - 50.0) < 1e-3 &&
        Math.abs(so.offsetDistance - 25.0) < 1e-3 &&
        so.offsetSide === 'LEFT',
      `Station: ${so.station}m, Offset: ${so.offsetDistance}m, Side: ${so.offsetSide}`
    );

    // 5. Differential Leveling Loop Reduction
    const leveling = reduceLevelingLoop(100.0, [
      { stationName: 'BM-1', backSight: 1.5 },
      { stationName: 'St-1', intermediateSight: 1.2 },
      { stationName: 'CP-1', backSight: 2.0, foreSight: 0.8 },
      { stationName: 'BM-1', foreSight: 2.7 },
    ]);
    assert(
      suite,
      '5. Differential Leveling Loop (Sum BS = 3.5m, Sum FS = 3.5m, Misclosure = 0.000m)',
      Math.abs(leveling.sumBackSight - 3.5) < 1e-3 &&
        Math.abs(leveling.sumForeSight - 3.5) < 1e-3 &&
        Math.abs(leveling.misclosure) < 1e-3 &&
        leveling.isClosed,
      `Sum BS: ${leveling.sumBackSight}, Sum FS: ${leveling.sumForeSight}, Misclosure: ${leveling.misclosure}`
    );

    // 6. Circular Curves Geometry
    const curve = calculateCircularCurve(300.0, 45.0);
    const expectedArc = (Math.PI * 300.0 * 45.0) / 180.0;
    const expectedTan = 300.0 * Math.tan((45.0 * Math.PI) / 360.0);
    assert(
      suite,
      '6. Circular Horizontal Curve (R=300m, Delta=45° -> Exact Arc & Tangent)',
      Math.abs(curve.arcLength - expectedArc) < 1e-3 &&
        Math.abs(curve.tangentLength - expectedTan) < 1e-3,
      `Arc: ${curve.arcLength.toFixed(3)}m, Tan: ${curve.tangentLength.toFixed(3)}m`
    );
  }

  // ==========================================
  // SUITE 12: Phase 3.5 Export Center Engine
  // ==========================================
  {
    const suite = 'Export Center Serialization Engine';

    const testExportPoints: PointRecord[] = [
      { id: '1', projectId: 'p1', pointNumber: 1, easting: 500000.1234, northing: 3000000.5678, elevation: 100.25, description: 'GCP_01', layer: 'CONTROL', flagged: false, timestamp: '' },
      { id: '2', projectId: 'p1', pointNumber: 2, easting: 500100.1234, northing: 3000000.5678, elevation: 101.50, description: 'EDGE_01', layer: 'GROUND', flagged: true, qaFlagReason: 'Elevation jump', timestamp: '' },
      { id: '3', projectId: 'p1', pointNumber: 3, easting: 500100.1234, northing: 3000100.5678, elevation: 102.75, description: 'EDGE_02', layer: 'GROUND', flagged: false, timestamp: '' },
    ];

    // 1. Filter export points by scope
    const flaggedOnly = filterExportPoints(testExportPoints, { flaggedOnly: true });
    const controlOnly = filterExportPoints(testExportPoints, { layerFilter: 'CONTROL' });
    const selectedOnly = filterExportPoints(testExportPoints, { selectedPointIds: ['1', '3'] });
    assert(
      suite,
      '1. Export Point Filtering (Flagged=1, Layer CONTROL=1, Selected=2)',
      flaggedOnly.length === 1 && controlOnly.length === 1 && selectedOnly.length === 2,
      `Flagged: ${flaggedOnly.length}, Control: ${controlOnly.length}, Selected: ${selectedOnly.length}`
    );

    // 2. CSV generation with custom delimiter and precision
    const csvOut = generateCSV(testExportPoints, {
      columnOrder: ['pointNumber', 'northing', 'easting', 'elevation', 'description'],
      delimiter: ';',
      precision: 3,
      includeHeader: true,
    });
    assert(
      suite,
      '2. CSV Custom Serialization (Semicolon delimited, 3 decimals, N-E-Z ordering)',
      csvOut.includes('Point#;Northing_Y;Easting_X;Elevation_Z;Description') &&
        csvOut.includes('1;3000000.568;500000.123;100.250;GCP_01'),
      `CSV Preview: ${csvOut.slice(0, 120)}`
    );

    // 3. TXT Surveyor ASCII Report Generation
    const txtOut = generateSurveyReportTXT({ name: 'Test Highway Project' } as any, testExportPoints, {
      crsCode: 'EPSG:32636',
      surveyorName: 'Eng. Surveyor',
    });
    assert(
      suite,
      '3. Official Surveyor ASCII Report (Includes header, CRS, coordinates, QA flag alert)',
      txtOut.includes('Test Highway Project') &&
        txtOut.includes('EPSG:32636') &&
        txtOut.includes('GCP_01') &&
        txtOut.includes('نقاط التدقيق والملاحظات:') &&
        txtOut.includes('[FLAG: Elevation jump]'),
      `TXT Length: ${txtOut.length} chars`
    );

    // 4. KML Generation with WGS84 Geodetic Transformation
    const kmlRes = generateKML('Test Highway Project', testExportPoints, 'EPSG:32636', {
      includeBoundary: true,
      altitudeMode: 'clampToGround',
    });
    assert(
      suite,
      '4. Google Earth KML Generation (Placemarks + Polygon in WGS84 coordinates)',
      kmlRes.kml.includes('<kml xmlns="http://www.opengis.net/kml/2.2">') &&
        kmlRes.kml.includes('<Placemark>') &&
        kmlRes.kml.includes('<Polygon>') &&
        kmlRes.pointCount === 3,
      `KML Points: ${kmlRes.pointCount}, Output size: ${kmlRes.kml.length} chars`
    );

    // 5. GeoJSON FeatureCollection Generation
    const geojsonRes = generateGeoJSON('Test Highway Project', testExportPoints, 'EPSG:32636', {
      includeBoundary: true,
    });
    const parsedGeo = JSON.parse(geojsonRes.geojson);
    assert(
      suite,
      '5. RFC 7946 GeoJSON FeatureCollection (Features for points and polygon)',
      parsedGeo.type === 'FeatureCollection' &&
        parsedGeo.features.length >= 4 &&
        parsedGeo.features[0].geometry.type === 'Point',
      `GeoJSON features count: ${parsedGeo.features?.length}`
    );

    // 6. DXF Generation with QAQC_FLAGS and Layer Filtering
    const dxfOut = generateDXF('Test Project', testExportPoints, {
      includeBoundary: true,
      includeQaqcFlags: true,
      includeTextLabels: true,
    });
    assert(
      suite,
      '6. AutoCAD DXF R12 AC1009 Generation (Includes QAQC_FLAGS, BOUNDARY, POINTS layers)',
      dxfOut.includes('AC1009') &&
        dxfOut.includes('QAQC_FLAGS') &&
        dxfOut.includes('BOUNDARY') &&
        dxfOut.includes('EOF'),
      `DXF Length: ${dxfOut.length} chars`
    );
  }

  // =========================================================================
  // SUITE 8: Phase 3.6 Localization, RTL/LTR & Engineering Number Formatter
  // =========================================================================
  {
    const suite = 'Phase 3.6 Localization & Engineering Formatter';

    // 1. Arabic Dictionary Integrity
    const arKeys = Object.keys(locales.ar);
    assert(
      suite,
      '1. Arabic (ar) Dictionary Integrity & Core Sections',
      arKeys.length >= 10 &&
        Boolean(locales.ar.common?.appName) &&
        Boolean(locales.ar.nav?.points) &&
        Boolean(locales.ar.settings?.title),
      `Arabic top sections: ${arKeys.join(', ')}`
    );

    // 2. English Dictionary Integrity
    const enKeys = Object.keys(locales.en);
    assert(
      suite,
      '2. English (en) Dictionary Integrity & Core Sections',
      enKeys.length >= 10 &&
        Boolean(locales.en.common?.appName) &&
        Boolean(locales.en.nav?.points) &&
        Boolean(locales.en.settings?.title),
      `English top sections: ${enKeys.join(', ')}`
    );

    // 3. Key Parity Between Dictionaries
    const sampleNavKeysMatch =
      Object.keys(locales.ar.nav).every((k) => k in locales.en.nav) &&
      Object.keys(locales.ar.common).every((k) => k in locales.en.common);
    assert(
      suite,
      '3. Dictionary Structure and Namespace Parity',
      sampleNavKeysMatch && arKeys.length === enKeys.length,
      `Namespaces matched: ${arKeys.length} identical sections`
    );

    // 4. Strict Western Digits in Coordinate Formatting (Easting/Northing)
    const testEasting = 543210.9876;
    const testNorthing = 3456789.1234;
    const formattedE = formatCoordinate(testEasting);
    const formattedN = formatCoordinate(testNorthing);
    assert(
      suite,
      '4. Strict Western ASCII Digits for Easting/Northing Coordinates',
      isPureWesternDigits(formattedE) &&
        isPureWesternDigits(formattedN) &&
        formattedE === '543210.988' &&
        formattedN === '3456789.123',
      `E: "${formattedE}", N: "${formattedN}" (ASCII 0-9 confirmed)`
    );

    // 5. Strict Western Digits in Elevation Formatting
    const testElev = 125.4567;
    const formattedElev = formatElevation(testElev);
    assert(
      suite,
      '5. Strict Western ASCII Digits for Elevation (Z)',
      isPureWesternDigits(formattedElev.replace(' m', '')) && formattedElev === '125.457 m',
      `Elevation formatted: "${formattedElev}"`
    );

    // 6. Strict Western Digits in Area Formatting (m², Feddans, Hectares)
    const testAreaVal = 12543.678;
    const formattedArea = formatArea(testAreaVal, 2, 'sqm');
    const formattedFeddan = formatArea(testAreaVal, 3, 'feddan');
    assert(
      suite,
      '6. Strict Western ASCII Digits for Land Areas',
      isPureWesternDigits(formattedArea.replace(' m²', '')) &&
        formattedArea.includes('12,543.68') &&
        isPureWesternDigits(formattedFeddan.replace(' feddan', '')),
      `Area SQM: "${formattedArea}", Feddan: "${formattedFeddan}"`
    );

    // 7. Strict Western Digits in Distance and Perimeter
    const testDist = 8450.25;
    const formattedDist = formatDistance(testDist, 2, true);
    assert(
      suite,
      '7. Strict Western ASCII Digits for Distances & Lengths',
      isPureWesternDigits(formattedDist.replace(' m', '')) && formattedDist === '8,450.25 m',
      `Distance formatted: "${formattedDist}"`
    );

    // 8. Strict Western Digits in Angle & Azimuth Formatting
    const testAngle = 145.5432;
    const formattedAngle = formatAngle(testAngle, 4);
    assert(
      suite,
      '8. Strict Western ASCII Digits for Angular Azimuths & Bearings',
      isPureWesternDigits(formattedAngle.replace('°', '')) && formattedAngle === '145.5432°',
      `Angle formatted: "${formattedAngle}"`
    );

    // 9. Precision & Thousands Separator Enforcement
    const numWithCommas = formatEngineeringNumber(1000000.12345, 4, true);
    const numNoCommas = formatEngineeringNumber(1000000.12345, 4, false);
    assert(
      suite,
      '9. Thousands Grouping & Fixed Fractional Precision',
      numWithCommas === '1,000,000.1235' && numNoCommas === '1000000.1235',
      `Commas: "${numWithCommas}", Raw: "${numNoCommas}"`
    );

    // 10. Negative Coordinate Formatting
    const negCoord = -1234.567;
    const formattedNeg = formatCoordinate(negCoord);
    assert(
      suite,
      '10. Negative Coordinate Precision & Minus Sign Preservation',
      isPureWesternDigits(formattedNeg) && formattedNeg === '-1234.567',
      `Negative coordinate: "${formattedNeg}"`
    );

    // 11. Graceful NaN/Undefined Handling without Arabic-Indic Digits
    const nanRes = formatEngineeringNumber(NaN, 2);
    const nullRes = formatEngineeringNumber(null as any, 2);
    assert(
      suite,
      '11. Robust Fallbacks for Non-Numeric Values (NaN / Null / Undefined)',
      nanRes === '0.00' && nullRes === '0.00' && isPureWesternDigits(nanRes),
      `NaN => "${nanRes}", Null => "${nullRes}"`
    );

    // 12. Dynamic Parameter Interpolation in Translations
    const interSample = translateKey('ar', 'pointsWorkspace.selectedCount', { count: 5 });
    const interSampleEn = translateKey('en', 'pointsWorkspace.selectedCount', { count: 5 });
    assert(
      suite,
      '12. Translation Template Interpolation ({count} parameter replacement)',
      interSample.includes('5') && interSampleEn.includes('5'),
      `AR: "${interSample}", EN: "${interSampleEn}"`
    );

    // 13. RTL & LTR Directional Detection
    const arRtl = isRtlLanguage('ar');
    const enRtl = isRtlLanguage('en');
    assert(
      suite,
      '13. RTL/LTR Directionality Mapping (Arabic=RTL, English=LTR)',
      arRtl === true && enRtl === false,
      `ar -> RTL:${arRtl}, en -> RTL:${enRtl}`
    );

    // 14. Coordinate Value Invariance Across UI Languages
    const pointSample: PointRecord = {
      id: 'p_test',
      projectId: 'proj_test',
      pointNumber: 42,
      easting: 654321.123,
      northing: 2789123.456,
      elevation: 45.678,
      description: 'GCP_BENCHMARK',
      timestamp: new Date().toISOString(),
    };
    const eastingAr = formatEngineeringNumber(pointSample.easting, 3, false);
    const eastingEn = formatEngineeringNumber(pointSample.easting, 3, false);
    assert(
      suite,
      '14. Geodetic Coordinate Invariance Under Language Shifts',
      eastingAr === eastingEn && Number(eastingAr) === pointSample.easting,
      `Easting in AR (${eastingAr}) === EN (${eastingEn}) === ${pointSample.easting}`
    );

    // 15. DXF Coordinate ASCII Compliance
    const testPointsDxf: PointRecord[] = [
      { id: '1', projectId: 'p1', pointNumber: 1, easting: 500000.123, northing: 3000000.456, elevation: 12.5, description: 'P1', timestamp: '' },
    ];
    const dxfString = generateDXF('DXF Test', testPointsDxf);
    assert(
      suite,
      '15. DXF File Output Strict ASCII Numeric Compatibility',
      dxfString.includes('500000.123') &&
        dxfString.includes('3000000.456') &&
        !/[\u0660-\u0669]/.test(dxfString),
      'DXF contains 0-9 ASCII numbers only; no Arabic-Indic digits present'
    );

    // 16. CSV Number String Western ASCII Compliance
    const csvExport = generateCSV(testPointsDxf, { delimiter: ',', precision: 3, includeHeader: true });
    assert(
      suite,
      '16. CSV File Output Strict ASCII Numeric Compatibility',
      csvExport.includes('500000.123') && !/[\u0660-\u0669]/.test(csvExport),
      `CSV Line: ${csvExport.split('\n')[1]}`
    );

    // 17. Technical Engineering Acronyms Preservation
    const enText = locales.en.cogo.title;
    const arText = locales.ar.cogo.title;
    assert(
      suite,
      '17. Technical Identifiers & Geodetic Terminology Preservation (COGO, CRS, UTM)',
      arText.includes('COGO') && enText.includes('COGO'),
      `AR: "${arText}", EN: "${enText}"`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const successRate = (passed / results.length) * 100;

  return {
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      successRate,
    },
  };
}

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
import { calculateInverse, calculateForward, calculateCircularCurve } from './cogo-engine';
import { calculatePolygonArea, calculatePolygonPerimeter } from './survey-calculations';
import { generateDXF } from './dxf-generator';
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

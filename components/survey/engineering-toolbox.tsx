'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Calculator,
  ArrowLeftRight,
  MoveRight,
  GitCommit,
  Layers,
  Ruler,
  Crosshair,
  Mountain,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Save,
  Plus,
  Trash2,
  Compass,
  RefreshCw,
  Info,
  ShieldCheck,
  Split,
  Maximize2,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, type PointRecord } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import {
  calculateInverse,
  calculateForward,
  calculateCircularCurve,
  reduceLevelingLoop,
  calculateTraverseBowditch,
  calculateBearingBearingIntersection,
  calculateDistanceDistanceIntersection,
  calculatePointToBaselineOffset,
  getBackAzimuth,
  type InverseResult,
  type ForwardResult,
  type CircularCurveResult,
  type LevelingLoopResult,
  type TraverseAdjustmentResult,
  type BearingBearingResult,
  type DistanceDistanceResult,
  type PointToBaselineOffsetResult,
} from '@/lib/cogo-engine';
import {
  calculatePolygonArea,
  calculatePolygonPerimeter,
  calculatePolygonCentroid,
} from '@/lib/survey-calculations';
import { logAuditEvent } from '@/lib/audit-service';
import { SUPPORTED_CRS } from '@/lib/crs-definitions';

type ToolboxTab =
  | 'inverse'
  | 'forward'
  | 'traverse'
  | 'curves'
  | 'leveling'
  | 'area_geom'
  | 'intersections'
  | 'earthwork';

export function EngineeringToolbox() {
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentProject = useAppStore((state) => state.currentProject);
  const activeCrs = useAppStore((state) => state.activeCrs);
  const selectedPointIds = useAppStore((state) => state.selectedPointIds);

  const [activeTab, setActiveTab] = useState<ToolboxTab>('inverse');

  // Real Project Points from Dexie
  const livePoints = useLiveQuery(
    () => db.points.where('projectId').equals(currentProjectId).sortBy('pointNumber'),
    [currentProjectId]
  );
  const points = useMemo(() => livePoints ?? [], [livePoints]);

  const crsDef = useMemo(() => {
    return (
      SUPPORTED_CRS.find((c) => c.code === (currentProject?.crsCode || activeCrs)) ||
      SUPPORTED_CRS[0]
    );
  }, [currentProject?.crsCode, activeCrs]);

  // ==========================================
  // 1. INVERSE TAB STATE
  // ==========================================
  const [invP1Id, setInvP1Id] = useState<string>('');
  const [invP2Id, setInvP2Id] = useState<string>('');
  const [invManualP1, setInvManualP1] = useState({ easting: '', northing: '', elevation: '' });
  const [invManualP2, setInvManualP2] = useState({ easting: '', northing: '', elevation: '' });
  const [inverseResult, setInverseResult] = useState<InverseResult | null>(null);

  // Quick point selection for Inverse
  const handleSelectInversePoints = (p1?: PointRecord, p2?: PointRecord) => {
    if (p1) {
      setInvP1Id(p1.id);
      setInvManualP1({
        easting: String(p1.easting),
        northing: String(p1.northing),
        elevation: String(p1.elevation),
      });
    }
    if (p2) {
      setInvP2Id(p2.id);
      setInvManualP2({
        easting: String(p2.easting),
        northing: String(p2.northing),
        elevation: String(p2.elevation),
      });
    }
  };

  const handleCalculateInverse = () => {
    const p1 = {
      easting: parseFloat(invManualP1.easting),
      northing: parseFloat(invManualP1.northing),
      elevation: parseFloat(invManualP1.elevation || '0'),
    };
    const p2 = {
      easting: parseFloat(invManualP2.easting),
      northing: parseFloat(invManualP2.northing),
      elevation: parseFloat(invManualP2.elevation || '0'),
    };

    if (isNaN(p1.easting) || isNaN(p1.northing) || isNaN(p2.easting) || isNaN(p2.northing)) {
      toast.error('يرجى إدخال إحداثيات صحيحة للنقطتين (Easting, Northing)');
      return;
    }

    const res = calculateInverse(p1, p2);
    setInverseResult(res);

    // Audit logging
    logAuditEvent({
      projectId: currentProjectId,
      operation: 'ENGINEERING_CALCULATION',
      summary: `حساب مسافة وانحراف (Inverse) بين النقطتين: مسافة أفقية=${res.horizontalDistance.toFixed(3)}م، انحراف=${res.azimuthDMS.formatted}`,
      metadata: {
        tool: 'COGO_INVERSE',
        horizontalDistance: res.horizontalDistance,
        azimuthDecimal: res.azimuthDecimal,
        bearing: res.bearing,
      },
    });

    toast.success('تم حساب المسافة والانحراف بنجاح');
  };

  // Flagged points check for Inverse
  const invP1Record = points.find((p) => p.id === invP1Id);
  const invP2Record = points.find((p) => p.id === invP2Id);
  const hasInvFlaggedPoint = Boolean(invP1Record?.flagged || invP2Record?.flagged);

  // ==========================================
  // 2. FORWARD TAB STATE
  // ==========================================
  const [fwdStartPId, setFwdStartPId] = useState<string>('');
  const [fwdStart, setFwdStart] = useState({ easting: '', northing: '', elevation: '' });
  const [fwdAzimuth, setFwdAzimuth] = useState<string>('45.0');
  const [fwdDistance, setFwdDistance] = useState<string>('100.0');
  const [fwdDeltaZ, setFwdDeltaZ] = useState<string>('0.0');
  const [forwardResult, setForwardResult] = useState<ForwardResult | null>(null);
  const [newPointDesc, setNewPointDesc] = useState<string>('COGO_STAKEOUT');
  const [newPointLayer, setNewPointLayer] = useState<string>('CALCULATED');

  const handleCalculateForward = () => {
    const s = {
      easting: parseFloat(fwdStart.easting),
      northing: parseFloat(fwdStart.northing),
      elevation: parseFloat(fwdStart.elevation || '0'),
    };
    const az = parseFloat(fwdAzimuth);
    const dist = parseFloat(fwdDistance);
    const dz = parseFloat(fwdDeltaZ || '0');

    if (isNaN(s.easting) || isNaN(s.northing) || isNaN(az) || isNaN(dist)) {
      toast.error('أدخل إحداثيات البداية والانحراف والمسافة بشكل صحيح');
      return;
    }

    const res = calculateForward(s, az, dist, dz);
    setForwardResult(res);

    logAuditEvent({
      projectId: currentProjectId,
      operation: 'ENGINEERING_CALCULATION',
      summary: `حساب نقطة أمامية (Forward): مسافة=${dist}م، انحراف=${az}° -> E=${res.easting.toFixed(3)}, N=${res.northing.toFixed(3)}`,
      metadata: { tool: 'COGO_FORWARD', azimuth: az, distance: dist, result: res },
    });

    toast.success('تم حساب إحداثيات النقطة المستهدفة');
  };

  const handleSaveForwardPointToDb = async () => {
    if (!forwardResult) return;
    try {
      const maxPt = points.reduce((max, p) => Math.max(max, p.pointNumber), 0);
      const nextPtNum = maxPt + 1;

      await db.points.add({
        id: crypto.randomUUID(),
        projectId: currentProjectId,
        pointNumber: nextPtNum,
        easting: forwardResult.easting,
        northing: forwardResult.northing,
        elevation: forwardResult.elevation,
        description: newPointDesc || 'COGO_STAKEOUT',
        layer: newPointLayer || 'CALCULATED',
        timestamp: new Date().toISOString(),
      });

      logAuditEvent({
        projectId: currentProjectId,
        operation: 'POINT_CREATED',
        summary: `إضافة النقطة المحسوبة P${nextPtNum} (E:${forwardResult.easting.toFixed(3)}, N:${forwardResult.northing.toFixed(3)}) إلى المشروع`,
        metadata: { pointNumber: nextPtNum, layer: newPointLayer },
      });

      toast.success(`تم حفظ النقطة P${nextPtNum} بنجاح في قاعدة بيانات المشروع`);
    } catch {
      toast.error('حدث خطأ أثناء حفظ النقطة');
    }
  };

  // ==========================================
  // 3. TRAVERSE TAB STATE
  // ==========================================
  const [traverseStartPId, setTraverseStartPId] = useState<string>('');
  const [traverseStartPoint, setTraverseStartPoint] = useState({ easting: '500000.0', northing: '3000000.0', elevation: '100.0' });
  const [traverseMode, setTraverseMode] = useState<'CLOSED_LOOP' | 'CONNECTING'>('CLOSED_LOOP');
  const [traverseClosingPoint, setTraverseClosingPoint] = useState({ easting: '500500.0', northing: '3000500.0', elevation: '102.0' });
  const [traverseLegs, setTraverseLegs] = useState<Array<{ stationName: string; distance: string; azimuth: string; deltaZ: string }>>([
    { stationName: 'St-1', distance: '124.50', azimuth: '45.2500', deltaZ: '0.50' },
    { stationName: 'St-2', distance: '98.30', azimuth: '135.5000', deltaZ: '-0.30' },
    { stationName: 'St-3', distance: '115.80', azimuth: '225.1000', deltaZ: '-0.40' },
    { stationName: 'St-4', distance: '102.10', azimuth: '315.3500', deltaZ: '0.20' },
  ]);
  const [traverseResult, setTraverseResult] = useState<TraverseAdjustmentResult | null>(null);

  const handlePopulateTraverseFromPoints = () => {
    if (points.length < 3) {
      toast.error('يتطلب المضلع 3 نقاط على الأقل في المشروع');
      return;
    }
    const pts = selectedPointIds.length >= 3
      ? points.filter((p) => selectedPointIds.includes(p.id))
      : points;

    if (pts.length < 3) {
      toast.error('حدد 3 نقاط على الأقل من المشروع');
      return;
    }

    const start = pts[0];
    setTraverseStartPoint({
      easting: String(start.easting),
      northing: String(start.northing),
      elevation: String(start.elevation),
    });

    const newLegs = [];
    for (let i = 0; i < pts.length; i++) {
      const pCurrent = pts[i];
      const pNext = pts[(i + 1) % pts.length];
      const inv = calculateInverse(pCurrent, pNext);
      newLegs.push({
        stationName: `P${pNext.pointNumber}`,
        distance: inv.horizontalDistance.toFixed(3),
        azimuth: inv.azimuthDecimal.toFixed(4),
        deltaZ: inv.deltaElevation.toFixed(3),
      });
    }
    setTraverseLegs(newLegs);
    setTraverseMode('CLOSED_LOOP');
    toast.success(`تم استيراد ${newLegs.length} أضلاع مضلع من نقاط المشروع`);
  };

  const handleCalculateTraverse = () => {
    const sE = parseFloat(traverseStartPoint.easting);
    const sN = parseFloat(traverseStartPoint.northing);
    const sZ = parseFloat(traverseStartPoint.elevation || '0');

    if (isNaN(sE) || isNaN(sN)) {
      toast.error('أدخل إحداثيات نقطة البداية بشكل صحيح');
      return;
    }

    const parsedLegs = traverseLegs.map((l) => ({
      stationName: l.stationName || 'STN',
      distance: parseFloat(l.distance) || 0,
      azimuth: parseFloat(l.azimuth) || 0,
      deltaZ: parseFloat(l.deltaZ || '0'),
    }));

    if (parsedLegs.some((l) => l.distance <= 0)) {
      toast.error('يجب أن تكون مسافات جميع الأضلاع أكبر من الصفر');
      return;
    }

    let closingPt: { easting: number; northing: number; elevation?: number } | undefined = undefined;
    if (traverseMode === 'CONNECTING') {
      const cE = parseFloat(traverseClosingPoint.easting);
      const cN = parseFloat(traverseClosingPoint.northing);
      const cZ = parseFloat(traverseClosingPoint.elevation || '0');
      if (isNaN(cE) || isNaN(cN)) {
        toast.error('أدخل إحداثيات نقطة القفل بشكل صحيح');
        return;
      }
      closingPt = { easting: cE, northing: cN, elevation: cZ };
    }

    const res = calculateTraverseBowditch(
      { easting: sE, northing: sN, elevation: sZ },
      parsedLegs,
      closingPt
    );

    setTraverseResult(res);

    logAuditEvent({
      projectId: currentProjectId,
      operation: 'ENGINEERING_CALCULATION',
      summary: `حساب وضبط مضلع ترافرس (Bowditch): محيط=${res.totalPerimeter.toFixed(2)}م، خطأ القفل=${res.linearErrorOfClosure.toFixed(4)}م، نسبة الدقة=${res.precisionFormatted}`,
      metadata: {
        tool: 'TRAVERSE_BOWDITCH',
        perimeter: res.totalPerimeter,
        linearError: res.linearErrorOfClosure,
        precision: res.precisionRatio,
      },
    });

    toast.success('تم حساب وضبط الترافرس بقاعدة بوديتش (Compass Rule)');
  };

  // ==========================================
  // 4. CURVES TAB STATE
  // ==========================================
  const [curveRadius, setCurveRadius] = useState<string>('300.0');
  const [curveDelta, setCurveDelta] = useState<string>('42.5');
  const [curvePiStation, setCurvePiStation] = useState<string>('1250.0');
  const [curveResult, setCurveResult] = useState<CircularCurveResult | null>(null);

  const handleCalculateCurve = () => {
    const r = parseFloat(curveRadius);
    const d = parseFloat(curveDelta);
    if (isNaN(r) || isNaN(d) || r <= 0 || d <= 0) {
      toast.error('أدخل نصف القطر وزاوية الانحراف بشكل صحيح (> 0)');
      return;
    }
    const res = calculateCircularCurve(r, d);
    setCurveResult(res);

    logAuditEvent({
      projectId: currentProjectId,
      operation: 'ENGINEERING_CALCULATION',
      summary: `حساب منحنى دائري: R=${r}م، Δ=${d}° -> طول القوس=${res.arcLength.toFixed(3)}م، المماس=${res.tangentLength.toFixed(3)}م`,
      metadata: { tool: 'CIRCULAR_CURVE', radius: r, delta: d, arcLength: res.arcLength },
    });

    toast.success('تم حساب عناصر المنحنى الدائري بنجاح');
  };

  // ==========================================
  // 5. LEVELING TAB STATE
  // ==========================================
  const [levelingBm, setLevelingBm] = useState<string>('100.000');
  const [levelingRows, setLevelingRows] = useState<
    Array<{ stationName: string; backSight: string; intermediateSight: string; foreSight: string; remarks: string }>
  >([
    { stationName: 'BM-1', backSight: '1.450', intermediateSight: '', foreSight: '', remarks: 'نقطة المرجع الأولي' },
    { stationName: 'St-1', backSight: '', intermediateSight: '1.820', foreSight: '', remarks: 'محطة مسار' },
    { stationName: 'CP-1', backSight: '2.100', intermediateSight: '', foreSight: '0.950', remarks: 'نقطة دوران Change Point' },
    { stationName: 'St-2', backSight: '', intermediateSight: '1.430', foreSight: '', remarks: 'محطة مسار' },
    { stationName: 'BM-1', backSight: '', intermediateSight: '', foreSight: '2.600', remarks: 'قفل الميزانية' },
  ]);
  const [levelingResult, setLevelingResult] = useState<LevelingLoopResult | null>(null);

  const handleCalculateLeveling = () => {
    const bm = parseFloat(levelingBm);
    if (isNaN(bm)) {
      toast.error('أدخل منسوب الروبير الأولي BM بشكل صحيح');
      return;
    }

    const readings = levelingRows.map((row) => ({
      stationName: row.stationName,
      backSight: row.backSight ? parseFloat(row.backSight) : undefined,
      intermediateSight: row.intermediateSight ? parseFloat(row.intermediateSight) : undefined,
      foreSight: row.foreSight ? parseFloat(row.foreSight) : undefined,
      remarks: row.remarks,
    }));

    const res = reduceLevelingLoop(bm, readings);
    setLevelingResult(res);

    logAuditEvent({
      projectId: currentProjectId,
      operation: 'ENGINEERING_CALCULATION',
      summary: `مراجعة ميزانية هندسية: مجموع BS=${res.sumBackSight.toFixed(3)}، مجموع FS=${res.sumForeSight.toFixed(3)}، خطأ القفل=${res.misclosure.toFixed(3)}م`,
      metadata: { tool: 'LEVELING_LOOP', sumBS: res.sumBackSight, sumFS: res.sumForeSight, misclosure: res.misclosure },
    });

    toast.success('تم جدول ومراجعة ميزانية المناسيب');
  };

  // ==========================================
  // 6. AREA & GEOMETRY TAB STATE
  // ==========================================
  const [areaPointScope, setAreaPointScope] = useState<'ALL' | 'SELECTED'>('ALL');

  const areaPoints = useMemo(() => {
    if (areaPointScope === 'SELECTED' && selectedPointIds.length >= 3) {
      return points.filter((p) => selectedPointIds.includes(p.id));
    }
    return points;
  }, [points, areaPointScope, selectedPointIds]);

  const geometryCalculations = useMemo(() => {
    if (areaPoints.length < 3) return null;
    const areaM2 = calculatePolygonArea(areaPoints);
    const perimeterM = calculatePolygonPerimeter(areaPoints);
    const centroid = calculatePolygonCentroid(areaPoints);

    // Bounding Box
    let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
    areaPoints.forEach((p) => {
      if (p.easting < minE) minE = p.easting;
      if (p.easting > maxE) maxE = p.easting;
      if (p.northing < minN) minN = p.northing;
      if (p.northing > maxN) maxN = p.northing;
    });

    // Agricultural Units (Feddans, Qirats, Sahms)
    const totalQirats = (areaM2 / 4200.833) * 24;
    const feddans = Math.floor(areaM2 / 4200.833);
    const remAreaAfterFeddan = areaM2 - feddans * 4200.833;
    const qirats = Math.floor(remAreaAfterFeddan / 175.035);
    const remAreaAfterQirat = remAreaAfterFeddan - qirats * 175.035;
    const sahms = (remAreaAfterQirat / 7.293).toFixed(1);

    const hectares = (areaM2 / 10000).toFixed(4);
    const acres = (areaM2 / 4046.856).toFixed(4);
    const sqFeet = (areaM2 * 10.7639).toFixed(1);

    return {
      pointCount: areaPoints.length,
      areaM2,
      perimeterM,
      centroid,
      boundingBox: { minE, maxE, minN, maxN, width: maxE - minE, height: maxN - minN },
      feddans,
      qirats,
      sahms,
      hectares,
      acres,
      sqFeet,
    };
  }, [areaPoints]);

  // ==========================================
  // 7. INTERSECTIONS TAB STATE
  // ==========================================
  const [interMode, setInterMode] = useState<'BEARING_BEARING' | 'DISTANCE_DISTANCE' | 'STATION_OFFSET'>('BEARING_BEARING');

  // Bearing-Bearing
  const [bbP1, setBbP1] = useState({ easting: '500100', northing: '3000100' });
  const [bbAz1, setBbAz1] = useState('65.5');
  const [bbP2, setBbP2] = useState({ easting: '500400', northing: '3000150' });
  const [bbAz2, setBbAz2] = useState('310.0');
  const [bbResult, setBbResult] = useState<BearingBearingResult | null>(null);

  // Distance-Distance
  const [ddP1, setDdP1] = useState({ easting: '500100', northing: '3000100' });
  const [ddR1, setDdR1] = useState('180.0');
  const [ddP2, setDdP2] = useState({ easting: '500300', northing: '3000100' });
  const [ddR2, setDdR2] = useState('150.0');
  const [ddResult, setDdResult] = useState<DistanceDistanceResult | null>(null);

  // Station-Offset
  const [soBaseA, setSoBaseA] = useState({ easting: '500000', northing: '3000000' });
  const [soBaseB, setSoBaseB] = useState({ easting: '500500', northing: '3000500' });
  const [soTestPt, setSoTestPt] = useState({ easting: '500250', northing: '3000300' });
  const [soResult, setSoResult] = useState<PointToBaselineOffsetResult | null>(null);

  const handleCalculateIntersection = () => {
    if (interMode === 'BEARING_BEARING') {
      const p1 = { easting: parseFloat(bbP1.easting), northing: parseFloat(bbP1.northing) };
      const p2 = { easting: parseFloat(bbP2.easting), northing: parseFloat(bbP2.northing) };
      const az1 = parseFloat(bbAz1);
      const az2 = parseFloat(bbAz2);

      if (isNaN(p1.easting) || isNaN(p1.northing) || isNaN(p2.easting) || isNaN(p2.northing) || isNaN(az1) || isNaN(az2)) {
        toast.error('أدخل المعطيات بشكل صحيح');
        return;
      }

      const res = calculateBearingBearingIntersection(p1, az1, p2, az2);
      setBbResult(res);
      if (res.isValid) toast.success('تم حساب نقطة تقاطع الانحرافين');
      else toast.error(res.error || 'فشل التقاطع');
    } else if (interMode === 'DISTANCE_DISTANCE') {
      const p1 = { easting: parseFloat(ddP1.easting), northing: parseFloat(ddP1.northing) };
      const p2 = { easting: parseFloat(ddP2.easting), northing: parseFloat(ddP2.northing) };
      const r1 = parseFloat(ddR1);
      const r2 = parseFloat(ddR2);

      if (isNaN(p1.easting) || isNaN(p1.northing) || isNaN(p2.easting) || isNaN(p2.northing) || isNaN(r1) || isNaN(r2)) {
        toast.error('أدخل المعطيات بشكل صحيح');
        return;
      }

      const res = calculateDistanceDistanceIntersection(p1, r1, p2, r2);
      setDdResult(res);
      if (res.isValid) toast.success('تم حساب تقاطع المسافتين (Trilateration)');
      else toast.error(res.error || 'فشل التقاطع');
    } else {
      const bA = { easting: parseFloat(soBaseA.easting), northing: parseFloat(soBaseA.northing) };
      const bB = { easting: parseFloat(soBaseB.easting), northing: parseFloat(soBaseB.northing) };
      const tP = { easting: parseFloat(soTestPt.easting), northing: parseFloat(soTestPt.northing) };

      if (isNaN(bA.easting) || isNaN(bA.northing) || isNaN(bB.easting) || isNaN(bB.northing) || isNaN(tP.easting) || isNaN(tP.northing)) {
        toast.error('أدخل المعطيات بشكل صحيح');
        return;
      }

      const res = calculatePointToBaselineOffset(bA, bB, tP);
      setSoResult(res);
      toast.success('تم حساب التدريج والانحراف العمودي');
    }
  };

  // ==========================================
  // 8. EARTHWORK TAB STATE (Tributary Grid)
  // ==========================================
  const [designElevation, setDesignElevation] = useState<string>('100.0');
  const [bulkingFactor, setBulkingFactor] = useState<string>('1.0');
  const [shrinkageFactor, setShrinkageFactor] = useState<string>('1.0');

  const earthworkCalc = useMemo(() => {
    if (points.length < 3) return null;
    const targetZ = parseFloat(designElevation);
    if (isNaN(targetZ)) return null;

    const bFactor = parseFloat(bulkingFactor) || 1.0;
    const sFactor = parseFloat(shrinkageFactor) || 1.0;

    const areaM2 = calculatePolygonArea(points);
    const tributaryAreaPerPoint = areaM2 / points.length;

    let totalCutVol = 0;
    let totalFillVol = 0;
    let sumZ = 0;
    let minZ = Infinity;
    let maxZ = -Infinity;

    const breakdown = points.map((p) => {
      sumZ += p.elevation;
      if (p.elevation < minZ) minZ = p.elevation;
      if (p.elevation > maxZ) maxZ = p.elevation;

      const diff = p.elevation - targetZ; // positive = cut, negative = fill
      const isCut = diff > 0;
      const depth = Math.abs(diff);
      const rawVol = depth * tributaryAreaPerPoint;
      const adjustedVol = isCut ? rawVol * bFactor : rawVol * sFactor;

      if (isCut) totalCutVol += adjustedVol;
      else totalFillVol += adjustedVol;

      return {
        pointNumber: p.pointNumber,
        originalZ: p.elevation,
        designZ: targetZ,
        diffZ: diff,
        type: isCut ? 'CUT' : 'FILL',
        depth,
        volume: adjustedVol,
      };
    });

    const netBalance = totalCutVol - totalFillVol;
    const avgZ = sumZ / points.length;

    return {
      pointCount: points.length,
      boundaryAreaM2: areaM2,
      tributaryAreaPerPoint,
      targetElevation: targetZ,
      avgElevation: avgZ,
      minElevation: minZ,
      maxElevation: maxZ,
      totalCutVolumeM3: totalCutVol,
      totalFillVolumeM3: totalFillVol,
      netBalanceM3: netBalance,
      breakdown,
    };
  }, [points, designElevation, bulkingFactor, shrinkageFactor]);

  return (
    <div className="space-y-6">
      {/* HEADER WITH CRS STATUS */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">صندوق الأدوات الهندسية (Engineering Toolbox)</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              محرك الحسابات المساحية والهندسية الدقيقة المرتبط ببيانات المشروع الحقيقي ({points.length} نقطة مسجلة)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-750 bg-slate-950/70 px-3.5 py-2 text-xs">
            <Compass className="h-4 w-4 text-sky-400" />
            <div>
              <span className="text-[10px] text-slate-500 block">نظام الإسناد النشط:</span>
              <span className="font-bold text-slate-200">{crsDef.code} - {crsDef.name}</span>
            </div>
          </div>

          <span
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
              crsDef.validationLevel === 'AUTHORITATIVE_GEODETIC'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {crsDef.validationLevel === 'AUTHORITATIVE_GEODETIC' ? 'إسناد معتمد' : 'يتطلب ضبط GCP'}
          </span>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {[
          { id: 'inverse', label: 'المسافة والانحراف (Inverse)', icon: ArrowLeftRight },
          { id: 'forward', label: 'الحساب المباشر (Forward)', icon: MoveRight },
          { id: 'traverse', label: 'ضبط المضلع (Traverse)', icon: Split },
          { id: 'curves', label: 'المنحنيات (Curves)', icon: GitCommit },
          { id: 'leveling', label: 'الميزانية (Leveling)', icon: Layers },
          { id: 'area_geom', label: 'المساحة والأبعاد (Area)', icon: Maximize2 },
          { id: 'intersections', label: 'التقاطعات (Intersections)', icon: Crosshair },
          { id: 'earthwork', label: 'حساب الكميات (Cut/Fill)', icon: Mountain },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ToolboxTab)}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center transition-all ${
                active
                  ? 'border-sky-500/50 bg-sky-500 text-white shadow-lg shadow-sky-950/40 font-bold'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-white' : 'text-slate-400'}`} />
              <span className="text-[11px] leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 1. INVERSE TAB */}
      {/* ========================================================================= */}
      {activeTab === 'inverse' && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="glass-card p-5 sm:p-7 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">حساب المسافة والانحراف (COGO Inverse)</h2>
                <p className="mt-1 text-xs text-slate-400">
                  حساب المسافة الأفقية والمائلة، زاوية الانحراف الدائري والربعي والإنحدار بين نقطتين
                </p>
              </div>
            </div>

            {hasInvFlaggedPoint && (
              <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>تحذير: إحدى النقطتين المختارتين معلمة للتدقيق والمراجعة في سجل ضبط الجودة (QA/QC Flag).</span>
              </div>
            )}

            {points.length >= 2 && (
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                <span className="mb-2 block text-xs font-semibold text-sky-300">
                  اختيار سريع من نقاط المشروع النشط ({points.length} نقطة):
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={invP1Id}
                    onChange={(e) => {
                      const pt = points.find((p) => p.id === e.target.value);
                      if (pt) handleSelectInversePoints(pt, undefined);
                    }}
                    className="h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
                  >
                    <option value="">اختر النقطة الأولى (P1)...</option>
                    {points.map((p) => (
                      <option key={p.id} value={p.id}>
                        P{p.pointNumber} - {p.description || `E:${p.easting.toFixed(1)}`} {p.flagged ? '⚠️' : ''}
                      </option>
                    ))}
                  </select>

                  <select
                    value={invP2Id}
                    onChange={(e) => {
                      const pt = points.find((p) => p.id === e.target.value);
                      if (pt) handleSelectInversePoints(undefined, pt);
                    }}
                    className="h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
                  >
                    <option value="">اختر النقطة الثانية (P2)...</option>
                    {points.map((p) => (
                      <option key={p.id} value={p.id}>
                        P{p.pointNumber} - {p.description || `E:${p.easting.toFixed(1)}`} {p.flagged ? '⚠️' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <span className="mb-3 block text-xs font-bold text-slate-300">النقطة الأولى P1 (Start Station)</span>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Easting X (م)</label>
                    <input
                      type="number"
                      dir="ltr"
                      value={invManualP1.easting}
                      onChange={(e) => setInvManualP1({ ...invManualP1, easting: e.target.value })}
                      placeholder="500000.000"
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Northing Y (م)</label>
                    <input
                      type="number"
                      dir="ltr"
                      value={invManualP1.northing}
                      onChange={(e) => setInvManualP1({ ...invManualP1, northing: e.target.value })}
                      placeholder="3000000.000"
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Elevation Z (م)</label>
                    <input
                      type="number"
                      dir="ltr"
                      value={invManualP1.elevation}
                      onChange={(e) => setInvManualP1({ ...invManualP1, elevation: e.target.value })}
                      placeholder="100.000"
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <span className="mb-3 block text-xs font-bold text-slate-300">النقطة الثانية P2 (Target Station)</span>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Easting X (م)</label>
                    <input
                      type="number"
                      dir="ltr"
                      value={invManualP2.easting}
                      onChange={(e) => setInvManualP2({ ...invManualP2, easting: e.target.value })}
                      placeholder="500150.000"
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Northing Y (م)</label>
                    <input
                      type="number"
                      dir="ltr"
                      value={invManualP2.northing}
                      onChange={(e) => setInvManualP2({ ...invManualP2, northing: e.target.value })}
                      placeholder="3000100.000"
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Elevation Z (م)</label>
                    <input
                      type="number"
                      dir="ltr"
                      value={invManualP2.elevation}
                      onChange={(e) => setInvManualP2({ ...invManualP2, elevation: e.target.value })}
                      placeholder="104.500"
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleCalculateInverse}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-xs font-bold text-white shadow-lg shadow-sky-950/30 transition-all hover:bg-sky-400 active:scale-[0.99]"
              >
                <ArrowLeftRight className="h-4 w-4" />
                حساب المسافة والانحراف الهندسي
              </button>
            </div>
          </section>

          {/* Results */}
          <section className="glass-card p-5 sm:p-7 space-y-4">
            <h3 className="text-base font-bold text-white">النتائج الهندسية المحسوبة</h3>
            <p className="text-xs text-slate-500">حسابات هندسية قطعية خالية من التقريب العشوائي</p>

            {inverseResult ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <span className="text-xs font-semibold text-emerald-300 block mb-1">المسافة الأفقية (Horizontal Distance)</span>
                  <p dir="ltr" className="text-2xl font-bold text-emerald-400">
                    {inverseResult.horizontalDistance.toFixed(4)} م
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-400 block">المسافة المائلة (3D Slope)</span>
                    <p dir="ltr" className="text-sm font-bold text-slate-200 mt-0.5">
                      {inverseResult.slopeDistance.toFixed(4)} م
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-400 block">فرق المنسوب (ΔZ)</span>
                    <p dir="ltr" className="text-sm font-bold text-sky-400 mt-0.5">
                      {inverseResult.deltaElevation > 0 ? '+' : ''}
                      {inverseResult.deltaElevation.toFixed(3)} م
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5">
                  <span className="text-[11px] text-slate-400 block">الانحراف الدائري الأمامي (Forward Azimuth)</span>
                  <p dir="ltr" className="mt-1 text-base font-bold text-sky-300">
                    {inverseResult.azimuthDMS.formatted} ({inverseResult.azimuthDecimal.toFixed(4)}°)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-400 block">الانحراف الخلفي (Back Az)</span>
                    <p dir="ltr" className="text-xs font-bold text-slate-300 mt-0.5">
                      {getBackAzimuth(inverseResult.azimuthDecimal).toFixed(4)}°
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-400 block">الانحراف الربع دائري (Bearing)</span>
                    <p dir="ltr" className="text-xs font-bold text-amber-400 mt-0.5">
                      {inverseResult.bearing}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-400 block">نسبة الميل (Slope Grade)</span>
                    <p dir="ltr" className="text-sm font-bold text-slate-200 mt-0.5">
                      {inverseResult.slopePercent.toFixed(2)}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-400 block">تناسب الميل (Ratio)</span>
                    <p className="text-xs font-bold text-slate-300 mt-0.5">{inverseResult.slopeRatio}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const text = `COGO Inverse Result:
Horizontal Distance: ${inverseResult.horizontalDistance.toFixed(4)} m
Slope Distance: ${inverseResult.slopeDistance.toFixed(4)} m
Azimuth: ${inverseResult.azimuthDMS.formatted} (${inverseResult.azimuthDecimal.toFixed(4)}°)
Bearing: ${inverseResult.bearing}
Delta Elevation: ${inverseResult.deltaElevation.toFixed(3)} m
Grade: ${inverseResult.slopePercent.toFixed(2)}%`;
                    navigator.clipboard.writeText(text);
                    toast.success('تم نسخ النتيجة إلى الحافظة');
                  }}
                  className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  <Copy className="h-3.5 w-3.5" /> نسخ تقرير النتيجة
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Compass className="h-10 w-10 text-slate-700 mb-2" />
                <p className="text-xs text-slate-500">اختر أو أدخل إحداثيات النقطتين واضغط حساب</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. FORWARD TAB */}
      {/* ========================================================================= */}
      {activeTab === 'forward' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="glass-card p-5 sm:p-7 space-y-4">
            <h2 className="text-base font-bold text-white">الحساب المباشر والتوقيع (COGO Forward)</h2>
            <p className="text-xs text-slate-400">
              حساب إحداثيات النقطة المستهدفة بمعلومية نقطة المحطة، الانحراف والمسافة الأفقية
            </p>

            {points.length > 0 && (
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
                <span className="text-xs font-semibold text-sky-300 block mb-2">اختيار محطة البداية من المشروع:</span>
                <select
                  value={fwdStartPId}
                  onChange={(e) => {
                    const pt = points.find((p) => p.id === e.target.value);
                    if (pt) {
                      setFwdStartPId(pt.id);
                      setFwdStart({
                        easting: String(pt.easting),
                        northing: String(pt.northing),
                        elevation: String(pt.elevation),
                      });
                    }
                  }}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white"
                >
                  <option value="">اختر المحطة الأساسية...</option>
                  {points.map((p) => (
                    <option key={p.id} value={p.id}>
                      P{p.pointNumber} - {p.description || `E:${p.easting.toFixed(1)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-300 block">إحداثيات محطة البداية (Station):</span>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  dir="ltr"
                  placeholder="Easting X"
                  value={fwdStart.easting}
                  onChange={(e) => setFwdStart({ ...fwdStart, easting: e.target.value })}
                  className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
                <input
                  type="number"
                  dir="ltr"
                  placeholder="Northing Y"
                  value={fwdStart.northing}
                  onChange={(e) => setFwdStart({ ...fwdStart, northing: e.target.value })}
                  className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
                <input
                  type="number"
                  dir="ltr"
                  placeholder="Elevation Z"
                  value={fwdStart.elevation}
                  onChange={(e) => setFwdStart({ ...fwdStart, elevation: e.target.value })}
                  className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">الانحراف الدائري (Azimuth °)</label>
                  <input
                    type="number"
                    step="any"
                    dir="ltr"
                    value={fwdAzimuth}
                    onChange={(e) => setFwdAzimuth(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">المسافة الأفقية (م)</label>
                  <input
                    type="number"
                    step="any"
                    dir="ltr"
                    value={fwdDistance}
                    onChange={(e) => setFwdDistance(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">فرق المنسوب Delta Z (م - اختياري)</label>
                <input
                  type="number"
                  step="any"
                  dir="ltr"
                  value={fwdDeltaZ}
                  onChange={(e) => setFwdDeltaZ(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
              </div>

              <button
                onClick={handleCalculateForward}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-xs font-bold text-white shadow-lg shadow-sky-950/30 hover:bg-sky-400"
              >
                <MoveRight className="h-4 w-4" /> حساب إحداثيات النقطة
              </button>
            </div>
          </section>

          <section className="glass-card p-5 sm:p-7 space-y-4">
            <h3 className="text-base font-bold text-white">إحداثيات النقطة المحسوبة</h3>
            <p className="text-xs text-slate-500">الإحداثيات الناتجة بعد تطبيق المتجه الهندسي</p>

            {forwardResult ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
                  <span className="text-[11px] text-slate-400 block">الشرق (Easting / X)</span>
                  <p dir="ltr" className="text-xl font-bold text-sky-300 mt-1">
                    {forwardResult.easting.toFixed(4)} م
                  </p>
                </div>

                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
                  <span className="text-[11px] text-slate-400 block">الشمال (Northing / Y)</span>
                  <p dir="ltr" className="text-xl font-bold text-sky-300 mt-1">
                    {forwardResult.northing.toFixed(4)} م
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <span className="text-[11px] text-slate-400 block">المنسوب (Elevation / Z)</span>
                  <p dir="ltr" className="text-xl font-bold text-emerald-400 mt-1">
                    {forwardResult.elevation.toFixed(3)} م
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                  <span className="text-xs font-bold text-slate-300 block">إضافة النقطة إلى قاعدة بيانات المشروع:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="الوصف (Description)"
                      value={newPointDesc}
                      onChange={(e) => setNewPointDesc(e.target.value)}
                      className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="الطبقة (Layer)"
                      value={newPointLayer}
                      onChange={(e) => setNewPointLayer(e.target.value)}
                      className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-white"
                    />
                  </div>
                  <button
                    onClick={handleSaveForwardPointToDb}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-500"
                  >
                    <Save className="h-4 w-4" /> حفظ النقطة في المشروع الحقيقي
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MoveRight className="h-10 w-10 text-slate-700 mb-2" />
                <p className="text-xs text-slate-500">أدخل المعطيات واضغط حساب</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TRAVERSE TAB */}
      {/* ========================================================================= */}
      {activeTab === 'traverse' && (
        <div className="space-y-6">
          <section className="glass-card p-5 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white">حساب وضبط المضلع المساحي (Traverse Adjustment - Bowditch)</h2>
                <p className="text-xs text-slate-400 mt-1">
                  حساب خطأ القفل الزاوي وخطي الإحداثيات وتوزيع الأخطاء طبقاً لقاعدة البوصلة (Bowditch Compass Rule)
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePopulateTraverseFromPoints}
                  className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-400 hover:bg-sky-500/20"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> استيراد أضلاع المضلع من نقاط المشروع
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">نوع المضلع (Traverse Type):</label>
                <select
                  value={traverseMode}
                  onChange={(e) => setTraverseMode(e.target.value as any)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white"
                >
                  <option value="CLOSED_LOOP">مضلع مغلق بحلقة مقفلة (Closed Loop)</option>
                  <option value="CONNECTING">مضلع موصل بين نقطتي تحكم (Connecting Traverse)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">نقطة البداية (Start Station E, N, Z):</label>
                <div className="grid grid-cols-3 gap-1">
                  <input
                    dir="ltr"
                    value={traverseStartPoint.easting}
                    onChange={(e) => setTraverseStartPoint({ ...traverseStartPoint, easting: e.target.value })}
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                    placeholder="E"
                  />
                  <input
                    dir="ltr"
                    value={traverseStartPoint.northing}
                    onChange={(e) => setTraverseStartPoint({ ...traverseStartPoint, northing: e.target.value })}
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                    placeholder="N"
                  />
                  <input
                    dir="ltr"
                    value={traverseStartPoint.elevation}
                    onChange={(e) => setTraverseStartPoint({ ...traverseStartPoint, elevation: e.target.value })}
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                    placeholder="Z"
                  />
                </div>
              </div>

              {traverseMode === 'CONNECTING' && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">نقطة القفل (Closing Station E, N, Z):</label>
                  <div className="grid grid-cols-3 gap-1">
                    <input
                      dir="ltr"
                      value={traverseClosingPoint.easting}
                      onChange={(e) => setTraverseClosingPoint({ ...traverseClosingPoint, easting: e.target.value })}
                      className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                      placeholder="E"
                    />
                    <input
                      dir="ltr"
                      value={traverseClosingPoint.northing}
                      onChange={(e) => setTraverseClosingPoint({ ...traverseClosingPoint, northing: e.target.value })}
                      className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                      placeholder="N"
                    />
                    <input
                      dir="ltr"
                      value={traverseClosingPoint.elevation}
                      onChange={(e) => setTraverseClosingPoint({ ...traverseClosingPoint, elevation: e.target.value })}
                      className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                      placeholder="Z"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Legs Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="p-3">المحطة المستهدفة</th>
                    <th className="p-3">المسافة الأفقية (م)</th>
                    <th className="p-3">الانحراف الدائري (Azimuth °)</th>
                    <th className="p-3">فرق المنسوب ΔZ (م)</th>
                    <th className="p-3">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {traverseLegs.map((leg, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
                        <input
                          value={leg.stationName}
                          onChange={(e) => {
                            const copy = [...traverseLegs];
                            copy[idx].stationName = e.target.value;
                            setTraverseLegs(copy);
                          }}
                          className="h-8 w-24 rounded border border-slate-800 bg-slate-900 px-2 text-xs text-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          dir="ltr"
                          value={leg.distance}
                          onChange={(e) => {
                            const copy = [...traverseLegs];
                            copy[idx].distance = e.target.value;
                            setTraverseLegs(copy);
                          }}
                          className="h-8 w-28 rounded border border-slate-800 bg-slate-900 px-2 text-xs text-sky-300"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          dir="ltr"
                          value={leg.azimuth}
                          onChange={(e) => {
                            const copy = [...traverseLegs];
                            copy[idx].azimuth = e.target.value;
                            setTraverseLegs(copy);
                          }}
                          className="h-8 w-28 rounded border border-slate-800 bg-slate-900 px-2 text-xs text-emerald-300"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          dir="ltr"
                          value={leg.deltaZ}
                          onChange={(e) => {
                            const copy = [...traverseLegs];
                            copy[idx].deltaZ = e.target.value;
                            setTraverseLegs(copy);
                          }}
                          className="h-8 w-24 rounded border border-slate-800 bg-slate-900 px-2 text-xs text-slate-300"
                        />
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => {
                            if (traverseLegs.length <= 3) {
                              toast.error('يجب بقاء 3 أضلاع على الأقل');
                              return;
                            }
                            setTraverseLegs(traverseLegs.filter((_, i) => i !== idx));
                          }}
                          className="rounded p-1 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setTraverseLegs([
                    ...traverseLegs,
                    {
                      stationName: `St-${traverseLegs.length + 1}`,
                      distance: '100.00',
                      azimuth: '90.0000',
                      deltaZ: '0.00',
                    },
                  ]);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" /> إضافة ضلع للمضلع
              </button>

              <button
                onClick={handleCalculateTraverse}
                className="flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-950/40 hover:bg-sky-400"
              >
                <Split className="h-4 w-4" /> حساب وضبط المضلع بقاعدة بوديتش
              </button>
            </div>
          </section>

          {/* Traverse Results Table */}
          {traverseResult && (
            <section className="glass-card p-5 sm:p-7 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">تقرير ضبط المضلع وتوزيع خطأ القفل</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    نتائج الضبط الهندسي المعتمد (Bowditch Compass Rule)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5">
                    <span className="text-slate-500 block text-[10px]">المحيط الكلي:</span>
                    <span className="font-bold text-white">{traverseResult.totalPerimeter.toFixed(3)} م</span>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5">
                    <span className="text-slate-500 block text-[10px]">خطأ القفل الخطي (Misclosure):</span>
                    <span className="font-bold text-amber-400">{traverseResult.linearErrorOfClosure.toFixed(4)} م</span>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 font-bold text-emerald-400">
                    نسبة الدقة النسبية: {traverseResult.precisionFormatted}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-400">
                    <tr>
                      <th className="p-3">المحطة</th>
                      <th className="p-3">المسافة (م)</th>
                      <th className="p-3">الانحراف</th>
                      <th className="p-3">ΔE الخام</th>
                      <th className="p-3">ΔN الخام</th>
                      <th className="p-3">تصحيح E</th>
                      <th className="p-3">تصحيح N</th>
                      <th className="p-3">الشرق المضبوط (E)</th>
                      <th className="p-3">الشمال المضبوط (N)</th>
                      <th className="p-3">المنسوب (Z)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-mono text-[11px]">
                    <tr className="bg-slate-900/40 text-slate-400">
                      <td className="p-2.5 font-sans font-bold text-white">البداية (P0)</td>
                      <td className="p-2.5">—</td>
                      <td className="p-2.5">—</td>
                      <td className="p-2.5">—</td>
                      <td className="p-2.5">—</td>
                      <td className="p-2.5">—</td>
                      <td className="p-2.5">—</td>
                      <td className="p-2.5 font-bold text-sky-300">{traverseResult.startPoint.easting.toFixed(4)}</td>
                      <td className="p-2.5 font-bold text-sky-300">{traverseResult.startPoint.northing.toFixed(4)}</td>
                      <td className="p-2.5 text-emerald-400">{traverseResult.startPoint.elevation.toFixed(3)}</td>
                    </tr>
                    {traverseResult.legs.map((leg, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-sans font-bold text-white">{leg.stationName}</td>
                        <td className="p-2.5 text-slate-300">{leg.distance.toFixed(3)}</td>
                        <td className="p-2.5 text-slate-300">{leg.azimuth.toFixed(4)}°</td>
                        <td className="p-2.5 text-slate-400">{leg.rawDeltaE.toFixed(4)}</td>
                        <td className="p-2.5 text-slate-400">{leg.rawDeltaN.toFixed(4)}</td>
                        <td className="p-2.5 text-amber-400">{leg.corrDeltaE > 0 ? `+${leg.corrDeltaE.toFixed(4)}` : leg.corrDeltaE.toFixed(4)}</td>
                        <td className="p-2.5 text-amber-400">{leg.corrDeltaN > 0 ? `+${leg.corrDeltaN.toFixed(4)}` : leg.corrDeltaN.toFixed(4)}</td>
                        <td className="p-2.5 font-bold text-sky-300">{leg.adjustedEasting.toFixed(4)}</td>
                        <td className="p-2.5 font-bold text-sky-300">{leg.adjustedNorthing.toFixed(4)}</td>
                        <td className="p-2.5 font-semibold text-emerald-400">{leg.adjustedElevation.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CURVES TAB */}
      {/* ========================================================================= */}
      {activeTab === 'curves' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="glass-card p-5 sm:p-7 space-y-4">
            <h2 className="text-base font-bold text-white">حساب المنحنيات الأفقية (Circular Curves)</h2>
            <p className="text-xs text-slate-400">
              حساب كامل عناصر المنحنى الدائري البسيط لمشاريع الطرق والسكك الحديدية
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">نصف قطر المنحنى Radius (R) بالمتر:</label>
                <input
                  type="number"
                  dir="ltr"
                  value={curveRadius}
                  onChange={(e) => setCurveRadius(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">زاوية الانحراف المركزية Delta (Δ) بالدرجات:</label>
                <input
                  type="number"
                  dir="ltr"
                  value={curveDelta}
                  onChange={(e) => setCurveDelta(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">محطة نقطة التقاطع PI Station (م - اختياري):</label>
                <input
                  type="number"
                  dir="ltr"
                  value={curvePiStation}
                  onChange={(e) => setCurvePiStation(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
              </div>

              <button
                onClick={handleCalculateCurve}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-xs font-bold text-white shadow-lg shadow-sky-950/30 hover:bg-sky-400"
              >
                <GitCommit className="h-4 w-4" /> حساب عناصر وتدريج المنحنى
              </button>
            </div>
          </section>

          <section className="glass-card p-5 sm:p-7 space-y-4">
            <h3 className="text-base font-bold text-white">عناصر المنحنى المحسوبة</h3>
            <p className="text-xs text-slate-500">نتائج التصميم الهندسي للمنحنى الدائري</p>

            {curveResult ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-400 block">طول القوس (Arc Length - L)</span>
                    <p dir="ltr" className="text-base font-bold text-emerald-400 mt-0.5">
                      {curveResult.arcLength.toFixed(3)} م
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-400 block">طول المماس (Tangent - T)</span>
                    <p dir="ltr" className="text-base font-bold text-sky-400 mt-0.5">
                      {curveResult.tangentLength.toFixed(3)} م
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-400 block">الوتر الطويل (Long Chord - C)</span>
                    <p dir="ltr" className="text-base font-bold text-slate-200 mt-0.5">
                      {curveResult.longChord.toFixed(3)} م
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-400 block">المسافة الخارجية (External - E)</span>
                    <p dir="ltr" className="text-base font-bold text-slate-200 mt-0.5">
                      {curveResult.externalDistance.toFixed(3)} م
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-400 block">سهم المنحنى (Middle Ordinate - M)</span>
                    <p dir="ltr" className="text-base font-bold text-slate-200 mt-0.5">
                      {curveResult.middleOrdinate.toFixed(3)} م
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-400 block">درجة التقوس (Degree - D)</span>
                    <p dir="ltr" className="text-base font-bold text-amber-400 mt-0.5">
                      {curveResult.degreeOfCurve.toFixed(3)}°
                    </p>
                  </div>
                </div>

                {curvePiStation && !isNaN(parseFloat(curvePiStation)) && (
                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5 text-xs space-y-1">
                    <span className="font-bold text-sky-300 block mb-1">محطات التدريج المحسوبة (Curve Stations):</span>
                    <div className="flex justify-between text-slate-300">
                      <span>بداية المنحنى (PC Station):</span>
                      <strong className="text-white" dir="ltr">{(parseFloat(curvePiStation) - curveResult.tangentLength).toFixed(3)}</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>نقطة التقاطع (PI Station):</span>
                      <strong className="text-white" dir="ltr">{parseFloat(curvePiStation).toFixed(3)}</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>نهاية المنحنى (PT Station):</span>
                      <strong className="text-white" dir="ltr">{(parseFloat(curvePiStation) - curveResult.tangentLength + curveResult.arcLength).toFixed(3)}</strong>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <GitCommit className="h-10 w-10 text-slate-700 mb-2" />
                <p className="text-xs text-slate-500">أدخل R و Delta واضغط حساب</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. LEVELING TAB */}
      {/* ========================================================================= */}
      {activeTab === 'leveling' && (
        <section className="glass-card p-5 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white">جدول ومراجعة الميزانية الهندسية (Differential Leveling)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                حساب المناسيب بطريقتي سطح الميزان (HI) والارتفاع والانخفاض (Rise & Fall) مع تدقيق قفل الميزانية
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-400">منسوب أول نقطة (BM):</label>
              <input
                type="number"
                dir="ltr"
                value={levelingBm}
                onChange={(e) => setLevelingBm(e.target.value)}
                className="h-9 w-28 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs font-bold text-emerald-400"
              />
              <button
                onClick={handleCalculateLeveling}
                className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-white hover:bg-sky-400"
              >
                تحديث وحساب الجدول
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="p-3">النقطة</th>
                  <th className="p-3">قراءة خلفية (BS)</th>
                  <th className="p-3">قراءة متوسطة (IS)</th>
                  <th className="p-3">قراءة أمامية (FS)</th>
                  <th className="p-3">سطح الميزان (HI)</th>
                  <th className="p-3">المنسوب (RL)</th>
                  <th className="p-3">ملاحظات</th>
                  <th className="p-3">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 font-mono text-[11px]">
                {levelingRows.map((row, idx) => {
                  const reduced = levelingResult?.stations[idx];
                  return (
                    <tr key={idx}>
                      <td className="p-2 font-sans">
                        <input
                          value={row.stationName}
                          onChange={(e) => {
                            const copy = [...levelingRows];
                            copy[idx].stationName = e.target.value;
                            setLevelingRows(copy);
                          }}
                          className="h-8 w-20 rounded border border-slate-800 bg-slate-900 px-2 text-xs text-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          dir="ltr"
                          value={row.backSight}
                          onChange={(e) => {
                            const copy = [...levelingRows];
                            copy[idx].backSight = e.target.value;
                            setLevelingRows(copy);
                          }}
                          placeholder="—"
                          className="h-8 w-20 rounded border border-slate-800 bg-slate-900 px-2 text-xs text-sky-300"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          dir="ltr"
                          value={row.intermediateSight}
                          onChange={(e) => {
                            const copy = [...levelingRows];
                            copy[idx].intermediateSight = e.target.value;
                            setLevelingRows(copy);
                          }}
                          placeholder="—"
                          className="h-8 w-20 rounded border border-slate-800 bg-slate-900 px-2 text-xs text-slate-300"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          dir="ltr"
                          value={row.foreSight}
                          onChange={(e) => {
                            const copy = [...levelingRows];
                            copy[idx].foreSight = e.target.value;
                            setLevelingRows(copy);
                          }}
                          placeholder="—"
                          className="h-8 w-20 rounded border border-slate-800 bg-slate-900 px-2 text-xs text-orange-300"
                        />
                      </td>
                      <td className="p-3 text-slate-400" dir="ltr">
                        {reduced?.heightOfInstrument ? reduced.heightOfInstrument.toFixed(3) : '—'}
                      </td>
                      <td className="p-3 font-bold text-emerald-400" dir="ltr">
                        {reduced?.reducedLevel ? reduced.reducedLevel.toFixed(3) : '—'}
                      </td>
                      <td className="p-2 font-sans">
                        <input
                          value={row.remarks}
                          onChange={(e) => {
                            const copy = [...levelingRows];
                            copy[idx].remarks = e.target.value;
                            setLevelingRows(copy);
                          }}
                          className="h-8 w-32 rounded border border-slate-800 bg-slate-900 px-2 text-xs text-slate-400"
                        />
                      </td>
                      <td className="p-2 font-sans">
                        <button
                          onClick={() => {
                            if (levelingRows.length <= 2) {
                              toast.error('يجب بقاء صفين على الأقل');
                              return;
                            }
                            setLevelingRows(levelingRows.filter((_, i) => i !== idx));
                          }}
                          className="rounded p-1 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={() => {
                setLevelingRows([
                  ...levelingRows,
                  {
                    stationName: `St-${levelingRows.length + 1}`,
                    backSight: '',
                    intermediateSight: '',
                    foreSight: '',
                    remarks: '',
                  },
                ]);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" /> إضافة صف قراءة
            </button>

            {levelingResult && (
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="text-slate-400">
                  مجموع BS: <strong className="text-white">{levelingResult.sumBackSight.toFixed(3)}</strong>
                </span>
                <span className="text-slate-400">
                  مجموع FS: <strong className="text-white">{levelingResult.sumForeSight.toFixed(3)}</strong>
                </span>
                <span
                  className={`rounded-xl px-3 py-1.5 font-bold ${
                    levelingResult.isClosed
                      ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                      : 'border border-amber-500/30 bg-amber-500/15 text-amber-400'
                  }`}
                >
                  خطأ القفل (Misclosure): {levelingResult.misclosure.toFixed(3)} م
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 6. AREA & GEOMETRY TAB */}
      {/* ========================================================================= */}
      {activeTab === 'area_geom' && (
        <section className="glass-card p-5 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white">حساب المساحات والمحيط ومركز الثقل (Area & Geometry)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                حساب المساحة المسقطة 2D (Gauss Shoelace Formula) والتحويل التلقائي للوحدات الزراعية والدولية
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">نطاق النقاط:</span>
              <button
                onClick={() => setAreaPointScope('ALL')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  areaPointScope === 'ALL'
                    ? 'bg-sky-500 text-white'
                    : 'border border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                كل نقاط المشروع ({points.length})
              </button>
              <button
                onClick={() => setAreaPointScope('SELECTED')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  areaPointScope === 'SELECTED'
                    ? 'bg-sky-500 text-white'
                    : 'border border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                النقاط المحددة ({selectedPointIds.length})
              </button>
            </div>
          </div>

          {geometryCalculations ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-1">
                <span className="text-xs font-semibold text-emerald-300 block">المساحة الإجمالية (م²)</span>
                <p dir="ltr" className="text-2xl font-bold text-emerald-400">
                  {geometryCalculations.areaM2.toFixed(3)} م²
                </p>
                <span className="text-[11px] text-slate-400 block pt-1">
                  المحيط الخارجي: {geometryCalculations.perimeterM.toFixed(3)} م
                </span>
              </div>

              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5 space-y-1">
                <span className="text-xs font-semibold text-sky-300 block">الوحدات الزراعية (فدان - قيراط - سهم)</span>
                <p className="text-base font-bold text-white pt-1">
                  {geometryCalculations.feddans} فدان و {geometryCalculations.qirats} قيراط و {geometryCalculations.sahms} سهم
                </p>
                <span className="text-[10px] text-slate-400 block pt-1">
                  (الفدان = 4200.833 م² | القيراط = 175.035 م²)
                </span>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-1">
                <span className="text-xs font-semibold text-slate-400 block">الوحدات الدولية (Hectare / Acre)</span>
                <p dir="ltr" className="text-sm font-bold text-slate-200 pt-1">
                  {geometryCalculations.hectares} هكتار (ha)
                </p>
                <p dir="ltr" className="text-sm font-bold text-slate-400">
                  {geometryCalculations.acres} فدان دولي (Acres)
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-1">
                <span className="text-xs font-semibold text-slate-400 block">مركز الثقل الهندسي (Centroid)</span>
                <p dir="ltr" className="text-xs font-mono text-sky-300 pt-1">
                  E: {geometryCalculations.centroid.easting.toFixed(3)}
                </p>
                <p dir="ltr" className="text-xs font-mono text-sky-300">
                  N: {geometryCalculations.centroid.northing.toFixed(3)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Maximize2 className="h-10 w-10 text-slate-700 mb-2" />
              <p className="text-xs text-slate-500">يتطلب حساب المساحة 3 نقاط على الأقل في المشروع أو التحديد</p>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* 7. INTERSECTIONS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'intersections' && (
        <section className="glass-card p-5 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white">التقاطعات والتدريج (Coordinate Geometry Intersections)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                حساب تقاطع الانحرافات، تقاطع المسافات (Trilateration)، والإزاحة عن خط الأساس (Station & Offset)
              </p>
            </div>

            <div className="flex items-center gap-2">
              {[
                { id: 'BEARING_BEARING', label: 'تقاطع انحرافين (Bearing-Bearing)' },
                { id: 'DISTANCE_DISTANCE', label: 'تقاطع مسافتين (Distance-Distance)' },
                { id: 'STATION_OFFSET', label: 'إزاحة خط الأساس (Station & Offset)' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setInterMode(m.id as any)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    interMode === m.id
                      ? 'bg-sky-500 text-white'
                      : 'border border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {interMode === 'BEARING_BEARING' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <span className="text-xs font-bold text-white block">المعطيات: نقطتان وانحرافان</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">P1 Easting, Northing</label>
                    <div className="space-y-1">
                      <input
                        dir="ltr"
                        value={bbP1.easting}
                        onChange={(e) => setBbP1({ ...bbP1, easting: e.target.value })}
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                        placeholder="E1"
                      />
                      <input
                        dir="ltr"
                        value={bbP1.northing}
                        onChange={(e) => setBbP1({ ...bbP1, northing: e.target.value })}
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                        placeholder="N1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">الانحراف من P1 (Azimuth 1 °)</label>
                    <input
                      type="number"
                      dir="ltr"
                      value={bbAz1}
                      onChange={(e) => setBbAz1(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-sky-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">P2 Easting, Northing</label>
                    <div className="space-y-1">
                      <input
                        dir="ltr"
                        value={bbP2.easting}
                        onChange={(e) => setBbP2({ ...bbP2, easting: e.target.value })}
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                        placeholder="E2"
                      />
                      <input
                        dir="ltr"
                        value={bbP2.northing}
                        onChange={(e) => setBbP2({ ...bbP2, northing: e.target.value })}
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                        placeholder="N2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">الانحراف من P2 (Azimuth 2 °)</label>
                    <input
                      type="number"
                      dir="ltr"
                      value={bbAz2}
                      onChange={(e) => setBbAz2(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-emerald-300"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCalculateIntersection}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-xs font-bold text-white hover:bg-sky-400"
                >
                  <Crosshair className="h-4 w-4" /> حساب نقطة التقاطع
                </button>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                <h4 className="text-sm font-bold text-white mb-2">نتيجة تقاطع الانحرافين</h4>
                {bbResult && bbResult.isValid && bbResult.intersectionPoint ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3.5">
                      <span className="text-[11px] text-slate-400 block">إحداثيات نقطة التقاطع الفريدة:</span>
                      <p dir="ltr" className="text-lg font-bold text-sky-300 mt-1">
                        E: {bbResult.intersectionPoint.easting.toFixed(4)}
                      </p>
                      <p dir="ltr" className="text-lg font-bold text-sky-300">
                        N: {bbResult.intersectionPoint.northing.toFixed(4)}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
                        <span className="text-slate-500 block text-[10px]">المسافة من P1:</span>
                        <span className="font-bold">{bbResult.distanceFromP1?.toFixed(3)} م</span>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
                        <span className="text-slate-500 block text-[10px]">المسافة من P2:</span>
                        <span className="font-bold">{bbResult.distanceFromP2?.toFixed(3)} م</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-8 text-center">أدخل المعطيات واضغط حساب</p>
                )}
              </div>
            </div>
          )}

          {interMode === 'DISTANCE_DISTANCE' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <span className="text-xs font-bold text-white block">المعطيات: نقطتان ومسافتان (نصفي قطرين)</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">P1 (E, N)</label>
                    <input
                      dir="ltr"
                      value={ddP1.easting}
                      onChange={(e) => setDdP1({ ...ddP1, easting: e.target.value })}
                      className="h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 text-xs text-white mb-1"
                      placeholder="E1"
                    />
                    <input
                      dir="ltr"
                      value={ddP1.northing}
                      onChange={(e) => setDdP1({ ...ddP1, northing: e.target.value })}
                      className="h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                      placeholder="N1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">المسافة من P1 (R1 م)</label>
                    <input
                      type="number"
                      dir="ltr"
                      value={ddR1}
                      onChange={(e) => setDdR1(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-sky-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">P2 (E, N)</label>
                    <input
                      dir="ltr"
                      value={ddP2.easting}
                      onChange={(e) => setDdP2({ ...ddP2, easting: e.target.value })}
                      className="h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 text-xs text-white mb-1"
                      placeholder="E2"
                    />
                    <input
                      dir="ltr"
                      value={ddP2.northing}
                      onChange={(e) => setDdP2({ ...ddP2, northing: e.target.value })}
                      className="h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                      placeholder="N2"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">المسافة من P2 (R2 م)</label>
                    <input
                      type="number"
                      dir="ltr"
                      value={ddR2}
                      onChange={(e) => setDdR2(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-emerald-300"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCalculateIntersection}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-xs font-bold text-white hover:bg-sky-400"
                >
                  <Crosshair className="h-4 w-4" /> حساب تقاطع المسافتين (الحلان الممكنان)
                </button>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                <h4 className="text-sm font-bold text-white mb-2">حلول التقاطع (Trilateration Solutions)</h4>
                {ddResult && ddResult.isValid ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3">
                      <span className="text-[11px] font-bold text-sky-300 block">الحل الأول (يمين خط الأساس):</span>
                      <p dir="ltr" className="text-sm font-bold text-white mt-1">
                        E: {ddResult.solution1?.easting.toFixed(4)}, N: {ddResult.solution1?.northing.toFixed(4)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <span className="text-[11px] font-bold text-emerald-300 block">الحل الثاني (يسار خط الأساس):</span>
                      <p dir="ltr" className="text-sm font-bold text-white mt-1">
                        E: {ddResult.solution2?.easting.toFixed(4)}, N: {ddResult.solution2?.northing.toFixed(4)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-8 text-center">أدخل المعطيات واضغط حساب</p>
                )}
              </div>
            </div>
          )}

          {interMode === 'STATION_OFFSET' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <span className="text-xs font-bold text-white block">خط الأساس (Baseline A → B) والنقطة المراد قياسها:</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">نقطة بداية خط الأساس A (E, N)</label>
                    <input
                      dir="ltr"
                      value={soBaseA.easting}
                      onChange={(e) => setSoBaseA({ ...soBaseA, easting: e.target.value })}
                      className="h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 text-xs text-white mb-1"
                      placeholder="E_A"
                    />
                    <input
                      dir="ltr"
                      value={soBaseA.northing}
                      onChange={(e) => setSoBaseA({ ...soBaseA, northing: e.target.value })}
                      className="h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                      placeholder="N_A"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">نقطة نهاية خط الأساس B (E, N)</label>
                    <input
                      dir="ltr"
                      value={soBaseB.easting}
                      onChange={(e) => setSoBaseB({ ...soBaseB, easting: e.target.value })}
                      className="h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 text-xs text-white mb-1"
                      placeholder="E_B"
                    />
                    <input
                      dir="ltr"
                      value={soBaseB.northing}
                      onChange={(e) => setSoBaseB({ ...soBaseB, northing: e.target.value })}
                      className="h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                      placeholder="N_B"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">النقطة المستهدفة Point P (E, N):</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      dir="ltr"
                      value={soTestPt.easting}
                      onChange={(e) => setSoTestPt({ ...soTestPt, easting: e.target.value })}
                      className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                      placeholder="E_P"
                    />
                    <input
                      dir="ltr"
                      value={soTestPt.northing}
                      onChange={(e) => setSoTestPt({ ...soTestPt, northing: e.target.value })}
                      className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                      placeholder="N_P"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCalculateIntersection}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-xs font-bold text-white hover:bg-sky-400"
                >
                  <Ruler className="h-4 w-4" /> حساب التدريج (Stationing) والإزاحة
                </button>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                <h4 className="text-sm font-bold text-white mb-2">نتائج التدريج والإزاحة العمودية</h4>
                {soResult && soResult.isValid ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3.5">
                      <span className="text-[11px] text-slate-400 block">المحطة على طول الخط (Station / Chainage):</span>
                      <p dir="ltr" className="text-xl font-bold text-sky-300 mt-1">
                        Sta {soResult.station.toFixed(3)} م
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5">
                      <span className="text-[11px] text-slate-400 block">الإزاحة العمودية عن الخط (Offset):</span>
                      <p className="text-base font-bold text-emerald-400 mt-1">
                        {soResult.offsetDistance.toFixed(3)} م ({soResult.offsetSide === 'RIGHT' ? 'يمين خط الأساس' : soResult.offsetSide === 'LEFT' ? 'يسار خط الأساس' : 'على خط الأساس مباشرة'})
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-8 text-center">أدخل المعطيات واضغط حساب</p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* 8. EARTHWORK TAB (TRIBUTARY GRID) */}
      {/* ========================================================================= */}
      {activeTab === 'earthwork' && (
        <section className="glass-card p-5 sm:p-7 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white">حساب كميات الحفر والردم (Earthwork - Tributary Grid Method)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تقدير مكعبات الحفر والردم بنموذج المساحة الرافدة (Discrete Tributary Grid) للنقاط المساحية الحقيقية
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">منسوب التصميم المستهدف (Z م):</label>
                <input
                  type="number"
                  step="any"
                  dir="ltr"
                  value={designElevation}
                  onChange={(e) => setDesignElevation(e.target.value)}
                  className="h-9 w-28 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs font-bold text-sky-400"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">معامل الانتفاش (Bulking):</label>
                <input
                  type="number"
                  step="0.05"
                  dir="ltr"
                  value={bulkingFactor}
                  onChange={(e) => setBulkingFactor(e.target.value)}
                  className="h-9 w-20 rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs font-bold text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Methodology Disclaimer Banner */}
          <div className="flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-xs text-sky-200">
            <Info className="h-5 w-5 shrink-0 text-sky-400 mt-0.5" />
            <div>
              <strong className="text-white block mb-0.5">منهجية الحساب (Tributary Grid Methodology):</strong>
              تعتمد هذه الحسابات على تقسيم مساحة الرفع الكلية بالتساوي على عدد النقاط المساحية المرفوعة (Tributary Area per Point) وحساب عمق القطع أو الردم لكل نقطة نسبة إلى منسوب التأسيس التصميمي. هذا الحساب لا يمثل سطح شبكي مثلثي مستمر (TIN Mesh)، وإنما يقدم تقديراً سريعاً معتمداً على توزيع النقاط.
            </div>
          </div>

          {earthworkCalc ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 space-y-1">
                  <span className="text-xs font-semibold text-red-300 block">إجمالي كمية الحفر (Cut Volume)</span>
                  <p dir="ltr" className="text-2xl font-bold text-red-400">
                    {earthworkCalc.totalCutVolumeM3.toFixed(2)} م³
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-1">
                  <span className="text-xs font-semibold text-emerald-300 block">إجمالي كمية الردم (Fill Volume)</span>
                  <p dir="ltr" className="text-2xl font-bold text-emerald-400">
                    {earthworkCalc.totalFillVolumeM3.toFixed(2)} م³
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-1">
                  <span className="text-xs font-semibold text-slate-400 block">صافي التوازن (Net Balance)</span>
                  <p dir="ltr" className={`text-xl font-bold ${earthworkCalc.netBalanceM3 >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {earthworkCalc.netBalanceM3 >= 0 ? `+${earthworkCalc.netBalanceM3.toFixed(2)} م³ (فائض حفر)` : `${earthworkCalc.netBalanceM3.toFixed(2)} م³ (عجز ردم)`}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-1">
                  <span className="text-xs font-semibold text-slate-400 block">إحصائيات المناسيب السطحية</span>
                  <p className="text-xs text-slate-300 pt-1">
                    متوسط المنسوب: <strong className="text-white" dir="ltr">{earthworkCalc.avgElevation.toFixed(2)} م</strong>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    المدى: {earthworkCalc.minElevation.toFixed(2)} م إلى {earthworkCalc.maxElevation.toFixed(2)} م
                  </p>
                </div>
              </div>

              {/* Point Breakdown Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-400">
                    <tr>
                      <th className="p-3">رقم النقطة</th>
                      <th className="p-3">المنسوب الفعلي (Z)</th>
                      <th className="p-3">المنسوب التصميمي</th>
                      <th className="p-3">فرق الارتفاع (ΔZ)</th>
                      <th className="p-3">النوع</th>
                      <th className="p-3">العمق (م)</th>
                      <th className="p-3">الحجم المقدر (م³)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-mono text-[11px]">
                    {earthworkCalc.breakdown.slice(0, 10).map((row, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-sans font-bold text-white">P{row.pointNumber}</td>
                        <td className="p-2.5 text-slate-300">{row.originalZ.toFixed(3)}</td>
                        <td className="p-2.5 text-sky-400">{row.designZ.toFixed(3)}</td>
                        <td className="p-2.5 text-slate-400">{row.diffZ.toFixed(3)}</td>
                        <td className="p-2.5 font-sans">
                          <span
                            className={`rounded px-2 py-0.5 font-bold ${
                              row.type === 'CUT' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            {row.type === 'CUT' ? 'حفر Cut' : 'ردم Fill'}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-200">{row.depth.toFixed(3)}</td>
                        <td className="p-2.5 font-bold text-white">{row.volume.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mountain className="h-10 w-10 text-slate-700 mb-2" />
              <p className="text-xs text-slate-500">يتطلب حساب الكميات 3 نقاط على الأقل في المشروع</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeftRight,
  Compass,
  CornerDownRight,
  GitCommit,
  Layers,
  MapPin,
  MoveRight,
  Plus,
  RefreshCw,
  Ruler,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, type PointRecord } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import {
  calculateCircularCurve,
  calculateForward,
  calculateInverse,
  interpolateLinePoints,
  reduceLevelingLoop,
  type CircularCurveResult,
  type ForwardResult,
  type InverseResult,
  type LevelingLoopResult,
} from '@/lib/cogo-engine';

type CogoTab = 'inverse' | 'forward' | 'interpolation' | 'curves' | 'leveling';

export function CogoCalculator() {
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const livePoints = useLiveQuery(
    () => db.points.where('projectId').equals(currentProjectId).sortBy('pointNumber'),
    [currentProjectId]
  );
  const points = useMemo(() => livePoints ?? [], [livePoints]);

  const [activeTab, setActiveTab] = useState<CogoTab>('inverse');

  // INVERSE STATE
  const [invP1Id, setInvP1Id] = useState<string>('');
  const [invP2Id, setInvP2Id] = useState<string>('');
  const [invManualP1, setInvManualP1] = useState({ easting: '', northing: '', elevation: '' });
  const [invManualP2, setInvManualP2] = useState({ easting: '', northing: '', elevation: '' });
  const [inverseResult, setInverseResult] = useState<InverseResult | null>(null);

  // FORWARD STATE
  const [fwdStart, setFwdStart] = useState({ easting: '673450.25', northing: '2736120.40', elevation: '648.50' });
  const [fwdAzimuth, setFwdAzimuth] = useState('45.50');
  const [fwdDistance, setFwdDistance] = useState('125.00');
  const [fwdDeltaZ, setFwdDeltaZ] = useState('1.50');
  const [forwardResult, setForwardResult] = useState<ForwardResult | null>(null);

  // INTERPOLATION STATE
  const [interpStart, setInterpStart] = useState({ easting: '673450.25', northing: '2736120.40', elevation: '648.50' });
  const [interpEnd, setInterpEnd] = useState({ easting: '673620.15', northing: '2736030.75', elevation: '651.05' });
  const [interpInterval, setInterpInterval] = useState('25');
  const [interpResults, setInterpResults] = useState<
    Array<{ station: number; easting: number; northing: number; elevation: number }>
  >([]);

  // CURVE STATE
  const [curveRadius, setCurveRadius] = useState('250');
  const [curveDelta, setCurveDelta] = useState('35.5');
  const [curveResult, setCurveResult] = useState<CircularCurveResult | null>(null);

  // LEVELING STATE
  const [levelingBm, setLevelingBm] = useState('100.000');
  const [levelingRows, setLevelingRows] = useState<
    Array<{
      stationName: string;
      backSight: string;
      intermediateSight: string;
      foreSight: string;
      remarks: string;
    }>
  >([
    { stationName: 'BM-1', backSight: '1.450', intermediateSight: '', foreSight: '', remarks: 'نقطة المرجع الثابتة' },
    { stationName: 'St-1', backSight: '', intermediateSight: '2.100', foreSight: '', remarks: 'منسوب طبيعي' },
    { stationName: 'CP-1', backSight: '0.950', intermediateSight: '', foreSight: '1.850', remarks: 'نقطة دوران' },
    { stationName: 'St-2', backSight: '', intermediateSight: '', foreSight: '1.200', remarks: 'نقطة ختام الميزانية' },
  ]);
  const [levelingResult, setLevelingResult] = useState<LevelingLoopResult | null>(null);

  // Inverse Calculation Handler
  const handleCalculateInverse = () => {
    let p1 = { easting: 0, northing: 0, elevation: 0 };
    let p2 = { easting: 0, northing: 0, elevation: 0 };

    if (invP1Id && invP2Id) {
      const pt1 = points.find((p) => p.id === invP1Id);
      const pt2 = points.find((p) => p.id === invP2Id);
      if (!pt1 || !pt2) {
        toast.error('اختر نقطتين صحيحتين من المشروع');
        return;
      }
      p1 = pt1;
      p2 = pt2;
    } else {
      const e1 = parseFloat(invManualP1.easting);
      const n1 = parseFloat(invManualP1.northing);
      const z1 = parseFloat(invManualP1.elevation || '0');
      const e2 = parseFloat(invManualP2.easting);
      const n2 = parseFloat(invManualP2.northing);
      const z2 = parseFloat(invManualP2.elevation || '0');

      if ([e1, n1, e2, n2].some(isNaN)) {
        toast.error('أدخل إحداثيات صحيحة للنقطتين');
        return;
      }
      p1 = { easting: e1, northing: n1, elevation: z1 };
      p2 = { easting: e2, northing: n2, elevation: z2 };
    }

    const res = calculateInverse(p1, p2);
    setInverseResult(res);
    toast.success('تم حساب المسافة والانحراف بنجاح');
  };

  // Forward Calculation Handler
  const handleCalculateForward = () => {
    const e = parseFloat(fwdStart.easting);
    const n = parseFloat(fwdStart.northing);
    const z = parseFloat(fwdStart.elevation || '0');
    const az = parseFloat(fwdAzimuth);
    const dist = parseFloat(fwdDistance);
    const dz = parseFloat(fwdDeltaZ || '0');

    if ([e, n, az, dist].some(isNaN)) {
      toast.error('أدخل جميع مدخلات الحساب المباشر بدقة');
      return;
    }

    const res = calculateForward({ easting: e, northing: n, elevation: z }, az, dist, dz);
    setForwardResult(res);
    toast.success('تم حساب إحداثيات النقطة المستهدفة');
  };

  // Curve Calculation Handler
  const handleCalculateCurve = () => {
    const r = parseFloat(curveRadius);
    const d = parseFloat(curveDelta);
    if (isNaN(r) || isNaN(d) || r <= 0 || d <= 0) {
      toast.error('أدخل نصف القطر وزاوية الانحراف بشكل صحيح');
      return;
    }
    const res = calculateCircularCurve(r, d);
    setCurveResult(res);
    toast.success('تم حساب عناصر المنحنى الدائري');
  };

  // Leveling Handler
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
    toast.success('تم جدول ومراجعة ميزانية المناسيب');
  };

  return (
    <div className="space-y-6">
      {/* NAVIGATION TABS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'inverse', label: 'الحساب العكسي (Inverse)', icon: ArrowLeftRight },
          { id: 'forward', label: 'الحساب المباشر (Forward / Traversing)', icon: MoveRight },
          { id: 'curves', label: 'المنحنيات الدائرية (Horizontal Curves)', icon: GitCommit },
          { id: 'interpolation', label: 'تقسيم المسار (Stationing)', icon: Ruler },
          { id: 'leveling', label: 'جدول الميزانية (Leveling Loop)', icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as CogoTab)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                active
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-950/40'
                  : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. INVERSE TAB */}
      {activeTab === 'inverse' && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="glass-card p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">حساب المسافة والانحراف (COGO Inverse)</h2>
                <p className="mt-1 text-xs text-slate-400">
                  حساب المسافة الأفقية والمائلة، زاوية الانحراف الدائري والربعي بين نقطتين
                </p>
              </div>
            </div>

            {points.length >= 2 && (
              <div className="mb-5 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                <span className="mb-2 block text-xs font-semibold text-sky-300">
                  اختيار سريع من نقاط المشروع:
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={invP1Id}
                    onChange={(e) => setInvP1Id(e.target.value)}
                    className="h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
                  >
                    <option value="">النقطة الأولى (P1)...</option>
                    {points.map((p) => (
                      <option key={p.id} value={p.id}>
                        P{p.pointNumber} - {p.description || `E:${p.easting.toFixed(1)}`}
                      </option>
                    ))}
                  </select>

                  <select
                    value={invP2Id}
                    onChange={(e) => setInvP2Id(e.target.value)}
                    className="h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
                  >
                    <option value="">النقطة الثانية (P2)...</option>
                    {points.map((p) => (
                      <option key={p.id} value={p.id}>
                        P{p.pointNumber} - {p.description || `E:${p.easting.toFixed(1)}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <span className="mb-3 block text-xs font-bold text-slate-300">النقطة الأولى P1</span>
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    type="number"
                    dir="ltr"
                    placeholder="Easting X"
                    value={invManualP1.easting}
                    onChange={(e) => setInvManualP1({ ...invManualP1, easting: e.target.value })}
                    className="h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
                  />
                  <input
                    type="number"
                    dir="ltr"
                    placeholder="Northing Y"
                    value={invManualP1.northing}
                    onChange={(e) => setInvManualP1({ ...invManualP1, northing: e.target.value })}
                    className="h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
                  />
                  <input
                    type="number"
                    dir="ltr"
                    placeholder="Elevation Z (اختياري)"
                    value={invManualP1.elevation}
                    onChange={(e) => setInvManualP1({ ...invManualP1, elevation: e.target.value })}
                    className="h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <span className="mb-3 block text-xs font-bold text-slate-300">النقطة الثانية P2</span>
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    type="number"
                    dir="ltr"
                    placeholder="Easting X"
                    value={invManualP2.easting}
                    onChange={(e) => setInvManualP2({ ...invManualP2, easting: e.target.value })}
                    className="h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
                  />
                  <input
                    type="number"
                    dir="ltr"
                    placeholder="Northing Y"
                    value={invManualP2.northing}
                    onChange={(e) => setInvManualP2({ ...invManualP2, northing: e.target.value })}
                    className="h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
                  />
                  <input
                    type="number"
                    dir="ltr"
                    placeholder="Elevation Z (اختياري)"
                    value={invManualP2.elevation}
                    onChange={(e) => setInvManualP2({ ...invManualP2, elevation: e.target.value })}
                    className="h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <button
                onClick={handleCalculateInverse}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-xs font-bold text-white shadow-lg shadow-sky-950/30 transition-all hover:bg-sky-400"
              >
                <ArrowLeftRight className="h-4 w-4" />
                حساب المسافة والانحراف
              </button>
            </div>
          </section>

          {/* Inverse Result Display */}
          <section className="glass-card p-5 sm:p-7">
            <h3 className="text-base font-bold text-white">نتائج الحساب الهندسي</h3>
            <p className="mt-1 text-xs text-slate-500">القيم الهندسية المستنتجة بدقة سنتيمترية</p>

            {inverseResult ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <span className="text-xs text-slate-500">المسافة الأفقية (Horizontal Distance)</span>
                  <p dir="ltr" className="text-xl font-bold text-emerald-400">
                    {inverseResult.horizontalDistance.toFixed(4)} م
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-500">المسافة المائلة (Slope Dist)</span>
                    <p dir="ltr" className="text-sm font-bold text-slate-200">
                      {inverseResult.slopeDistance.toFixed(4)} م
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-500">فرق الارتفاع (Delta Z)</span>
                    <p dir="ltr" className="text-sm font-bold text-sky-400">
                      {inverseResult.deltaElevation > 0 ? '+' : ''}
                      {inverseResult.deltaElevation.toFixed(3)} م
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                  <span className="text-xs text-slate-400">الانحراف الدائري (Azimuth)</span>
                  <p dir="ltr" className="mt-1 text-lg font-bold text-sky-300">
                    {inverseResult.azimuthDMS.formatted} ({inverseResult.azimuthDecimal.toFixed(4)}°)
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <span className="text-xs text-slate-400">الانحراف الربع دائري (Quadrant Bearing)</span>
                  <p dir="ltr" className="mt-1 text-base font-bold text-amber-400">
                    {inverseResult.bearing}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-500">ميل الخط (Grade %)</span>
                    <p dir="ltr" className="text-sm font-bold text-slate-200">
                      {inverseResult.slopePercent.toFixed(2)}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-[11px] text-slate-500">نسبة الميل (Slope Ratio)</span>
                    <p className="text-xs font-bold text-slate-300">{inverseResult.slopeRatio}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-10 flex flex-col items-center justify-center text-center">
                <Compass className="h-10 w-10 text-slate-700" />
                <p className="mt-3 text-xs text-slate-500">حدد النقطتين واضغط حساب لعرض النتائج</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 2. FORWARD TAB */}
      {activeTab === 'forward' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="glass-card p-5 sm:p-7">
            <h2 className="text-lg font-bold text-white">الحساب المباشر (COGO Forward)</h2>
            <p className="mt-1 text-xs text-slate-400">
              حساب إحداثيات نقطة الهدف بمعلومية نقطة البداية، الانحراف والمسافة
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <span className="mb-2 block text-xs font-semibold text-slate-300">نقطة البداية (Start Station)</span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    dir="ltr"
                    placeholder="Easting X"
                    value={fwdStart.easting}
                    onChange={(e) => setFwdStart({ ...fwdStart, easting: e.target.value })}
                    className="h-10 rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-xs text-white"
                  />
                  <input
                    type="number"
                    dir="ltr"
                    placeholder="Northing Y"
                    value={fwdStart.northing}
                    onChange={(e) => setFwdStart({ ...fwdStart, northing: e.target.value })}
                    className="h-10 rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-xs text-white"
                  />
                  <input
                    type="number"
                    dir="ltr"
                    placeholder="Elevation Z"
                    value={fwdStart.elevation}
                    onChange={(e) => setFwdStart({ ...fwdStart, elevation: e.target.value })}
                    className="h-10 rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-400">
                    الانحراف الدائري (Azimuth °)
                  </label>
                  <input
                    type="number"
                    step="any"
                    dir="ltr"
                    value={fwdAzimuth}
                    onChange={(e) => setFwdAzimuth(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-400">المسافة الأفقية (م)</label>
                  <input
                    type="number"
                    step="any"
                    dir="ltr"
                    value={fwdDistance}
                    onChange={(e) => setFwdDistance(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-400">فرق المنسوب Delta Z (م)</label>
                <input
                  type="number"
                  step="any"
                  dir="ltr"
                  value={fwdDeltaZ}
                  onChange={(e) => setFwdDeltaZ(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-xs text-white"
                />
              </div>

              <button
                onClick={handleCalculateForward}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-xs font-bold text-white shadow-lg shadow-sky-950/30 transition-all hover:bg-sky-400"
              >
                <MoveRight className="h-4 w-4" />
                حساب إحداثيات النقطة المستهدفة
              </button>
            </div>
          </section>

          <section className="glass-card p-5 sm:p-7">
            <h3 className="text-base font-bold text-white">إحداثيات النقطة المستهدفة (Target Coordinates)</h3>
            <p className="mt-1 text-xs text-slate-500">الإحداثيات الناتجة بعد تطبيق المسافة والزاوية</p>

            {forwardResult ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                  <span className="text-xs text-slate-400">الشرق (Easting / X)</span>
                  <p dir="ltr" className="mt-1 text-xl font-bold text-sky-300">
                    {forwardResult.easting.toFixed(4)}
                  </p>
                </div>
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                  <span className="text-xs text-slate-400">الشمال (Northing / Y)</span>
                  <p dir="ltr" className="mt-1 text-xl font-bold text-sky-300">
                    {forwardResult.northing.toFixed(4)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <span className="text-xs text-slate-400">المنسوب (Elevation / Z)</span>
                  <p dir="ltr" className="mt-1 text-xl font-bold text-emerald-400">
                    {forwardResult.elevation.toFixed(3)} م
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-10 flex flex-col items-center justify-center text-center">
                <MoveRight className="h-10 w-10 text-slate-700" />
                <p className="mt-3 text-xs text-slate-500">أدخل المعطيات واضغط حساب</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 3. CURVES TAB */}
      {activeTab === 'curves' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="glass-card p-5 sm:p-7">
            <h2 className="text-lg font-bold text-white">حساب المنحنيات الأفقية (Circular Curves)</h2>
            <p className="mt-1 text-xs text-slate-400">
              حساب كامل عناصر المنحنى الدائري البسيط للطرق والسكك الحديدية
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-400">
                  نصف قطر المنحنى Radius (R) بالمتر
                </label>
                <input
                  type="number"
                  dir="ltr"
                  value={curveRadius}
                  onChange={(e) => setCurveRadius(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-xs text-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-400">
                  زاوية الانحراف المركزية Delta (Δ) بالدرجات العشرية
                </label>
                <input
                  type="number"
                  dir="ltr"
                  value={curveDelta}
                  onChange={(e) => setCurveDelta(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-xs text-white"
                />
              </div>

              <button
                onClick={handleCalculateCurve}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-xs font-bold text-white shadow-lg shadow-sky-950/30 transition-all hover:bg-sky-400"
              >
                <GitCommit className="h-4 w-4" />
                حساب عناصر المنحنى
              </button>
            </div>
          </section>

          <section className="glass-card p-5 sm:p-7">
            <h3 className="text-base font-bold text-white">عناصر المنحنى المحسوبة</h3>
            <p className="mt-1 text-xs text-slate-500">نتائج التصميم الهندسي للمنحنى</p>

            {curveResult ? (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <span className="text-[11px] text-slate-500">طول القوس (Arc Length - L)</span>
                  <p dir="ltr" className="text-sm font-bold text-emerald-400">
                    {curveResult.arcLength.toFixed(3)} م
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <span className="text-[11px] text-slate-500">طول المماس (Tangent - T)</span>
                  <p dir="ltr" className="text-sm font-bold text-sky-400">
                    {curveResult.tangentLength.toFixed(3)} م
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <span className="text-[11px] text-slate-500">طول الوتر الطويل (Long Chord - C)</span>
                  <p dir="ltr" className="text-sm font-bold text-slate-200">
                    {curveResult.longChord.toFixed(3)} م
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <span className="text-[11px] text-slate-500">المسافة الخارجية (External - E)</span>
                  <p dir="ltr" className="text-sm font-bold text-slate-200">
                    {curveResult.externalDistance.toFixed(3)} م
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <span className="text-[11px] text-slate-500">سهم المنحنى (Middle Ordinate - M)</span>
                  <p dir="ltr" className="text-sm font-bold text-slate-200">
                    {curveResult.middleOrdinate.toFixed(3)} م
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <span className="text-[11px] text-slate-500">درجة التقوس (Degree of Curve - D)</span>
                  <p dir="ltr" className="text-sm font-bold text-amber-400">
                    {curveResult.degreeOfCurve.toFixed(3)}°
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-10 flex flex-col items-center justify-center text-center">
                <GitCommit className="h-10 w-10 text-slate-700" />
                <p className="mt-3 text-xs text-slate-500">أدخل R و Delta واضغط حساب</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 4. LEVELING TAB */}
      {activeTab === 'leveling' && (
        <section className="glass-card p-5 sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">جدول الميزانية الهندسية (Differential Leveling)</h2>
              <p className="mt-1 text-xs text-slate-400">
                حساب المناسيب بطريقتي منسوب سطح الميزان (HI) والارتفاع والانخفاض (Rise & Fall) مع تدقيق قفل الميزانية
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
              <tbody className="divide-y divide-slate-850">
                {levelingRows.map((row, idx) => {
                  const reduced = levelingResult?.stations[idx];
                  return (
                    <tr key={idx}>
                      <td className="p-2">
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
                      <td className="p-2">
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
                      <td className="p-2">
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

          <div className="mt-4 flex items-center justify-between">
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
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" /> إضافة صف قراءة
            </button>

            {levelingResult && (
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-400">
                  مجموع BS: <strong className="text-white">{levelingResult.sumBackSight.toFixed(3)}</strong>
                </span>
                <span className="text-slate-400">
                  مجموع FS: <strong className="text-white">{levelingResult.sumForeSight.toFixed(3)}</strong>
                </span>
                <span
                  className={`rounded-lg px-2.5 py-1 font-bold ${
                    levelingResult.isClosed
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  خطأ القفل (Misclosure): {levelingResult.misclosure.toFixed(3)} م
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5. INTERPOLATION TAB */}
      {activeTab === 'interpolation' && (
        <section className="glass-card p-5 sm:p-7">
          <h2 className="text-lg font-bold text-white">تقسيم وتدريج المسار (Stationing & Interpolation)</h2>
          <p className="mt-1 text-xs text-slate-400">
            توليد نقاط على طول خط المشروع بمسافات متساوية (Stationing) لخدمة أعمال الرصف والتنفيذ
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <span className="mb-2 block text-xs font-semibold text-slate-400">نقطة البداية (Start)</span>
              <div className="space-y-2">
                <input
                  type="number"
                  dir="ltr"
                  placeholder="Easting X"
                  value={interpStart.easting}
                  onChange={(e) => setInterpStart({ ...interpStart, easting: e.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
                <input
                  type="number"
                  dir="ltr"
                  placeholder="Northing Y"
                  value={interpStart.northing}
                  onChange={(e) => setInterpStart({ ...interpStart, northing: e.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
                <input
                  type="number"
                  dir="ltr"
                  placeholder="Elevation Z"
                  value={interpStart.elevation}
                  onChange={(e) => setInterpStart({ ...interpStart, elevation: e.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <span className="mb-2 block text-xs font-semibold text-slate-400">نقطة النهاية (End)</span>
              <div className="space-y-2">
                <input
                  type="number"
                  dir="ltr"
                  placeholder="Easting X"
                  value={interpEnd.easting}
                  onChange={(e) => setInterpEnd({ ...interpEnd, easting: e.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
                <input
                  type="number"
                  dir="ltr"
                  placeholder="Northing Y"
                  value={interpEnd.northing}
                  onChange={(e) => setInterpEnd({ ...interpEnd, northing: e.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
                <input
                  type="number"
                  dir="ltr"
                  placeholder="Elevation Z"
                  value={interpEnd.elevation}
                  onChange={(e) => setInterpEnd({ ...interpEnd, elevation: e.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex flex-col justify-between">
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-400">
                  المسافة البينية Interval (م)
                </label>
                <input
                  type="number"
                  dir="ltr"
                  value={interpInterval}
                  onChange={(e) => setInterpInterval(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
              </div>
              <button
                onClick={() => {
                  const s = {
                    easting: parseFloat(interpStart.easting),
                    northing: parseFloat(interpStart.northing),
                    elevation: parseFloat(interpStart.elevation || '0'),
                  };
                  const en = {
                    easting: parseFloat(interpEnd.easting),
                    northing: parseFloat(interpEnd.northing),
                    elevation: parseFloat(interpEnd.elevation || '0'),
                  };
                  const intv = parseFloat(interpInterval);
                  if (isNaN(intv) || intv <= 0) {
                    toast.error('أدخل مسافة بينية صحيحة');
                    return;
                  }
                  const res = interpolateLinePoints(s, en, intv);
                  setInterpResults(res);
                  toast.success(`تم توليد ${res.length} محطة تدريج`);
                }}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-xs font-bold text-white shadow-lg shadow-sky-950/30 hover:bg-sky-400"
              >
                <Ruler className="h-4 w-4" /> توليد محطات التدريج
              </button>
            </div>
          </div>

          {interpResults.length > 0 && (
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="p-3">المحطة (Station)</th>
                    <th className="p-3">Easting X</th>
                    <th className="p-3">Northing Y</th>
                    <th className="p-3">Elevation Z</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {interpResults.map((r, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-bold text-sky-400" dir="ltr">
                        Sta 0+{r.station.toFixed(2).padStart(6, '0')}
                      </td>
                      <td className="p-3 text-slate-300" dir="ltr">
                        {r.easting.toFixed(4)}
                      </td>
                      <td className="p-3 text-slate-300" dir="ltr">
                        {r.northing.toFixed(4)}
                      </td>
                      <td className="p-3 text-emerald-400 font-semibold" dir="ltr">
                        {r.elevation.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

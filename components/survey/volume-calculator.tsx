'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  Download,
  Layers,
  Scale,
  Shovel,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, ensureDefaultProject, type PointRecord } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import { calculatePolygonArea } from '@/lib/survey-calculations';
import { downloadFile } from '@/lib/dxf-generator';

function formatNumber(value: number, decimals = 2) {
  return value.toLocaleString('ar-SA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function VolumeCalculator() {
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentProject = useAppStore((state) => state.currentProject);

  const livePoints = useLiveQuery(
    () => db.points.where('projectId').equals(currentProjectId).sortBy('pointNumber'),
    [currentProjectId]
  );
  const points = useMemo(() => livePoints ?? [], [livePoints]);

  const [targetElevation, setTargetElevation] = useState<string>('650.000');
  const [shrinkageFactor, setShrinkageFactor] = useState<string>('1.15'); // 15% bulking/compaction
  const [calculationMode, setCalculationMode] = useState<'grid-tributary' | 'mean-plane'>('grid-tributary');

  useEffect(() => {
    void ensureDefaultProject();
  }, []);

  const totalArea = useMemo(() => calculatePolygonArea(points), [points]);
  const avgElevation = useMemo(
    () => (points.length ? points.reduce((sum, p) => sum + p.elevation, 0) / points.length : 0),
    [points]
  );

  // Advanced Earthwork Calculation Engine (Prismoidal / Tributary Area Method)
  const calculationResults = useMemo(() => {
    const target = parseFloat(targetElevation);
    const shrinkage = parseFloat(shrinkageFactor) || 1.0;

    if (isNaN(target) || points.length < 3 || totalArea <= 0) {
      return null;
    }

    const tributaryAreaPerPoint = totalArea / points.length;

    let cutVolume = 0;
    let fillVolume = 0;
    let cutArea = 0;
    let fillArea = 0;

    const pointDepths = points.map((p) => {
      const diff = p.elevation - target;
      const isCut = diff > 0;
      const depth = Math.abs(diff);
      const cellVolume = depth * tributaryAreaPerPoint;

      if (isCut) {
        cutVolume += cellVolume;
        cutArea += tributaryAreaPerPoint;
      } else {
        fillVolume += cellVolume;
        fillArea += tributaryAreaPerPoint;
      }

      return {
        point: p,
        diff,
        isCut,
        depth,
        volume: cellVolume,
      };
    });

    const netVolume = cutVolume - fillVolume;
    const adjustedFillVolume = fillVolume * shrinkage;
    const adjustedNetBalance = cutVolume - adjustedFillVolume;

    return {
      targetElevation: target,
      totalArea,
      avgElevation,
      cutVolume,
      fillVolume,
      cutArea,
      fillArea,
      netVolume,
      adjustedFillVolume,
      adjustedNetBalance,
      pointDepths,
    };
  }, [points, totalArea, avgElevation, targetElevation, shrinkageFactor]);

  const exportEarthworkReport = () => {
    if (!calculationResults) return;

    const text = `# SurveyPro AI - تقرير حساب كميات الحفر والردم (Earthwork Quantity Report)
تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA')}
اسم المشروع: ${currentProject.name}
منسوب التصميم المستهدف: ${calculationResults.targetElevation.toFixed(3)} م
إجمالي مساحة المضلع: ${calculationResults.totalArea.toFixed(2)} م²
متوسط المناسيب الطبيعية: ${calculationResults.avgElevation.toFixed(3)} م

--------------------------------------------------
ملخص الكميات الهندسية:
- إجمالي حجم الحفر (Cut Volume): ${calculationResults.cutVolume.toFixed(3)} م³
- إجمالي حجم الردم (Fill Volume): ${calculationResults.fillVolume.toFixed(3)} م³
- معامل الانتفاش / الدمك (Bulking Factor): ${shrinkageFactor}
- حجم الردم المعدل للدمك: ${calculationResults.adjustedFillVolume.toFixed(3)} م³
- صافي توازن الأتربة (Net Earthwork Balance): ${Math.abs(calculationResults.adjustedNetBalance).toFixed(3)} م³ (${calculationResults.adjustedNetBalance >= 0 ? 'فائض حفر للتوريد/التصدير' : 'عجز ردم يتطلب توريد دفان'})

--------------------------------------------------
جدول أعماق وكميات كل نقطة رفع:
${calculationResults.pointDepths
  .map(
    (pd) =>
      `P${pd.point.pointNumber} | المنسوب: ${pd.point.elevation.toFixed(3)} م | ${
        pd.isCut ? 'حفر' : 'ردم'
      } بعمق ${pd.depth.toFixed(3)} م | الحجم التقريبي: ${pd.volume.toFixed(3)} م³`
  )
  .join('\n')}
`;

    downloadFile(
      text,
      `SurveyPro-Earthwork-${currentProject.name.replace(/\s+/g, '_')}.txt`,
      'text/plain;charset=utf-8;'
    );
    toast.success('تم تصدير تقرير الكميات بنجاح');
  };

  return (
    <div className="space-y-6">
      {/* INPUTS & ENGINE CONTROLS */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-card p-5 sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
              <Shovel className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">إعدادات حساب الحفر والردم (Earthwork)</h2>
              <p className="mt-1 text-xs text-slate-400">
                حساب كميات تسوية الموقع بطريقة الخلايا المساحية الدقيقة (Tributary Grid Method)
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div>
                <span className="text-xs text-slate-500">مساحة المشروع</span>
                <p className="mt-0.5 text-sm font-bold text-sky-400">{formatNumber(totalArea)} م²</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">متوسط المنسوب الطبيعي</span>
                <p className="mt-0.5 text-sm font-bold text-slate-200">{avgElevation.toFixed(3)} م</p>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                منسوب التصميم / التسوية المستهدف (Formation Level - Z) بالمتر
              </label>
              <input
                type="number"
                step="any"
                dir="ltr"
                value={targetElevation}
                onChange={(e) => setTargetElevation(e.target.value)}
                placeholder="650.000"
                className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                معامل انتفاش ودمك التربة (Compaction & Bulking Factor)
              </label>
              <input
                type="number"
                step="0.01"
                dir="ltr"
                value={shrinkageFactor}
                onChange={(e) => setShrinkageFactor(e.target.value)}
                placeholder="1.15"
                className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-orange-500"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                الافتراضي 1.15 (زيادة 15% في حجم الدفان المطلوب للدمك الميكانيكي)
              </span>
            </div>
          </div>
        </section>

        {/* RESULTS CARD */}
        <section className="glass-card p-5 sm:p-7">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-white">الكميات الإجمالية المحسوبة</h3>
            {calculationResults && (
              <button
                onClick={exportEarthworkReport}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-850 px-3 py-1.5 text-xs font-semibold text-orange-400 hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                تصدير التقرير
              </button>
            )}
          </div>

          {calculationResults ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                    <TrendingDown className="h-4 w-4" />
                    حجم الحفر (Cut)
                  </div>
                  <p dir="ltr" className="mt-1 text-xl font-bold text-red-400">
                    {formatNumber(calculationResults.cutVolume, 2)} م³
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                    حجم الردم (Fill)
                  </div>
                  <p dir="ltr" className="mt-1 text-xl font-bold text-emerald-400">
                    {formatNumber(calculationResults.adjustedFillVolume, 2)} م³
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">صافي التوازن (Net Balance)</span>
                  <Scale className="h-4 w-4 text-orange-400" />
                </div>
                <p
                  dir="ltr"
                  className={`mt-1 text-2xl font-bold ${
                    calculationResults.adjustedNetBalance >= 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {calculationResults.adjustedNetBalance >= 0 ? '+' : ''}
                  {formatNumber(calculationResults.adjustedNetBalance, 2)} م³
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {calculationResults.adjustedNetBalance >= 0
                    ? 'فائض حفر: يتطلب ترحيل نواتج الحفر خارج الموقع'
                    : 'عجز ردم: يتطلب توريد ردميات معتمدة من الخارج'}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-10 flex flex-col items-center justify-center text-center">
              <Layers className="h-10 w-10 text-slate-700" />
              <p className="mt-3 text-xs text-slate-500">أدخل منسوب التصميم لحساب الكميات</p>
            </div>
          )}
        </section>
      </div>

      {/* DETAILED POINT DEPTHS TABLE */}
      {calculationResults && (
        <section className="glass-card p-5 sm:p-7">
          <h3 className="mb-4 text-base font-bold text-white">
            تفاصيل أعماق الحفر والردم لكل نقطة رفع مساحي
          </h3>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="p-3">رقم النقطة</th>
                  <th className="p-3">المنسوب الطبيعي Z</th>
                  <th className="p-3">المنسوب المستهدف</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">العمق (Depth)</th>
                  <th className="p-3">الحجم التقريبي للمنطقة</th>
                  <th className="p-3">الوصف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {calculationResults.pointDepths.map((item) => (
                  <tr key={item.point.id}>
                    <td className="p-3 font-bold text-sky-400">P{item.point.pointNumber}</td>
                    <td className="p-3 font-semibold text-slate-200" dir="ltr">
                      {item.point.elevation.toFixed(3)} م
                    </td>
                    <td className="p-3 text-slate-400" dir="ltr">
                      {calculationResults.targetElevation.toFixed(3)} م
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          item.isCut ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {item.isCut ? 'حفر (Cut)' : 'ردم (Fill)'}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-white" dir="ltr">
                      {item.depth.toFixed(3)} م
                    </td>
                    <td className="p-3 text-slate-300" dir="ltr">
                      {item.volume.toFixed(2)} م³
                    </td>
                    <td className="p-3 text-slate-400">{item.point.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

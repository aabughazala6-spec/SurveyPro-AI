'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Download,
  Info,
  Layers,
  Scale,
  Shovel,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import { calculatePolygonArea, formatNumber } from '@/lib/survey-calculations';
import { downloadFile } from '@/lib/dxf-generator';

export function VolumeCalculator() {
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentProject = useAppStore((state) => state.currentProject);

  const livePoints = useLiveQuery(
    () => db.points.where('projectId').equals(currentProjectId).sortBy('pointNumber'),
    [currentProjectId]
  );
  const points = useMemo(() => livePoints ?? [], [livePoints]);

  const [targetElevation, setTargetElevation] = useState<string>('100.000');
  const [shrinkageFactor, setShrinkageFactor] = useState<string>('1.15');

  const totalArea = useMemo(() => {
    if (points.length < 3) return 0;
    return calculatePolygonArea(points);
  }, [points]);

  const avgElevation = useMemo(() => {
    if (!points.length) return 0;
    return points.reduce((sum, p) => sum + p.elevation, 0) / points.length;
  }, [points]);

  const calculationResults = useMemo(() => {
    if (points.length < 3 || totalArea <= 0) return null;

    const target = parseFloat(targetElevation);
    const shrinkage = parseFloat(shrinkageFactor) || 1.0;
    if (isNaN(target)) return null;

    // TRIBUTARY GRID / DISCRETE POINT AREA METHOD
    // Area allocated to each survey sample point: A_cell = Total_Polygon_Area / N
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
      tributaryAreaPerPoint,
    };
  }, [points, totalArea, avgElevation, targetElevation, shrinkageFactor]);

  const exportEarthworkReport = () => {
    if (!calculationResults) return;

    const text = `# SurveyPro AI - تقرير حساب كميات الحفر والردم (Earthwork Quantity Report)
تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA')}
اسم المشروع: ${currentProject.name}
طريقة الحساب: TRIBUTARY GRID / DISCRETE POINT AREA METHOD (طريقة الخلايا المساحية النقطية)
منسوب التصميم المستهدف: ${calculationResults.targetElevation.toFixed(3)} م
إجمالي مساحة المضلع: ${calculationResults.totalArea.toFixed(2)} م²
المساحة الموزعة لكل نقطة (Tributary Area): ${calculationResults.tributaryAreaPerPoint.toFixed(2)} م²
متوسط المناسيب الطبيعية: ${calculationResults.avgElevation.toFixed(3)} م

--------------------------------------------------
ملخص الكميات الهندسية:
- إجمالي حجم الحفر (Cut Volume): ${calculationResults.cutVolume.toFixed(3)} م³
- إجمالي حجم الردم (Fill Volume): ${calculationResults.fillVolume.toFixed(3)} م³
- معامل الانتفاش / الدمك (Bulking Factor): ${shrinkageFactor}
- حجم الردم المعدل للدمك: ${calculationResults.adjustedFillVolume.toFixed(3)} م³
- صافي توازن الأتربة (Net Earthwork Balance): ${Math.abs(calculationResults.adjustedNetBalance).toFixed(3)} م³ (${calculationResults.adjustedNetBalance >= 0 ? 'فائض حفر للتوريد/التصدير' : 'عجز ردم يتطلب توريد دفان'})

--------------------------------------------------
ملاحظة المنهجية الهندسية:
تم حساب الحجوم باستخدام طريقة الخلايا المساحية الموزعة على نقاط الرفع المساحي (Tributary Grid/Area Method). هذه الطريقة دقيقة جداً لتقدير صافي توازن الموقع والمناسيب المتوسطة، مع ملاحظة أن الفصل الدقيق بين سطوح الحفر والردم المنحنية يتطلب شبكة رفع كثيفة أو مجسم سطحي ثلاثي الأبعاد (TIN Surface).

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
      {/* METHODOLOGY TRANSPARENCY BANNER */}
      <div className="flex flex-col gap-3 rounded-2xl border border-orange-500/30 bg-orange-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">منهجية الحساب الرياضية:</span>
              <span className="rounded bg-orange-500/20 px-2 py-0.5 text-[11px] font-bold text-orange-300 border border-orange-500/30">
                TRIBUTARY GRID / DISCRETE POINT AREA
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-300">
              توزيع مساحة المضلع الكلية بالتساوي على نقاط الرصد (Tributary Area = Area / N) لحساب توازن الحفر والردم الصافي.
            </p>
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          * لا تعتمد الطريقة السطح المثلثي المتصل (TIN Surface)
        </div>
      </div>

      {/* INPUTS & ENGINE CONTROLS */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-card p-5 sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
              <Shovel className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">إعدادات تسوية الموقع (Earthwork)</h2>
              <p className="mt-1 text-xs text-slate-400">
                طريقة الخلايا المساحية النقطية (Tributary Grid Method)
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
                placeholder="100.000"
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
                  {formatNumber(Math.abs(calculationResults.adjustedNetBalance), 2)} م³
                </p>
                <span className="mt-1 block text-xs text-slate-400">
                  {calculationResults.adjustedNetBalance >= 0
                    ? 'فائض حفر ناتج عن التسوية (Cut Surplus)'
                    : 'عجز ردم يتطلب توريد دفان للموقع (Fill Deficit)'}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-12 flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-10 w-10 text-slate-700" />
              <p className="mt-3 text-xs text-slate-500">
                يتطلب حساب الحجوم وجود 3 نقاط رفع على الأقل تشكل مضلعاً بمساحة صالحة.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

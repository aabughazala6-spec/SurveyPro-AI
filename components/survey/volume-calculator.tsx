'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, Calculator, Layers, Shovel } from 'lucide-react';
import { toast } from 'sonner';
import { db, DEFAULT_PROJECT, ensureDefaultProject } from '@/lib/db';
import { calculatePolygonArea, squareMetersToFeddans } from '@/lib/survey-calculations';

function formatNumber(value: number, decimals = 2) {
  return value.toLocaleString('ar-SA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function VolumeCalculator() {
  const livePoints = useLiveQuery(
    () => db.points.where('projectId').equals(DEFAULT_PROJECT.id).sortBy('pointNumber'),
    [DEFAULT_PROJECT.id]
  );
  const points = useMemo(() => livePoints ?? [], [livePoints]);

  const [targetElevation, setTargetElevation] = useState('');
  const [result, setResult] = useState<{
    avgElevation: number;
    deltaZ: number;
    volume: number;
    isCut: boolean;
  } | null>(null);

  useEffect(() => {
    void ensureDefaultProject();
  }, []);

  const avgElevation = useMemo(
    () => (points.length ? points.reduce((sum, p) => sum + p.elevation, 0) / points.length : 0),
    [points]
  );

  const area = useMemo(() => calculatePolygonArea(points), [points]);

  const calculate = () => {
    const target = Number(targetElevation);
    if (!Number.isFinite(target)) {
      toast.error('أدخل منسوب تصميم مستهدف صحيح');
      return;
    }
    if (points.length < 3) {
      toast.error('أضف 3 نقاط على الأقل لحساب الحجم');
      return;
    }
    if (area <= 0) {
      toast.error('المساحة تساوي صفر — تحقق من النقاط');
      return;
    }

    const deltaZ = avgElevation - target;
    const volume = area * Math.abs(deltaZ);
    setResult({ avgElevation, deltaZ, volume, isCut: deltaZ > 0 });
    toast.success('تم حساب كميات الحفر والردم');
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <section className="glass-card p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
            <Shovel className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">بيانات الحساب</h2>
            <p className="mt-1 text-xs text-slate-500">طريقة متوسط المناسيب للتقديرات الميدانية السريعة</p>
          </div>
        </div>

        <div className="mb-5 space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">عدد النقاط</span>
              <span className="text-sm font-bold text-emerald-400">{points.length} نقطة</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-800/60 pt-2">
              <span className="text-xs text-slate-500">المساحة المحسوبة</span>
              <span className="text-sm font-bold text-sky-400">{formatNumber(area)} م²</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-800/60 pt-2">
              <span className="text-xs text-slate-500">متوسط المنسوب الحالي</span>
              <span className="text-sm font-bold text-slate-200">{avgElevation.toFixed(3)} م</span>
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-slate-400">منسوب التصميم المستهدف (م)</span>
            <input
              type="number"
              step="any"
              dir="ltr"
              value={targetElevation}
              onChange={(e) => setTargetElevation(e.target.value)}
              placeholder={avgElevation ? avgElevation.toFixed(3) : '650.000'}
              className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 text-sm text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
            />
          </label>

          <button
            onClick={calculate}
            disabled={!targetElevation || points.length < 3}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition-all hover:bg-orange-400 active:scale-[0.98] disabled:opacity-40"
          >
            <Calculator className="h-4 w-4" />
            حساب كميات الحفر والردم
          </button>
        </div>

        {points.length < 3 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center text-[11px] text-amber-400">
            أضف 3 نقاط على الأقل من شاشة النقاط والمساحات لتفعيل الحساب
          </div>
        )}
      </section>

      <section className="glass-card relative overflow-hidden p-5 sm:p-7">
        <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="relative">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">النتائج</h2>
              <p className="mt-1 text-xs text-slate-500">{result ? 'تم الحساب بنجاح' : 'أدخل البيانات واضغط حساب'}</p>
            </div>
          </div>

          {result ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <p className="mb-2 text-xs text-slate-500">متوسط المنسوب الحالي</p>
                <p dir="ltr" className="text-2xl font-bold text-slate-100">{result.avgElevation.toFixed(3)} م</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <p className="mb-2 text-xs text-slate-500">فرق المنسوب (Delta Z)</p>
                <p dir="ltr" className="text-2xl font-bold text-slate-100">
                  {result.deltaZ > 0 ? '+' : ''}{result.deltaZ.toFixed(3)} م
                </p>
              </div>

              {result.isCut ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <ArrowDown className="h-5 w-5 text-red-400" />
                    <span className="text-sm font-bold text-red-400">حفر (Cut)</span>
                  </div>
                  <p className="text-xs text-slate-500">حجم الحفر المطلوب</p>
                  <p dir="ltr" className="mt-1 text-3xl font-bold text-red-400">{formatNumber(result.volume, 3)} م³</p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <ArrowUp className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400">ردم (Fill)</span>
                  </div>
                  <p className="text-xs text-slate-500">حجم الردم المطلوب</p>
                  <p dir="ltr" className="mt-1 text-3xl font-bold text-emerald-400">{formatNumber(result.volume, 3)} م³</p>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-xl bg-slate-800/40 p-3 text-[11px] text-slate-500">
                <span className="h-2 w-2 rounded-full bg-orange-400" />
                المعادلة: الحجم = المساحة × |متوسط المنسوب - منسوب التصميم|
              </div>
            </div>
          ) : (
            <div className="mt-8 flex min-h-[230px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 text-center">
              <Shovel className="mb-3 h-9 w-9 text-slate-700" />
              <p className="text-sm text-slate-500">أدخل منسوب التصميم واحسب</p>
              <p className="mt-1 text-xs text-slate-700">سيتم عرض نتائج الحفر والردم هنا</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

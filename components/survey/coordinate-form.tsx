'use client';

import { useState } from 'react';
import {
  ArrowLeftRight,
  Bot,
  Copy,
  Crosshair,
  Globe2,
  LocateFixed,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, type PointRecord } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import {
  SUPPORTED_CRS,
  transformCoordinates,
  getAutoUtmZone,
} from '@/lib/crs-definitions';
import { transformProjectCrs } from '@/lib/point-operations';

export function CoordinateForm() {
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const activeCrs = useAppStore((state) => state.activeCrs);
  const setActiveCrs = useAppStore((state) => state.setActiveCrs);

  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [sourceCrs, setSourceCrs] = useState<string>(activeCrs || 'EPSG:4326');
  const [targetCrs, setTargetCrs] = useState<string>('EPSG:32636');

  // Single Coordinate inputs
  const [inputX, setInputX] = useState<string>('31.2357'); // Cairo Longitude
  const [inputY, setInputY] = useState<string>('30.0444'); // Cairo Latitude
  const [inputZ, setInputZ] = useState<string>('50.000');

  // Result state
  const [convertedResult, setConvertedResult] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);

  // Batch conversion state
  const [isBatchTransforming, setIsBatchTransforming] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const sourceObj = SUPPORTED_CRS.find((c) => c.code === sourceCrs);
  const targetObj = SUPPORTED_CRS.find((c) => c.code === targetCrs);

  const handleConvertSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const x = parseFloat(inputX);
    const y = parseFloat(inputY);
    const z = parseFloat(inputZ) || 0;

    if (isNaN(x) || isNaN(y)) {
      toast.error('يرجى إدخال قيم إحداثيات رقمية صحيحة');
      return;
    }

    try {
      const result = transformCoordinates(x, y, z, sourceCrs, targetCrs);
      setConvertedResult(result);
      toast.success('تم تحويل الإحداثيات بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('فشل في تحويل الإحداثيات بين النظامين المحددين');
    }
  };

  const handleSwapCrs = () => {
    const temp = sourceCrs;
    setSourceCrs(targetCrs);
    setTargetCrs(temp);
    if (convertedResult) {
      setInputX(convertedResult.x.toString());
      setInputY(convertedResult.y.toString());
      setInputZ(convertedResult.z.toString());
      setConvertedResult(null);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('متصفحك لا يدعم تحديد الموقع الجغرافي');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        const alt = pos.coords.altitude || 0;

        setSourceCrs('EPSG:4326');
        setInputX(lng.toFixed(7));
        setInputY(lat.toFixed(7));
        setInputZ(alt.toFixed(3));

        // Auto determine UTM zone
        const auto = getAutoUtmZone(lng, lat);
        setTargetCrs(auto.epsg);
        toast.success(`تم تحديد موقعك بدقة والتعرف التلقائي على ${auto.name}`);
      },
      (err) => {
        setIsLocating(false);
        toast.error(`تعذر جلب الموقع: ${err.message}`);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleBatchTransformProject = async () => {
    const points = await db.points.where('projectId').equals(currentProjectId).toArray();
    if (!points.length) {
      toast.error('لا توجد نقاط في المشروع الحالي لتحويلها');
      return;
    }

    setIsBatchTransforming(true);
    try {
      const res = await transformProjectCrs({
        projectId: currentProjectId,
        sourceCrs,
        targetCrs,
        mode: 'TRANSFORM_COORDINATES',
      });

      if (res.success) {
        setActiveCrs(targetCrs);
        toast.success(`تم تحويل ${res.transformedCount} نقطة في المشروع بنجاح إلى ${targetCrs}`);
      } else {
        toast.error(res.error || 'حدث خطأ أثناء تحويل نقاط المشروع');
      }
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تحويل نقاط المشروع');
    } finally {
      setIsBatchTransforming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* MODE TOGGLE */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('single')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            mode === 'single'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-950/40'
              : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
          }`}
        >
          <Crosshair className="h-4 w-4" />
          تحويل نقطة مفردة (Single Point)
        </button>
        <button
          onClick={() => setMode('batch')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            mode === 'batch'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-950/40'
              : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
          }`}
        >
          <RefreshCw className="h-4 w-4" />
          تحويل جماعي لنقاط المشروع
        </button>
      </div>

      {/* CRS SELECTION ROW */}
      <div className="glass-card p-5 sm:p-7">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">اختيار أنظمة الإحداثيات والمرجع الجيوديسي</h2>
          <button
            onClick={handleSwapCrs}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-sky-400 hover:bg-slate-700"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            عكس الاتجاه
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* SOURCE CRS */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <span className="mb-2 block text-xs font-bold text-slate-400">النظام المصدر (Source CRS)</span>
            <select
              value={sourceCrs}
              onChange={(e) => {
                setSourceCrs(e.target.value);
                setConvertedResult(null);
              }}
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
            >
              {SUPPORTED_CRS.map((crs) => (
                <option key={crs.code} value={crs.code}>
                  {crs.code} — {crs.nameAr} ({crs.category})
                </option>
              ))}
            </select>
            {sourceObj && (
              <div className="mt-2.5 space-y-1">
                <p className="text-[11px] text-slate-400 font-medium">
                  {sourceObj.nameEn} • {sourceObj.type === 'GEOGRAPHIC_2D' ? 'درجات عشرية Lat/Lon' : 'إسقاط مستوي أمتار (E, N)'}
                </p>
                <div className="flex items-center gap-1.5 text-[10px]">
                  {sourceObj.validationLevel === 'AUTHORITATIVE_GEODETIC' ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400 font-medium border border-emerald-500/20">
                      <ShieldCheck className="h-3 w-3" />
                      مرجع عالمي معتمد (WGS84/UTM)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-300 font-medium border border-amber-500/20">
                      <AlertTriangle className="h-3 w-3" />
                      يتطلب تدقيق مع ثوابت محلية (GCPs)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* TARGET CRS */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <span className="mb-2 block text-xs font-bold text-slate-400">النظام الهدف (Target CRS)</span>
            <select
              value={targetCrs}
              onChange={(e) => {
                setTargetCrs(e.target.value);
                setConvertedResult(null);
              }}
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
            >
              {SUPPORTED_CRS.map((crs) => (
                <option key={crs.code} value={crs.code}>
                  {crs.code} — {crs.nameAr} ({crs.category})
                </option>
              ))}
            </select>
            {targetObj && (
              <div className="mt-2.5 space-y-1">
                <p className="text-[11px] text-slate-400 font-medium">
                  {targetObj.nameEn} • {targetObj.type === 'GEOGRAPHIC_2D' ? 'درجات عشرية Lat/Lon' : 'إسقاط مستوي أمتار (E, N)'}
                </p>
                <div className="flex items-center gap-1.5 text-[10px]">
                  {targetObj.validationLevel === 'AUTHORITATIVE_GEODETIC' ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400 font-medium border border-emerald-500/20">
                      <ShieldCheck className="h-3 w-3" />
                      مرجع عالمي معتمد (WGS84/UTM)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-300 font-medium border border-amber-500/20">
                      <AlertTriangle className="h-3 w-3" />
                      يتطلب تدقيق مع ثوابت محلية (GCPs)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TRANSFORMATION TECHNICAL NOTICE */}
        {(sourceObj?.validationLevel === 'REQUIRES_CONTROL_VALIDATION' || targetObj?.validationLevel === 'REQUIRES_CONTROL_VALIDATION') && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 text-xs text-amber-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <strong className="text-amber-300">ملاحظة جيوديسية للمراجع الإقليمية:</strong>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                تم دمج معاملات إزاحة الشفت المعيارية (+towgs84) للمرجع الإقليمي. نظراً لأن المراجع الإقليمية التاريخية غير متحدة المركز مع WGS84، فإن دقة التحويل الإقليمي تتراوح بين 3 إلى 5 أمتار وتتطلب تدقيقاً ومطابقة موقعية (Site Calibration) مع نقاط تحكم أرضية معتمدة (GCPs) للمشاريع التي تتطلب دقة سنتيمترية.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* SINGLE POINT CONVERSION VIEW */}
      {mode === 'single' ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="glass-card p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">إدخال قيم الإحداثيات</h3>
              <button
                onClick={handleGetCurrentLocation}
                disabled={isLocating}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <LocateFixed className={`h-4 w-4 ${isLocating ? 'animate-spin' : ''}`} />
                {isLocating ? 'جاري التحديد...' : 'موقعي الحالي (GPS)'}
              </button>
            </div>

            <form onSubmit={handleConvertSingle} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-400">
                  {sourceObj?.type === 'GEOGRAPHIC_2D'
                    ? 'خط الطول Longitude (X) بالدرجات'
                    : 'الشرق Easting (X) بالمتر'}
                </label>
                <input
                  type="number"
                  step="any"
                  dir="ltr"
                  value={inputX}
                  onChange={(e) => {
                    setInputX(e.target.value);
                    setConvertedResult(null);
                  }}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-400">
                  {sourceObj?.type === 'GEOGRAPHIC_2D'
                    ? 'خط العرض Latitude (Y) بالدرجات'
                    : 'الشمال Northing (Y) بالمتر'}
                </label>
                <input
                  type="number"
                  step="any"
                  dir="ltr"
                  value={inputY}
                  onChange={(e) => {
                    setInputY(e.target.value);
                    setConvertedResult(null);
                  }}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-400">
                  المنسوب Elevation (Z) بالمتر (اختياري)
                </label>
                <input
                  type="number"
                  step="any"
                  dir="ltr"
                  value={inputZ}
                  onChange={(e) => {
                    setInputZ(e.target.value);
                    setConvertedResult(null);
                  }}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-sky-500 outline-none"
                />
              </div>

              <button
                type="submit"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-xs font-bold text-white shadow-lg shadow-sky-950/40 hover:bg-sky-400"
              >
                <Sparkles className="h-4 w-4" />
                تحويل الإحداثي الآن
              </button>
            </form>
          </section>

          {/* RESULT DISPLAY */}
          <section className="glass-card flex flex-col justify-between p-5 sm:p-7">
            <div>
              <h3 className="text-base font-bold text-white">نتيجة التحويل الجيوديسي</h3>
              <p className="mt-1 text-xs text-slate-400">
                الإحداثيات المحسوبة بدقة في نظام {targetCrs}
              </p>
            </div>

            {convertedResult ? (
              <div className="my-6 space-y-3">
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {targetObj?.type === 'GEOGRAPHIC_2D' ? 'خط الطول Longitude (X)' : 'الشرق Easting (X)'}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(convertedResult.x.toString());
                        toast.success('تم نسخ الإحداثي');
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p dir="ltr" className="mt-1 text-xl font-bold text-sky-300">
                    {targetObj?.type === 'GEOGRAPHIC_2D'
                      ? convertedResult.x.toFixed(7)
                      : convertedResult.x.toFixed(4)}
                  </p>
                </div>

                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {targetObj?.type === 'GEOGRAPHIC_2D' ? 'خط العرض Latitude (Y)' : 'الشمال Northing (Y)'}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(convertedResult.y.toString());
                        toast.success('تم نسخ الإحداثي');
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p dir="ltr" className="mt-1 text-xl font-bold text-sky-300">
                    {targetObj?.type === 'GEOGRAPHIC_2D'
                      ? convertedResult.y.toFixed(7)
                      : convertedResult.y.toFixed(4)}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <span className="text-xs text-slate-400">المنسوب Elevation (Z)</span>
                  <p dir="ltr" className="mt-1 text-lg font-bold text-emerald-400">
                    {convertedResult.z.toFixed(3)} م
                  </p>
                </div>
              </div>
            ) : (
              <div className="my-10 flex flex-col items-center justify-center text-center">
                <Globe2 className="h-10 w-10 text-slate-700" />
                <p className="mt-3 text-xs text-slate-500">أدخل الإحداثيات واضغط تحويل لعرض النتيجة</p>
              </div>
            )}
          </section>
        </div>
      ) : (
        /* BATCH CONVERSION VIEW */
        <section className="glass-card p-5 sm:p-7">
          <div className="mb-5">
            <h3 className="text-base font-bold text-white">التحويل الجماعي لنقاط المشروع</h3>
            <p className="mt-1 text-xs text-slate-400">
              تحويل كامل إحداثيات نقاط الرفع المساحي في المشروع من {sourceCrs} إلى {targetCrs}
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
            <strong>⚠️ تنبيه مهم:</strong> سيؤدي هذا الإجراء إلى إعادة حساب وتحديث إحداثيات جميع نقاط المشروع في قاعدة البيانات بشكل دائم.
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={handleBatchTransformProject}
              disabled={isBatchTransforming}
              className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-950/30 hover:bg-sky-400 disabled:opacity-50"
            >
              {isBatchTransforming ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  جاري تحويل النقاط...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  تحويل جميع نقاط المشروع الآن
                </>
              )}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

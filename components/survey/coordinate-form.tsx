'use client';

import { useState } from 'react';
import proj4 from 'proj4';
import { Crosshair, LocateFixed, RefreshCw, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';

const WGS84 = 'EPSG:4326';
const UTM38N = 'EPSG:32638';

type Direction = 'wgs84-to-utm' | 'utm-to-wgs84';

type CoordinateValues = {
  first: string;
  second: string;
};

export function CoordinateForm() {
  const [direction, setDirection] = useState<Direction>('wgs84-to-utm');
  const [values, setValues] = useState<CoordinateValues>({ first: '', second: '' });
  const [result, setResult] = useState<CoordinateValues | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const isWgs84 = direction === 'wgs84-to-utm';
  const inputLabels = isWgs84 ? ['خط العرض Latitude', 'خط الطول Longitude'] : ['الشمال Northing', 'الشرق Easting'];
  const resultLabels = isWgs84 ? ['الشمال Northing', 'الشرق Easting'] : ['خط العرض Latitude', 'خط الطول Longitude'];

  const updateValue = (key: keyof CoordinateValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setResult(null);
  };

  const convert = () => {
    const first = Number(values.first);
    const second = Number(values.second);
    if (!Number.isFinite(first) || !Number.isFinite(second)) {
      toast.error('أدخل قيم إحداثيات صحيحة قبل التحويل');
      return;
    }

    try {
      const converted = isWgs84
        ? proj4(WGS84, UTM38N, [second, first])
        : proj4(UTM38N, WGS84, [second, first]);
      setResult({ first: converted[1].toFixed(6), second: converted[0].toFixed(6) });
      toast.success('تم تحويل الإحداثيات بنجاح');
    } catch {
      toast.error('تعذر تحويل الإحداثيات، تحقق من القيم المدخلة');
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('المتصفح لا يدعم تحديد الموقع');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setDirection('wgs84-to-utm');
        setValues({ first: latitude.toFixed(6), second: longitude.toFixed(6) });
        setResult(null);
        setIsLocating(false);
        toast.success('تم جلب موقعك الحالي');
      },
      () => {
        setIsLocating(false);
        toast.error('لم نتمكن من جلب الموقع. تحقق من صلاحية الوصول للموقع.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="glass-card p-5 sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400"><Crosshair className="h-5 w-5" /></div><h2 className="text-lg font-bold text-white">إدخال الإحداثيات</h2><p className="mt-1 text-xs text-slate-500">اختر نظام الإحداثيات وأدخل القيم للتحويل</p></div>
          <button onClick={() => { setValues({ first: '', second: '' }); setResult(null); }} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200" aria-label="مسح الحقول"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-950/70 p-1.5">
          <button onClick={() => { setDirection('wgs84-to-utm'); setResult(null); }} className={`rounded-lg px-3 py-3 text-xs font-semibold transition-all ${isWgs84 ? 'bg-sky-500 text-white shadow-lg shadow-sky-950/30' : 'text-slate-500 hover:text-slate-200'}`}>WGS84 <span className="block mt-1 text-[10px] font-normal opacity-70">إلى UTM 38N</span></button>
          <button onClick={() => { setDirection('utm-to-wgs84'); setResult(null); }} className={`rounded-lg px-3 py-3 text-xs font-semibold transition-all ${!isWgs84 ? 'bg-sky-500 text-white shadow-lg shadow-sky-950/30' : 'text-slate-500 hover:text-slate-200'}`}>UTM 38N <span className="block mt-1 text-[10px] font-normal opacity-70">إلى WGS84</span></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {inputLabels.map((label, index) => { const key = index === 0 ? 'first' : 'second'; return <label key={label} className="block"><span className="mb-2 block text-xs font-semibold text-slate-400">{label}</span><input dir="ltr" inputMode="decimal" value={values[key]} onChange={(event) => updateValue(key, event.target.value)} placeholder={isWgs84 ? (index === 0 ? '24.7136' : '46.6753') : (index === 0 ? '2732345.65' : '466753.21')} className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 text-sm text-white outline-none transition-colors placeholder:text-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10" /></label>; })}
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button onClick={convert} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 text-sm font-bold text-white shadow-lg shadow-sky-950/30 transition-all hover:bg-sky-400 active:scale-[0.98]"><ArrowLeftRight className="h-4 w-4" /> تحويل الإحداثيات</button>
          <button onClick={getCurrentLocation} disabled={isLocating} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/70 px-5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:opacity-50"><LocateFixed className={`h-4 w-4 text-emerald-400 ${isLocating ? 'animate-spin' : ''}`} /> {isLocating ? 'جاري التحديد...' : 'جلب موقعي الحالي'}</button>
        </div>
      </section>
      <section className={`glass-card relative overflow-hidden p-5 sm:p-7 ${result ? 'border-sky-500/30' : ''}`}>
        <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative"><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sky-400">النتيجة</p><h2 className="text-lg font-bold text-white">الإحداثيات المحولة</h2><p className="mt-1 text-xs text-slate-500">{result ? 'تم الحساب باستخدام نظام UTM Zone 38N' : 'ستظهر النتيجة هنا بعد تنفيذ التحويل'}</p>{result ? <div className="mt-8 space-y-4">{resultLabels.map((label, index) => <div key={label} className="rounded-xl border border-sky-500/15 bg-sky-500/5 p-4"><p className="mb-2 text-xs text-slate-500">{label}</p><p dir="ltr" className="text-xl font-bold tracking-wide text-sky-300">{result[index === 0 ? 'first' : 'second']}</p></div>)}<div className="mt-5 flex items-center gap-2 text-[11px] text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-400" />دقة العرض: 6 منازل عشرية</div></div> : <div className="mt-8 flex min-h-[230px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 text-center"><Crosshair className="mb-3 h-9 w-9 text-slate-700" /><p className="text-sm text-slate-500">أدخل الإحداثيات واضغط تحويل</p><p className="mt-1 text-xs text-slate-700">يمكنك أيضاً استخدام موقعك الحالي</p></div>}</div>
      </section>
    </div>
  );
}

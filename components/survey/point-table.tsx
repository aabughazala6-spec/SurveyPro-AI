'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { db, DEFAULT_PROJECT, ensureDefaultProject, type PointRecord } from '@/lib/db';
import { calculatePolygonArea, calculatePolygonPerimeter, squareMetersToFeddans } from '@/lib/survey-calculations';

const PROJECT_ID = DEFAULT_PROJECT.id;
type PointForm = Omit<PointRecord, 'id' | 'projectId' | 'timestamp'>;
const emptyForm: PointForm = { pointNumber: 1, northing: 0, easting: 0, elevation: 0, description: '' };

function formatNumber(value: number, decimals = 2) {
  return value.toLocaleString('ar-SA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function PointTable() {
  const livePoints = useLiveQuery(() => db.points.where('projectId').equals(PROJECT_ID).sortBy('pointNumber'), [PROJECT_ID]);
  const points = useMemo(() => livePoints ?? [], [livePoints]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PointForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void ensureDefaultProject().catch(() => toast.error('تعذر تهيئة قاعدة البيانات المحلية'));
  }, []);

  const area = useMemo(() => calculatePolygonArea(points), [points]);
  const perimeter = useMemo(() => calculatePolygonPerimeter(points), [points]);

  const openAddModal = () => {
    const nextPointNumber = points.length ? Math.max(...points.map((point) => point.pointNumber)) + 1 : 1;
    setEditingId(null);
    setForm({ ...emptyForm, pointNumber: nextPointNumber });
    setIsModalOpen(true);
  };

  const openEditModal = (point: PointRecord) => {
    setEditingId(point.id);
    setForm({ pointNumber: point.pointNumber, northing: point.northing, easting: point.easting, elevation: point.elevation, description: point.description });
    setIsModalOpen(true);
  };

  const savePoint = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (![form.pointNumber, form.northing, form.easting, form.elevation].every(Number.isFinite) || form.pointNumber < 1) {
      toast.error('تحقق من أرقام النقطة والإحداثيات المدخلة');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await db.points.update(editingId, form);
        toast.success('تم تحديث النقطة بنجاح');
      } else {
        await db.points.add({ ...form, id: crypto.randomUUID(), projectId: PROJECT_ID, timestamp: new Date().toISOString() });
        toast.success('تم حفظ النقطة محلياً');
      }
      const updatedPoints = await db.points.where('projectId').equals(PROJECT_ID).sortBy('pointNumber');
      await db.projects.update(PROJECT_ID, {
        area: calculatePolygonArea(updatedPoints),
        perimeter: calculatePolygonPerimeter(updatedPoints),
      });
      setIsModalOpen(false);
    } catch {
      toast.error('تعذر حفظ النقطة، حاول مرة أخرى');
    } finally {
      setIsSaving(false);
    }
  };

  const deletePoint = async (point: PointRecord) => {
    try {
      await db.points.delete(point.id);
      const remaining = points.filter((item) => item.id !== point.id);
      await db.projects.update(PROJECT_ID, { area: calculatePolygonArea(remaining), perimeter: calculatePolygonPerimeter(remaining) });
      toast.success('تم حذف النقطة');
    } catch {
      toast.error('تعذر حذف النقطة');
    }
  };

  const exportCsv = () => {
    if (!points.length) {
      toast.error('أضف نقطة واحدة على الأقل قبل التصدير');
      return;
    }
    const header = ['Point', 'Northing', 'Easting', 'Elevation', 'Description'];
    const rows = points.map((point) => [point.pointNumber, point.northing, point.easting, point.elevation, point.description].map((value) => `"${String(value).replaceAll('"', '""')}"`));
    const csv = '\ufeff' + [header, ...rows].map((row) => row.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `surveypro-points-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير ملف CSV بنجاح');
  };

  return <>
    <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Metric label="عدد النقاط" value={`${points.length} نقطة`} color="text-emerald-400" />
      <Metric label="المساحة" value={`${formatNumber(area)} م²`} sub={`≈ ${formatNumber(squareMetersToFeddans(area))} فدان`} color="text-emerald-400" />
      <Metric label="المحيط" value={`${formatNumber(perimeter, 1)} م`} color="text-sky-400" />
      <Metric label="الحالة" value="محفوظ محلياً" sub="جاهز للمزامنة" color="text-amber-400" />
    </section>
    <section className="glass-card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-800/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="text-lg font-bold text-white">جدول النقاط PNEZD</h2><p className="mt-1 text-xs text-slate-500">أدخل نقاط الرفع بالترتيب لتفعيل حساب المساحة</p></div><div className="flex gap-2"><button onClick={exportCsv} className="h-11 rounded-xl border border-slate-700 bg-slate-800/70 px-4 text-xs font-semibold text-slate-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-400">تصدير CSV</button><button onClick={openAddModal} className="flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-400"><Plus className="h-4 w-4" /> إضافة نقطة</button></div></div>
      {points.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-right text-sm"><thead className="bg-slate-950/60 text-xs text-slate-500"><tr><th className="px-5 py-4 font-semibold">النقطة</th><th className="px-5 py-4 font-semibold">Northing</th><th className="px-5 py-4 font-semibold">Easting</th><th className="px-5 py-4 font-semibold">Elevation</th><th className="px-5 py-4 font-semibold">الوصف</th><th className="px-5 py-4 font-semibold">إجراء</th></tr></thead><tbody className="divide-y divide-slate-800/60">{points.map((point) => <tr key={point.id} className="transition-colors hover:bg-slate-800/30"><td className="px-5 py-4 font-bold text-emerald-400">P{point.pointNumber}</td><td dir="ltr" className="px-5 py-4 text-slate-300">{point.northing.toFixed(3)}</td><td dir="ltr" className="px-5 py-4 text-slate-300">{point.easting.toFixed(3)}</td><td dir="ltr" className="px-5 py-4 text-slate-300">{point.elevation.toFixed(3)}</td><td className="px-5 py-4 text-slate-400">{point.description || '—'}</td><td className="px-5 py-4"><div className="flex gap-1"><button onClick={() => openEditModal(point)} className="rounded-lg p-2 text-slate-500 hover:bg-sky-500/10 hover:text-sky-400" aria-label="تعديل"><Pencil className="h-4 w-4" /></button><button onClick={() => void deletePoint(point)} className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400" aria-label="حذف"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div> : <div className="flex min-h-[300px] flex-col items-center justify-center px-5 text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400"><Plus className="h-6 w-6" /></div><h3 className="text-base font-bold text-white">لا توجد نقاط بعد</h3><p className="mt-2 max-w-sm text-xs leading-6 text-slate-500">ابدأ بإضافة نقاط الرفع المساحي ليتم حساب المساحة والمحيط تلقائياً.</p><button onClick={openAddModal} className="mt-5 rounded-xl border border-emerald-500/30 px-4 py-2.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10">إضافة أول نقطة</button></div>}
    </section>
    {isModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7"><div className="mb-6 flex items-start justify-between"><div><h2 className="text-lg font-bold text-white">{editingId ? 'تعديل النقطة' : 'إضافة نقطة جديدة'}</h2><p className="mt-1 text-xs text-slate-500">بيانات النقطة بصيغة PNEZD</p></div><button onClick={() => setIsModalOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="إغلاق"><X className="h-5 w-5" /></button></div><form onSubmit={savePoint} className="grid gap-4 sm:grid-cols-2">{([['pointNumber', 'رقم النقطة', '1'], ['northing', 'Northing / الشمال', '2732345.650'], ['easting', 'Easting / الشرق', '466753.210'], ['elevation', 'Elevation / الارتفاع', '650.000']] as const).map(([key, label, placeholder]) => <label key={key} className="block"><span className="mb-2 block text-xs font-semibold text-slate-400">{label}</span><input required type="number" step="any" dir="ltr" value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: Number(event.target.value) }))} placeholder={placeholder} className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-emerald-500" /></label>)}<label className="block sm:col-span-2"><span className="mb-2 block text-xs font-semibold text-slate-400">الوصف</span><input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="مثال: زاوية جنوبية" className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-emerald-500" /></label><div className="mt-2 flex gap-3 sm:col-span-2"><button type="submit" disabled={isSaving} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50"><Save className="h-4 w-4" />{isSaving ? 'جاري الحفظ...' : 'حفظ النقطة'}</button><button type="button" onClick={() => setIsModalOpen(false)} className="h-11 rounded-xl border border-slate-700 px-5 text-sm font-semibold text-slate-300 hover:bg-slate-800">إلغاء</button></div></form></div></div>}
  </>;
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return <div className="glass-card p-4 sm:p-5"><p className="text-[11px] text-slate-500">{label}</p><p className={`mt-2 text-base font-bold ${color} sm:text-lg`}>{value}</p>{sub && <p className="mt-1 text-[10px] text-slate-600">{sub}</p>}</div>;
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownToLine,
  ArrowUpDown,
  Compass,
  FileCode2,
  FileSpreadsheet,
  MapPin,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, ensureDefaultProject, type PointRecord } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import {
  calculateBoundingBox,
  calculatePolygonArea,
  calculatePolygonCentroid,
  calculatePolygonPerimeter,
  calculatePolygonPerimeter3D,
  squareMetersToFeddans,
  squareMetersToHectares,
} from '@/lib/survey-calculations';
import { downloadFile, generateDXF } from '@/lib/dxf-generator';
import Link from 'next/link';

type PointForm = Omit<PointRecord, 'id' | 'projectId' | 'timestamp'>;
const emptyForm: PointForm = {
  pointNumber: 1,
  northing: 0,
  easting: 0,
  elevation: 0,
  description: '',
};

function formatNumber(value: number, decimals = 2) {
  return value.toLocaleString('ar-SA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function PointTable() {
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentProject = useAppStore((state) => state.currentProject);
  const activeCrs = useAppStore((state) => state.activeCrs);

  const livePoints = useLiveQuery(
    () => db.points.where('projectId').equals(currentProjectId).sortBy('pointNumber'),
    [currentProjectId]
  );
  const points = useMemo(() => livePoints ?? [], [livePoints]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PointForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [sortBy, setSortBy] = useState<'pointNumber' | 'easting' | 'northing' | 'elevation'>('pointNumber');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    void ensureDefaultProject();
  }, []);

  const area = useMemo(() => calculatePolygonArea(points), [points]);
  const perimeter2D = useMemo(() => calculatePolygonPerimeter(points), [points]);
  const perimeter3D = useMemo(() => calculatePolygonPerimeter3D(points), [points]);
  const centroid = useMemo(() => calculatePolygonCentroid(points), [points]);
  const bbox = useMemo(() => calculateBoundingBox(points), [points]);

  const filteredPoints = useMemo(() => {
    let result = points;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.pointNumber.toString().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.easting.toString().includes(q) ||
          p.northing.toString().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [points, searchQuery, sortBy, sortAsc]);

  const openAddModal = () => {
    const nextPointNumber = points.length
      ? Math.max(...points.map((p) => p.pointNumber)) + 1
      : 1;
    setEditingId(null);
    setForm({ ...emptyForm, pointNumber: nextPointNumber });
    setIsModalOpen(true);
  };

  const openEditModal = (point: PointRecord) => {
    setEditingId(point.id);
    setForm({
      pointNumber: point.pointNumber,
      northing: point.northing,
      easting: point.easting,
      elevation: point.elevation,
      description: point.description,
    });
    setIsModalOpen(true);
  };

  const savePoint = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      ![form.pointNumber, form.northing, form.easting, form.elevation].every(Number.isFinite) ||
      form.pointNumber < 1
    ) {
      toast.error('تحقق من صحة أرقام النقطة والإحداثيات المدخلة');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      if (editingId) {
        await db.points.update(editingId, form);
        toast.success('تم تحديث النقطة بنجاح');
      } else {
        await db.points.add({
          ...form,
          id: crypto.randomUUID(),
          projectId: currentProjectId,
          timestamp: now,
        });
        toast.success('تم حفظ النقطة بالمشروع');
      }

      const updatedPoints = await db.points
        .where('projectId')
        .equals(currentProjectId)
        .sortBy('pointNumber');

      await db.projects.update(currentProjectId, {
        area: calculatePolygonArea(updatedPoints),
        perimeter: calculatePolygonPerimeter(updatedPoints),
        updatedAt: now,
      });

      setIsModalOpen(false);
    } catch {
      toast.error('تعذر حفظ النقطة');
    } finally {
      setIsSaving(false);
    }
  };

  const deletePoint = async (point: PointRecord) => {
    try {
      await db.points.delete(point.id);
      const remaining = points.filter((item) => item.id !== point.id);
      await db.projects.update(currentProjectId, {
        area: calculatePolygonArea(remaining),
        perimeter: calculatePolygonPerimeter(remaining),
        updatedAt: new Date().toISOString(),
      });
      toast.success(`تم حذف النقطة P${point.pointNumber}`);
    } catch {
      toast.error('تعذر حذف النقطة');
    }
  };

  const exportCsv = () => {
    if (!points.length) {
      toast.error('أضف نقطة واحدة على الأقل قبل التصدير');
      return;
    }
    const header = ['Point', 'Easting', 'Northing', 'Elevation', 'Description'];
    const rows = points.map((p) =>
      [p.pointNumber, p.easting.toFixed(4), p.northing.toFixed(4), p.elevation.toFixed(4), p.description].map(
        (val) => `"${String(val).replaceAll('"', '""')}"`
      )
    );
    const csv = '\ufeff' + [header, ...rows].map((r) => r.join(',')).join('\n');
    downloadFile(
      csv,
      `SurveyPro-${currentProject.name.replace(/\s+/g, '_')}-PNEZD.csv`,
      'text/csv;charset=utf-8;'
    );
    toast.success('تم تصدير ملف CSV بنجاح');
  };

  const exportDXF = () => {
    if (!points.length) {
      toast.error('أضف نقاط أولاً');
      return;
    }
    const dxf = generateDXF(currentProject.name, points);
    downloadFile(
      dxf,
      `SurveyPro-${currentProject.name.replace(/\s+/g, '_')}.dxf`,
      'application/dxf;charset=utf-8;'
    );
    toast.success('تم تصدير ملف AutoCAD DXF');
  };

  return (
    <div className="space-y-6">
      {/* GEODETIC METRICS BAR */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="عدد نقاط الرفع"
          value={`${points.length} نقطة`}
          sub={`نظام: ${activeCrs}`}
          color="text-emerald-400"
        />
        <Metric
          label="المساحة المحسوبة"
          value={`${formatNumber(area)} م²`}
          sub={`≈ ${formatNumber(squareMetersToFeddans(area), 3)} فدان | ${formatNumber(squareMetersToHectares(area), 3)} هكتار`}
          color="text-emerald-400"
        />
        <Metric
          label="المحيط الإجمالي"
          value={`${formatNumber(perimeter2D, 2)} م`}
          sub={`محيط 3D فضائي: ${formatNumber(perimeter3D, 2)} م`}
          color="text-sky-400"
        />
        <Metric
          label="المركز الهندسي (Centroid)"
          value={`E:${formatNumber(centroid.easting, 1)}`}
          sub={`N:${formatNumber(centroid.northing, 1)}`}
          color="text-amber-400"
        />
      </section>

      {/* MAIN POINTS TABLE CONTAINER */}
      <section className="glass-card overflow-hidden">
        {/* ACTION BAR */}
        <div className="flex flex-col gap-4 border-b border-slate-800/80 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-white">جدول بيانات النقاط المساحية (PNEZD)</h2>
            <p className="mt-1 text-xs text-slate-400">
              إدارة إحداثيات ومناسيب وأكواد معالم مشروع &laquo;{currentProject.name}&raquo;
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/import"
              className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-850 px-3 text-xs font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-800"
            >
              <ArrowDownToLine className="h-4 w-4 text-sky-400" />
              استيراد / تصدير
            </Link>

            <button
              onClick={exportDXF}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-850 px-3 text-xs font-semibold text-slate-200 hover:border-sky-500/40 hover:text-sky-400"
            >
              <FileCode2 className="h-4 w-4 text-sky-400" />
              DXF
            </button>

            <button
              onClick={exportCsv}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-850 px-3 text-xs font-semibold text-slate-200 hover:border-emerald-500/40 hover:text-emerald-400"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              CSV
            </button>

            <button
              onClick={openAddModal}
              className="flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" /> إضافة نقطة
            </button>
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-850 bg-slate-950/40 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم النقطة، الوصف أو الإحداثيات..."
              className="h-9 w-full rounded-xl border border-slate-800 bg-slate-900 pr-9 pl-3 text-xs text-white placeholder:text-slate-600 outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>عرض {filteredPoints.length} من أصل {points.length} نقطة</span>
            <Link
              href="/qa-qc"
              className="flex items-center gap-1 text-sky-400 hover:underline font-semibold"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> فحص الجودة
            </Link>
          </div>
        </div>

        {/* TABLE */}
        {filteredPoints.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-xs">
              <thead className="bg-slate-950/70 text-slate-400">
                <tr>
                  <th
                    onClick={() => {
                      if (sortBy === 'pointNumber') setSortAsc(!sortAsc);
                      else {
                        setSortBy('pointNumber');
                        setSortAsc(true);
                      }
                    }}
                    className="cursor-pointer px-4 py-3.5 font-bold hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      رقم النقطة <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortBy === 'easting') setSortAsc(!sortAsc);
                      else {
                        setSortBy('easting');
                        setSortAsc(true);
                      }
                    }}
                    className="cursor-pointer px-4 py-3.5 font-bold hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      الشرق (Easting / X) <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortBy === 'northing') setSortAsc(!sortAsc);
                      else {
                        setSortBy('northing');
                        setSortAsc(true);
                      }
                    }}
                    className="cursor-pointer px-4 py-3.5 font-bold hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      الشمال (Northing / Y) <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortBy === 'elevation') setSortAsc(!sortAsc);
                      else {
                        setSortBy('elevation');
                        setSortAsc(true);
                      }
                    }}
                    className="cursor-pointer px-4 py-3.5 font-bold hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      المنسوب (Elevation / Z) <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3.5 font-bold">الوصف / كود المعلم</th>
                  <th className="px-4 py-3.5 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredPoints.map((point) => (
                  <tr key={point.id} className="transition-colors hover:bg-slate-850/50">
                    <td className="px-4 py-3 font-bold text-emerald-400">P{point.pointNumber}</td>
                    <td dir="ltr" className="px-4 py-3 font-mono text-slate-200">
                      {point.easting.toFixed(4)}
                    </td>
                    <td dir="ltr" className="px-4 py-3 font-mono text-slate-200">
                      {point.northing.toFixed(4)}
                    </td>
                    <td dir="ltr" className="px-4 py-3 font-mono text-sky-400 font-semibold">
                      {point.elevation.toFixed(3)} م
                    </td>
                    <td className="px-4 py-3 text-slate-300">{point.description || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(point)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-500/10 hover:text-sky-400"
                          title="تعديل النقطة"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => void deletePoint(point)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
                          title="حذف النقطة"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center p-6 text-center">
            <MapPin className="mb-3 h-10 w-10 text-slate-700" />
            <h3 className="text-sm font-bold text-white">لا توجد نقاط مطابقة</h3>
            <p className="mt-1 text-xs text-slate-500">
              {searchQuery ? 'جرّب تغيير كلمات البحث' : 'ابدأ بإضافة نقاط الرفع المساحي للمشروع'}
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" /> إضافة نقطة جديدة
            </button>
          </div>
        )}
      </section>

      {/* ADD/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingId ? 'تعديل نقطة الرفع' : 'إضافة نقطة رفع مساحي جديدة'}
                </h3>
                <p className="mt-1 text-xs text-slate-400">إحداثيات 3D بصيغة PNEZD</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={savePoint} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    رقم النقطة (Point ID)
                  </label>
                  <input
                    required
                    type="number"
                    dir="ltr"
                    value={form.pointNumber}
                    onChange={(e) =>
                      setForm({ ...form, pointNumber: parseInt(e.target.value, 10) || 1 })
                    }
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    المنسوب (Elevation / Z)
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    dir="ltr"
                    value={form.elevation}
                    onChange={(e) =>
                      setForm({ ...form, elevation: parseFloat(e.target.value) || 0 })
                    }
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    الشرق (Easting / X)
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    dir="ltr"
                    value={form.easting}
                    onChange={(e) =>
                      setForm({ ...form, easting: parseFloat(e.target.value) || 0 })
                    }
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    الشمال (Northing / Y)
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    dir="ltr"
                    value={form.northing}
                    onChange={(e) =>
                      setForm({ ...form, northing: parseFloat(e.target.value) || 0 })
                    }
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">
                  الوصف / كود المعلم (Code / Description)
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="مثال: ركن حديدي، زاوية سور، منسوب أسفلت..."
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-bold text-white hover:bg-emerald-400 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'جاري الحفظ...' : 'حفظ النقطة'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="glass-card p-4 sm:p-5">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`mt-1.5 text-base font-bold ${color} sm:text-lg`} dir="ltr">
        {value}
      </p>
      {sub && <p className="mt-1 text-[10px] text-slate-500 truncate">{sub}</p>}
    </div>
  );
}

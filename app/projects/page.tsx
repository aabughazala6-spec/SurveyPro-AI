'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChevronLeft,
  Download,
  FolderKanban,
  FolderOpen,
  MapPin,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  db,
  DEFAULT_PROJECT,
  ensureDefaultProject,
  type ProjectRecord,
} from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import { calculatePolygonArea, calculatePolygonPerimeter, squareMetersToFeddans } from '@/lib/survey-calculations';
import proj4 from 'proj4';

const UTM38N = 'EPSG:32638';
const WGS84 = 'EPSG:4326';

function formatNumber(value: number, decimals = 2) {
  return value.toLocaleString('ar-SA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ProjectsPage() {
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const setCurrentProject = useAppStore((state) => state.setCurrentProject);
  const currentProjectId = useAppStore((state) => state.currentProject.id);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void ensureDefaultProject();
  }, []);

  const createProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newName.trim()) {
      toast.error('أدخل اسم المشروع');
      return;
    }
    setIsSaving(true);
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.projects.add({
        id,
        name: newName.trim(),
        description: newDescription.trim(),
        createdAt: now,
        area: 0,
        perimeter: 0,
      });
      toast.success('تم إنشاء المشروع بنجاح');
      setNewName('');
      setNewDescription('');
      setIsCreateOpen(false);
    } catch {
      toast.error('تعذر إنشاء المشروع');
    } finally {
      setIsSaving(false);
    }
  };

  const openProject = async (project: ProjectRecord) => {
    const pointCount = await db.points.where('projectId').equals(project.id).count();
    setCurrentProject({
      id: project.id,
      name: project.name,
      location: project.description || 'غير محدد',
      areaSquareMeters: project.area,
      pointCount,
      perimeter: project.perimeter,
      updatedAt: formatDate(project.createdAt),
    });
    toast.success(`تم تحميل المشروع: ${project.name}`);
  };

  const exportProject = async (project: ProjectRecord, format: 'csv' | 'kml') => {
    const points = await db.points.where('projectId').equals(project.id).sortBy('pointNumber');
    if (!points.length) {
      toast.error('لا توجد نقاط في هذا المشروع');
      return;
    }

    if (format === 'csv') {
      const header = ['Point', 'Northing', 'Easting', 'Elevation', 'Description'];
      const rows = points.map((p) =>
        [p.pointNumber, p.northing, p.easting, p.elevation, p.description].map((v) => `"${String(v).replaceAll('"', '""')}"`)
      );
      const csv = '\ufeff' + [header, ...rows].map((r) => r.join(',')).join('\n');
      downloadFile(csv, `surveypro-${project.name}.csv`, 'text/csv;charset=utf-8;');
      toast.success('تم تصدير ملف CSV');
    } else {
      const placemarks = points.map((p) => {
        const [lng, lat] = proj4(UTM38N, WGS84, [p.easting, p.northing]);
        return `    <Placemark>
      <name>P${p.pointNumber}</name>
      <description>${p.description || ''}</description>
      <Point><coordinates>${lng},${lat},${p.elevation}</coordinates></Point>
    </Placemark>`;
      });
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${project.name}</name>
${placemarks.join('\n')}
  </Document>
</kml>`;
      downloadFile(kml, `surveypro-${project.name}.kml`, 'application/vnd.google-earth.kml+xml');
      toast.success('تم تصدير ملف KML');
    }
  };

  const deleteProject = async (project: ProjectRecord) => {
    try {
      await db.points.where('projectId').equals(project.id).delete();
      await db.projects.delete(project.id);
      if (project.id === currentProjectId) {
        await ensureDefaultProject();
        const def = await db.projects.get(DEFAULT_PROJECT.id);
        if (def) {
          const count = await db.points.where('projectId').equals(def.id).count();
          setCurrentProject({
            id: def.id,
            name: def.name,
            location: def.description || 'غير محدد',
            areaSquareMeters: def.area,
            pointCount: count,
            perimeter: def.perimeter,
            updatedAt: formatDate(def.createdAt),
          });
        }
      }
      toast.success('تم حذف المشروع وكل نقاطه');
    } catch {
      toast.error('تعذر حذف المشروع');
    }
    setDeleteTarget(null);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <span>الرئيسية</span>
            <ChevronLeft className="h-3 w-3" />
            <span className="text-sky-400">المشاريع</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">إدارة المشاريع</h1>
              <p className="mt-1 text-sm text-slate-400">أنشئ وأدر مشاريعك المساحية المحفوظة محلياً</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 text-sm font-bold text-white shadow-lg shadow-sky-950/30 transition-all hover:bg-sky-400 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          إنشاء مشروع جديد
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="glass-card flex min-h-[300px] flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400">
            <FolderKanban className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">لا توجد مشاريع بعد</h3>
          <p className="mt-2 max-w-sm text-xs leading-6 text-slate-500">
            ابدأ بإنشاء مشروعك الأول لإدارة نقاط الرفع والمساحات.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="mt-5 rounded-xl border border-sky-500/30 px-4 py-2.5 text-xs font-bold text-sky-400 hover:bg-sky-500/10"
          >
            إنشاء أول مشروع
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isActive={project.id === currentProjectId}
              onOpen={() => void openProject(project)}
              onExportCsv={() => void exportProject(project, 'csv')}
              onExportKml={() => void exportProject(project, 'kml')}
              onDelete={() => setDeleteTarget(project)}
            />
          ))}
        </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">إنشاء مشروع جديد</h2>
                <p className="mt-1 text-xs text-slate-500">أدخل تفاصيل المشروع المساحي</p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="إغلاق">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={createProject} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-slate-400">اسم المشروع</span>
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: مخطط حي الياسمين"
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-sky-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-slate-400">الوصف</span>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="مثال: مشروع رفع مساحي لقطع أراضٍ سكنية"
                  rows={3}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
                />
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isSaving} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-500 text-sm font-bold text-white hover:bg-sky-400 disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  {isSaving ? 'جاري الحفظ...' : 'حفظ المشروع'}
                </button>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="h-11 rounded-xl border border-slate-700 px-5 text-sm font-semibold text-slate-300 hover:bg-slate-800">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-slate-900 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
              <Trash2 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-white">تأكيد حذف المشروع</h2>
            <p className="mt-2 text-sm text-slate-400">
              سيتم حذف المشروع &laquo;{deleteTarget.name}&raquo; وكل نقاطه نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => void deleteProject(deleteTarget)}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-bold text-white hover:bg-red-400"
              >
                <Trash2 className="h-4 w-4" />
                حذف نهائي
              </button>
              <button onClick={() => setDeleteTarget(null)} className="h-11 rounded-xl border border-slate-700 px-5 text-sm font-semibold text-slate-300 hover:bg-slate-800">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  isActive,
  onOpen,
  onExportCsv,
  onExportKml,
  onDelete,
}: {
  project: ProjectRecord;
  isActive: boolean;
  onOpen: () => void;
  onExportCsv: () => void;
  onExportKml: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`glass-card overflow-hidden transition-all ${isActive ? 'border-sky-500/30 ring-1 ring-sky-500/10' : ''}`}>
      {isActive && (
        <div className="bg-sky-500/10 px-4 py-1.5 text-center text-[11px] font-bold text-sky-400">
          المشروع النشط
        </div>
      )}
      <div className="p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-white">{project.name}</h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">{project.description || 'بدون وصف'}</p>
          </div>
        </div>
        <div className="mb-5 grid grid-cols-3 gap-2 border-y border-slate-800/60 py-3">
          <div>
            <p className="text-[10px] text-slate-500">المساحة</p>
            <p className="mt-1 text-sm font-bold text-emerald-400">{formatNumber(project.area)} م²</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500">المحيط</p>
            <p className="mt-1 text-sm font-bold text-sky-400">{formatNumber(project.perimeter, 1)} م</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500">التاريخ</p>
            <p className="mt-1 text-sm font-bold text-slate-300">{formatDate(project.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onOpen} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-500/10 px-3 text-xs font-semibold text-sky-400 transition-colors hover:bg-sky-500/20">
            <FolderOpen className="h-3.5 w-3.5" />
            فتح
          </button>
          <button onClick={onExportCsv} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:border-emerald-500/40 hover:text-emerald-400">
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button onClick={onExportKml} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:border-orange-500/40 hover:text-orange-400">
            <Download className="h-3.5 w-3.5" />
            KML
          </button>
          <button onClick={onDelete} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:border-red-500/40 hover:text-red-400">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

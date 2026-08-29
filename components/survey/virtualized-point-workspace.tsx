'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpDown,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Compass,
  Download,
  Edit2,
  FileCode2,
  FileSpreadsheet,
  Filter,
  Flag,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Square,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, ensureDefaultProject, type PointRecord } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import {
  addSurveyPoint,
  bulkDeletePoints,
  bulkShiftCoordinates,
  bulkShiftElevation,
  bulkToggleFlag,
  bulkUpdateLayer,
  calculatePointStatistics,
  deleteSurveyPoint,
  updateSurveyPoint,
} from '@/lib/point-operations';
import {
  calculatePolygonArea,
  calculatePolygonCentroid,
  calculatePolygonPerimeter,
  calculatePolygonPerimeter3D,
  squareMetersToFeddans,
  squareMetersToHectares,
} from '@/lib/survey-calculations';
import { downloadFile, generateDXF } from '@/lib/dxf-generator';
import { CrsSafetyPanel } from './crs-safety-panel';
import Link from 'next/link';
import { useTranslation, engFormat } from '@/lib/i18n';

type SortField = 'pointNumber' | 'easting' | 'northing' | 'elevation' | 'description' | 'layer' | 'timestamp';

function formatNumber(value: number, decimals = 2) {
  return engFormat.number(value, decimals, true);
}

export function VirtualizedPointWorkspace() {
  const { t, isRtl } = useTranslation();
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentProject = useAppStore((state) => state.currentProject);
  const activeCrs = useAppStore((state) => state.activeCrs);

  // Reactive Dexie points query for active project
  const livePoints = useLiveQuery(
    () => db.points.where('projectId').equals(currentProjectId).sortBy('pointNumber'),
    [currentProjectId]
  );
  const points = useMemo(() => livePoints ?? [], [livePoints]);

  // Ensure default project exists
  useEffect(() => {
    void ensureDefaultProject();
  }, []);

  // UI / Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [qaFilter, setQaFilter] = useState<'ALL' | 'FLAGGED_ONLY' | 'VALID_ONLY'>('ALL');
  const [selectedLayer, setSelectedLayer] = useState<string>('ALL');
  const [minElevation, setMinElevation] = useState<string>('');
  const [maxElevation, setMaxElevation] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('pointNumber');
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination (supports virtualized batching)
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selection state (Set of Point IDs)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals & Single Point State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<PointRecord | null>(null);

  // Inline Quick Edit state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineElevation, setInlineElevation] = useState<number>(0);
  const [inlineDescription, setInlineDescription] = useState<string>('');

  // Bulk Operations Modal States
  const [bulkActionType, setBulkActionType] = useState<
    'DELETE' | 'SHIFT_Z' | 'SHIFT_XY' | 'UPDATE_LAYER' | 'FLAG' | null
  >(null);
  const [shiftZDelta, setShiftZDelta] = useState<string>('0.000');
  const [shiftDeltaE, setShiftDeltaE] = useState<string>('0.000');
  const [shiftDeltaN, setShiftDeltaN] = useState<string>('0.000');
  const [bulkLayerInput, setBulkLayerInput] = useState<string>('');
  const [bulkDescInput, setBulkDescInput] = useState<string>('');
  const [isExecutingBulk, setIsExecutingBulk] = useState(false);

  // Form State for Add / Edit
  const [pointForm, setPointForm] = useState({
    pointNumber: 1,
    easting: 0,
    northing: 0,
    elevation: 0,
    description: '',
    layer: 'SURVEY_POINTS',
  });

  // Extract distinct layers in current dataset
  const distinctLayers = useMemo(() => {
    const set = new Set<string>();
    points.forEach((p) => {
      if (p.layer) set.add(p.layer);
    });
    return Array.from(set);
  }, [points]);

  // Comprehensive Filter & Sort logic
  const filteredAndSortedPoints = useMemo(() => {
    let result = points;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.pointNumber.toString().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.layer?.toLowerCase().includes(q) ||
          p.easting.toString().includes(q) ||
          p.northing.toString().includes(q) ||
          p.elevation.toString().includes(q)
      );
    }

    // QA filter
    if (qaFilter === 'FLAGGED_ONLY') {
      result = result.filter((p) => Boolean(p.flagged));
    } else if (qaFilter === 'VALID_ONLY') {
      result = result.filter((p) => !p.flagged);
    }

    // Layer filter
    if (selectedLayer !== 'ALL') {
      result = result.filter((p) => p.layer === selectedLayer);
    }

    // Elevation range filter
    const minZ = parseFloat(minElevation);
    const maxZ = parseFloat(maxElevation);
    if (!isNaN(minZ)) {
      result = result.filter((p) => p.elevation >= minZ);
    }
    if (!isNaN(maxZ)) {
      result = result.filter((p) => p.elevation <= maxZ);
    }

    // Sort
    return [...result].sort((a, b) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [points, searchQuery, qaFilter, selectedLayer, minElevation, maxElevation, sortField, sortAsc]);

  // Statistics for active project points
  const statistics = useMemo(() => {
    return calculatePointStatistics(points);
  }, [points]);

  // Polygon geometric metrics
  const area = useMemo(() => calculatePolygonArea(points), [points]);
  const perimeter2D = useMemo(() => calculatePolygonPerimeter(points), [points]);
  const perimeter3D = useMemo(() => calculatePolygonPerimeter3D(points), [points]);

  // Paginated points for table rendering
  const totalPages = Math.ceil(filteredAndSortedPoints.length / pageSize) || 1;
  const paginatedPoints = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedPoints.slice(start, start + pageSize);
  }, [filteredAndSortedPoints, currentPage, pageSize]);

  // Handle header sorting click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Selection handlers
  const handleToggleSelectPoint = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allOnPageSelected = paginatedPoints.every((p) => next.has(p.id));
      if (allOnPageSelected) {
        paginatedPoints.forEach((p) => next.delete(p.id));
      } else {
        paginatedPoints.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(new Set(filteredAndSortedPoints.map((p) => p.id)));
    toast.info(t('pointsWorkspace.selectAllFiltered', { count: filteredAndSortedPoints.length }));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Add Point Modal Open
  const openAddModal = () => {
    const nextNum = points.length ? Math.max(...points.map((p) => p.pointNumber)) + 1 : 1;
    setPointForm({
      pointNumber: nextNum,
      easting: 0,
      northing: 0,
      elevation: 0,
      description: '',
      layer: 'SURVEY_POINTS',
    });
    setIsAddModalOpen(true);
  };

  // Edit Point Modal Open
  const openEditModal = (p: PointRecord) => {
    setEditingPoint(p);
    setPointForm({
      pointNumber: p.pointNumber,
      easting: p.easting,
      northing: p.northing,
      elevation: p.elevation,
      description: p.description || '',
      layer: p.layer || 'SURVEY_POINTS',
    });
    setIsEditModalOpen(true);
  };

  // Save Single Add Point
  const handleSaveAddPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await addSurveyPoint(currentProjectId, pointForm);
    if (res.success) {
      toast.success(t('pointsWorkspace.pointSavedMsg', { pointNumber: pointForm.pointNumber }));
      setIsAddModalOpen(false);
    } else {
      toast.error(res.error || t('common.error'));
    }
  };

  // Save Single Edit Point
  const handleSaveEditPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPoint) return;
    const res = await updateSurveyPoint(editingPoint.id, pointForm);
    if (res.success) {
      toast.success(t('pointsWorkspace.pointUpdatedMsg', { pointNumber: pointForm.pointNumber }));
      setIsEditModalOpen(false);
      setEditingPoint(null);
    } else {
      toast.error(res.error || t('common.error'));
    }
  };

  // Delete Single Point
  const handleDeletePoint = async (p: PointRecord) => {
    const res = await deleteSurveyPoint(p.id);
    if (res.success) {
      toast.success(t('pointsWorkspace.pointDeletedMsg', { pointNumber: p.pointNumber }));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    } else {
      toast.error(res.error || t('common.error'));
    }
  };

  // Inline quick edit save
  const handleSaveInlineEdit = async (p: PointRecord) => {
    const res = await updateSurveyPoint(p.id, {
      elevation: inlineElevation,
      description: inlineDescription,
    });
    if (res.success) {
      toast.success(t('pointsWorkspace.pointUpdatedMsg', { pointNumber: p.pointNumber }));
      setInlineEditingId(null);
    } else {
      toast.error(res.error || t('common.error'));
    }
  };

  // Execute Bulk Operations
  const handleExecuteBulkAction = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setIsExecutingBulk(true);
    try {
      if (bulkActionType === 'DELETE') {
        const res = await bulkDeletePoints(currentProjectId, ids);
        if (res.success) {
          toast.success(t('pointsWorkspace.pointsDeletedMsg', { count: res.count }));
          setSelectedIds(new Set());
        } else {
          toast.error(res.error || t('common.error'));
        }
      } else if (bulkActionType === 'SHIFT_Z') {
        const delta = parseFloat(shiftZDelta);
        if (isNaN(delta) || delta === 0) {
          toast.error(t('pointsWorkspace.shiftInputLabel'));
          setIsExecutingBulk(false);
          return;
        }
        const res = await bulkShiftElevation({
          projectId: currentProjectId,
          pointIds: ids,
          deltaZ: delta,
        });
        if (res.success) {
          toast.success(t('pointsWorkspace.singlePointShifted', { count: res.updatedCount, delta: delta.toFixed(3) }));
        } else {
          toast.error(res.error || t('common.error'));
        }
      } else if (bulkActionType === 'SHIFT_XY') {
        const dE = parseFloat(shiftDeltaE) || 0;
        const dN = parseFloat(shiftDeltaN) || 0;
        if (dE === 0 && dN === 0) {
          toast.error(t('pointsWorkspace.batchPlanarShift'));
          setIsExecutingBulk(false);
          return;
        }
        const res = await bulkShiftCoordinates({
          projectId: currentProjectId,
          pointIds: ids,
          deltaE: dE,
          deltaN: dN,
        });
        if (res.success) {
          toast.success(t('pointsWorkspace.planarShiftedSuccess', { count: res.updatedCount }));
        } else {
          toast.error(res.error || t('common.error'));
        }
      } else if (bulkActionType === 'UPDATE_LAYER') {
        const res = await bulkUpdateLayer({
          projectId: currentProjectId,
          pointIds: ids,
          layer: bulkLayerInput.trim() || undefined,
          description: bulkDescInput.trim() || undefined,
        });
        if (res.success) {
          toast.success(t('pointsWorkspace.layerUpdatedSuccess', { count: res.updatedCount }));
        } else {
          toast.error(res.error || t('common.error'));
        }
      } else if (bulkActionType === 'FLAG') {
        const res = await bulkToggleFlag({
          projectId: currentProjectId,
          pointIds: ids,
          flagged: true,
        });
        if (res.success) {
          toast.success(t('pointsWorkspace.pointsFlaggedSuccess', { count: res.updatedCount }));
        }
      }

      setBulkActionType(null);
    } catch (err) {
      toast.error(t('common.error'));
      console.error(err);
    } finally {
      setIsExecutingBulk(false);
    }
  };

  // Export Selected Points
  const handleExportSelectedCsv = () => {
    const targetPoints = selectedIds.size > 0
      ? points.filter((p) => selectedIds.has(p.id))
      : points;

    if (!targetPoints.length) {
      toast.error(t('pointsWorkspace.noPointsToExport'));
      return;
    }

    const header = ['Point', 'Easting', 'Northing', 'Elevation', 'Description', 'Layer', 'Flagged'];
    const rows = targetPoints.map((p) =>
      [
        p.pointNumber,
        p.easting.toFixed(4),
        p.northing.toFixed(4),
        p.elevation.toFixed(4),
        p.description || '',
        p.layer || 'SURVEY_POINTS',
        p.flagged ? 'YES' : 'NO',
      ].map((val) => `"${String(val).replaceAll('"', '""')}"`)
    );
    const csv = '\ufeff' + [header, ...rows].map((r) => r.join(',')).join('\n');
    downloadFile(
      csv,
      `SurveyPro-${currentProject?.name?.replace(/\s+/g, '_') || 'Project'}-Points.csv`,
      'text/csv;charset=utf-8;'
    );
    toast.success(t('pointsWorkspace.exportCsvSuccess', { count: targetPoints.length }));
  };

  const handleExportDXF = () => {
    const targetPoints = selectedIds.size > 0
      ? points.filter((p) => selectedIds.has(p.id))
      : points;

    if (!targetPoints.length) {
      toast.error(t('pointsWorkspace.noPointsToExport'));
      return;
    }
    const dxf = generateDXF(currentProject?.name || 'Survey Project', targetPoints);
    downloadFile(
      dxf,
      `SurveyPro-${currentProject?.name?.replace(/\s+/g, '_') || 'Project'}.dxf`,
      'application/dxf;charset=utf-8;'
    );
    toast.success(t('pointsWorkspace.exportDxfSuccess', { count: targetPoints.length }));
  };

  return (
    <div className="space-y-6">
      {/* CRS SAFETY PANEL EMBED */}
      <CrsSafetyPanel points={points} />

      {/* GEODETIC & STATISTICAL METRICS SUMMARY */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <div className="glass-card p-4">
          <p className="text-[11px] text-slate-400">{t('pointsWorkspace.statTotal')}</p>
          <p className="mt-1 text-base font-bold text-white sm:text-lg">
            {points.length} <span className="text-xs font-normal text-slate-400">{t('pointsWorkspace.thPoint')}</span>
          </p>
          <p className="mt-1 text-[10px] text-emerald-400 truncate">
            {statistics.flaggedCount > 0
              ? t('pointsWorkspace.flaggedForReview', { count: statistics.flaggedCount })
              : t('pointsWorkspace.allApproved')}
          </p>
        </div>

        <div className="glass-card p-4">
          <p className="text-[11px] text-slate-400">{t('pointsWorkspace.statArea')}</p>
          <p className="mt-1 text-base font-bold text-emerald-400 sm:text-lg" dir="ltr">
            {formatNumber(area)} {t('units.meterSq')}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 truncate">
            ≈ {formatNumber(squareMetersToFeddans(area), 2)} {t('units.feddan')} | {formatNumber(squareMetersToHectares(area), 2)} {t('units.hectare')}
          </p>
        </div>

        <div className="glass-card p-4">
          <p className="text-[11px] text-slate-400">{t('pointsWorkspace.statPerimeter')}</p>
          <p className="mt-1 text-base font-bold text-sky-400 sm:text-lg" dir="ltr">
            {formatNumber(perimeter2D, 2)} {t('units.meter')}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 truncate">
            {t('pointsWorkspace.statSpatial')}: {formatNumber(perimeter3D, 2)} {t('units.meter')}
          </p>
        </div>

        <div className="glass-card p-4">
          <p className="text-[11px] text-slate-400">{t('pointsWorkspace.statEastSpan')}</p>
          <p className="mt-1 text-xs font-bold text-slate-200 font-mono" dir="ltr">
            Δ {formatNumber(statistics.bbox.deltaE, 2)} {t('units.meter')}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 font-mono truncate" dir="ltr">
            [{formatNumber(statistics.bbox.minE, 1)} .. {formatNumber(statistics.bbox.maxE, 1)}]
          </p>
        </div>

        <div className="glass-card p-4">
          <p className="text-[11px] text-slate-400">{t('pointsWorkspace.statNorthSpan')}</p>
          <p className="mt-1 text-xs font-bold text-slate-200 font-mono" dir="ltr">
            Δ {formatNumber(statistics.bbox.deltaN, 2)} {t('units.meter')}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 font-mono truncate" dir="ltr">
            [{formatNumber(statistics.bbox.minN, 1)} .. {formatNumber(statistics.bbox.maxN, 1)}]
          </p>
        </div>

        <div className="glass-card p-4">
          <p className="text-[11px] text-slate-400">{t('pointsWorkspace.statZRelief')}</p>
          <p className="mt-1 text-xs font-bold text-amber-400 font-mono" dir="ltr">
            ΔZ {formatNumber(statistics.bbox.deltaZ, 2)} {t('units.meter')}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 font-mono truncate" dir="ltr">
            {t('pointsWorkspace.statAverage')}: {formatNumber(statistics.bbox.avgZ, 2)} {t('units.meter')}
          </p>
        </div>
      </section>

      {/* MAIN VIRTUALIZED WORKSPACE CONTAINER */}
      <section className="glass-card overflow-hidden">
        {/* HEADER TOOLBAR */}
        <div className="flex flex-col gap-4 border-b border-slate-800/80 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-400" />
              {t('pointsWorkspace.title')}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {t('pointsWorkspace.subtitle')} — &laquo;{currentProject?.name}&raquo;
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/import"
              className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-850 px-3 text-xs font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-800 transition-colors"
            >
              <ArrowDownToLine className="h-4 w-4 text-sky-400" />
              {t('nav.importExport')}
            </Link>

            <button
              onClick={handleExportDXF}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-850 px-3 text-xs font-semibold text-slate-200 hover:border-sky-500/40 hover:text-sky-400 transition-colors"
            >
              <FileCode2 className="h-4 w-4 text-sky-400" />
              DXF
            </button>

            <button
              onClick={handleExportSelectedCsv}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-850 px-3 text-xs font-semibold text-slate-200 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              CSV
            </button>

            <button
              onClick={openAddModal}
              className="flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-400 transition-colors"
            >
              <Plus className="h-4 w-4" /> {t('pointsWorkspace.addNewPoint')}
            </button>
          </div>
        </div>

        {/* SEARCH, FILTERS & VIEW OPTIONS */}
        <div className="border-b border-slate-850 bg-slate-950/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t('pointsWorkspace.searchPlaceholder')}
                className={`h-9 w-full rounded-xl border border-slate-800 bg-slate-900 ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} text-xs text-white placeholder:text-slate-600 outline-none focus:border-sky-500`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* QA Status filter */}
              <select
                value={qaFilter}
                onChange={(e) => {
                  setQaFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="h-9 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs text-slate-300 outline-none focus:border-sky-500 font-medium"
              >
                <option value="ALL">{t('pointsWorkspace.allStatuses')}</option>
                <option value="VALID_ONLY">{t('pointsWorkspace.validOnly')}</option>
                <option value="FLAGGED_ONLY">{t('pointsWorkspace.flaggedFilter')}</option>
              </select>

              {/* Layer Filter */}
              {distinctLayers.length > 0 && (
                <select
                  value={selectedLayer}
                  onChange={(e) => {
                    setSelectedLayer(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs text-slate-300 outline-none focus:border-sky-500 font-medium"
                >
                  <option value="ALL">{t('pointsWorkspace.allLayersCount', { count: distinctLayers.length })}</option>
                  {distinctLayers.map((ly) => (
                    <option key={ly} value={ly}>
                      {t('pointsWorkspace.layerPrefix', { name: ly })}
                    </option>
                  ))}
                </select>
              )}

              {/* Advanced Filter Toggle */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                  showAdvancedFilters || minElevation || maxElevation
                    ? 'border-sky-500/50 bg-sky-500/10 text-sky-400'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                {t('pointsWorkspace.advancedFilter')}
              </button>
            </div>
          </div>

          {/* ADVANCED FILTER COLLAPSIBLE */}
          {showAdvancedFilters && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 text-xs text-slate-300">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">{t('pointsWorkspace.filterElevationZ')}</span>
                  <input
                    type="number"
                    step="any"
                    placeholder={t('pointsWorkspace.minElevPlaceholder')}
                    value={minElevation}
                    onChange={(e) => {
                      setMinElevation(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-8 w-28 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-white"
                  />
                  <span className="text-slate-500">{t('pointsWorkspace.toLabel')}</span>
                  <input
                    type="number"
                    step="any"
                    placeholder={t('pointsWorkspace.maxElevPlaceholder')}
                    value={maxElevation}
                    onChange={(e) => {
                      setMaxElevation(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-8 w-28 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-white"
                  />
                </div>

                {(minElevation || maxElevation || selectedLayer !== 'ALL' || qaFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setMinElevation('');
                      setMaxElevation('');
                      setSelectedLayer('ALL');
                      setQaFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className="text-xs text-rose-400 hover:underline"
                  >
                    {t('pointsWorkspace.resetFilters')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* DOCKED FLOATING BULK ACTIONS TOOLBAR (WHEN SELECTED) */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-500/30 bg-sky-950/40 px-5 py-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-sky-500 px-2.5 py-1 font-bold text-white shadow-sm">
                {t('pointsWorkspace.selectedCount', { count: selectedIds.size, total: points.length })}
              </span>
              <button
                onClick={handleSelectAllFiltered}
                className="text-sky-400 hover:underline font-semibold"
              >
                {t('pointsWorkspace.selectAllFiltered', { count: filteredAndSortedPoints.length })}
              </button>
              <button
                onClick={handleClearSelection}
                className="text-slate-400 hover:text-white"
              >
                {t('pointsWorkspace.clearSelection')}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setBulkActionType('SHIFT_Z')}
                className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 font-semibold text-amber-300 hover:bg-amber-500/20"
              >
                {t('pointsWorkspace.bulkShiftZTitle')}
              </button>

              <button
                onClick={() => setBulkActionType('SHIFT_XY')}
                className="flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 font-semibold text-sky-300 hover:bg-sky-500/20"
              >
                {t('pointsWorkspace.batchPlanarShift')}
              </button>

              <button
                onClick={() => setBulkActionType('UPDATE_LAYER')}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-semibold text-slate-200 hover:bg-slate-750"
              >
                <Tag className="h-3.5 w-3.5" />
                {t('pointsWorkspace.batchLayer')}
              </button>

              <button
                onClick={() => setBulkActionType('FLAG')}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-semibold text-slate-200 hover:bg-slate-750"
              >
                <Flag className="h-3.5 w-3.5 text-amber-400" />
                {t('pointsWorkspace.batchFlag')}
              </button>

              <button
                onClick={() => setBulkActionType('DELETE')}
                className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 font-semibold text-rose-300 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('pointsWorkspace.batchDelete')}
              </button>
            </div>
          </div>
        )}

        {/* HIGH-PERFORMANCE TABLE */}
        {filteredAndSortedPoints.length > 0 ? (
          <div className="overflow-x-auto">
            <table className={`w-full min-w-[850px] ${isRtl ? 'text-right' : 'text-left'} text-xs`}>
              <thead className="bg-slate-950/70 text-slate-400 select-none">
                <tr>
                  <th className="w-12 px-4 py-3.5 text-center">
                    <button
                      onClick={handleSelectAllOnPage}
                      className="text-slate-400 hover:text-white"
                      title={t('pointsWorkspace.selectAllOnPage')}
                    >
                      {paginatedPoints.every((p) => selectedIds.has(p.id)) && paginatedPoints.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-sky-400" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>

                  <th
                    onClick={() => handleSort('pointNumber')}
                    className="cursor-pointer px-4 py-3.5 font-bold hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      {t('pointsWorkspace.thPoint')} <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('easting')}
                    className="cursor-pointer px-4 py-3.5 font-bold hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      {t('pointsWorkspace.thEasting')} <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('northing')}
                    className="cursor-pointer px-4 py-3.5 font-bold hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      {t('pointsWorkspace.thNorthing')} <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('elevation')}
                    className="cursor-pointer px-4 py-3.5 font-bold hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      {t('pointsWorkspace.thElevation')} <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('layer')}
                    className="cursor-pointer px-4 py-3.5 font-bold hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      {t('pointsWorkspace.thLayer')} <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('description')}
                    className="cursor-pointer px-4 py-3.5 font-bold hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      {t('pointsWorkspace.thDesc')} <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>

                  <th className="px-4 py-3.5 font-bold text-center">{t('pointsWorkspace.thActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {paginatedPoints.map((point) => {
                  const isSelected = selectedIds.has(point.id);
                  const isInline = inlineEditingId === point.id;

                  return (
                    <tr
                      key={point.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-sky-950/30 hover:bg-sky-950/40'
                          : point.flagged
                          ? 'bg-amber-950/15 hover:bg-amber-950/25'
                          : 'hover:bg-slate-850/50'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleSelectPoint(point.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-sky-400" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>

                      {/* Point Number */}
                      <td className="px-4 py-3 font-bold text-emerald-400">
                        <div className="flex items-center gap-1.5">
                          <span>P{point.pointNumber}</span>
                          {point.flagged && (
                            <span title={t('pointsWorkspace.auditPoint')}>
                              <Flag className="h-3 w-3 text-amber-400" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Easting */}
                      <td dir="ltr" className="px-4 py-3 font-mono text-slate-200">
                        {point.easting.toFixed(4)}
                      </td>

                      {/* Northing */}
                      <td dir="ltr" className="px-4 py-3 font-mono text-slate-200">
                        {point.northing.toFixed(4)}
                      </td>

                      {/* Elevation */}
                      <td dir="ltr" className="px-4 py-3 font-mono">
                        {isInline ? (
                          <input
                            type="number"
                            step="any"
                            value={inlineElevation}
                            onChange={(e) => setInlineElevation(parseFloat(e.target.value) || 0)}
                            className="h-7 w-24 rounded border border-sky-500 bg-slate-900 px-1.5 text-xs text-sky-400"
                          />
                        ) : (
                          <span className="font-semibold text-sky-400">
                            {point.elevation.toFixed(3)} {t('units.meter')}
                          </span>
                        )}
                      </td>

                      {/* Layer */}
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                          {point.layer || 'SURVEY_POINTS'}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 text-slate-300">
                        {isInline ? (
                          <input
                            type="text"
                            value={inlineDescription}
                            onChange={(e) => setInlineDescription(e.target.value)}
                            className="h-7 w-32 rounded border border-sky-500 bg-slate-900 px-1.5 text-xs text-white"
                          />
                        ) : (
                          point.description || '—'
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {isInline ? (
                            <>
                              <button
                                onClick={() => handleSaveInlineEdit(point)}
                                className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/10"
                                title={t('pointsWorkspace.saveQuickEdit')}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setInlineEditingId(null)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
                                title={t('common.cancel')}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setInlineEditingId(point.id);
                                  setInlineElevation(point.elevation);
                                  setInlineDescription(point.description || '');
                                }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-500/10 hover:text-sky-400"
                                title={t('pointsWorkspace.quickEdit')}
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => openEditModal(point)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-500/10 hover:text-sky-400"
                                title={t('pointsWorkspace.editFull')}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => void handleDeletePoint(point)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
                                title={t('pointsWorkspace.deletePoint')}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center p-6 text-center">
            <MapPin className="mb-3 h-10 w-10 text-slate-700" />
            <h3 className="text-sm font-bold text-white">{t('pointsWorkspace.noPointsMatch')}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {searchQuery || qaFilter !== 'ALL' || minElevation || maxElevation
                ? t('pointsWorkspace.noPointsMatchDesc')
                : t('pointsWorkspace.noPointsStartDesc')}
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-400 transition-colors"
            >
              <Plus className="h-4 w-4" /> {t('pointsWorkspace.addNewPoint')}
            </button>
          </div>
        )}

        {/* PAGINATION BAR */}
        <div className="flex flex-col gap-3 border-t border-slate-850 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              {t('pointsWorkspace.showingRows', {
                from: (currentPage - 1) * pageSize + 1,
                to: Math.min(currentPage * pageSize, filteredAndSortedPoints.length),
                total: filteredAndSortedPoints.length,
              })}
            </span>
            <span className="text-slate-600">•</span>
            <span>{t('pointsWorkspace.rowsPerPage')}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 rounded-lg border border-slate-800 bg-slate-900 px-2 text-xs text-white"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </div>

          <div className="flex items-center gap-1 self-end sm:self-center">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:bg-slate-850 hover:text-white disabled:opacity-40"
              title={t('pointsWorkspace.firstPage')}
            >
              {isRtl ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:bg-slate-850 hover:text-white disabled:opacity-40"
              title={t('pointsWorkspace.prevPage')}
            >
              {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>

            <span className="px-3 font-semibold text-slate-200">
              {t('pointsWorkspace.pageOf', { current: currentPage, total: totalPages })}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:bg-slate-850 hover:text-white disabled:opacity-40"
              title={t('pointsWorkspace.nextPage')}
            >
              {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:bg-slate-850 hover:text-white disabled:opacity-40"
              title={t('pointsWorkspace.lastPage')}
            >
              {isRtl ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </section>

      {/* ADD POINT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7 ${isRtl ? 'text-right' : 'text-left'}`}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{t('pointsWorkspace.addPointTitle')}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {activeCrs}
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAddPoint} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.inputPointNum')}
                  </label>
                  <input
                    required
                    type="number"
                    dir="ltr"
                    value={pointForm.pointNumber}
                    onChange={(e) =>
                      setPointForm({ ...pointForm, pointNumber: parseInt(e.target.value, 10) || 1 })
                    }
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.inputElevation')}
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    dir="ltr"
                    value={pointForm.elevation}
                    onChange={(e) =>
                      setPointForm({ ...pointForm, elevation: parseFloat(e.target.value) || 0 })
                    }
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.inputEasting')}
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    dir="ltr"
                    value={pointForm.easting}
                    onChange={(e) =>
                      setPointForm({ ...pointForm, easting: parseFloat(e.target.value) || 0 })
                    }
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.inputNorthing')}
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    dir="ltr"
                    value={pointForm.northing}
                    onChange={(e) =>
                      setPointForm({ ...pointForm, northing: parseFloat(e.target.value) || 0 })
                    }
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.inputDescription')}
                  </label>
                  <input
                    type="text"
                    value={pointForm.description}
                    onChange={(e) => setPointForm({ ...pointForm, description: e.target.value })}
                    placeholder={t('pointsWorkspace.inputDescription')}
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.inputLayer')}
                  </label>
                  <input
                    type="text"
                    value={pointForm.layer}
                    onChange={(e) => setPointForm({ ...pointForm, layer: e.target.value })}
                    placeholder="SURVEY_POINTS"
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-bold text-white hover:bg-emerald-400 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  {t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT POINT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7 ${isRtl ? 'text-right' : 'text-left'}`}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{t('pointsWorkspace.editPointTitle')} P{editingPoint?.pointNumber}</h3>
                <p className="mt-1 text-xs text-slate-400">{t('pointsWorkspace.subtitle')}</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPoint} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.inputPointNum')}
                  </label>
                  <input
                    required
                    type="number"
                    dir="ltr"
                    value={pointForm.pointNumber}
                    onChange={(e) =>
                      setPointForm({ ...pointForm, pointNumber: parseInt(e.target.value, 10) || 1 })
                    }
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.inputElevation')}
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    dir="ltr"
                    value={pointForm.elevation}
                    onChange={(e) =>
                      setPointForm({ ...pointForm, elevation: parseFloat(e.target.value) || 0 })
                    }
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.inputEasting')}
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    dir="ltr"
                    value={pointForm.easting}
                    onChange={(e) =>
                      setPointForm({ ...pointForm, easting: parseFloat(e.target.value) || 0 })
                    }
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.inputNorthing')}
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    dir="ltr"
                    value={pointForm.northing}
                    onChange={(e) =>
                      setPointForm({ ...pointForm, northing: parseFloat(e.target.value) || 0 })
                    }
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.inputDescription')}
                  </label>
                  <input
                    type="text"
                    value={pointForm.description}
                    onChange={(e) => setPointForm({ ...pointForm, description: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.inputLayer')}
                  </label>
                  <input
                    type="text"
                    value={pointForm.layer}
                    onChange={(e) => setPointForm({ ...pointForm, layer: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-500 text-xs font-bold text-white hover:bg-sky-400 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  {t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK ACTION MODALS */}
      {bulkActionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6 ${isRtl ? 'text-right' : 'text-left'}`}>
            {bulkActionType === 'DELETE' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-rose-400">
                  <AlertTriangle className="h-6 w-6 shrink-0" />
                  <h3 className="text-base font-bold text-white">{t('pointsWorkspace.confirmBulkDeleteTitle')}</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('pointsWorkspace.confirmBulkDeleteDesc', { count: selectedIds.size })}
                </p>
                <div className="flex gap-3 pt-3">
                  <button
                    onClick={handleExecuteBulkAction}
                    disabled={isExecutingBulk}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 text-xs font-bold text-white hover:bg-rose-400 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isExecutingBulk ? t('pointsWorkspace.deleting') : t('pointsWorkspace.yesDeletePoints')}
                  </button>
                  <button
                    onClick={() => setBulkActionType(null)}
                    className="rounded-xl border border-slate-700 px-4 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {bulkActionType === 'SHIFT_Z' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white">{t('pointsWorkspace.bulkShiftZTitle')}</h3>
                <p className="text-xs text-slate-400">
                  {t('pointsWorkspace.bulkShiftZDesc', { count: selectedIds.size })}
                </p>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.shiftInputLabel')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    dir="ltr"
                    placeholder="+0.500 / -1.250"
                    value={shiftZDelta}
                    onChange={(e) => setShiftZDelta(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {t('pointsWorkspace.bulkShiftZHint')}
                  </p>
                </div>
                <div className="flex gap-3 pt-3">
                  <button
                    onClick={handleExecuteBulkAction}
                    disabled={isExecutingBulk}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 text-xs font-bold text-white hover:bg-amber-400 disabled:opacity-50"
                  >
                    {isExecutingBulk ? t('pointsWorkspace.applying') : t('pointsWorkspace.shiftApplyBtn')}
                  </button>
                  <button
                    onClick={() => setBulkActionType(null)}
                    className="rounded-xl border border-slate-700 px-4 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {bulkActionType === 'SHIFT_XY' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white">{t('pointsWorkspace.bulkPlanarTitle')}</h3>
                <p className="text-xs text-slate-400">
                  {t('pointsWorkspace.bulkPlanarDesc', { count: selectedIds.size })}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">
                      {t('pointsWorkspace.shiftDeltaELabel')}
                    </label>
                    <input
                      type="number"
                      step="any"
                      dir="ltr"
                      value={shiftDeltaE}
                      onChange={(e) => setShiftDeltaE(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">
                      {t('pointsWorkspace.shiftDeltaNLabel')}
                    </label>
                    <input
                      type="number"
                      step="any"
                      dir="ltr"
                      value={shiftDeltaN}
                      onChange={(e) => setShiftDeltaN(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-3">
                  <button
                    onClick={handleExecuteBulkAction}
                    disabled={isExecutingBulk}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-500 text-xs font-bold text-white hover:bg-sky-400 disabled:opacity-50"
                  >
                    {isExecutingBulk ? t('pointsWorkspace.applying') : t('pointsWorkspace.shiftApplyBtn')}
                  </button>
                  <button
                    onClick={() => setBulkActionType(null)}
                    className="rounded-xl border border-slate-700 px-4 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {bulkActionType === 'UPDATE_LAYER' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white">{t('pointsWorkspace.layerChangeTitle')}</h3>
                <p className="text-xs text-slate-400">
                  {t('pointsWorkspace.bulkLayerDesc', { count: selectedIds.size })}
                </p>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.layerInputLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder="BOUNDARY_WALLS / ROAD_CENTER"
                    value={bulkLayerInput}
                    onChange={(e) => setBulkLayerInput(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    {t('pointsWorkspace.inputDescription')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('pointsWorkspace.bulkDescPlaceholder')}
                    value={bulkDescInput}
                    onChange={(e) => setBulkDescInput(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
                <div className="flex gap-3 pt-3">
                  <button
                    onClick={handleExecuteBulkAction}
                    disabled={isExecutingBulk}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-bold text-white hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {isExecutingBulk ? t('pointsWorkspace.updating') : t('common.save')}
                  </button>
                  <button
                    onClick={() => setBulkActionType(null)}
                    className="rounded-xl border border-slate-700 px-4 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

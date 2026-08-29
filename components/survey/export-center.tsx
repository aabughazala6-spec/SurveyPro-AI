'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Download,
  FileSpreadsheet,
  FileCode2,
  MapPin,
  FileText,
  Copy,
  CheckCircle2,
  AlertCircle,
  Layers,
  Settings2,
  Compass,
  Eye,
  RefreshCw,
  Filter,
  ShieldCheck,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, type PointRecord } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import { SUPPORTED_CRS } from '@/lib/crs-definitions';
import { generateDXF, downloadFile } from '@/lib/dxf-generator';
import {
  generateCSV,
  generateSurveyReportTXT,
  generateKML,
  generateGeoJSON,
  filterExportPoints,
  type CsvColumnField,
} from '@/lib/export-engine';
import { logAuditEvent } from '@/lib/audit-service';

type ExportFormat = 'CSV' | 'TXT' | 'DXF' | 'KML' | 'GEOJSON';
type ScopeFilter = 'ALL' | 'SELECTED' | 'FLAGGED' | 'LAYER';

export function ExportCenter() {
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentProject = useAppStore((state) => state.currentProject);
  const activeCrs = useAppStore((state) => state.activeCrs);
  const selectedPointIds = useAppStore((state) => state.selectedPointIds);

  const [activeFormat, setActiveFormat] = useState<ExportFormat>('CSV');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('ALL');
  const [selectedLayer, setSelectedLayer] = useState<string>('ALL');

  // CSV Configuration Options
  const [csvDelimiter, setCsvDelimiter] = useState<string>(',');
  const [csvPrecision, setCsvPrecision] = useState<number>(4);
  const [csvIncludeHeader, setCsvIncludeHeader] = useState<boolean>(true);
  const [csvIncludeComments, setCsvIncludeComments] = useState<boolean>(false);
  const [csvColumns, setCsvColumns] = useState<CsvColumnField[]>([
    'pointNumber',
    'easting',
    'northing',
    'elevation',
    'description',
  ]);

  // DXF Configuration Options
  const [dxfIncludeBoundary, setDxfIncludeBoundary] = useState<boolean>(true);
  const [dxfIncludeLabels, setDxfIncludeLabels] = useState<boolean>(true);
  const [dxfIncludeElev, setDxfIncludeElev] = useState<boolean>(true);
  const [dxfIncludeQaqc, setDxfIncludeQaqc] = useState<boolean>(true);
  const [dxfTextHeight, setDxfTextHeight] = useState<number>(1.5);

  // KML Options
  const [kmlIncludeBoundary, setKmlIncludeBoundary] = useState<boolean>(true);
  const [kmlAltitudeMode, setKmlAltitudeMode] = useState<'clampToGround' | 'relativeToGround' | 'absolute'>(
    'clampToGround'
  );

  // TXT Options
  const [surveyorName, setSurveyorName] = useState<string>('المساح المعتمد');

  // Fetch real points from Dexie
  const liveAllPoints = useLiveQuery(
    () => db.points.where('projectId').equals(currentProjectId).sortBy('pointNumber'),
    [currentProjectId]
  );
  const allPoints = useMemo(() => liveAllPoints ?? [], [liveAllPoints]);

  // Unique layers present in project points
  const projectLayers = useMemo(() => {
    const set = new Set<string>();
    allPoints.forEach((p) => {
      if (p.layer) set.add(p.layer);
    });
    return Array.from(set);
  }, [allPoints]);

  const crsDef = useMemo(() => {
    return (
      SUPPORTED_CRS.find((c) => c.code === (currentProject?.crsCode || activeCrs)) ||
      SUPPORTED_CRS[0]
    );
  }, [currentProject?.crsCode, activeCrs]);

  // Calculate filtered export points
  const targetPoints = useMemo(() => {
    return filterExportPoints(allPoints, {
      selectedPointIds: scopeFilter === 'SELECTED' ? selectedPointIds : undefined,
      flaggedOnly: scopeFilter === 'FLAGGED',
      layerFilter: scopeFilter === 'LAYER' ? selectedLayer : undefined,
    });
  }, [allPoints, scopeFilter, selectedPointIds, selectedLayer]);

  // Compute live preview string based on current format & options
  const exportPayload = useMemo(() => {
    if (!targetPoints || targetPoints.length === 0) {
      return { content: '', warnings: [], pointCount: 0, filename: '', mimeType: '' };
    }

    const projCleanName = (currentProject?.name || 'SurveyProject').replace(/\s+/g, '_');

    if (activeFormat === 'CSV') {
      const content = generateCSV(targetPoints, {
        columnOrder: csvColumns,
        delimiter: csvDelimiter,
        precision: csvPrecision,
        includeHeader: csvIncludeHeader,
        includeCommentHeader: csvIncludeComments,
        projectName: currentProject?.name,
        crsCode: activeCrs,
      });
      return {
        content,
        warnings: [],
        pointCount: targetPoints.length,
        filename: `${projCleanName}_points.csv`,
        mimeType: 'text/csv;charset=utf-8;',
      };
    }

    if (activeFormat === 'TXT') {
      const content = generateSurveyReportTXT(currentProject, targetPoints, {
        projectName: currentProject?.name,
        crsCode: activeCrs,
        surveyorName,
      });
      return {
        content,
        warnings: [],
        pointCount: targetPoints.length,
        filename: `${projCleanName}_report.txt`,
        mimeType: 'text/plain;charset=utf-8;',
      };
    }

    if (activeFormat === 'DXF') {
      const content = generateDXF(currentProject?.name || 'SurveyProject', targetPoints, {
        includeBoundary: dxfIncludeBoundary,
        includeTextLabels: dxfIncludeLabels,
        includeElevationText: dxfIncludeElev,
        includeQaqcFlags: dxfIncludeQaqc,
        textHeight: dxfTextHeight,
      });
      return {
        content,
        warnings: [],
        pointCount: targetPoints.length,
        filename: `${projCleanName}_cad.dxf`,
        mimeType: 'application/dxf;charset=utf-8;',
      };
    }

    if (activeFormat === 'KML') {
      const res = generateKML(currentProject?.name || 'SurveyProject', targetPoints, activeCrs, {
        includeBoundary: kmlIncludeBoundary,
        altitudeMode: kmlAltitudeMode,
      });
      return {
        content: res.kml,
        warnings: res.warnings,
        pointCount: res.pointCount,
        filename: `${projCleanName}_earth.kml`,
        mimeType: 'application/vnd.google-earth.kml+xml;charset=utf-8;',
      };
    }

    if (activeFormat === 'GEOJSON') {
      const res = generateGeoJSON(currentProject?.name || 'SurveyProject', targetPoints, activeCrs, {
        includeBoundary: true,
      });
      return {
        content: res.geojson,
        warnings: res.warnings,
        pointCount: res.pointCount,
        filename: `${projCleanName}_gis.geojson`,
        mimeType: 'application/geo+json;charset=utf-8;',
      };
    }

    return { content: '', warnings: [], pointCount: 0, filename: '', mimeType: '' };
  }, [
    activeFormat,
    targetPoints,
    currentProject,
    activeCrs,
    csvColumns,
    csvDelimiter,
    csvPrecision,
    csvIncludeHeader,
    csvIncludeComments,
    surveyorName,
    dxfIncludeBoundary,
    dxfIncludeLabels,
    dxfIncludeElev,
    dxfIncludeQaqc,
    dxfTextHeight,
    kmlIncludeBoundary,
    kmlAltitudeMode,
  ]);

  const handleDownload = () => {
    if (!exportPayload.content || exportPayload.pointCount === 0) {
      toast.error('لا توجد نقاط مطابقة للتصدير');
      return;
    }

    downloadFile(exportPayload.content, exportPayload.filename, exportPayload.mimeType);

    // Audit Logging
    logAuditEvent({
      projectId: currentProjectId,
      operation: 'EXPORT_COMPLETED',
      summary: `تصدير بيانات المشروع بصيغة ${activeFormat} (${exportPayload.pointCount} نقطة) - ملف: ${exportPayload.filename}`,
      metadata: {
        format: activeFormat,
        pointCount: exportPayload.pointCount,
        scopeFilter,
        crsCode: activeCrs,
        filename: exportPayload.filename,
      },
    });

    toast.success(`تم تصدير ملف ${exportPayload.filename} بنجاح`);
  };

  const handleCopyClipboard = () => {
    if (!exportPayload.content) return;
    navigator.clipboard.writeText(exportPayload.content);
    toast.success('تم نسخ محتوى التصدير إلى الحافظة');
  };

  return (
    <div className="space-y-6">
      {/* EXPORT HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
            <Download className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">مركز التصدير الهندسي (Export Center)</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              تصدير نقاط ومضلعات المشروع بدقة هندسية عالية إلى AutoCAD, GIS, Excel, Google Earth مع ضبط الإسناد
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-750 bg-slate-950/70 px-3.5 py-2 text-xs">
            <span className="text-[10px] text-slate-500 block">نظام الإسناد المصدر:</span>
            <span className="font-bold text-sky-400">{crsDef.code} - {crsDef.name}</span>
          </div>
          <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400">
            {allPoints.length} نقطة مسجلة
          </span>
        </div>
      </div>

      {/* FORMAT SELECTOR */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          {
            id: 'CSV',
            title: 'جدول CSV / Excel',
            desc: 'PNEZD كامل مع الوصف والأعمدة المخصصة',
            icon: FileSpreadsheet,
            color: 'text-emerald-400',
            borderColor: 'hover:border-emerald-500/40',
          },
          {
            id: 'TXT',
            title: 'تقرير مساحي TXT',
            desc: 'تقرير رسمي منسق مع إحصائيات المشروع',
            icon: FileText,
            color: 'text-sky-400',
            borderColor: 'hover:border-sky-500/40',
          },
          {
            id: 'DXF',
            title: 'AutoCAD DXF',
            desc: 'طبقات، نصوص، مناسيب ومضلع 3D (R12/AC1009)',
            icon: FileCode2,
            color: 'text-amber-400',
            borderColor: 'hover:border-amber-500/40',
          },
          {
            id: 'KML',
            title: 'Google Earth KML',
            desc: 'إسقاط فضائي 3D مع المضلع والبيانات الوصفية',
            icon: MapPin,
            color: 'text-orange-400',
            borderColor: 'hover:border-orange-500/40',
          },
          {
            id: 'GEOJSON',
            title: 'نظم GIS / GeoJSON',
            desc: 'FeatureCollection معياري (RFC 7946)',
            icon: Share2,
            color: 'text-fuchsia-400',
            borderColor: 'hover:border-fuchsia-500/40',
          },
        ].map((fmt) => {
          const Icon = fmt.icon;
          const active = activeFormat === fmt.id;
          return (
            <button
              key={fmt.id}
              onClick={() => setActiveFormat(fmt.id as ExportFormat)}
              className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-right transition-all ${
                active
                  ? 'border-sky-500 bg-slate-850 shadow-lg shadow-sky-950/40 ring-1 ring-sky-500/50'
                  : `border-slate-800 bg-slate-900/60 ${fmt.borderColor} hover:bg-slate-850`
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <Icon className={`h-5 w-5 ${fmt.color}`} />
                {active && <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />}
              </div>
              <div>
                <span className="text-xs font-bold text-white block">{fmt.title}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">{fmt.desc}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* LEFT COLUMN: FILTERS & FORMAT-SPECIFIC CONFIGURATION */}
        <div className="space-y-6">
          {/* SCOPE FILTER SECTION */}
          <section className="glass-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Filter className="h-4 w-4 text-sky-400" /> نطاق النقاط المراد تصديرها (Export Scope)
              </h2>
              <span className="text-xs font-bold text-sky-300">
                {targetPoints.length} من {allPoints.length} نقطة
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { id: 'ALL', label: `كل النقاط (${allPoints.length})` },
                { id: 'SELECTED', label: `المحددة فقط (${selectedPointIds.length})` },
                { id: 'FLAGGED', label: `نقاط التدقيق ⚠️ (${allPoints.filter((p) => p.flagged).length})` },
                { id: 'LAYER', label: 'حسب الطبقة' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScopeFilter(s.id as ScopeFilter)}
                  className={`rounded-xl border p-2.5 text-center text-xs font-bold transition-all ${
                    scopeFilter === s.id
                      ? 'border-sky-500 bg-sky-500/15 text-sky-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {scopeFilter === 'LAYER' && (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <label className="text-xs text-slate-400 block mb-1.5 font-semibold">اختر الطبقة المطلوب تصديرها:</label>
                <select
                  value={selectedLayer}
                  onChange={(e) => setSelectedLayer(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
                >
                  <option value="ALL">جميع الطبقات (All Layers)</option>
                  {projectLayers.map((l) => (
                    <option key={l} value={l}>
                      طبقة: {l} ({allPoints.filter((p) => p.layer === l).length} نقطة)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

          {/* FORMAT-SPECIFIC CUSTOMIZATION PANEL */}
          <section className="glass-card p-5 sm:p-6 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-emerald-400" /> تخصيص إعدادات صيغة {activeFormat}
            </h2>

            {/* CSV Settings */}
            {activeFormat === 'CSV' && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-semibold">الفاصل (Delimiter):</label>
                    <select
                      value={csvDelimiter}
                      onChange={(e) => setCsvDelimiter(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                    >
                      <option value=",">فاصلة Comma (,)</option>
                      <option value=";">فاصلة منقوطة Semicolon (;)</option>
                      <option value="&#9;">تاب Tab (\t)</option>
                      <option value=" ">مسافة Space</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-semibold">الدقة العشرية (Decimal Precision):</label>
                    <select
                      value={csvPrecision}
                      onChange={(e) => setCsvPrecision(parseInt(e.target.value))}
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                    >
                      <option value="2">2 أرقام عشرية (0.01 م - دقة عادية)</option>
                      <option value="3">3 أرقام عشرية (0.001 م - دقة مليمترية)</option>
                      <option value="4">4 أرقام عشرية (0.0001 م - دقة هندسية عالية)</option>
                      <option value="6">6 أرقام عشرية (جيوديسي فائق)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={csvIncludeHeader}
                      onChange={(e) => setCsvIncludeHeader(e.target.checked)}
                      className="h-4 w-4 rounded accent-sky-500"
                    />
                    تضمين عناوين الأعمدة (Header Row)
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={csvIncludeComments}
                      onChange={(e) => setCsvIncludeComments(e.target.checked)}
                      className="h-4 w-4 rounded accent-sky-500"
                    />
                    تضمين ترويسة معلومات المشروع ومرجع الإسناد (#)
                  </label>
                </div>
              </div>
            )}

            {/* TXT Report Settings */}
            {activeFormat === 'TXT' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-semibold">اسم المساح المسئول عن التقرير:</label>
                  <input
                    type="text"
                    value={surveyorName}
                    onChange={(e) => setSurveyorName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  يتضمن تقرير TXT ملخصاً شاملاً للمشروع مع المساحة، المحيط، إسناد CRS، ونقاط الملاحظات.
                </p>
              </div>
            )}

            {/* DXF Settings */}
            {activeFormat === 'DXF' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-semibold">ارتفاع النصوص (Text Height م):</label>
                    <input
                      type="number"
                      step="0.5"
                      dir="ltr"
                      value={dxfTextHeight}
                      onChange={(e) => setDxfTextHeight(parseFloat(e.target.value) || 1.5)}
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-semibold">توافق AutoCAD:</label>
                    <input
                      disabled
                      value="AutoCAD R12 / AC1009 (Universal 3D)"
                      className="h-10 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dxfIncludeBoundary}
                      onChange={(e) => setDxfIncludeBoundary(e.target.checked)}
                      className="h-4 w-4 rounded accent-sky-500"
                    />
                    رسم مضلع الحدود المغلق (BOUNDARY)
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dxfIncludeLabels}
                      onChange={(e) => setDxfIncludeLabels(e.target.checked)}
                      className="h-4 w-4 rounded accent-sky-500"
                    />
                    إظهار أرقام النقاط وأكواد الوصف
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dxfIncludeElev}
                      onChange={(e) => setDxfIncludeElev(e.target.checked)}
                      className="h-4 w-4 rounded accent-sky-500"
                    />
                    كتابة المناسيب (ELEVATIONS)
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dxfIncludeQaqc}
                      onChange={(e) => setDxfIncludeQaqc(e.target.checked)}
                      className="h-4 w-4 rounded accent-sky-500"
                    />
                    تمييز نقاط الملاحظات (QAQC_FLAGS)
                  </label>
                </div>
              </div>
            )}

            {/* KML Settings */}
            {activeFormat === 'KML' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-semibold">نمط الارتفاع (Altitude Mode):</label>
                    <select
                      value={kmlAltitudeMode}
                      onChange={(e) => setKmlAltitudeMode(e.target.value as any)}
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white"
                    >
                      <option value="clampToGround">تثبيت على سطح الأرض (Clamp To Ground)</option>
                      <option value="relativeToGround">نسبي لسطح الأرض (Relative)</option>
                      <option value="absolute">ارتفاع مطلق ثلاثي الأبعاد 3D (Absolute)</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={kmlIncludeBoundary}
                        onChange={(e) => setKmlIncludeBoundary(e.target.checked)}
                        className="h-4 w-4 rounded accent-sky-500"
                      />
                      تضمين مضلع حدود المشروع في Google Earth
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-300">
                  يتم تحويل الإحداثيات المسقطة تلقائياً من {activeCrs} إلى نظام خطوط الطول والعرض WGS84 الخاص بـ Google Earth.
                </div>
              </div>
            )}

            {/* GeoJSON Settings */}
            {activeFormat === 'GEOJSON' && (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-200">صيغة FeatureCollection قياسية متوافقة مع RFC 7946:</p>
                <p>تحتوي كل نقطة على الهندسة الإحداثية (WGS84) مع خصائص الإحداثي الشرقي والشمالي الأصليين والمنسوب والطبقة.</p>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: LIVE PREVIEW & DOWNLOAD ACTIONS */}
        <div className="space-y-6">
          <section className="glass-card p-5 sm:p-6 space-y-4 flex flex-col h-full">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Eye className="h-4 w-4 text-sky-400" /> معاينة محتوى التصدير المباشر (Live Preview)
                </h3>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  الملف الناتج: <code className="text-sky-300 font-mono">{exportPayload.filename}</code>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyClipboard}
                  disabled={!exportPayload.content}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  <Copy className="h-3.5 w-3.5" /> نسخ
                </button>
              </div>
            </div>

            {/* Warnings banner */}
            {exportPayload.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 space-y-1">
                {exportPayload.warnings.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Code / Text Preview Container */}
            <div className="relative flex-1 min-h-[300px] max-h-[440px] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-slate-300 leading-relaxed" dir="ltr">
              {exportPayload.content ? (
                <pre>{exportPayload.content.slice(0, 5000)}{exportPayload.content.length > 5000 ? '\n... (تم اقتطاع باقي الملف للمعاينة السريعة)' : ''}</pre>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-600">
                  لا توجد نقاط مطابقة للمعاينة
                </div>
              )}
            </div>

            {/* Download Button */}
            <div className="pt-2">
              <button
                onClick={handleDownload}
                disabled={!exportPayload.content || exportPayload.pointCount === 0}
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition-all hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-40"
              >
                <Download className="h-5 w-5" />
                تحميل ملف {exportPayload.filename} ({exportPayload.pointCount} نقطة)
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  MapPin,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, type PointRecord } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import { downloadFile, generateDXF } from '@/lib/dxf-generator';
import { calculatePolygonArea, calculatePolygonPerimeter } from '@/lib/survey-calculations';
import proj4 from 'proj4';
import { SUPPORTED_CRS } from '@/lib/crs-definitions';

type ColumnRole = 'pointNumber' | 'northing' | 'easting' | 'elevation' | 'description' | 'ignore';

export function ImportExportWizard() {
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentProject = useAppStore((state) => state.currentProject);
  const activeCrs = useAppStore((state) => state.activeCrs);

  const livePoints = useLiveQuery(
    () => db.points.where('projectId').equals(currentProjectId).sortBy('pointNumber'),
    [currentProjectId]
  );
  const points = useMemo(() => livePoints ?? [], [livePoints]);

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [delimiter, setDelimiter] = useState<string>(',');
  const [hasHeader, setHasHeader] = useState<boolean>(true);
  const [columnMapping, setColumnMapping] = useState<Record<number, ColumnRole>>({
    0: 'pointNumber',
    1: 'easting',
    2: 'northing',
    3: 'elevation',
    4: 'description',
  });
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  // Parse raw text into rows
  const parsedRows = useMemo(() => {
    if (!rawText) return [];
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    return lines.map((line) => {
      if (delimiter === 'auto') {
        if (line.includes(',')) return line.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
        if (line.includes('\t')) return line.split('\t').map((s) => s.trim());
        if (line.includes(';')) return line.split(';').map((s) => s.trim());
        return line.split(/\s+/).map((s) => s.trim());
      }
      if (delimiter === '\\s+') {
        return line.split(/\s+/).map((s) => s.trim());
      }
      return line.split(delimiter).map((s) => s.trim().replace(/^["']|["']$/g, ''));
    });
  }, [rawText, delimiter]);

  // Preview & Validate parsed points
  const validation = useMemo(() => {
    if (!parsedRows.length) {
      return { validPoints: [], invalidCount: 0, duplicateCount: 0 };
    }

    const dataRows = hasHeader ? parsedRows.slice(1) : parsedRows;
    const validPoints: Array<Omit<PointRecord, 'id' | 'projectId' | 'timestamp'>> = [];
    let invalidCount = 0;
    const seenNumbers = new Set<number>();
    let duplicateCount = 0;

    dataRows.forEach((row, idx) => {
      let pNum = idx + 1;
      let easting = NaN;
      let northing = NaN;
      let elevation = 0;
      let description = '';

      Object.entries(columnMapping).forEach(([colIdxStr, role]) => {
        const cIdx = Number(colIdxStr);
        const cellValue = row[cIdx] ?? '';

        if (role === 'pointNumber') {
          const parsed = parseInt(cellValue.replace(/\D/g, ''), 10);
          if (!isNaN(parsed)) pNum = parsed;
        } else if (role === 'easting') {
          easting = parseFloat(cellValue);
        } else if (role === 'northing') {
          northing = parseFloat(cellValue);
        } else if (role === 'elevation') {
          const el = parseFloat(cellValue);
          if (!isNaN(el)) elevation = el;
        } else if (role === 'description') {
          description = cellValue;
        }
      });

      if (!isNaN(easting) && !isNaN(northing)) {
        if (seenNumbers.has(pNum)) {
          duplicateCount++;
          pNum = Math.max(...Array.from(seenNumbers), 0) + 1;
        }
        seenNumbers.add(pNum);

        validPoints.push({
          pointNumber: pNum,
          easting,
          northing,
          elevation,
          description,
        });
      } else {
        invalidCount++;
      }
    });

    return { validPoints, invalidCount, duplicateCount };
  }, [parsedRows, hasHeader, columnMapping]);

  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRawText(text);

      // Auto detect delimiter
      const firstLine = text.split(/\r?\n/)[0] || '';
      if (firstLine.includes(',')) setDelimiter(',');
      else if (firstLine.includes('\t')) setDelimiter('\t');
      else if (firstLine.includes(';')) setDelimiter(';');
      else setDelimiter('\\s+');

      toast.success(`تم قراءة الملف: ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleImportCommit = async () => {
    if (!validation.validPoints.length) {
      toast.error('لا توجد نقاط صالحة للاستيراد');
      return;
    }

    setIsImporting(true);
    try {
      if (importMode === 'replace') {
        await db.points.where('projectId').equals(currentProjectId).delete();
      }

      const now = new Date().toISOString();
      const recordsToInsert: PointRecord[] = validation.validPoints.map((p) => ({
        ...p,
        id: crypto.randomUUID(),
        projectId: currentProjectId,
        timestamp: now,
      }));

      await db.points.bulkAdd(recordsToInsert);

      const allProjectPoints = await db.points
        .where('projectId')
        .equals(currentProjectId)
        .sortBy('pointNumber');

      await db.projects.update(currentProjectId, {
        area: calculatePolygonArea(allProjectPoints),
        perimeter: calculatePolygonPerimeter(allProjectPoints),
        updatedAt: now,
      });

      toast.success(`تم استيراد ${recordsToInsert.length} نقطة بنجاح إلى المشروع`);
      setRawText(null);
      setFileName(null);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ النقاط المستوردة');
    } finally {
      setIsImporting(false);
    }
  };

  // Export handlers
  const exportCSV = () => {
    if (!points.length) {
      toast.error('لا توجد نقاط في المشروع للتصدير');
      return;
    }
    const header = ['Point', 'Easting', 'Northing', 'Elevation', 'Description'];
    const rows = points.map((p) =>
      [p.pointNumber, p.easting.toFixed(4), p.northing.toFixed(4), p.elevation.toFixed(4), p.description].map(
        (v) => `"${String(v).replaceAll('"', '""')}"`
      )
    );
    const csvContent = '\ufeff' + [header, ...rows].map((r) => r.join(',')).join('\n');
    downloadFile(
      csvContent,
      `SurveyPro-${currentProject.name.replace(/\s+/g, '_')}-PNEZD.csv`,
      'text/csv;charset=utf-8;'
    );
    toast.success('تم تصدير ملف CSV بنجاح');
  };

  const exportDXF = () => {
    if (!points.length) {
      toast.error('لا توجد نقاط في المشروع للتصدير');
      return;
    }
    const dxf = generateDXF(currentProject.name, points, {
      includeBoundary: true,
      includeTextLabels: true,
      includeElevationText: true,
    });
    downloadFile(
      dxf,
      `SurveyPro-${currentProject.name.replace(/\s+/g, '_')}.dxf`,
      'application/dxf;charset=utf-8;'
    );
    toast.success('تم تصدير ملف AutoCAD DXF بنجاح');
  };

  const exportKML = () => {
    if (!points.length) {
      toast.error('لا توجد نقاط في المشروع للتصدير');
      return;
    }
    try {
      const srcCrs = activeCrs || 'EPSG:32638';
      const placemarks = points.map((p) => {
        let lng = p.easting;
        let lat = p.northing;
        if (srcCrs !== 'EPSG:4326') {
          const transformed = proj4(srcCrs, 'EPSG:4326', [p.easting, p.northing]);
          lng = transformed[0];
          lat = transformed[1];
        }
        return `    <Placemark>
      <name>P${p.pointNumber}</name>
      <description>${p.description ? `${p.description} - Elevation: ${p.elevation.toFixed(2)}m` : `Elevation: ${p.elevation.toFixed(2)}m`}</description>
      <Point>
        <coordinates>${lng.toFixed(7)},${lat.toFixed(7)},${p.elevation.toFixed(2)}</coordinates>
      </Point>
    </Placemark>`;
      });

      const polyCoords = points.map((p) => {
        let lng = p.easting;
        let lat = p.northing;
        if (srcCrs !== 'EPSG:4326') {
          const transformed = proj4(srcCrs, 'EPSG:4326', [p.easting, p.northing]);
          lng = transformed[0];
          lat = transformed[1];
        }
        return `${lng.toFixed(7)},${lat.toFixed(7)},${p.elevation.toFixed(2)}`;
      });

      if (polyCoords.length >= 3) {
        polyCoords.push(polyCoords[0]); // Close polygon loop
      }

      const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${currentProject.name}</name>
    <description>SurveyPro AI Exported Survey Boundary</description>
    <Style id="polyStyle">
      <LineStyle><color>ff00aaff</color><width>2.5</width></LineStyle>
      <PolyStyle><color>3300aaff</color></PolyStyle>
    </Style>
    <Folder>
      <name>نقاط الرفع المساحي</name>
${placemarks.join('\n')}
    </Folder>
    ${
      polyCoords.length >= 3
        ? `
    <Placemark>
      <name>حدود المضلع</name>
      <styleUrl>#polyStyle</styleUrl>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              ${polyCoords.join('\n              ')}
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`
        : ''
    }
  </Document>
</kml>`;

      downloadFile(
        kml,
        `SurveyPro-${currentProject.name.replace(/\s+/g, '_')}.kml`,
        'application/vnd.google-earth.kml+xml;charset=utf-8;'
      );
      toast.success('تم تصدير ملف Google Earth KML بنجاح');
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء تحويل الإحداثيات إلى KML');
    }
  };

  const exportGeoJSON = () => {
    if (!points.length) {
      toast.error('لا توجد نقاط في المشروع للتصدير');
      return;
    }
    const srcCrs = activeCrs || 'EPSG:32638';
    const features: any[] = points.map((p) => {
      let lng = p.easting;
      let lat = p.northing;
      if (srcCrs !== 'EPSG:4326') {
        const transformed = proj4(srcCrs, 'EPSG:4326', [p.easting, p.northing]);
        lng = transformed[0];
        lat = transformed[1];
      }
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat, p.elevation],
        },
        properties: {
          pointNumber: p.pointNumber,
          elevation: p.elevation,
          description: p.description,
          rawEasting: p.easting,
          rawNorthing: p.northing,
        },
      };
    });

    const geojson = {
      type: 'FeatureCollection',
      name: currentProject.name,
      crs: {
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
      },
      features,
    };

    downloadFile(
      JSON.stringify(geojson, null, 2),
      `SurveyPro-${currentProject.name.replace(/\s+/g, '_')}.geojson`,
      'application/geo+json;charset=utf-8;'
    );
    toast.success('تم تصدير ملف GeoJSON بنجاح');
  };

  return (
    <div className="space-y-8">
      {/* EXPORT SECTION */}
      <section className="glass-card p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">تصدير بيانات المشروع</h2>
            <p className="mt-1 text-xs text-slate-400">
              تصدير نقاط المشروع ({points.length} نقطة) إلى الصيغ الهندسية القياسية (AutoCAD, GIS, Excel)
            </p>
          </div>
          <span className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-400">
            {activeCrs}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            onClick={exportCSV}
            disabled={!points.length}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-750 bg-slate-900/80 p-4 text-center transition-all hover:border-emerald-500/40 hover:bg-slate-850 active:scale-[0.98] disabled:opacity-40"
          >
            <FileSpreadsheet className="h-6 w-6 text-emerald-400" />
            <span className="text-xs font-bold text-white">جدول CSV / Excel</span>
            <span className="text-[10px] text-slate-500">PNEZD كامل مع الوصف</span>
          </button>

          <button
            onClick={exportDXF}
            disabled={!points.length}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-750 bg-slate-900/80 p-4 text-center transition-all hover:border-sky-500/40 hover:bg-slate-850 active:scale-[0.98] disabled:opacity-40"
          >
            <FileCode2 className="h-6 w-6 text-sky-400" />
            <span className="text-xs font-bold text-white">AutoCAD DXF</span>
            <span className="text-[10px] text-slate-500">طبقات، نصوص ومضلعات 3D</span>
          </button>

          <button
            onClick={exportKML}
            disabled={!points.length}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-750 bg-slate-900/80 p-4 text-center transition-all hover:border-orange-500/40 hover:bg-slate-850 active:scale-[0.98] disabled:opacity-40"
          >
            <MapPin className="h-6 w-6 text-orange-400" />
            <span className="text-xs font-bold text-white">Google Earth KML</span>
            <span className="text-[10px] text-slate-500">عرض فضائي ومضلع مغلق</span>
          </button>

          <button
            onClick={exportGeoJSON}
            disabled={!points.length}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-750 bg-slate-900/80 p-4 text-center transition-all hover:border-fuchsia-500/40 hover:bg-slate-850 active:scale-[0.98] disabled:opacity-40"
          >
            <FileText className="h-6 w-6 text-fuchsia-400" />
            <span className="text-xs font-bold text-white">نظم GIS / GeoJSON</span>
            <span className="text-[10px] text-slate-500">FeatureCollection قياسي</span>
          </button>
        </div>
      </section>

      {/* IMPORT WIZARD */}
      <section className="glass-card p-5 sm:p-7">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
              <UploadCloud className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-white">معالج استيراد بيانات الرفع المساحي</h2>
            <p className="mt-1 text-xs text-slate-400">
              استيراد ملفات النقاط (PNEZD, NEZ, XYZ, CSV, TXT) مع كشف تلقائي للأعمدة وتدقيق البيانات
            </p>
          </div>
        </div>

        {!rawText ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/40 p-6 text-center transition-all hover:border-sky-500/50 hover:bg-slate-900/50"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.txt,.xyz,.dat"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
              className="hidden"
            />
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-white">اسحب وأفلت ملف النقاط هنا أو اضغط للاختيار</p>
            <p className="mt-1.5 text-xs text-slate-500">يدعم صيغ: .CSV, .TXT, .XYZ, .DAT حتى 10,000 نقطة</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-sky-400" />
                <div>
                  <p className="text-sm font-bold text-white">{fileName}</p>
                  <p className="text-xs text-slate-400">{parsedRows.length} صف مقروء</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setRawText(null);
                  setFileName(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Configuration */}
            <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-400">الفاصل (Delimiter)</label>
                <select
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
                >
                  <option value=",">فاصلة Comma (,)</option>
                  <option value="\t">تاب Tab (\t)</option>
                  <option value=";">فاصلة منقوطة Semicolon (;)</option>
                  <option value="\s+">مسافات Whitespace</option>
                  <option value="auto">كشف تلقائي Auto</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-400">الصف الأول يحتوي عناوين</label>
                <div className="flex h-10 items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasHeaderCheck"
                    checked={hasHeader}
                    onChange={(e) => setHasHeader(e.target.checked)}
                    className="h-4 w-4 rounded accent-sky-500"
                  />
                  <label htmlFor="hasHeaderCheck" className="text-xs text-slate-300">
                    تخطي أول صف (Header)
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-400">طريقة الحفظ بالمشروع</label>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as any)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-sky-500"
                >
                  <option value="append">إضافة إلى النقاط الحالية (Append)</option>
                  <option value="replace">استبدال كل نقاط المشروع (Replace)</option>
                </select>
              </div>
            </div>

            {/* Column Mapping Table */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">تحديد أعمدة البيانات (Column Mapping)</h3>
                <span className="text-xs text-slate-400">اختر نوع البيانات المقابل لكل عمود</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-400">
                    <tr>
                      {parsedRows[0]?.map((_, colIdx) => (
                        <th key={colIdx} className="p-3">
                          <select
                            value={columnMapping[colIdx] || 'ignore'}
                            onChange={(e) =>
                              setColumnMapping((prev) => ({
                                ...prev,
                                [colIdx]: e.target.value as ColumnRole,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-850 p-1.5 text-xs text-sky-300 font-semibold outline-none focus:border-sky-400"
                          >
                            <option value="pointNumber">رقم النقطة (Point #)</option>
                            <option value="easting">الشرق (Easting / X)</option>
                            <option value="northing">الشمال (Northing / Y)</option>
                            <option value="elevation">المنسوب (Elevation / Z)</option>
                            <option value="description">الوصف (Code / Desc)</option>
                            <option value="ignore">تجاهل العمود (Ignore)</option>
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {parsedRows.slice(0, 5).map((row, rIdx) => (
                      <tr key={rIdx} className={hasHeader && rIdx === 0 ? 'bg-slate-900/50 text-slate-500' : ''}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-3 text-slate-300" dir="ltr">
                            {cell || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Validation Summary */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  {validation.validPoints.length} نقطة صالحة للاستيراد
                </div>
                {validation.invalidCount > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <AlertCircle className="h-4 w-4" />
                    {validation.invalidCount} صف تم تخطيه لعدم صلاحية الإحداثيات
                  </div>
                )}
                {validation.duplicateCount > 0 && (
                  <div className="flex items-center gap-1.5 text-sky-400">
                    <HelpCircle className="h-4 w-4" />
                    تمت إعادة ترقيم {validation.duplicateCount} نقطة لتفادي التكرار
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRawText(null);
                    setFileName(null);
                  }}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleImportCommit}
                  disabled={isImporting || !validation.validPoints.length}
                  className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-950/30 transition-all hover:bg-sky-400 disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      جاري الاستيراد...
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="h-4 w-4" />
                      تأكيد استيراد {validation.validPoints.length} نقطة
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

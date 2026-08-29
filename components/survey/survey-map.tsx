'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  Compass,
  Crosshair,
  Edit2,
  Eye,
  Flag,
  Layers,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Plus,
  RefreshCw,
  Ruler,
  Satellite,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { db, ensureDefaultProject, type PointRecord } from '@/lib/db';
import { useAppStore, type MapInteractionMode } from '@/lib/stores/app-store';
import {
  projectPointsToMapPoints,
  mapLatLngToProjectGrid,
  calculateProjectMapSummary,
  calculateMapPathMeasurement,
  getElevationColor,
  type MapPointDTO,
  type MapMeasurementResult,
  type ProjectMapSummary,
} from '@/lib/map-engine';
import { addSurveyPoint, deleteSurveyPoint, updateSurveyPoint, bulkToggleFlag } from '@/lib/point-operations';
import { formatNumber } from '@/lib/survey-calculations';
import { SUPPORTED_CRS } from '@/lib/crs-definitions';
import Link from 'next/link';

// Fix Leaflet's default icon assets URL resolution in Webpack/Next.js
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Point Marker Icon Generator
function createPointMarkerIcon(
  point: MapPointDTO,
  isSelected: boolean,
  isFocused: boolean,
  colorByElevation: boolean
) {
  let bgColor = '#0284c7'; // default sky
  let borderColor = '#ffffff';
  let textColor = '#ffffff';
  let zIndexOffset = 100;
  let pulseHtml = '';
  let flagBadge = '';

  if (colorByElevation && typeof point.elevationNormalized === 'number') {
    bgColor = getElevationColor(point.elevationNormalized);
  }

  if (point.flagged) {
    bgColor = '#f59e0b'; // amber
    borderColor = '#fef3c7';
    flagBadge = `<span style="font-size: 8px; margin-left: 2px;">⚠</span>`;
  }

  if (isSelected) {
    bgColor = '#0ea5e9';
    borderColor = '#38bdf8';
    zIndexOffset = 500;
  }

  if (isFocused) {
    bgColor = '#06b6d4';
    borderColor = '#22d3ee';
    zIndexOffset = 1000;
    pulseHtml = `
      <span style="
        position: absolute;
        top: -6px; left: -6px; right: -6px; bottom: -6px;
        border-radius: 9999px;
        border: 2px solid #22d3ee;
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        pointer-events: none;
      "></span>
    `;
  }

  const html = `
    <div style="
      position: relative;
      background: ${bgColor};
      color: ${textColor};
      font-weight: 800;
      font-size: ${isSelected || isFocused ? '12px' : '11px'};
      padding: ${isSelected || isFocused ? '4px 8px' : '3px 6px'};
      border-radius: 9999px;
      border: 2px solid ${borderColor};
      box-shadow: 0 4px 10px rgba(0,0,0,0.6)${isSelected ? ', 0 0 12px rgba(14,165,233,0.8)' : ''};
      white-space: nowrap;
      transform: translate(-50%, -50%);
      display: flex;
      align-items: center;
      gap: 2px;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
    ">
      ${pulseHtml}
      ${flagBadge}
      <span>P${point.pointNumber}</span>
      ${colorByElevation ? `<span style="font-size:9px; opacity:0.85; margin-right:2px;">${point.elevation.toFixed(1)}m</span>` : ''}
    </div>
  `;

  return L.divIcon({
    className: `survey-marker-p${point.pointNumber}`,
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Map Event Listener for Real-Time Coordinates, Snapping, and Interactions
function MapInteractionController({
  mapMode,
  activeCrs,
  onMapClick,
  onMouseMove,
}: {
  mapMode: MapInteractionMode;
  activeCrs: string;
  onMapClick: (lat: number, lng: number, e: L.LeafletMouseEvent) => void;
  onMouseMove: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng, e);
    },
    mousemove(e) {
      onMouseMove(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

// Programmatic map bounds fitter & focus controller
function MapViewController({
  points,
  focusedPoint,
}: {
  points: MapPointDTO[];
  focusedPoint: MapPointDTO | null;
}) {
  const map = useMap();
  const prevFocusedId = useRef<string | null>(null);

  useEffect(() => {
    if (focusedPoint && focusedPoint.id !== prevFocusedId.current && focusedPoint.isTransformedValid) {
      prevFocusedId.current = focusedPoint.id;
      map.flyTo([focusedPoint.lat, focusedPoint.lng], Math.max(map.getZoom(), 18), {
        duration: 1.2,
      });
    }
  }, [focusedPoint, map]);

  return null;
}

export default function SurveyMap() {
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentProject = useAppStore((state) => state.currentProject);
  const activeCrs = useAppStore((state) => state.activeCrs);
  const selectedPointId = useAppStore((state) => state.selectedPointId);
  const selectedPointIds = useAppStore((state) => state.selectedPointIds);
  const focusedPointId = useAppStore((state) => state.focusedPointId);
  const mapMode = useAppStore((state) => state.mapMode);

  const setSelectedPointId = useAppStore((state) => state.setSelectedPointId);
  const toggleSelectPointId = useAppStore((state) => state.toggleSelectPointId);
  const setFocusedPointId = useAppStore((state) => state.setFocusedPointId);
  const setMapMode = useAppStore((state) => state.setMapMode);
  const clearSelection = useAppStore((state) => state.clearSelection);

  // Reactive Dexie query for active project points
  const rawPoints = useLiveQuery(
    () => db.points.where('projectId').equals(currentProjectId).sortBy('pointNumber'),
    [currentProjectId]
  );
  const points = useMemo(() => rawPoints ?? [], [rawPoints]);

  const mapRef = useRef<L.Map | null>(null);
  const [baseMap, setBaseMap] = useState<'satellite' | 'street' | 'dark' | 'topo'>('satellite');
  const [colorByElevation, setColorByElevation] = useState<boolean>(false);
  const [showPolygonFill, setShowPolygonFill] = useState<boolean>(true);
  const [showPointLabels, setShowPointLabels] = useState<boolean>(true);
  const [showStatsDrawer, setShowStatsDrawer] = useState<boolean>(true);

  // Cursor Hover Coordinates
  const [cursorCoords, setCursorCoords] = useState<{
    lat: number;
    lng: number;
    easting: number;
    northing: number;
  } | null>(null);

  // User GPS Location State
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Measurement State (interactive CAD path)
  const [measurePoints, setMeasurePoints] = useState<
    Array<{ lat: number; lng: number; easting: number; northing: number; elevation: number; label: string }>
  >([]);

  // Add Point Modal State
  const [isAddPointModalOpen, setIsAddPointModalOpen] = useState<boolean>(false);
  const [newPointCoords, setNewPointCoords] = useState<{
    lat: number;
    lng: number;
    easting: number;
    northing: number;
    elevation: number;
    pointNumber: number;
    description: string;
    layer: string;
  }>({
    lat: 0,
    lng: 0,
    easting: 0,
    northing: 0,
    elevation: 0,
    pointNumber: 1,
    description: '',
    layer: 'GROUND',
  });

  // Edit Point Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingPoint, setEditingPoint] = useState<PointRecord | null>(null);

  // Ensure default project initialized
  useEffect(() => {
    void ensureDefaultProject();
  }, []);

  // Transform Project Points to Map Points (WGS84 lat/lng)
  const mapPoints = useMemo(() => {
    return projectPointsToMapPoints(points, activeCrs);
  }, [points, activeCrs]);

  const validMapPoints = useMemo(() => {
    return mapPoints.filter((p) => p.isTransformedValid);
  }, [mapPoints]);

  // Project Polygon Geometry
  const polygonLatLngs = useMemo(() => {
    return validMapPoints.map((p) => [p.lat, p.lng] as [number, number]);
  }, [validMapPoints]);

  // Focused Point Object
  const focusedPoint = useMemo(() => {
    if (!focusedPointId) return null;
    return mapPoints.find((p) => p.id === focusedPointId) ?? null;
  }, [mapPoints, focusedPointId]);

  // Project Summary Statistics
  const projectSummary = useMemo<ProjectMapSummary>(() => {
    return calculateProjectMapSummary(points, activeCrs);
  }, [points, activeCrs]);

  // Measurement Result Calculation
  const measurementResult = useMemo<MapMeasurementResult | null>(() => {
    if (measurePoints.length < 2) return null;
    const mode =
      mapMode === 'measure_distance'
        ? 'distance'
        : mapMode === 'measure_azimuth'
        ? 'azimuth'
        : 'area';
    return calculateMapPathMeasurement(measurePoints, mode);
  }, [measurePoints, mapMode]);

  // Default Center based on points or Riyadh default
  const defaultCenter: [number, number] = useMemo(() => {
    if (validMapPoints.length > 0) {
      return [validMapPoints[0].lat, validMapPoints[0].lng];
    }
    return [24.7136, 46.6753];
  }, [validMapPoints]);

  // Fit Project Bounds
  const handleFitBounds = useCallback(() => {
    if (!mapRef.current || validMapPoints.length === 0) return;
    if (validMapPoints.length === 1) {
      mapRef.current.setView([validMapPoints[0].lat, validMapPoints[0].lng], 18);
      return;
    }
    const bounds = L.latLngBounds(validMapPoints.map((p) => [p.lat, p.lng]));
    mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 19 });
  }, [validMapPoints]);

  // Initial fit bounds when points load
  useEffect(() => {
    if (validMapPoints.length > 0 && mapRef.current) {
      handleFitBounds();
    }
  }, [validMapPoints.length, handleFitBounds]);

  // Handle GPS Location
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      toast.error('المتصفح لا يدعم تحديد الموقع الجغرافي');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsLocation({ lat: latitude, lng: longitude, accuracy });
        mapRef.current?.flyTo([latitude, longitude], 18, { duration: 1.5 });
        toast.success('تم تحديد موقعك الفعلي بنجاح', {
          description: `دقة التحديد: ±${accuracy.toFixed(1)} متر`,
        });
        setIsLocating(false);
      },
      (err) => {
        console.error(err);
        toast.error('تعذر تحديد الموقع الجغرافي (تأكد من منح الصلاحية)');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Cursor move handler
  const handleMouseMove = useCallback(
    (lat: number, lng: number) => {
      const grid = mapLatLngToProjectGrid(lat, lng, activeCrs);
      setCursorCoords({
        lat,
        lng,
        easting: grid.easting,
        northing: grid.northing,
      });
    },
    [activeCrs]
  );

  // Map click handler depending on active tool mode
  const handleMapClick = useCallback(
    (lat: number, lng: number, e: L.LeafletMouseEvent) => {
      const grid = mapLatLngToProjectGrid(lat, lng, activeCrs);

      // Check if clicking near an existing point for snapping (radius ~15px)
      let snapPoint: MapPointDTO | null = null;
      if (mapRef.current) {
        const clickPoint = mapRef.current.latLngToLayerPoint(e.latlng);
        for (const p of validMapPoints) {
          const ptLayer = mapRef.current.latLngToLayerPoint([p.lat, p.lng]);
          if (clickPoint.distanceTo(ptLayer) < 18) {
            snapPoint = p;
            break;
          }
        }
      }

      if (mapMode === 'add_point') {
        const nextNum = points.length > 0 ? Math.max(...points.map((p) => p.pointNumber)) + 1 : 1;
        setNewPointCoords({
          lat: snapPoint ? snapPoint.lat : lat,
          lng: snapPoint ? snapPoint.lng : lng,
          easting: snapPoint ? snapPoint.easting : grid.easting,
          northing: snapPoint ? snapPoint.northing : grid.northing,
          elevation: snapPoint ? snapPoint.elevation : 0,
          pointNumber: nextNum,
          description: '',
          layer: 'GROUND',
        });
        setIsAddPointModalOpen(true);
        return;
      }

      if (
        mapMode === 'measure_distance' ||
        mapMode === 'measure_azimuth' ||
        mapMode === 'measure_area'
      ) {
        const targetLat = snapPoint ? snapPoint.lat : lat;
        const targetLng = snapPoint ? snapPoint.lng : lng;
        const targetE = snapPoint ? snapPoint.easting : grid.easting;
        const targetN = snapPoint ? snapPoint.northing : grid.northing;
        const targetZ = snapPoint ? snapPoint.elevation : 0;
        const label = snapPoint ? `P${snapPoint.pointNumber}` : `M${measurePoints.length + 1}`;

        if (mapMode === 'measure_azimuth' && measurePoints.length >= 2) {
          // Azimuth tool accepts 2 points per measurement session, restart from 1st
          setMeasurePoints([
            { lat: targetLat, lng: targetLng, easting: targetE, northing: targetN, elevation: targetZ, label },
          ]);
        } else {
          setMeasurePoints((prev) => [
            ...prev,
            { lat: targetLat, lng: targetLng, easting: targetE, northing: targetN, elevation: targetZ, label },
          ]);
        }
        return;
      }

      // Default View Mode: If clicked empty space, clear single focus
      if (!snapPoint) {
        setFocusedPointId(null);
      }
    },
    [mapMode, activeCrs, validMapPoints, points, measurePoints.length, setFocusedPointId]
  );

  // Save new point from map click
  const handleSaveNewPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await addSurveyPoint(currentProjectId, {
        pointNumber: newPointCoords.pointNumber,
        easting: newPointCoords.easting,
        northing: newPointCoords.northing,
        elevation: newPointCoords.elevation,
        description: newPointCoords.description.trim() || undefined,
        layer: newPointCoords.layer.trim() || 'GROUND',
      });

      if (res.success && res.id) {
        toast.success(`تمت إضافة النقطة P${newPointCoords.pointNumber} بنجاح إلى قاعدة البيانات`);
        setIsAddPointModalOpen(false);
        setSelectedPointId(res.id);
        setFocusedPointId(res.id);
      } else {
        toast.error(res.error || 'تعذر إضافة النقطة المساحية');
      }
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ النقطة');
    }
  };

  // Save updated point from edit modal
  const handleSaveEditPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPoint) return;
    try {
      const res = await updateSurveyPoint(editingPoint.id, {
        pointNumber: editingPoint.pointNumber,
        easting: editingPoint.easting,
        northing: editingPoint.northing,
        elevation: editingPoint.elevation,
        description: editingPoint.description,
        layer: editingPoint.layer,
        flagged: editingPoint.flagged,
      });

      if (res.success) {
        toast.success(`تم تعديل النقطة P${editingPoint.pointNumber} بنجاح`);
        setIsEditModalOpen(false);
        setEditingPoint(null);
      } else {
        toast.error(res.error || 'تعذر تعديل النقطة');
      }
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تعديل النقطة');
    }
  };

  // Delete point with confirmation
  const handleDeletePoint = async (id: string, pointNumber: number) => {
    if (!confirm(`هل أنت متأكد من حذف النقطة P${pointNumber}؟`)) return;
    try {
      const res = await deleteSurveyPoint(id);
      if (res.success) {
        toast.success(`تم حذف النقطة P${pointNumber}`);
        if (selectedPointId === id) setSelectedPointId(null);
        if (focusedPointId === id) setFocusedPointId(null);
      } else {
        toast.error(res.error || 'تعذر حذف النقطة');
      }
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حذف النقطة');
    }
  };

  // Toggle QA flag
  const handleToggleFlag = async (id: string, currentFlag: boolean, pointNumber: number) => {
    try {
      await bulkToggleFlag({
        projectId: currentProjectId,
        pointIds: [id],
        flagged: !currentFlag,
      });
      toast.success(
        !currentFlag
          ? `تم تعليم النقطة P${pointNumber} للتدقيق والمراجعة`
          : `تم إلغاء تعليم النقطة P${pointNumber}`
      );
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تحديث حالة التدقيق');
    }
  };

  return (
    <div className="relative flex flex-col w-full h-[calc(100vh-140px)] min-h-[580px] rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
      {/* TOP GEODETIC CRS & METADATA BANNER */}
      <div className="z-[1000] flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-900/90 px-4 py-2.5 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-200">المرجع الهندسي (Project CRS):</span>
            <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-mono font-bold text-emerald-300">
              {projectSummary.crsCode}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            <span>•</span>
            <span className="truncate max-w-[200px] text-slate-300">{projectSummary.crsName}</span>
            <span>•</span>
            <span>إسقاط العرض: <strong className="text-sky-400 font-mono">WGS84 Web Mercator</strong></span>
          </div>

          {projectSummary.validationLevel === 'REQUIRES_CONTROL_VALIDATION' ? (
            <span className="flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5" />
              يتطلب تدقيق GCPs
            </span>
          ) : (
            <span className="hidden md:flex items-center gap-1 rounded-md bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              معتمد جيوديسياً
            </span>
          )}
        </div>

        {/* Live Cursor Coordinates Readout */}
        <div className="flex items-center gap-3 text-xs font-mono">
          {cursorCoords ? (
            <div className="flex items-center gap-2 rounded-lg bg-slate-950/70 border border-slate-800 px-2.5 py-1 text-slate-300">
              <Crosshair className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <span>E: <strong className="text-sky-300">{cursorCoords.easting.toFixed(2)}</strong></span>
              <span>N: <strong className="text-emerald-300">{cursorCoords.northing.toFixed(2)}</strong></span>
              <span className="text-slate-500 hidden lg:inline">|</span>
              <span className="text-slate-400 hidden lg:inline">
                {cursorCoords.lat.toFixed(5)}°, {cursorCoords.lng.toFixed(5)}°
              </span>
            </div>
          ) : (
            <div className="text-slate-500 text-xs flex items-center gap-1.5">
              <Crosshair className="h-3.5 w-3.5" />
              <span>حرك المؤشر لقراءة الإحداثيات</span>
            </div>
          )}

          <Link
            href="/points"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <Layers className="h-3.5 w-3.5 text-emerald-400" />
            <span>جدول النقاط</span>
          </Link>
        </div>
      </div>

      {/* FLOATING CAD & MEASUREMENT TOOLBAR */}
      <div className="absolute top-14 right-3 z-[1000] flex flex-col gap-2">
        {/* Basemap Switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/90 p-1 shadow-xl backdrop-blur-md">
          <button
            onClick={() => setBaseMap('satellite')}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all flex items-center gap-1 ${
              baseMap === 'satellite' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
            title="صور الأقمار الصناعية عالية الدقة Esri"
          >
            <Satellite className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">أقمار صناعية</span>
          </button>
          <button
            onClick={() => setBaseMap('street')}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all flex items-center gap-1 ${
              baseMap === 'street' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
            title="خريطة الشوارع والمعالم OpenStreetMap"
          >
            <MapIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">شوارع</span>
          </button>
          <button
            onClick={() => setBaseMap('dark')}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all flex items-center gap-1 ${
              baseMap === 'dark' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
            title="الوضع الليلي عالي التباين CartoDB"
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ليلي</span>
          </button>
        </div>

        {/* CAD & Interactive Tools Selector */}
        <div className="flex flex-col gap-1 rounded-xl border border-slate-700 bg-slate-900/90 p-1.5 shadow-xl backdrop-blur-md">
          <div className="text-[10px] font-bold text-slate-400 px-2 py-0.5 border-b border-slate-800">
            أدوات الرفع والقياس (COGO)
          </div>

          <button
            onClick={() => {
              setMapMode('view');
              setMeasurePoints([]);
            }}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-right transition-colors ${
              mapMode === 'view' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span>عرض واستكشاف النقاط</span>
          </button>

          <button
            onClick={() => {
              setMapMode('measure_distance');
              setMeasurePoints([]);
            }}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-right transition-colors ${
              mapMode === 'measure_distance' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Ruler className="h-3.5 w-3.5 shrink-0" />
            <span>قياس المسافات والميول (Distance/Slope)</span>
          </button>

          <button
            onClick={() => {
              setMapMode('measure_azimuth');
              setMeasurePoints([]);
            }}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-right transition-colors ${
              mapMode === 'measure_azimuth' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Compass className="h-3.5 w-3.5 shrink-0" />
            <span>قياس الانحراف والاتجاه (Azimuth/Bearing)</span>
          </button>

          <button
            onClick={() => {
              setMapMode('measure_area');
              setMeasurePoints([]);
            }}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-right transition-colors ${
              mapMode === 'measure_area' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Scale className="h-3.5 w-3.5 shrink-0" />
            <span>حساب المساحة والمحيط التفاعلي</span>
          </button>

          <button
            onClick={() => {
              setMapMode('add_point');
              setMeasurePoints([]);
            }}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-right transition-colors ${
              mapMode === 'add_point' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>إضافة نقطة بنقر الخريطة (Add Point)</span>
          </button>

          {/* Visualization Toggles */}
          <div className="mt-1 pt-1 border-t border-slate-800 flex flex-col gap-1">
            <button
              onClick={() => setColorByElevation((prev) => !prev)}
              className={`flex items-center justify-between rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
                colorByElevation ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span>تدرج المناسيب (Elevation Ramp)</span>
              <span className={`h-2 w-2 rounded-full ${colorByElevation ? 'bg-sky-400' : 'bg-slate-600'}`} />
            </button>

            <button
              onClick={() => setShowPolygonFill((prev) => !prev)}
              className={`flex items-center justify-between rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
                showPolygonFill ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span>مضلع المشروع (Polygon Fill)</span>
              <span className={`h-2 w-2 rounded-full ${showPolygonFill ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ACTIVE MEASUREMENT RESULTS OVERLAY PANEL */}
      {mapMode !== 'view' && mapMode !== 'add_point' && (
        <div className="absolute top-14 left-3 z-[1000] w-80 max-w-[calc(100vw-24px)] rounded-2xl border border-sky-500/30 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
              {mapMode === 'measure_distance' && <Ruler className="h-4 w-4" />}
              {mapMode === 'measure_azimuth' && <Compass className="h-4 w-4" />}
              {mapMode === 'measure_area' && <Scale className="h-4 w-4" />}
              <span>
                {mapMode === 'measure_distance' && 'نتائج قياس المسافات والميول'}
                {mapMode === 'measure_azimuth' && 'نتائج قياس الانحراف والاتجاه'}
                {mapMode === 'measure_area' && 'نتائج حساب المساحة والمحيط'}
              </span>
            </div>
            <button
              onClick={() => setMeasurePoints([])}
              className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[11px] text-slate-300 transition-colors"
              title="مسح نقاط القياس"
            >
              <Undo2 className="h-3 w-3" />
              <span>مسح</span>
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <p className="text-[11px] text-slate-400">
              {measurePoints.length === 0 && 'انقر على الخريطة أو على نقاط الرفع لبدء القياس الهندسي...'}
              {measurePoints.length === 1 && 'انقر نقطة ثانية لحساب المسافة والانحراف...'}
              {measurePoints.length > 1 && `عدد النقاط المقاسة: ${measurePoints.length}`}
            </p>

            {measurementResult && (
              <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-2.5 space-y-2 font-mono text-slate-200">
                {mapMode === 'measure_distance' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">المسافة الأفقية (HD):</span>
                      <strong className="text-emerald-400 font-bold">
                        {measurementResult.totalHorizontalDistance.toFixed(3)} م
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">المسافة المائلة (SD):</span>
                      <strong className="text-sky-400">
                        {measurementResult.totalSlopeDistance.toFixed(3)} م
                      </strong>
                    </div>
                    {measurementResult.segments.length > 0 && (
                      <div className="flex justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-1.5">
                        <span className="font-sans">فارق المنسوب (ΔZ):</span>
                        <span>
                          {measurementResult.segments[measurementResult.segments.length - 1].inverse.deltaElevation > 0 ? '+' : ''}
                          {measurementResult.segments[measurementResult.segments.length - 1].inverse.deltaElevation.toFixed(3)} م
                        </span>
                      </div>
                    )}
                  </>
                )}

                {mapMode === 'measure_azimuth' && measurementResult.segments.length > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">الانحراف الدائري (Azimuth):</span>
                      <strong className="text-amber-400">
                        {measurementResult.segments[0].inverse.azimuthDMS.formatted}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-sans">الزاوية العشرية:</span>
                      <span className="text-slate-300">
                        {measurementResult.segments[0].inverse.azimuthDecimal.toFixed(4)}°
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">الاتجاه الربعي (Bearing):</span>
                      <strong className="text-sky-300">
                        {measurementResult.segments[0].inverse.bearing}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px] border-t border-slate-800/80 pt-1.5">
                      <span className="text-slate-400 font-sans">المسافة الأفقية:</span>
                      <span className="text-emerald-400">
                        {measurementResult.segments[0].inverse.horizontalDistance.toFixed(3)} م
                      </span>
                    </div>
                  </>
                )}

                {mapMode === 'measure_area' && measurementResult.areaSqm !== undefined && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">المساحة بالمتر المربع:</span>
                      <strong className="text-emerald-400 font-bold">
                        {measurementResult.areaSqm.toFixed(2)} م²
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-sans">المساحة بالفدان:</span>
                      <span className="text-amber-300">
                        {measurementResult.areaFeddans?.toFixed(3)} فدان
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-sans">المساحة بالهكتار:</span>
                      <span className="text-sky-300">
                        {measurementResult.areaHectares?.toFixed(4)} ha
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800/80 pt-1.5">
                      <span className="text-slate-400 font-sans">المحيط (2D Perimeter):</span>
                      <strong className="text-slate-200">
                        {measurementResult.perimeter2D?.toFixed(3)} م
                      </strong>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* LEAFLET INTERACTIVE MAP CONTAINER */}
      <div className="flex-1 w-full h-full relative">
        <MapContainer
          center={defaultCenter}
          zoom={16}
          zoomControl={false}
          className="h-full w-full bg-slate-950"
          ref={(instance) => {
            mapRef.current = instance;
          }}
        >
          <MapViewController points={validMapPoints} focusedPoint={focusedPoint} />
          <MapInteractionController
            mapMode={mapMode}
            activeCrs={activeCrs}
            onMapClick={handleMapClick}
            onMouseMove={handleMouseMove}
          />

          {/* BASEMAP TILES */}
          {baseMap === 'satellite' && (
            <>
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="&copy; Esri, Maxar, Earthstar Geographics"
                maxZoom={19}
              />
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
            </>
          )}

          {baseMap === 'street' && (
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
              maxZoom={19}
            />
          )}

          {baseMap === 'dark' && (
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; CARTO"
              maxZoom={19}
            />
          )}

          {/* USER REAL-TIME GPS ACCURACY CIRCLE & MARKER */}
          {gpsLocation && (
            <>
              <Circle
                center={[gpsLocation.lat, gpsLocation.lng]}
                radius={gpsLocation.accuracy}
                pathOptions={{
                  color: '#10b981',
                  fillColor: '#10b981',
                  fillOpacity: 0.15,
                  weight: 1.5,
                }}
              />
              <CircleMarker
                center={[gpsLocation.lat, gpsLocation.lng]}
                radius={7}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: '#10b981',
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-right text-xs p-1" dir="rtl">
                    <strong className="text-emerald-600 block">موقعك الفعلي (GPS Live)</strong>
                    <p className="text-slate-600 mt-1">الدقة: ±{gpsLocation.accuracy.toFixed(1)} متر</p>
                  </div>
                </Popup>
              </CircleMarker>
            </>
          )}

          {/* PROJECT CLOSED BOUNDARY POLYGON */}
          {showPolygonFill && polygonLatLngs.length >= 3 && (
            <Polygon
              positions={polygonLatLngs}
              pathOptions={{
                color: '#38bdf8',
                weight: 2.5,
                fillColor: '#0284c7',
                fillOpacity: 0.22,
                dashArray: '5, 5',
              }}
            />
          )}

          {/* CAD MEASUREMENT POLYLINE / POLYGON */}
          {measurePoints.length >= 2 && (
            <>
              {mapMode === 'measure_area' && measurePoints.length >= 3 ? (
                <Polygon
                  positions={measurePoints.map((p) => [p.lat, p.lng] as [number, number])}
                  pathOptions={{
                    color: '#818cf8',
                    weight: 3,
                    fillColor: '#6366f1',
                    fillOpacity: 0.3,
                  }}
                />
              ) : (
                <Polyline
                  positions={measurePoints.map((p) => [p.lat, p.lng] as [number, number])}
                  pathOptions={{
                    color: mapMode === 'measure_azimuth' ? '#f59e0b' : '#10b981',
                    weight: 3,
                    dashArray: '6, 6',
                  }}
                />
              )}

              {measurePoints.map((mp, idx) => (
                <CircleMarker
                  key={idx}
                  center={[mp.lat, mp.lng]}
                  radius={5}
                  pathOptions={{
                    color: '#ffffff',
                    fillColor: mapMode === 'measure_azimuth' ? '#f59e0b' : '#10b981',
                    fillOpacity: 1,
                    weight: 2,
                  }}
                />
              ))}
            </>
          )}

          {/* SURVEY POINT MARKERS */}
          {validMapPoints.map((point) => {
            const isSelected = selectedPointIds.includes(point.id) || selectedPointId === point.id;
            const isFocused = focusedPointId === point.id;

            return (
              <Marker
                key={point.id}
                position={[point.lat, point.lng]}
                icon={createPointMarkerIcon(point, isSelected, isFocused, colorByElevation)}
                eventHandlers={{
                  click: () => {
                    if (mapMode === 'view') {
                      setSelectedPointId(point.id);
                      setFocusedPointId(point.id);
                    }
                  },
                }}
              >
                <Popup>
                  <div className="min-w-[220px] max-w-[280px] space-y-2 p-1 text-right text-xs" dir="rtl">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <MapPin className="h-4 w-4 text-sky-600" />
                        <span>نقطة P{point.pointNumber}</span>
                        {point.flagged && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] text-amber-700 border border-amber-300">
                            مؤشرة
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 font-mono">
                        {point.layer || 'GROUND'}
                      </span>
                    </div>

                    {/* Coordinates */}
                    <div className="space-y-1 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">الشرق (Easting):</span>
                        <strong className="text-sky-700" dir="ltr">{point.easting.toFixed(4)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">الشمال (Northing):</span>
                        <strong className="text-emerald-700" dir="ltr">{point.northing.toFixed(4)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">المنسوب (Elevation Z):</span>
                        <strong className="text-slate-900" dir="ltr">{point.elevation.toFixed(3)} م</strong>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 border-t border-slate-200 pt-1">
                        <span className="font-sans">WGS84:</span>
                        <span dir="ltr">{point.lat.toFixed(5)}°, {point.lng.toFixed(5)}°</span>
                      </div>
                    </div>

                    {point.description && (
                      <p className="text-slate-700 text-[11px]">
                        <strong>الوصف:</strong> {point.description}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-200">
                      <button
                        onClick={() => {
                          setSelectedPointId(point.id);
                          setFocusedPointId(point.id);
                          toast.success(`تم تحديد النقطة P${point.pointNumber} في مساحة العمل`);
                        }}
                        className="flex items-center justify-center gap-1 rounded-md bg-sky-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-sky-500 transition-colors"
                      >
                        <Crosshair className="h-3 w-3" />
                        <span>تحديد النقطة</span>
                      </button>

                      <button
                        onClick={() => handleToggleFlag(point.id, !!point.flagged, point.pointNumber)}
                        className={`flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                          point.flagged
                            ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        <Flag className="h-3 w-3" />
                        <span>{point.flagged ? 'إلغاء التأشير' : 'تأشير للتدقيق'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingPoint(point);
                          setIsEditModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>تعديل</span>
                      </button>

                      <button
                        onClick={() => handleDeletePoint(point.id, point.pointNumber)}
                        className="flex items-center justify-center gap-1 rounded-md bg-red-50 text-red-700 border border-red-200 px-2 py-1 text-[11px] font-semibold hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* BOTTOM ACTION BAR & CONTROLS */}
      <div className="z-[1000] flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 bg-slate-900/90 px-4 py-2.5 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          {/* Fit Project Bounds */}
          <button
            onClick={handleFitBounds}
            disabled={validMapPoints.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition-colors"
            title="توسيط حدود جميع نقاط المشروع"
          >
            <Maximize2 className="h-4 w-4 text-sky-400" />
            <span>توسيط الحدود</span>
          </button>

          {/* GPS Locate Button */}
          <button
            onClick={handleLocateUser}
            disabled={isLocating}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
          >
            <LocateFixed className={`h-4 w-4 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'جاري التحديد...' : 'موقعي الفعلي GPS'}</span>
          </button>

          {/* Clear Selection */}
          {(selectedPointIds.length > 0 || selectedPointId !== null) && (
            <button
              onClick={clearSelection}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-red-400" />
              <span>إلغاء التحديد ({selectedPointIds.length || 1})</span>
            </button>
          )}
        </div>

        {/* Live Project Geometry Statistics Bar */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-sans">النقاط:</span>
            <strong className="text-white font-bold">{projectSummary.validPointCount}</strong>
          </div>

          {projectSummary.hasGeometry && (
            <>
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-slate-500 font-sans">المساحة:</span>
                <strong className="text-emerald-400">{projectSummary.areaSqm.toFixed(2)} م²</strong>
                <span className="text-[10px] text-slate-400">({projectSummary.areaFeddans.toFixed(3)} فدان)</span>
              </div>

              <div className="hidden md:flex items-center gap-1.5">
                <span className="text-slate-500 font-sans">المحيط:</span>
                <strong className="text-sky-400">{projectSummary.perimeter2D.toFixed(2)} م</strong>
              </div>

              <div className="hidden lg:flex items-center gap-1.5">
                <span className="text-slate-500 font-sans">فارق المناسيب:</span>
                <strong className="text-amber-400">ΔZ {projectSummary.deltaElevation.toFixed(2)} م</strong>
              </div>
            </>
          )}

          <button
            onClick={() => setShowStatsDrawer((prev) => !prev)}
            className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-sans text-slate-300 transition-colors"
          >
            <Scale className="h-3.5 w-3.5 text-emerald-400" />
            <span>{showStatsDrawer ? 'إخفاء الإحصائيات' : 'تفاصيل المشروع'}</span>
          </button>
        </div>
      </div>

      {/* EXPANDABLE STATS DRAWER */}
      {showStatsDrawer && (
        <div className="z-[1000] border-t border-slate-800 bg-slate-950/95 p-3.5 backdrop-blur-md">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
              <span className="text-[11px] text-slate-400 block mb-1">النقاط الكلية</span>
              <strong className="text-base text-white font-mono">{projectSummary.pointCount}</strong>
              {projectSummary.flaggedCount > 0 && (
                <span className="text-[10px] text-amber-400 block mt-0.5">
                  ({projectSummary.flaggedCount} مؤشرة للمراجعة)
                </span>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
              <span className="text-[11px] text-slate-400 block mb-1">المساحة المغلقة</span>
              <strong className="text-base text-emerald-400 font-mono">
                {formatNumber(projectSummary.areaSqm, 2)} م²
              </strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {projectSummary.areaFeddans.toFixed(3)} فدان / {projectSummary.areaHectares.toFixed(4)} ha
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
              <span className="text-[11px] text-slate-400 block mb-1">المحيط (2D / 3D)</span>
              <strong className="text-base text-sky-400 font-mono">
                {formatNumber(projectSummary.perimeter2D, 2)} م
              </strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                3D: {formatNumber(projectSummary.perimeter3D, 2)} م
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
              <span className="text-[11px] text-slate-400 block mb-1">أبعاد الصندوق (Bounding Box)</span>
              <strong className="text-xs text-slate-200 font-mono block">
                ΔE: {formatNumber(projectSummary.boundingBox.width, 2)} م
              </strong>
              <strong className="text-xs text-slate-200 font-mono block">
                ΔN: {formatNumber(projectSummary.boundingBox.height, 2)} م
              </strong>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
              <span className="text-[11px] text-slate-400 block mb-1">المناسيب (Z Min / Max)</span>
              <div className="font-mono text-xs text-slate-300">
                <span>{projectSummary.minElevation.toFixed(2)}م</span> →{' '}
                <span>{projectSummary.maxElevation.toFixed(2)}م</span>
              </div>
              <span className="text-[10px] text-amber-400 block mt-0.5">
                متوسط Z: {projectSummary.avgElevation.toFixed(2)} م
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
              <span className="text-[11px] text-slate-400 block mb-1">مركز الثقل الهندسي</span>
              <div className="font-mono text-[11px] text-slate-300">
                <div>E: {projectSummary.centroid.easting.toFixed(2)}</div>
                <div>N: {projectSummary.centroid.northing.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD POINT MODAL */}
      {isAddPointModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-sky-500/30 bg-slate-900 p-5 text-right shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                  <Plus className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-white">إضافة نقطة مساحية من الخريطة</h3>
              </div>
              <button
                onClick={() => setIsAddPointModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewPoint} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">رقم النقطة</label>
                  <input
                    type="number"
                    required
                    value={newPointCoords.pointNumber}
                    onChange={(e) =>
                      setNewPointCoords({ ...newPointCoords, pointNumber: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">الطبقة (Layer)</label>
                  <input
                    type="text"
                    value={newPointCoords.layer}
                    onChange={(e) =>
                      setNewPointCoords({ ...newPointCoords, layer: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-sans">
                    الشرق (Easting) [{activeCrs}]
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newPointCoords.easting}
                    onChange={(e) =>
                      setNewPointCoords({ ...newPointCoords, easting: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-sky-400 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-sans">
                    الشمال (Northing) [{activeCrs}]
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newPointCoords.northing}
                    onChange={(e) =>
                      setNewPointCoords({ ...newPointCoords, northing: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-emerald-400 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">المنسوب (Elevation Z) [متر]</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={newPointCoords.elevation}
                  onChange={(e) =>
                    setNewPointCoords({ ...newPointCoords, elevation: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">الوصف (Description)</label>
                <input
                  type="text"
                  placeholder="مثال: ركن سور، منهول، نقطة تحكم..."
                  value={newPointCoords.description}
                  onChange={(e) =>
                    setNewPointCoords({ ...newPointCoords, description: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-sky-600 hover:bg-sky-500 py-2 text-sm font-bold text-white transition-colors"
                >
                  حفظ النقطة
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddPointModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT POINT MODAL */}
      {isEditModalOpen && editingPoint && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-right shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Edit2 className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-white">تعديل النقطة P{editingPoint.pointNumber}</h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPoint} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">رقم النقطة</label>
                  <input
                    type="number"
                    required
                    value={editingPoint.pointNumber}
                    onChange={(e) =>
                      setEditingPoint({ ...editingPoint, pointNumber: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">الطبقة (Layer)</label>
                  <input
                    type="text"
                    value={editingPoint.layer || 'GROUND'}
                    onChange={(e) =>
                      setEditingPoint({ ...editingPoint, layer: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-sans">الشرق (Easting)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={editingPoint.easting}
                    onChange={(e) =>
                      setEditingPoint({ ...editingPoint, easting: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-sky-400 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-sans">الشمال (Northing)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={editingPoint.northing}
                    onChange={(e) =>
                      setEditingPoint({ ...editingPoint, northing: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-emerald-400 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">المنسوب (Elevation Z) [متر]</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={editingPoint.elevation}
                  onChange={(e) =>
                    setEditingPoint({ ...editingPoint, elevation: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">الوصف</label>
                <input
                  type="text"
                  value={editingPoint.description || ''}
                  onChange={(e) =>
                    setEditingPoint({ ...editingPoint, description: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editPointFlagged"
                  checked={!!editingPoint.flagged}
                  onChange={(e) =>
                    setEditingPoint({ ...editingPoint, flagged: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="editPointFlagged" className="text-xs text-amber-300 font-semibold cursor-pointer">
                  تأشير النقطة للمراجعة والتدقيق (Flagged QA)
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2 text-sm font-bold text-white transition-colors"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
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

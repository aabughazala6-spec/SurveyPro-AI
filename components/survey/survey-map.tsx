'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, LocateFixed, MapPin, Maximize2, Satellite } from 'lucide-react';
import proj4 from 'proj4';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { db, ensureDefaultProject, type PointRecord } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createPointIcon(pointNumber: number) {
  return L.divIcon({
    className: 'custom-point-marker',
    html: `
      <div style="
        background: #0284c7;
        color: #ffffff;
        font-weight: 800;
        font-size: 11px;
        padding: 3px 6px;
        border-radius: 9999px;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5);
        white-space: nowrap;
        transform: translate(-50%, -50%);
        display: flex;
        align-items: center;
        gap: 3px;
      ">
        P${pointNumber}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function FitBoundsButton({ points }: { points: Array<{ lat: number; lng: number }> }) {
  const map = useMap();
  return (
    <button
      onClick={() => {
        if (points.length === 0) return;
        if (points.length === 1) {
          map.setView([points[0].lat, points[0].lng], 18);
          return;
        }
        const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [60, 60] });
      }}
      className="absolute bottom-6 left-3 z-[1000] flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs font-bold text-slate-200 shadow-xl backdrop-blur transition-colors hover:bg-slate-800"
    >
      <Maximize2 className="h-4 w-4 text-sky-400" />
      توسيط الحدود
    </button>
  );
}

function LocationButton() {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error('المتصفح لا يدعم تحديد الموقع');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        map.setView([latitude, longitude], 18);
        toast.success('تم تحديد موقعك الفعلي', {
          description: `الدقة: ±${accuracy.toFixed(0)} م`,
        });
        setLocating(false);
      },
      () => {
        toast.error('تعذر تحديد الموقع الجغرافي');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <button
      onClick={locate}
      disabled={locating}
      className="absolute bottom-6 right-3 z-[1000] flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-300 shadow-xl backdrop-blur transition-all hover:bg-emerald-500/25 disabled:opacity-50"
    >
      <LocateFixed className={`h-4 w-4 ${locating ? 'animate-spin' : ''}`} />
      {locating ? 'جاري التحديد...' : 'موقعي الفعلي GPS'}
    </button>
  );
}

function MapReadyHandler({ onReady }: { onReady: () => void }) {
  const map = useMap();
  useEffect(() => {
    map.whenReady(onReady);
  }, [map, onReady]);
  return null;
}

export default function SurveyMap() {
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const activeCrs = useAppStore((state) => state.activeCrs);

  const livePoints = useLiveQuery(
    () => db.points.where('projectId').equals(currentProjectId).sortBy('pointNumber'),
    [currentProjectId]
  );
  const points = useMemo(() => livePoints ?? [], [livePoints]);

  const mapRef = useRef<L.Map | null>(null);
  const readyRef = useRef(false);
  const [baseMap, setBaseMap] = useState<'satellite' | 'street' | 'dark'>('satellite');

  useEffect(() => {
    void ensureDefaultProject();
  }, []);

  const mapPoints = useMemo(() => {
    const srcCrs = activeCrs || 'EPSG:32638';
    return points
      .map((point) => {
        try {
          let lng = point.easting;
          let lat = point.northing;
          if (srcCrs !== 'EPSG:4326') {
            const transformed = proj4(srcCrs, 'EPSG:4326', [point.easting, point.northing]);
            lng = transformed[0];
            lat = transformed[1];
          }
          return { ...point, lat, lng };
        } catch {
          return null;
        }
      })
      .filter((p): p is PointRecord & { lat: number; lng: number } => p !== null);
  }, [points, activeCrs]);

  const polygonLatLngs = useMemo(() => {
    return mapPoints.map((p) => [p.lat, p.lng] as [number, number]);
  }, [mapPoints]);

  const center: [number, number] = mapPoints.length
    ? [mapPoints[0].lat, mapPoints[0].lng]
    : [24.7136, 46.6753];

  return (
    <div className="relative h-[65vh] w-full overflow-hidden rounded-2xl border border-slate-800 sm:h-[75vh]">
      {/* BASEMAP SWITCHER */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 p-1.5 backdrop-blur-md">
        <button
          onClick={() => setBaseMap('satellite')}
          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
            baseMap === 'satellite' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          أقمار صناعية
        </button>
        <button
          onClick={() => setBaseMap('street')}
          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
            baseMap === 'street' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          خريطة شوارع
        </button>
        <button
          onClick={() => setBaseMap('dark')}
          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
            baseMap === 'dark' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          وضع ليلي
        </button>
      </div>

      <MapContainer
        center={center}
        zoom={16}
        zoomControl={false}
        className="h-full w-full"
        ref={(instance) => {
          mapRef.current = instance;
        }}
      >
        <MapReadyHandler
          onReady={() => {
            if (!readyRef.current && mapRef.current) {
              readyRef.current = true;
              setTimeout(() => mapRef.current?.invalidateSize(), 100);
            }
          }}
        />

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

        {/* CLOSED SURVEY POLYGON BOUNDARY */}
        {polygonLatLngs.length >= 3 && (
          <Polygon
            positions={polygonLatLngs}
            pathOptions={{
              color: '#38bdf8',
              weight: 3,
              fillColor: '#0284c7',
              fillOpacity: 0.2,
              dashArray: '4, 4',
            }}
          />
        )}

        {/* POINT MARKERS */}
        {mapPoints.map((point) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={createPointIcon(point.pointNumber)}
          >
            <Popup>
              <div className="space-y-1.5 text-right text-xs" dir="rtl">
                <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <MapPin className="h-4 w-4 text-sky-600" />
                  <strong className="font-bold text-slate-800">نقطة P{point.pointNumber}</strong>
                </div>
                <div className="space-y-1 text-slate-700">
                  <p>
                    <strong>الشرق (X):</strong> <span dir="ltr">{point.easting.toFixed(4)}</span>
                  </p>
                  <p>
                    <strong>الشمال (Y):</strong> <span dir="ltr">{point.northing.toFixed(4)}</span>
                  </p>
                  <p>
                    <strong>المنسوب (Z):</strong> <span dir="ltr">{point.elevation.toFixed(3)} م</span>
                  </p>
                  {point.description && (
                    <p>
                      <strong>الوصف:</strong> {point.description}
                    </p>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <FitBoundsButton points={mapPoints.map((p) => ({ lat: p.lat, lng: p.lng }))} />
        <LocationButton />
      </MapContainer>
    </div>
  );
}

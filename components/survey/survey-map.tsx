'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin, Maximize2, Satellite } from 'lucide-react';
import proj4 from 'proj4';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { db, DEFAULT_PROJECT, ensureDefaultProject, type PointRecord } from '@/lib/db';

const UTM38N = 'EPSG:32638';
const WGS84 = 'EPSG:4326';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function FitBoundsButton({ points }: { points: Array<{ lat: number; lng: number }> }) {
  const map = useMap();
  return (
    <button
      onClick={() => {
        if (points.length === 0) return;
        if (points.length === 1) {
          map.setView([points[0].lat, points[0].lng], 17);
          return;
        }
        const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }}
      className="absolute bottom-8 left-3 z-[1000] flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur transition-colors hover:bg-slate-800"
    >
      <Maximize2 className="h-3.5 w-3.5 text-orange-400" />
      توسيط
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
      (err) => {
        const messages: Record<number, string> = {
          1: 'تم رفض إذن الوصول إلى الموقع',
          2: 'تعذر تحديد الموقع',
          3: 'انتهت مهلة تحديد الموقع',
        };
        toast.error(messages[err.code] || 'تعذر تحديد الموقع');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <button
      onClick={locate}
      disabled={locating}
      className="absolute bottom-8 right-3 z-[1000] flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-300 shadow-lg backdrop-blur transition-all hover:bg-sky-500/25 disabled:opacity-50"
    >
      <LocateFixed className={`h-3.5 w-3.5 ${locating ? 'animate-pulse' : ''}`} />
      {locating ? 'جاري التحديد...' : 'موقعي الفعلي'}
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
  const livePoints = useLiveQuery(
    () => db.points.where('projectId').equals(DEFAULT_PROJECT.id).sortBy('pointNumber'),
    [DEFAULT_PROJECT.id]
  );
  const points = useMemo(() => livePoints ?? [], [livePoints]);

  const mapRef = useRef<L.Map | null>(null);
  const readyRef = useRef(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    void ensureDefaultProject();
  }, []);

  const mapPoints = useMemo(
    () =>
      points
        .map((point) => {
          try {
            const [lng, lat] = proj4(UTM38N, WGS84, [point.easting, point.northing]);
            return { ...point, lat, lng };
          } catch {
            return null;
          }
        })
        .filter((p): p is PointRecord & { lat: number; lng: number } => p !== null),
    [points]
  );

  const center: [number, number] = mapPoints.length
    ? [mapPoints[0].lat, mapPoints[0].lng]
    : [24.7136, 46.6753];

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  return (
    <div className="relative h-[60vh] w-full overflow-hidden rounded-2xl border border-slate-700/60 sm:h-[70vh]">
      <MapContainer
        center={center}
        zoom={13}
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
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; Esri, Maxar, Earthstar Geographics'
          maxZoom={19}
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          attribution=''
          maxZoom={19}
        />
        {mapPoints.map((point) => (
          <Marker key={point.id} position={[point.lat, point.lng]}>
            <Popup>
              <div className="space-y-1.5 text-right" dir="rtl">
                <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <MapPin className="h-4 w-4 text-orange-500" />
                  <span className="font-bold text-slate-800">نقطة P{point.pointNumber}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span className="font-semibold text-slate-500">الشمال:</span>
                  <span dir="ltr" className="text-right">{point.northing.toFixed(3)}</span>
                  <span className="font-semibold text-slate-500">الشرق:</span>
                  <span dir="ltr" className="text-right">{point.easting.toFixed(3)}</span>
                  <span className="font-semibold text-slate-500">الارتفاع:</span>
                  <span dir="ltr" className="text-right">{point.elevation.toFixed(3)} م</span>
                  <span className="font-semibold text-slate-500">الوصف:</span>
                  <span className="text-right">{point.description || '—'}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        {userLocation && (
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={8}
            pathOptions={{ color: '#38bdf8', fillColor: '#38bdf8', fillOpacity: 0.4, weight: 2 }}
          >
            <Popup>
              <div className="text-right" dir="rtl">
                <div className="flex items-center gap-1.5">
                  <LocateFixed className="h-4 w-4 text-sky-500" />
                  <span className="font-bold text-slate-800">موقعك الحالي</span>
                </div>
                <p className="mt-1 text-xs text-slate-600" dir="ltr">
                  {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        )}
        <FitBoundsButton points={mapPoints.map((p) => ({ lat: p.lat, lng: p.lng }))} />
        <LocationButton />
      </MapContainer>
      <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-1.5 text-[11px] font-semibold text-slate-300 shadow-lg backdrop-blur">
        <Satellite className="h-3.5 w-3.5 text-emerald-400" />
        Esri World Imagery
      </div>
      {!mapPoints.length && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto rounded-xl border border-slate-700 bg-slate-900/90 px-5 py-4 text-center backdrop-blur">
            <MapPin className="mx-auto mb-2 h-6 w-6 text-slate-600" />
            <p className="text-sm text-slate-400">لا توجد نقاط لعرضها على الخريطة</p>
            <p className="mt-1 text-xs text-slate-600">أضف نقاطاً من شاشة النقاط والمساحات</p>
          </div>
        </div>
      )}
    </div>
  );
}

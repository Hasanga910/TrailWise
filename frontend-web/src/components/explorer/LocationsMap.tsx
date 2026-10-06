import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapPoint } from './packageSummary';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

function pinIcon(n: number) {
  return L.divIcon({
    className: 'tw-map-pin',
    html: `<span>${n}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 10);
      return;
    }
    map.fitBounds(
      points.map((p) => [p.latitude, p.longitude] as [number, number]),
      { padding: [36, 36], maxZoom: 11 },
    );
  }, [map, points]);
  return null;
}

/** Interactive OpenStreetMap with numbered pins. Loaded lazily so Leaflet stays out of the main bundle. */
export function LocationsMap({ points }: { points: MapPoint[] }) {
  return (
    <div className="tw-map overflow-hidden rounded-card border border-border" role="region" aria-label="Map of tour locations">
      <MapContainer
        center={[points[0].latitude, points[0].longitude]}
        zoom={8}
        scrollWheelZoom={false}
        className="h-80 w-full sm:h-96"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p) => (
          <Marker key={`${p.number}-${p.name}`} position={[p.latitude, p.longitude]} icon={pinIcon(p.number)} title={`${p.number}. ${p.name}`}>
            <Popup>
              {p.number}. {p.name}
            </Popup>
          </Marker>
        ))}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}

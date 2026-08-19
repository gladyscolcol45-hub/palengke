'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Next.js bundles Leaflet's default marker icons at broken paths — point them
// at the CDN instead so pins actually show up.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER = [14.5995, 120.9842]; // Metro Manila

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Re-centers the map whenever the location changes from outside a click —
// e.g. after typing a barangay/city and it gets auto-geocoded.
function RecenterOnChange({ latitude, longitude }) {
  const map = useMap();
  useEffect(() => {
    if (latitude != null && longitude != null) {
      map.setView([latitude, longitude], map.getZoom());
    }
  }, [latitude, longitude, map]);
  return null;
}

export default function LocationPicker({ latitude, longitude, onChange, autoNote }) {
  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude, 'manual');
      },
      () => {
        alert('Could not get your location. You can still tap the map below to set it.');
      }
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-stone-700">
          Location on map (optional)
        </label>
        <button
          type="button"
          onClick={useMyLocation}
          className="text-xs text-green-700 hover:underline whitespace-nowrap"
        >
          Use my current location
        </button>
      </div>
      {autoNote && (
        <p className="text-xs text-stone-400 mb-2">{autoNote}</p>
      )}
      <div className="rounded-md overflow-hidden border border-stone-300" style={{ height: 220 }}>
        <MapContainer
          center={latitude && longitude ? [latitude, longitude] : DEFAULT_CENTER}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <ClickHandler onPick={(lat, lng) => onChange(lat, lng, 'manual')} />
          <RecenterOnChange latitude={latitude} longitude={longitude} />
          {latitude && longitude && <Marker position={[latitude, longitude]} />}
        </MapContainer>
      </div>
      <p className="text-xs text-stone-400 mt-1">
        Tap the map to set your exact spot instead of the guessed location.
      </p>
      {latitude && longitude && (
        <button
          type="button"
          onClick={() => onChange(null, null, null)}
          className="text-xs text-stone-400 hover:text-red-600 underline mt-1"
        >
          Clear location
        </button>
      )}
    </div>
  );
}

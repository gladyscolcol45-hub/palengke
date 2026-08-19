'use client';

import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
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

export default function LocationPicker({ latitude, longitude, onChange }) {
  const [center] = useState(
    latitude && longitude ? [latitude, longitude] : DEFAULT_CENTER
  );

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
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
          Tap the map to set your location (optional)
        </label>
        <button
          type="button"
          onClick={useMyLocation}
          className="text-xs text-green-700 hover:underline whitespace-nowrap"
        >
          Use my current location
        </button>
      </div>
      <div className="rounded-md overflow-hidden border border-stone-300" style={{ height: 220 }}>
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <ClickHandler onPick={onChange} />
          {latitude && longitude && <Marker position={[latitude, longitude]} />}
        </MapContainer>
      </div>
      {latitude && longitude && (
        <button
          type="button"
          onClick={() => onChange(null, null)}
          className="text-xs text-stone-400 hover:text-red-600 underline mt-1"
        >
          Clear location
        </button>
      )}
    </div>
  );
}

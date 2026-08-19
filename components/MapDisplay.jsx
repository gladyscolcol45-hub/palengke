'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER = [14.5995, 120.9842]; // Metro Manila

export default function MapDisplay({ listings, height, zoom }) {
  const center =
    listings && listings.length > 0
      ? [listings[0].latitude, listings[0].longitude]
      : DEFAULT_CENTER;

  return (
    <div
      className="rounded-lg overflow-hidden border border-stone-200"
      style={{ height: height || 500 }}
    >
      <MapContainer center={center} zoom={zoom || 12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {(listings || []).map((listing) => (
          <Marker key={listing.id} position={[listing.latitude, listing.longitude]}>
            <Popup>
              <a href={`/listing/${listing.id}`} className="font-medium text-green-700">
                {listing.title}
              </a>
              {listing.price != null && (
                <>
                  <br />
                  ₱{Number(listing.price).toLocaleString()}
                </>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

'use client';

import dynamic from 'next/dynamic';

// Leaflet touches the browser window directly, so it can only render on the
// client — this wrapper skips it during server rendering.
const LocationPicker = dynamic(() => import('./LocationPicker'), {
  ssr: false,
  loading: () => <p className="text-stone-400 text-sm">Loading map…</p>,
});

export default LocationPicker;

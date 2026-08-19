'use client';

import dynamic from 'next/dynamic';

const MapDisplay = dynamic(() => import('./MapDisplay'), {
  ssr: false,
  loading: () => <p className="text-stone-400 text-sm">Loading map…</p>,
});

export default MapDisplay;

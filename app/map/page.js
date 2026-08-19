'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import MapDisplay from '@/components/DynamicMapDisplay';

export default function MapPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .then(({ data }) => {
        setListings(data || []);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Map</h1>
        <a href="/" className="text-sm text-green-700 hover:underline">View as list</a>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Loading…</p>
      ) : listings.length === 0 ? (
        <p className="text-stone-400 text-sm">
          No listings with a location yet. Sellers can add one from Post a listing or Edit listing.
        </p>
      ) : (
        <MapDisplay listings={listings} height={500} zoom={12} />
      )}
    </div>
  );
}

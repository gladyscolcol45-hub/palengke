'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

export default function FavoritesPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      setLoading(true);
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: favRows } = await supabase
        .from('favorites')
        .select('listing_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const listingIds = (favRows || []).map((f) => f.listing_id);
      if (listingIds.length === 0) {
        setListings([]);
        setLoading(false);
        return;
      }

      const { data: listingRows } = await supabase
        .from('listings')
        .select('*')
        .in('id', listingIds);

      const byId = {};
      (listingRows || []).forEach((l) => { byId[l.id] = l; });
      const ordered = listingIds.map((lid) => byId[lid]).filter(Boolean);

      setListings(ordered);
      setLoading(false);
    }

    load();
  }, []);

  async function handleRemove(listingId) {
    const supabase = createClient();
    const userResult = await supabase.auth.getUser();
    const user = userResult.data.user;
    if (!user) return;

    await supabase.from('favorites').delete().eq('user_id', user.id).eq('listing_id', listingId);
    setListings((prev) => prev.filter((l) => l.id !== listingId));
  }

  if (loading) {
    return <p className="text-stone-400 text-sm">Loading...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Saved</h1>
      {listings.length === 0 ? (
        <p className="text-stone-400 text-sm">You haven't saved anything yet. Tap the heart on a listing to save it here.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {listings.map((listing) => (
            <div key={listing.id} className="flex items-center gap-3 border border-stone-200 rounded-lg p-3">
              <a href={'/listing/' + listing.id} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-14 h-14 rounded-md bg-stone-100 overflow-hidden flex-shrink-0">
                  {listing.photo_urls && listing.photo_urls[0] ? (
                    <img src={listing.photo_urls[0]} alt={listing.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">No photo</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{listing.title}</p>
                  <p className="text-orange-700 font-bold text-sm">
                    ₱{Number(listing.price).toLocaleString()}
                    <span className="text-stone-400 font-normal"> / {listing.unit}</span>
                  </p>
                </div>
              </a>
              <button
                onClick={() => handleRemove(listing.id)}
                className="text-stone-400 hover:text-red-600 text-xs underline flex-shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

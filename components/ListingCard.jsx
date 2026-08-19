'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

export default function ListingCard({ listing }) {
  const photo = listing.photo_urls?.[0];
  const [userId, setUserId] = useState(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data?.user || null;
      setUserId(user ? user.id : null);
      if (user) {
        const { data: favRow } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('listing_id', listing.id)
          .maybeSingle();
        setIsFavorited(!!favRow);
      }
    });
  }, [listing.id]);

  async function handleToggleFavorite(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!userId || busy) return;
    setBusy(true);
    const supabase = createClient();

    if (isFavorited) {
      await supabase.from('favorites').delete().eq('user_id', userId).eq('listing_id', listing.id);
      setIsFavorited(false);
    } else {
      await supabase.from('favorites').insert({ user_id: userId, listing_id: listing.id });
      setIsFavorited(true);
    }
    setBusy(false);
  }

  const isOwnListing = userId && userId === listing.seller_id;

  return (
    <a
      href={`/listing/${listing.id}`}
      className="block rounded-lg border border-stone-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-square bg-stone-100 flex items-center justify-center overflow-hidden">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={listing.title} className={`w-full h-full object-cover ${listing.status === 'sold' ? 'opacity-50' : ''}`} />
        ) : (
          <span className="text-stone-400 text-sm">No photo</span>
        )}
        {listing.status === 'sold' && (
          <span className="absolute top-2 left-2 bg-stone-900 text-white text-xs font-bold px-2 py-1 rounded">
            SOLD
          </span>
        )}
        {!isOwnListing && userId && (
          <button
            onClick={handleToggleFavorite}
            disabled={busy}
            aria-label={isFavorited ? 'Remove from saved' : 'Save listing'}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={isFavorited ? '#c2410c' : 'none'}
              stroke={isFavorited ? '#c2410c' : 'currentColor'}
              strokeWidth="2"
              className="w-4 h-4 text-stone-500"
            >
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
            </svg>
          </button>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold truncate">{listing.title}</p>
        <p className="text-orange-700 font-bold">
          ₱{Number(listing.price).toLocaleString()}
          <span className="text-stone-400 font-normal text-sm"> / {listing.unit}</span>
        </p>
        <p className="text-stone-500 text-xs mt-1">{listing.barangay}{listing.barangay && listing.city ? ', ' : ''}{listing.city}</p>
      </div>
    </a>
  );
}

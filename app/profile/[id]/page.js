'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function ProfilePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      setProfile(profileData);

      const { data: listingData } = await supabase
        .from('listings')
        .select('*')
        .eq('seller_id', id)
        .order('created_at', { ascending: false });
      setListings(listingData || []);

      const { data: reviewData } = await supabase
        .from('reviews')
        .select('*')
        .eq('reviewed_user_id', id)
        .order('created_at', { ascending: false });
      setReviews(reviewData || []);

      setLoading(false);
    }

    load();
  }, [id]);

  if (loading) return <p className="text-stone-400 text-sm">Loading…</p>;
  if (!profile) return <p className="text-stone-400 text-sm">User not found.</p>;

  const avgRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-stone-200 flex items-center justify-center text-2xl font-bold text-stone-500">
          {profile.username ? profile.username[0].toUpperCase() : '?'}
        </div>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-1.5">
            {profile.username || 'Unknown user'}
            {profile.is_verified && (
              <span
                title="Verified Seller"
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-700 text-white text-xs"
              >
                ✓
              </span>
            )}
          </h1>
          {profile.is_verified && (
            <p className="text-xs text-green-700 font-medium">Verified Seller</p>
          )}
          {avgRating ? (
            <p className="text-sm text-stone-500">
              <span className="text-yellow-500">★</span> {avgRating} ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
            </p>
          ) : (
            <p className="text-sm text-stone-400">No reviews yet</p>
          )}
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">Listings</h2>
      {listings.length === 0 ? (
        <p className="text-stone-400 text-sm">No listings yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {listings.map((listing) => (
            <a key={listing.id} href={`/listing/${listing.id}`} className="block border border-stone-200 rounded-lg overflow-hidden hover:shadow-md transition">
              <div className="aspect-square bg-stone-100">
                {listing.photo_urls?.[0] ? (
                  <img src={listing.photo_urls[0]} alt={listing.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs">No photo</div>
                )}
              </div>
              <div className="p-2">
                <p className="text-sm font-medium truncate">{listing.title}</p>
                <p className="text-orange-700 font-bold text-sm">₱{Number(listing.price).toLocaleString()}</p>
              </div>
            </a>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">Reviews</h2>
      {reviews.length === 0 ? (
        <p className="text-stone-400 text-sm">No reviews yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((r) => (
            <div key={r.id} className="border border-stone-200 rounded-md p-3">
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className={r.rating >= star ? 'text-yellow-500' : 'text-stone-300'}>★</span>
                ))}
              </div>
              {r.comment && <p className="text-sm text-stone-700">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

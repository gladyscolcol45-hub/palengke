'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusBadgeClass(status) {
  if (status === 'confirmed') return 'bg-green-100 text-green-700';
  if (status === 'declined') return 'bg-red-100 text-red-700';
  if (status === 'completed') return 'bg-stone-200 text-stone-700';
  return 'bg-amber-100 text-amber-700';
}

function BookingRow({ b }) {
  const photo = b.listing && b.listing.photo_urls ? b.listing.photo_urls[0] : null;
  const otherName = b.otherUser ? b.otherUser.full_name || b.otherUser.username : 'Unnamed user';

  return (
    <a
      href={'/listing/' + b.listing_id}
      className="flex items-center gap-3 border border-stone-200 rounded-lg p-3 hover:bg-stone-50"
    >
      <div className="w-14 h-14 rounded-md bg-stone-100 overflow-hidden flex-shrink-0">
        {photo ? (
          <img src={photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">No photo</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{b.listing ? b.listing.title : 'Listing'}</p>
        <p className="text-sm text-stone-500 truncate">with {otherName}</p>
        {b.dates_note && <p className="text-xs text-stone-400 mt-0.5">{b.dates_note}</p>}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadgeClass(b.status)}`}>
          {b.status}
        </span>
        <span className="text-xs text-stone-400">{formatDate(b.created_at)}</span>
      </div>
    </a>
  );
}

export default function BookingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [asBuyer, setAsBuyer] = useState([]);
  const [asSeller, setAsSeller] = useState([]);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);

      const { data: rows } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      const bookingRows = rows || [];

      const listingIds = [...new Set(bookingRows.map((b) => b.listing_id))];
      const listingMap = {};
      for (let i = 0; i < listingIds.length; i++) {
        const { data: listing } = await supabase
          .from('listings')
          .select('title, photo_urls')
          .eq('id', listingIds[i])
          .single();
        listingMap[listingIds[i]] = listing || null;
      }

      const otherUserIds = [
        ...new Set(
          bookingRows.map((b) => (b.buyer_id === user.id ? b.seller_id : b.buyer_id))
        ),
      ];
      const userMap = {};
      for (let i = 0; i < otherUserIds.length; i++) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, full_name')
          .eq('id', otherUserIds[i])
          .single();
        userMap[otherUserIds[i]] = profile || null;
      }

      const enriched = bookingRows.map((b) => ({
        ...b,
        listing: listingMap[b.listing_id] || null,
        otherUser: userMap[b.buyer_id === user.id ? b.seller_id : b.buyer_id] || null,
      }));

      setAsBuyer(enriched.filter((b) => b.buyer_id === user.id));
      setAsSeller(enriched.filter((b) => b.seller_id === user.id));
      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) {
    return <p className="text-stone-400 text-sm">Loading...</p>;
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">My Bookings</h1>

      <div className="mb-8">
        <h2 className="text-lg font-bold mb-3">Booking requests received</h2>
        {asSeller.length === 0 ? (
          <p className="text-stone-400 text-sm">No one has requested to book your places yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {asSeller.map((b) => (
              <BookingRow key={b.id} b={b} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3">Bookings you requested</h2>
        {asBuyer.length === 0 ? (
          <p className="text-stone-400 text-sm">You haven&apos;t requested to book anything yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {asBuyer.map((b) => (
              <BookingRow key={b.id} b={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

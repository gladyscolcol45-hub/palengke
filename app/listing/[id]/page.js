'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function ListingDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [listing, setListing] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('listings').select('*').eq('id', id).single()
      .then(({ data }) => setListing(data));
  }, [id]);

  async function handleMessageSeller() {
    setStarting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }
    if (user.id === listing.seller_id) {
      setStarting(false);
      return; // can't message yourself
    }

    // Find existing chat or create a new one
    const { data: existing } = await supabase
      .from('chats')
      .select('id')
      .eq('listing_id', listing.id)
      .eq('buyer_id', user.id)
      .eq('seller_id', listing.seller_id)
      .maybeSingle();

    let chatId = existing?.id;

    if (!chatId) {
      const { data: created, error } = await supabase
        .from('chats')
        .insert({ listing_id: listing.id, buyer_id: user.id, seller_id: listing.seller_id })
        .select('id')
        .single();
      if (error) {
        setStarting(false);
        return;
      }
      chatId = created.id;
    }

    router.push(`/chat/${chatId}`);
  }

  if (!listing) return <p className="text-stone-400 text-sm">Loading…</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="aspect-square bg-stone-100 rounded-lg overflow-hidden mb-4">
        {listing.photo_urls?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.photo_urls[0]} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400">No photo</div>
        )}
      </div>
      <h1 className="text-2xl font-bold">{listing.title}</h1>
      <p className="text-orange-700 font-bold text-xl mt-1">
        ₱{Number(listing.price).toLocaleString()} <span className="text-stone-400 font-normal text-base">/ {listing.unit}</span>
      </p>
      <p className="text-stone-500 text-sm mt-1">{listing.barangay}{listing.barangay && listing.city ? ', ' : ''}{listing.city}</p>
      {listing.description && <p className="text-stone-700 mt-4">{listing.description}</p>}

      <button
        onClick={handleMessageSeller}
        disabled={starting}
        className="mt-6 bg-orange-700 text-white rounded-md px-4 py-2 font-semibold hover:bg-orange-800 disabled:opacity-50"
      >
        {starting ? 'Opening chat…' : 'Message seller'}
      </button>
    </div>
  );
}

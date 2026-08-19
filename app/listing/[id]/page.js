'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import MapDisplay from '@/components/DynamicMapDisplay';

const REPORT_REASONS = [
  'Scam or fraud',
  'Fake or misleading listing',
  'Inappropriate content',
  'Prohibited item',
  'Other',
];

export default function ListingDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [listing, setListing] = useState(null);
  const [sellerUsername, setSellerUsername] = useState(null);
  const [starting, setStarting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.from('listings').select('*').eq('id', id).single()
      .then(async ({ data }) => {
        setListing(data);
        if (data && data.seller_id) {
          const { data: sellerProfile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', data.seller_id)
            .single();
          setSellerUsername(sellerProfile ? sellerProfile.username : null);
        }
      });
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data && data.user ? data.user.id : null));
  }, [id]);

  async function handleMessageSeller() {
    setStarting(true);
    const supabase = createClient();
    const userResult = await supabase.auth.getUser();
    const user = userResult.data.user;

    if (!user) {
      router.push('/login');
      return;
    }
    if (user.id === listing.seller_id) {
      setStarting(false);
      return;
    }

    const existingResult = await supabase
      .from('chats')
      .select('id')
      .eq('listing_id', listing.id)
      .eq('buyer_id', user.id)
      .eq('seller_id', listing.seller_id)
      .maybeSingle();

    let chatId = existingResult.data ? existingResult.data.id : null;

    if (!chatId) {
      const createdResult = await supabase
        .from('chats')
        .insert({ listing_id: listing.id, buyer_id: user.id, seller_id: listing.seller_id })
        .select('id')
        .single();
      if (createdResult.error) {
        setStarting(false);
        return;
      }
      chatId = createdResult.data.id;
    }

    router.push('/chat/' + chatId);
  }

  async function handleSubmitReport() {
    setReportSubmitting(true);
    setReportError('');
    const supabase = createClient();
    const userResult = await supabase.auth.getUser();
    const user = userResult.data.user;

    if (!user) {
      router.push('/login');
      return;
    }

    const insertResult = await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_user_id: listing.seller_id,
      listing_id: listing.id,
      reason: reportReason,
      details: reportDetails || null,
    });

    setReportSubmitting(false);

    if (insertResult.error) {
      setReportError('Something went wrong. Please try again.');
      return;
    }

    setReportSubmitted(true);
    setShowReportForm(false);
  }

  if (!listing) {
    return <p className="text-stone-400 text-sm">Loading...</p>;
  }

  const isOwner = currentUserId && currentUserId === listing.seller_id;
  const editUrl = '/listing/' + listing.id + '/edit';
  const profileUrl = '/profile/' + listing.seller_id;
  const hasLocation = listing.latitude != null && listing.longitude != null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="aspect-square bg-stone-100 rounded-lg overflow-hidden mb-4">
        {listing.photo_urls && listing.photo_urls[0] ? (
          <img src={listing.photo_urls[0]} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400">No photo</div>
        )}
      </div>
      <h1 className="text-2xl font-bold">{listing.title}</h1>
      <p className="text-orange-700 font-bold text-xl mt-1">
        P{Number(listing.price).toLocaleString()} <span className="text-stone-400 font-normal text-base">/ {listing.unit}</span>
      </p>
      <p className="text-stone-500 text-sm mt-1">{listing.barangay}{listing.barangay && listing.city ? ', ' : ''}{listing.city}</p>
      {sellerUsername ? <p className="text-sm mt-2">Sold by <a href={profileUrl} className="text-green-700 font-medium hover:underline">{sellerUsername}</a></p> : null}
      {listing.description ? <p className="text-stone-700 mt-4">{listing.description}</p> : null}

      {hasLocation && (
        <div className="mt-4">
          <p className="text-sm font-medium text-stone-700 mb-1">Location</p>
          <MapDisplay
            listings={[listing]}
            height={220}
            zoom={14}
          />
        </div>
      )}

      <div className="flex items-center gap-4 mt-6">
        {isOwner ? (
          <a href={editUrl} className="bg-green-700 text-white rounded-md px-4 py-2 font-semibold hover:bg-green-800">Edit listing</a>
        ) : (
          <>
            <button
              onClick={handleMessageSeller}
              disabled={starting}
              className="bg-orange-700 text-white rounded-md px-4 py-2 font-semibold hover:bg-orange-800 disabled:opacity-50"
            >
              {starting ? 'Opening chat...' : 'Message seller'}
            </button>

            {!reportSubmitted && (
              <button
                onClick={() => setShowReportForm((v) => !v)}
                className="text-stone-400 text-sm hover:text-red-600 underline"
              >
                Report listing
              </button>
            )}
          </>
        )}
      </div>

      {reportSubmitted && (
        <p className="text-sm text-green-700 mt-3">Thanks, your report was submitted.</p>
      )}

      {showReportForm && (
        <div className="mt-4 border border-stone-200 rounded-md p-4 bg-stone-50">
          <label className="block text-sm font-medium text-stone-700 mb-1">Reason</label>
          <select
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mb-3"
          >
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <label className="block text-sm font-medium text-stone-700 mb-1">Details (optional)</label>
          <textarea
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            rows={3}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mb-3"
            placeholder="Anything else we should know?"
          />

          {reportError && <p className="text-sm text-red-600 mb-2">{reportError}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSubmitReport}
              disabled={reportSubmitting}
              className="bg-red-600 text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {reportSubmitting ? 'Submitting...' : 'Submit report'}
            </button>
            <button
              onClick={() => setShowReportForm(false)}
              className="text-stone-500 text-sm px-4 py-2 hover:text-stone-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

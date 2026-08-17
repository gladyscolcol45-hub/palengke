'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

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
  const [starting, setStarting] = useState(false);

  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportError, setReportError] = useState('');

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

  async function handleSubmitReport() {
    setReportSubmitting(true);
    setReportError('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_user_id: listing.seller_id,
      listing_id: listing.id,
      reason: reportReason,
      details: reportDetails || null,
    });

    setReportSubmitting(false);

    if (error) {
      setReportError('Something went wrong. Please try again.');
      return;
    }

    setReportSubmitted(true);
    setShowReportForm(false);
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

      <div className="flex items-center gap-4 mt-6">
        <button
          onClick={handleMessageSeller}
          disabled={starting}
          className="bg-orange-700 text-white rounded-md px-4 py-2 font-semibold hover:bg-orange-800 disabled:opacity-50"
        >
          {starting ? 'Opening chat…' : 'Message seller'}
        </button>

        {!reportSubmitted && (
          <button
            onClick={() => setShowReportForm((v) => !v)}
            className="text-stone-400 text-sm hover:text-red-600 underline"
          >
            Report listing
          </button>
        )}
      </div>

      {reportSubmitted && (
        <p className="text-sm text-green-700 mt-3">Thanks — your report was submitted.</p>
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
              {reportSubmitting ? 'Submitting…' : 'Submit report'}
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
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
  const [sellerVerified, setSellerVerified] = useState(false);
  const [starting, setStarting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportError, setReportError] = useState('');

  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [togglingSold, setTogglingSold] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('listings').select('*').eq('id', id).single()
      .then(async ({ data }) => {
        setListing(data);
        setActivePhotoIndex(0);
        if (data && data.seller_id) {
          const { data: sellerProfile } = await supabase
            .from('profiles')
            .select('username, verified_until')
            .eq('id', data.seller_id)
            .single();
          setSellerUsername(sellerProfile ? sellerProfile.username : null);
          setSellerVerified(
            !!(sellerProfile && sellerProfile.verified_until && new Date(sellerProfile.verified_until) > new Date())
          );
        }
      });
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data && data.user ? data.user : null;
      setCurrentUserId(user ? user.id : null);
      if (user) {
        const { data: favRow } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('listing_id', id)
          .maybeSingle();
        setIsFavorited(!!favRow);
      }
    });
  }, [id]);

  async function handleToggleFavorite() {
    if (!currentUserId) {
      router.push('/login');
      return;
    }
    setFavoriteLoading(true);
    const supabase = createClient();

    if (isFavorited) {
      await supabase.from('favorites').delete().eq('user_id', currentUserId).eq('listing_id', id);
      setIsFavorited(false);
    } else {
      await supabase.from('favorites').insert({ user_id: currentUserId, listing_id: id });
      setIsFavorited(true);
    }
    setFavoriteLoading(false);
  }

  async function handleToggleSold() {
    setTogglingSold(true);
    const supabase = createClient();
    const newStatus = listing.status === 'sold' ? 'active' : 'sold';
    const { error } = await supabase.from('listings').update({ status: newStatus }).eq('id', listing.id);
    setTogglingSold(false);
    if (!error) {
      setListing({ ...listing, status: newStatus });
    }
  }

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

    await supabase.from('notifications').insert({
      user_id: listing.seller_id,
      type: 'listing_reported',
      message: `Your listing "${listing.title}" was reported.`,
      link: '/listing/' + listing.id,
    });

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
      <div className="relative aspect-square bg-stone-100 rounded-lg overflow-hidden mb-2">
        {listing.photo_urls && listing.photo_urls[activePhotoIndex] ? (
          <img
            src={listing.photo_urls[activePhotoIndex]}
            alt={listing.title}
            className={`w-full h-full object-cover ${listing.status === 'sold' ? 'opacity-50' : ''}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400">No photo</div>
        )}
        {listing.status === 'sold' && (
          <span className="absolute top-3 left-3 bg-stone-900 text-white text-sm font-bold px-3 py-1 rounded">
            SOLD
          </span>
        )}
        {!isOwner && (
          <button
            onClick={handleToggleFavorite}
            disabled={favoriteLoading}
            aria-label={isFavorited ? 'Remove from saved' : 'Save listing'}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={isFavorited ? '#c2410c' : 'none'}
              stroke={isFavorited ? '#c2410c' : 'currentColor'}
              strokeWidth="2"
              className="w-5 h-5 text-stone-500"
            >
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
            </svg>
          </button>
        )}
      </div>

      {listing.photo_urls && listing.photo_urls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto mb-4">
          {listing.photo_urls.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActivePhotoIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 ${
                i === activePhotoIndex ? 'border-green-700' : 'border-transparent'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${listing.title} photo ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <h1 className="text-2xl font-bold">{listing.title}</h1>
      <p className="text-orange-700 font-bold text-xl mt-1">
        P{Number(listing.price).toLocaleString()} <span className="text-stone-400 font-normal text-base">/ {listing.unit}</span>
      </p>
      <p className="text-stone-500 text-sm mt-1">{listing.barangay}{listing.barangay && listing.city ? ', ' : ''}{listing.city}</p>
      {sellerUsername ? (
        <p className="text-sm mt-2 flex items-center gap-1">
          Sold by <a href={profileUrl} className="text-green-700 font-medium hover:underline">{sellerUsername}</a>
          {sellerVerified && (
            <span
              title="Verified Seller"
              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-700 text-white text-[10px]"
            >
              ✓
            </span>
          )}
        </p>
      ) : null}
      {listing.description ? <p className="text-stone-700 mt-4">{listing.description}</p> : null}

      <div className="flex items-center gap-4 mt-6">
        {isOwner ? (
          <>
            <a href={editUrl} className="bg-green-700 text-white rounded-md px-4 py-2 font-semibold hover:bg-green-800">Edit listing</a>
            <button
              onClick={handleToggleSold}
              disabled={togglingSold}
              className={`rounded-md px-4 py-2 font-semibold disabled:opacity-50 ${
                listing.status === 'sold'
                  ? 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  : 'bg-orange-700 text-white hover:bg-orange-800'
              }`}
            >
              {togglingSold
                ? 'Updating...'
                : listing.status === 'sold'
                ? 'Mark as available'
                : 'Mark as sold'}
            </button>
          </>
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

      {hasLocation && (
        <div className="mt-6">
          <p className="text-sm font-medium text-stone-700 mb-1">Location</p>
          <MapDisplay
            listings={[listing]}
            height={220}
            zoom={14}
          />
        </div>
      )}

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

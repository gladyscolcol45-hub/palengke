'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import MapDisplay from '@/components/DynamicMapDisplay';
import { PAYMENT_METHODS, getPaymentMethod } from '@/lib/paymentMethods';

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
  const [categorySlug, setCategorySlug] = useState(null);

  // Boosted listings
  const [boostRequest, setBoostRequest] = useState(null);
  const [requestingBoost, setRequestingBoost] = useState(false);
  const [boostProofFile, setBoostProofFile] = useState(null);
  const [boostProofPreview, setBoostProofPreview] = useState(null);
  const [boostProofError, setBoostProofError] = useState(null);
  const [boostPaymentMethod, setBoostPaymentMethod] = useState('gcash');

  // Bookings (Resorts & Venues)
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingDatesNote, setBookingDatesNote] = useState('');
  const [bookingGuestCount, setBookingGuestCount] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingSubmitted, setBookingSubmitted] = useState(false);
  const [bookingActionId, setBookingActionId] = useState(null);
  const [priceDrafts, setPriceDrafts] = useState({});
  const [commissionProofFiles, setCommissionProofFiles] = useState({});
  const [commissionProofPreviews, setCommissionProofPreviews] = useState({});
  const [commissionErrors, setCommissionErrors] = useState({});
  const [submittingCommissionId, setSubmittingCommissionId] = useState(null);
  const [commissionPaymentMethods, setCommissionPaymentMethods] = useState({});

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
        if (data && data.category_id) {
          const { data: cat } = await supabase
            .from('categories')
            .select('slug')
            .eq('id', data.category_id)
            .single();
          setCategorySlug(cat ? cat.slug : null);
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

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    supabase
      .from('boost_requests')
      .select('*')
      .eq('listing_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setBoostRequest(data || null);
      });
  }, [id]);

  useEffect(() => {
    if (!id || categorySlug !== 'resorts-venues') return;
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, categorySlug]);

  async function loadBookings() {
    setBookingsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('listing_id', id)
      .order('created_at', { ascending: false });
    setBookings(data || []);
    setBookingsLoading(false);
  }

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

  async function handleSetListingStatus(newStatus) {
    setTogglingSold(true);
    const supabase = createClient();
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

  function handleBoostProofChange(e) {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) return;
    setBoostProofError(null);
    setBoostProofFile(file);
    setBoostProofPreview(URL.createObjectURL(file));
  }

  function handleRemoveBoostProof() {
    setBoostProofFile(null);
    setBoostProofPreview(null);
  }

  async function handleRequestBoost() {
    if (!currentUserId || !listing) return;
    if (!boostProofFile) {
      setBoostProofError('Please attach a screenshot of your payment first.');
      return;
    }

    setBoostProofError(null);
    setRequestingBoost(true);
    const supabase = createClient();

    const proofPath = `${currentUserId}/boost-${listing.id}-${Date.now()}-${boostProofFile.name}`;
    const uploadResult = await supabase.storage.from('payment-proofs').upload(proofPath, boostProofFile);

    if (uploadResult.error) {
      setRequestingBoost(false);
      setBoostProofError('Could not upload your screenshot. Please try again.');
      return;
    }

    const insertResult = await supabase
      .from('boost_requests')
      .insert({
        listing_id: listing.id,
        user_id: currentUserId,
        status: 'pending',
        payment_proof_path: proofPath,
        payment_method: boostPaymentMethod,
      })
      .select()
      .single();

    if (insertResult.error) {
      setRequestingBoost(false);
      alert('Something went wrong sending your request. Please try again.');
      return;
    }

    const adminsResult = await supabase.from('profiles').select('id').eq('is_admin', true);
    const admins = adminsResult.data || [];
    for (let i = 0; i < admins.length; i++) {
      await supabase.from('notifications').insert({
        user_id: admins[i].id,
        type: 'boost_requested',
        message: `A seller requested a boost for "${listing.title}" — review it in Boost requests.`,
        link: '/admin/boosts',
      });
    }

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;
    if (accessToken) {
      try {
        await fetch('/api/boost-request', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: listing.id, listingTitle: listing.title }),
        });
      } catch (e) {
        // Ignore — the request row and in-app notification already succeeded.
      }
    }

    setBoostRequest(insertResult.data);
    setRequestingBoost(false);
  }

  async function handleSubmitBookingRequest() {
    if (!currentUserId) {
      router.push('/login');
      return;
    }
    if (currentUserId === listing.seller_id) return;

    setSubmittingBooking(true);
    const supabase = createClient();

    const insertResult = await supabase
      .from('bookings')
      .insert({
        listing_id: listing.id,
        buyer_id: currentUserId,
        seller_id: listing.seller_id,
        dates_note: bookingDatesNote || null,
        guest_count: bookingGuestCount ? Number(bookingGuestCount) : null,
        message: bookingMessage || null,
        total_price: listing.price,
      })
      .select()
      .single();

    setSubmittingBooking(false);

    if (insertResult.error) {
      alert('Something went wrong sending your booking request. Please try again.');
      return;
    }

    await supabase.from('notifications').insert({
      user_id: listing.seller_id,
      type: 'booking_requested',
      message: `You have a new booking request for "${listing.title}".`,
      link: '/listing/' + listing.id,
    });

    setBookings((prev) => [insertResult.data, ...prev]);
    setShowBookingForm(false);
    setBookingSubmitted(true);
    setBookingDatesNote('');
    setBookingGuestCount('');
    setBookingMessage('');
  }

  async function handleBookingAction(bookingId, action) {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    setBookingActionId(bookingId);
    const supabase = createClient();

    let updates = { updated_at: new Date().toISOString() };
    if (action === 'confirm') {
      const draftPrice = priceDrafts[bookingId];
      const finalPrice =
        draftPrice !== undefined && draftPrice !== '' ? Number(draftPrice) : Number(booking.total_price || 0);
      updates.status = 'confirmed';
      updates.total_price = finalPrice;
    } else if (action === 'decline') {
      updates.status = 'declined';
    } else if (action === 'complete') {
      const finalPrice = Number(booking.total_price || 0);
      const commissionAmount = Math.round(finalPrice * Number(booking.commission_rate || 0.1) * 100) / 100;
      updates.status = 'completed';
      updates.commission_amount = commissionAmount;
    }

    const { data, error } = await supabase.from('bookings').update(updates).eq('id', bookingId).select().single();
    setBookingActionId(null);

    if (error) {
      alert('Something went wrong. Please try again.');
      return;
    }

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? data : b)));

    if (action === 'confirm') {
      await supabase.from('notifications').insert({
        user_id: booking.buyer_id,
        type: 'booking_confirmed',
        message: `Your booking request for "${listing.title}" was confirmed.`,
        link: '/listing/' + listing.id,
      });
    } else if (action === 'decline') {
      await supabase.from('notifications').insert({
        user_id: booking.buyer_id,
        type: 'booking_declined',
        message: `Your booking request for "${listing.title}" was declined.`,
        link: '/listing/' + listing.id,
      });
    } else if (action === 'complete') {
      await supabase.from('notifications').insert({
        user_id: booking.buyer_id,
        type: 'booking_completed',
        message: `Your booking for "${listing.title}" is marked complete. Hope it went well!`,
        link: '/listing/' + listing.id,
      });
    }
  }

  function handleCommissionProofChange(bookingId, e) {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) return;
    setCommissionErrors((prev) => ({ ...prev, [bookingId]: null }));
    setCommissionProofFiles((prev) => ({ ...prev, [bookingId]: file }));
    setCommissionProofPreviews((prev) => ({ ...prev, [bookingId]: URL.createObjectURL(file) }));
  }

  function handleRemoveCommissionProof(bookingId) {
    setCommissionProofFiles((prev) => ({ ...prev, [bookingId]: null }));
    setCommissionProofPreviews((prev) => ({ ...prev, [bookingId]: null }));
  }

  async function handleSubmitCommissionProof(bookingId) {
    const file = commissionProofFiles[bookingId];
    if (!file) {
      setCommissionErrors((prev) => ({ ...prev, [bookingId]: 'Please attach a screenshot of your payment first.' }));
      return;
    }

    setSubmittingCommissionId(bookingId);
    const supabase = createClient();

    const proofPath = `${currentUserId}/commission-${bookingId}-${Date.now()}-${file.name}`;
    const uploadResult = await supabase.storage.from('payment-proofs').upload(proofPath, file);

    if (uploadResult.error) {
      setSubmittingCommissionId(null);
      setCommissionErrors((prev) => ({ ...prev, [bookingId]: 'Could not upload your screenshot. Please try again.' }));
      return;
    }

    const method = commissionPaymentMethods[bookingId] || 'gcash';
    const { data, error } = await supabase
      .from('bookings')
      .update({ commission_status: 'pending_review', commission_proof_path: proofPath, commission_payment_method: method })
      .eq('id', bookingId)
      .select()
      .single();

    setSubmittingCommissionId(null);

    if (error) {
      alert('Something went wrong. Please try again.');
      return;
    }

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? data : b)));

    const adminsResult = await supabase.from('profiles').select('id').eq('is_admin', true);
    const admins = adminsResult.data || [];
    for (let i = 0; i < admins.length; i++) {
      await supabase.from('notifications').insert({
        user_id: admins[i].id,
        type: 'commission_requested',
        message: `A seller submitted a booking commission payment for "${listing.title}" — review it in Booking commissions.`,
        link: '/admin/bookings',
      });
    }

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;
    if (accessToken) {
      try {
        await fetch('/api/booking-commission-request', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId, listingTitle: listing.title }),
        });
      } catch (e) {
        // Ignore — the request row already saved either way.
      }
    }
  }

  if (!listing) {
    return <p className="text-stone-400 text-sm">Loading...</p>;
  }

  const isOwner = currentUserId && currentUserId === listing.seller_id;
  const editUrl = '/listing/' + listing.id + '/edit';
  const profileUrl = '/profile/' + listing.seller_id;
  const hasLocation = listing.latitude != null && listing.longitude != null;
  const isResort = categorySlug === 'resorts-venues';
  const isBoostedNow = !!(listing.boosted_until && new Date(listing.boosted_until) > new Date());
  const boostDaysLeft = isBoostedNow
    ? Math.max(1, Math.ceil((new Date(listing.boosted_until) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;
  const boostPending = !!boostRequest && boostRequest.status === 'pending';
  const boostRejected = !!boostRequest && boostRequest.status === 'rejected';
  const myBookingRequest = !isOwner && currentUserId
    ? bookings.find((b) => b.buyer_id === currentUserId)
    : null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="relative aspect-square bg-stone-100 rounded-lg overflow-hidden mb-2">
        {listing.photo_urls && listing.photo_urls[activePhotoIndex] ? (
          <img
            src={listing.photo_urls[activePhotoIndex]}
            alt={listing.title}
            className={`w-full h-full object-cover ${
              listing.status === 'sold' || listing.status === 'reserved' || listing.status === 'in_use' ? 'opacity-50' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400">No photo</div>
        )}
        {listing.status === 'sold' && (
          <span className="absolute top-3 left-3 bg-stone-900 text-white text-sm font-bold px-3 py-1 rounded">
            SOLD
          </span>
        )}
        {listing.status === 'reserved' && (
          <span className="absolute top-3 left-3 bg-amber-600 text-white text-sm font-bold px-3 py-1 rounded">
            RESERVED
          </span>
        )}
        {listing.status === 'in_use' && (
          <span className="absolute top-3 left-3 bg-red-700 text-white text-sm font-bold px-3 py-1 rounded">
            OCCUPIED
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

      {isResort && (listing.max_guests || (listing.amenities && listing.amenities.length > 0) || listing.house_rules) && (
        <div className="mt-4 border border-stone-200 rounded-md p-3 text-sm">
          {listing.max_guests ? (
            <p className="text-stone-700">
              <span className="font-medium">Fits up to</span> {listing.max_guests} guest{listing.max_guests !== 1 ? 's' : ''}
            </p>
          ) : null}
          {listing.amenities && listing.amenities.length > 0 ? (
            <div className="mt-2">
              <p className="font-medium text-stone-700 mb-1">Amenities</p>
              <div className="flex flex-wrap gap-1.5">
                {listing.amenities.map((a) => (
                  <span key={a} className="bg-stone-100 text-stone-600 text-xs px-2 py-1 rounded-full">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {listing.house_rules ? (
            <div className="mt-2">
              <p className="font-medium text-stone-700">House rules</p>
              <p className="text-stone-600 mt-0.5 whitespace-pre-wrap">{listing.house_rules}</p>
            </div>
          ) : null}
        </div>
      )}

      <div className="flex items-center gap-4 mt-6">
        {isOwner ? (
          <>
            <a href={editUrl} className="bg-green-700 text-white rounded-md px-4 py-2 font-semibold hover:bg-green-800">Edit listing</a>
            {isResort ? (
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'active', label: 'Available' },
                  { value: 'reserved', label: 'Reserved' },
                  { value: 'in_use', label: 'Occupied' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSetListingStatus(opt.value)}
                    disabled={togglingSold || listing.status === opt.value}
                    className={`rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-100 ${
                      listing.status === opt.value
                        ? 'bg-orange-700 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
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
            )}
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

            {isResort && !myBookingRequest && listing.status === 'active' && (
              <button
                onClick={() => setShowBookingForm((v) => !v)}
                className="bg-green-700 text-white rounded-md px-4 py-2 font-semibold hover:bg-green-800"
              >
                Request to Book
              </button>
            )}

            {isResort && !myBookingRequest && listing.status !== 'active' && listing.status !== 'sold' && listing.status !== 'removed' && (
              <span className="text-sm text-stone-500">
                {listing.status === 'reserved' ? 'Currently reserved' : 'Currently occupied'}
              </span>
            )}

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

      {!isOwner && isResort && showBookingForm && !myBookingRequest && (
        <div className="mt-4 border border-green-200 bg-green-50 rounded-md p-4">
          <p className="font-medium text-stone-700 mb-2">Request to book this place</p>
          <label className="block text-sm font-medium text-stone-700 mb-1">Dates you have in mind</label>
          <input
            type="text"
            value={bookingDatesNote}
            onChange={(e) => setBookingDatesNote(e.target.value)}
            placeholder="e.g. Dec 24-26, 2026"
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <label className="block text-sm font-medium text-stone-700 mb-1">Number of guests (optional)</label>
          <input
            type="number"
            min="1"
            value={bookingGuestCount}
            onChange={(e) => setBookingGuestCount(e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <label className="block text-sm font-medium text-stone-700 mb-1">Message to the owner (optional)</label>
          <textarea
            value={bookingMessage}
            onChange={(e) => setBookingMessage(e.target.value)}
            rows={3}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mb-3"
            placeholder="Anything they should know?"
          />
          <p className="text-xs text-stone-500 mb-3">
            The owner will confirm your booking and the final price with you. This just sends them your request.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleSubmitBookingRequest}
              disabled={submittingBooking}
              className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
            >
              {submittingBooking ? 'Sending...' : 'Send booking request'}
            </button>
            <button
              onClick={() => setShowBookingForm(false)}
              className="text-stone-500 text-sm px-4 py-2 hover:text-stone-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!isOwner && bookingSubmitted && (
        <p className="text-sm text-green-700 mt-4">Your booking request was sent to the owner.</p>
      )}

      {!isOwner && myBookingRequest && (
        <div className="mt-4 border border-stone-200 rounded-md p-4 bg-stone-50">
          <p className="font-medium text-stone-700">Your booking request</p>
          <p className="text-sm text-stone-500 mt-1">
            Status:{' '}
            <span
              className={
                myBookingRequest.status === 'confirmed'
                  ? 'text-green-700 font-medium'
                  : myBookingRequest.status === 'declined'
                  ? 'text-red-600 font-medium'
                  : myBookingRequest.status === 'completed'
                  ? 'text-stone-700 font-medium'
                  : 'text-amber-600 font-medium'
              }
            >
              {myBookingRequest.status === 'requested' ? 'Waiting for owner to confirm' : myBookingRequest.status}
            </span>
          </p>
          {myBookingRequest.dates_note && (
            <p className="text-sm text-stone-500 mt-1">Dates: {myBookingRequest.dates_note}</p>
          )}
          {(myBookingRequest.status === 'confirmed' || myBookingRequest.status === 'completed') &&
            myBookingRequest.total_price != null && (
              <p className="text-sm text-stone-500 mt-1">
                Total price: ₱{Number(myBookingRequest.total_price).toLocaleString()}
              </p>
            )}
        </div>
      )}

      {isOwner && isResort && (
        <div className="mt-6">
          <h2 className="text-lg font-bold mb-2">Booking requests</h2>
          {bookingsLoading ? (
            <p className="text-stone-400 text-sm">Loading...</p>
          ) : bookings.length === 0 ? (
            <p className="text-stone-400 text-sm">No booking requests yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {bookings.map((b) => (
                <div key={b.id} className="border border-stone-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-stone-700">
                      {b.dates_note || 'No dates given'}
                      {b.guest_count ? ` · ${b.guest_count} guest${b.guest_count !== 1 ? 's' : ''}` : ''}
                    </p>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        b.status === 'confirmed'
                          ? 'bg-green-100 text-green-700'
                          : b.status === 'declined'
                          ? 'bg-red-100 text-red-700'
                          : b.status === 'completed'
                          ? 'bg-stone-200 text-stone-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                  {b.message && <p className="text-sm text-stone-500 mt-1">&ldquo;{b.message}&rdquo;</p>}

                  {b.status === 'requested' && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Total price (₱) &mdash; adjust if needed
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={priceDrafts[b.id] !== undefined ? priceDrafts[b.id] : b.total_price || ''}
                        onChange={(e) => setPriceDrafts((prev) => ({ ...prev, [b.id]: e.target.value }))}
                        className="border border-stone-300 rounded-md px-3 py-1.5 text-sm mb-2 w-32"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleBookingAction(b.id, 'confirm')}
                          disabled={bookingActionId === b.id}
                          className="text-sm bg-green-700 text-white rounded-md px-3 py-1.5 hover:bg-green-800 disabled:opacity-50"
                        >
                          {bookingActionId === b.id ? 'Working...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => handleBookingAction(b.id, 'decline')}
                          disabled={bookingActionId === b.id}
                          className="text-sm bg-stone-100 text-stone-700 rounded-md px-3 py-1.5 hover:bg-stone-200 disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  )}

                  {b.status === 'confirmed' && (
                    <div className="mt-3">
                      <p className="text-sm text-stone-600">Total price: ₱{Number(b.total_price || 0).toLocaleString()}</p>
                      <button
                        onClick={() => handleBookingAction(b.id, 'complete')}
                        disabled={bookingActionId === b.id}
                        className="mt-2 text-sm bg-orange-700 text-white rounded-md px-3 py-1.5 hover:bg-orange-800 disabled:opacity-50"
                      >
                        {bookingActionId === b.id ? 'Working...' : 'Mark stay/event as completed'}
                      </button>
                    </div>
                  )}

                  {b.status === 'completed' && b.commission_status !== 'paid' && (
                    <div className="mt-3 bg-white border border-stone-200 rounded-md p-3 text-sm">
                      <p className="font-medium text-stone-700">
                        You owe ₱{Number(b.commission_amount || 0).toLocaleString()} commission on this booking
                      </p>
                      {b.commission_status === 'pending_review' ? (
                        <p className="text-stone-500 mt-1">Your payment is being reviewed by the admin.</p>
                      ) : (
                        <>
                          <p className="text-stone-700 mt-0.5">Step 1 &mdash; Send it</p>
                          <div className="flex gap-2 mt-1.5 mb-2">
                            {PAYMENT_METHODS.map((m) => (
                              <button
                                key={m.value}
                                type="button"
                                onClick={() =>
                                  setCommissionPaymentMethods((prev) => ({ ...prev, [b.id]: m.value }))
                                }
                                className={`text-xs px-3 py-1.5 rounded-full border ${
                                  (commissionPaymentMethods[b.id] || 'gcash') === m.value
                                    ? 'bg-orange-700 text-white border-orange-700'
                                    : 'bg-white text-stone-600 border-stone-300'
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                          {getPaymentMethod(commissionPaymentMethods[b.id] || 'gcash').lines.map((line) => (
                            <p key={line} className="text-stone-500">{line}</p>
                          ))}
                          <p className="font-medium text-stone-700 mt-2">Step 2 &mdash; Attach your payment screenshot</p>

                          {commissionProofPreviews[b.id] ? (
                            <div className="mt-1.5 flex items-center gap-2">
                              <img
                                src={commissionProofPreviews[b.id]}
                                alt="Payment screenshot"
                                className="w-14 h-14 rounded-md object-cover border border-stone-200"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveCommissionProof(b.id)}
                                className="text-xs text-stone-500 hover:text-red-600 underline"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <label className="mt-1.5 inline-block text-sm text-green-700 hover:underline cursor-pointer">
                              Choose screenshot...
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleCommissionProofChange(b.id, e)}
                                className="hidden"
                              />
                            </label>
                          )}

                          {commissionErrors[b.id] && (
                            <p className="text-red-600 text-xs mt-2">{commissionErrors[b.id]}</p>
                          )}

                          <button
                            onClick={() => handleSubmitCommissionProof(b.id)}
                            disabled={submittingCommissionId === b.id}
                            className="mt-2 bg-green-700 text-white rounded-md px-3 py-1.5 text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
                          >
                            {submittingCommissionId === b.id ? 'Submitting...' : "I've Paid — Submit"}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {b.commission_status === 'paid' && (
                    <p className="text-sm text-green-700 mt-2">✓ Commission paid</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isOwner && (
        <div
          className={`mt-6 rounded-lg p-4 border ${
            isBoostedNow ? 'border-orange-200 bg-orange-50' : 'border-stone-200 bg-stone-50'
          }`}
        >
          {isBoostedNow ? (
            <>
              <p className="text-sm font-semibold text-orange-800 flex items-center gap-1.5">⚡ Boosted</p>
              <p className="text-sm text-orange-700 mt-1">
                This listing is featured at the top of the home feed for {boostDaysLeft} more day
                {boostDaysLeft !== 1 ? 's' : ''}.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-stone-700">Get more views</p>

              {boostPending ? (
                <p className="text-sm text-stone-500 mt-1">
                  Your boost payment is being reviewed by the admin. You&apos;ll get a notification once it&apos;s confirmed.
                </p>
              ) : (
                <>
                  <p className="text-sm text-stone-500 mt-1">
                    Pin this listing to the top of the home feed for 7 days.
                  </p>

                  {boostRejected && (
                    <p className="text-sm text-red-600 mt-2">
                      Your last request couldn&apos;t be confirmed. Please double-check your payment, then try again below.
                    </p>
                  )}

                  <div className="mt-3 bg-white border border-stone-200 rounded-md p-3 text-sm">
                    <p className="font-medium text-stone-700">Step 1 &mdash; Send ₱49</p>
                    <div className="flex gap-2 mt-1.5 mb-2">
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setBoostPaymentMethod(m.value)}
                          className={`text-xs px-3 py-1.5 rounded-full border ${
                            boostPaymentMethod === m.value
                              ? 'bg-orange-700 text-white border-orange-700'
                              : 'bg-white text-stone-600 border-stone-300'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {getPaymentMethod(boostPaymentMethod).lines.map((line) => (
                      <p key={line} className="text-stone-500">{line}</p>
                    ))}
                    <p className="font-medium text-stone-700 mt-3">Step 2 &mdash; Attach your payment screenshot</p>

                    {boostProofPreview ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        <img
                          src={boostProofPreview}
                          alt="Payment screenshot"
                          className="w-14 h-14 rounded-md object-cover border border-stone-200"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveBoostProof}
                          className="text-xs text-stone-500 hover:text-red-600 underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="mt-1.5 inline-block text-sm text-green-700 hover:underline cursor-pointer">
                        Choose screenshot...
                        <input type="file" accept="image/*" onChange={handleBoostProofChange} className="hidden" />
                      </label>
                    )}

                    <p className="font-medium text-stone-700 mt-3">Step 3 &mdash; Tap the button below</p>
                  </div>

                  {boostProofError && <p className="text-red-600 text-sm mt-2">{boostProofError}</p>}

                  <button
                    onClick={handleRequestBoost}
                    disabled={requestingBoost}
                    className="mt-3 bg-orange-700 text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-orange-800 disabled:opacity-50"
                  >
                    {requestingBoost ? 'Submitting...' : "I've Paid — Boost This Listing"}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

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

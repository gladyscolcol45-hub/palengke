import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return { error: 'Not authenticated', status: 401 };

  const supabaseAsUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser();
  if (userError || !userData || !userData.user) {
    return { error: 'Not authenticated', status: 401 };
  }

  const supabaseAdmin = createClient(supabaseUrl, secretKey);
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single();

  if (!profile || !profile.is_admin) {
    return { error: 'Not authorized', status: 403 };
  }

  return { userId: userData.user.id, supabaseAdmin };
}

async function loadPendingReviews(supabaseAdmin) {
  const pendingResult = await supabaseAdmin
    .from('bookings')
    .select('id, listing_id, seller_id, commission_amount, created_at, commission_proof_path, commission_payment_method')
    .eq('commission_status', 'pending_review')
    .order('created_at', { ascending: true });

  const pendingRows = pendingResult.data || [];
  const pendingReviews = [];

  for (let i = 0; i < pendingRows.length; i++) {
    const row = pendingRows[i];

    const listingResult = await supabaseAdmin
      .from('listings')
      .select('title')
      .eq('id', row.listing_id)
      .single();
    const listing = listingResult.data;

    const profileResult = await supabaseAdmin
      .from('profiles')
      .select('username, full_name')
      .eq('id', row.seller_id)
      .single();
    const p = profileResult.data;

    let paymentProofUrl = null;
    if (row.commission_proof_path) {
      const signedResult = await supabaseAdmin.storage
        .from('payment-proofs')
        .createSignedUrl(row.commission_proof_path, 3600);
      paymentProofUrl = signedResult.data ? signedResult.data.signedUrl : null;
    }

    pendingReviews.push({
      bookingId: row.id,
      listingId: row.listing_id,
      listingTitle: listing ? listing.title : 'Untitled listing',
      sellerId: row.seller_id,
      username: p ? p.username : null,
      fullName: p ? p.full_name : null,
      commissionAmount: row.commission_amount,
      paymentMethod: row.commission_payment_method || 'gcash',
      createdAt: row.created_at,
      paymentProofUrl,
    });
  }

  return pendingReviews;
}

async function loadHistory(supabaseAdmin) {
  const historyResult = await supabaseAdmin
    .from('bookings')
    .select('id, listing_id, seller_id, commission_status, commission_amount, updated_at')
    .eq('commission_status', 'paid')
    .order('updated_at', { ascending: false })
    .limit(30);

  const historyRows = historyResult.data || [];
  const history = [];

  for (let i = 0; i < historyRows.length; i++) {
    const row = historyRows[i];

    const listingResult = await supabaseAdmin
      .from('listings')
      .select('title')
      .eq('id', row.listing_id)
      .single();
    const listing = listingResult.data;

    const profileResult = await supabaseAdmin
      .from('profiles')
      .select('username, full_name')
      .eq('id', row.seller_id)
      .single();
    const p = profileResult.data;

    history.push({
      bookingId: row.id,
      listingTitle: listing ? listing.title : 'Untitled listing',
      username: p ? p.username : null,
      fullName: p ? p.full_name : null,
      commissionAmount: row.commission_amount,
      updatedAt: row.updated_at,
    });
  }

  return history;
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = auth;

  const pendingReviews = await loadPendingReviews(supabaseAdmin);
  const history = await loadHistory(supabaseAdmin);

  return NextResponse.json({ pendingReviews, history });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = auth;

  const body = await request.json();
  const { bookingId, sellerId, listingId, action } = body;

  if (!bookingId || !sellerId || !listingId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
  }

  if (action === 'approve') {
    const update = await supabaseAdmin
      .from('bookings')
      .update({ commission_status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', bookingId);

    if (update.error) {
      return NextResponse.json({ error: update.error.message }, { status: 500 });
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: sellerId,
      type: 'commission_approved',
      message: 'Your booking commission payment was confirmed. Thanks!',
      link: '/listing/' + listingId,
    });

    const pendingReviews = await loadPendingReviews(supabaseAdmin);
    const history = await loadHistory(supabaseAdmin);
    return NextResponse.json({ success: true, pendingReviews, history });
  }

  // action === 'reject'
  const update = await supabaseAdmin
    .from('bookings')
    .update({ commission_status: 'unpaid', commission_proof_path: null, updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (update.error) {
    return NextResponse.json({ error: update.error.message }, { status: 500 });
  }

  await supabaseAdmin.from('notifications').insert({
    user_id: sellerId,
    type: 'commission_rejected',
    message: 'We could not confirm your booking commission payment. Please double-check it and try again, or contact the admin.',
    link: '/listing/' + listingId,
  });

  const pendingReviews = await loadPendingReviews(supabaseAdmin);
  const history = await loadHistory(supabaseAdmin);
  return NextResponse.json({ success: true, pendingReviews, history });
}

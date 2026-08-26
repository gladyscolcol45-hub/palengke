import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

const BOOST_DAYS = 7;

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

async function loadPendingRequests(supabaseAdmin) {
  const pendingResult = await supabaseAdmin
    .from('boost_requests')
    .select('id, listing_id, user_id, created_at, payment_proof_path')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const pendingRows = pendingResult.data || [];
  const pendingRequests = [];

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
      .eq('id', row.user_id)
      .single();
    const p = profileResult.data;

    let paymentProofUrl = null;
    if (row.payment_proof_path) {
      const signedResult = await supabaseAdmin.storage
        .from('payment-proofs')
        .createSignedUrl(row.payment_proof_path, 3600);
      paymentProofUrl = signedResult.data ? signedResult.data.signedUrl : null;
    }

    pendingRequests.push({
      requestId: row.id,
      listingId: row.listing_id,
      listingTitle: listing ? listing.title : 'Untitled listing',
      userId: row.user_id,
      createdAt: row.created_at,
      username: p ? p.username : null,
      fullName: p ? p.full_name : null,
      paymentProofUrl,
    });
  }

  return pendingRequests;
}

async function loadRequestHistory(supabaseAdmin) {
  const historyResult = await supabaseAdmin
    .from('boost_requests')
    .select('id, listing_id, user_id, status, created_at, reviewed_at')
    .in('status', ['approved', 'rejected'])
    .order('reviewed_at', { ascending: false })
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
      .eq('id', row.user_id)
      .single();
    const p = profileResult.data;

    history.push({
      requestId: row.id,
      listingTitle: listing ? listing.title : 'Untitled listing',
      status: row.status,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
      username: p ? p.username : null,
      fullName: p ? p.full_name : null,
    });
  }

  return history;
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = auth;

  const pendingRequests = await loadPendingRequests(supabaseAdmin);
  const requestHistory = await loadRequestHistory(supabaseAdmin);

  return NextResponse.json({ pendingRequests, requestHistory });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = auth;

  const body = await request.json();
  const { requestId, listingId, userId, action } = body;

  if (!requestId || !listingId || !userId || !['approve_request', 'reject_request'].includes(action)) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
  }

  if (action === 'approve_request') {
    const boostedUntil = new Date(Date.now() + BOOST_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const listingUpdate = await supabaseAdmin
      .from('listings')
      .update({ boosted_until: boostedUntil })
      .eq('id', listingId);

    if (listingUpdate.error) {
      return NextResponse.json({ error: listingUpdate.error.message }, { status: 500 });
    }

    const requestUpdate = await supabaseAdmin
      .from('boost_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', requestId);

    if (requestUpdate.error) {
      return NextResponse.json({ error: requestUpdate.error.message }, { status: 500 });
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: 'boost_approved',
      message: `Your payment was confirmed — your listing is now boosted for ${BOOST_DAYS} days!`,
      link: '/listing/' + listingId,
    });

    const pendingRequests = await loadPendingRequests(supabaseAdmin);
    const requestHistory = await loadRequestHistory(supabaseAdmin);
    return NextResponse.json({ success: true, boostedUntil, pendingRequests, requestHistory });
  }

  // action === 'reject_request'
  const requestUpdate = await supabaseAdmin
    .from('boost_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', requestId);

  if (requestUpdate.error) {
    return NextResponse.json({ error: requestUpdate.error.message }, { status: 500 });
  }

  await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    type: 'boost_rejected',
    message: 'We could not confirm your boost payment. Please double-check it and try again from the listing page, or contact the admin.',
    link: '/listing/' + listingId,
  });

  const pendingRequests = await loadPendingRequests(supabaseAdmin);
  const requestHistory = await loadRequestHistory(supabaseAdmin);
  return NextResponse.json({ success: true, pendingRequests, requestHistory });
}

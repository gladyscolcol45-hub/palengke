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

async function loadPendingRequests(supabaseAdmin) {
  const pendingResult = await supabaseAdmin
    .from('verification_requests')
    .select('id, user_id, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const pendingRows = pendingResult.data || [];
  const pendingRequests = [];

  for (let i = 0; i < pendingRows.length; i++) {
    const row = pendingRows[i];
    const profileResult = await supabaseAdmin
      .from('profiles')
      .select('username, full_name')
      .eq('id', row.user_id)
      .single();

    const p = profileResult.data;
    pendingRequests.push({
      requestId: row.id,
      userId: row.user_id,
      createdAt: row.created_at,
      username: p ? p.username : null,
      fullName: p ? p.full_name : null,
    });
  }

  return pendingRequests;
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = auth;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  const pendingRequests = await loadPendingRequests(supabaseAdmin);

  if (!q) {
    return NextResponse.json({ users: [], pendingRequests });
  }

  const { data: users, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name, is_admin, verified_until')
    .ilike('username', `%${q}%`)
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: users || [], pendingRequests });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = auth;

  const body = await request.json();
  const { userId, action, requestId } = body;

  const validActions = ['verify', 'unverify', 'approve_request', 'reject_request'];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: 'Missing or invalid action' }, { status: 400 });
  }

  if ((action === 'verify' || action === 'unverify') && !userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }
  if ((action === 'approve_request' || action === 'reject_request') && (!requestId || !userId)) {
    return NextResponse.json({ error: 'Missing requestId or userId' }, { status: 400 });
  }

  if (action === 'verify') {
    const verifiedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_verified: true, verified_until: verifiedUntil })
      .eq('id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: 'verified',
      message: 'You are now a Verified Seller on Palengke for the next 30 days!',
      link: '/settings',
    });

    return NextResponse.json({ success: true, verifiedUntil });
  }

  if (action === 'unverify') {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_verified: false, verified_until: null })
      .eq('id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'approve_request') {
    const verifiedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const profileUpdate = await supabaseAdmin
      .from('profiles')
      .update({ is_verified: true, verified_until: verifiedUntil })
      .eq('id', userId);

    if (profileUpdate.error) {
      return NextResponse.json({ error: profileUpdate.error.message }, { status: 500 });
    }

    const requestUpdate = await supabaseAdmin
      .from('verification_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', requestId);

    if (requestUpdate.error) {
      return NextResponse.json({ error: requestUpdate.error.message }, { status: 500 });
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: 'verified',
      message: 'Your payment was confirmed — you are now a Verified Seller on Palengke for the next 30 days!',
      link: '/settings',
    });

    const pendingRequests = await loadPendingRequests(supabaseAdmin);
    return NextResponse.json({ success: true, verifiedUntil, pendingRequests });
  }

  // action === 'reject_request'
  const requestUpdate = await supabaseAdmin
    .from('verification_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', requestId);

  if (requestUpdate.error) {
    return NextResponse.json({ error: requestUpdate.error.message }, { status: 500 });
  }

  await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    type: 'verification_rejected',
    message: 'We could not confirm your Verified Seller payment. Please double-check it and try again from Settings, or contact the admin.',
    link: '/settings',
  });

  const pendingRequests = await loadPendingRequests(supabaseAdmin);
  return NextResponse.json({ success: true, pendingRequests });
}

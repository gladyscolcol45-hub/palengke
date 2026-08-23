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

const PROFILE_COLUMNS =
  'id, username, full_name, email, phone, is_admin, verified_until, created_at, banned_until';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = auth;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  const pendingRequests = await loadPendingRequests(supabaseAdmin);

  if (!q) {
    // No search yet — show every account that has signed up, most recent
    // first. This is the admin's record of all signups.
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: users || [], pendingRequests, allSignups: true });
  }

  const { data: users, error } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_COLUMNS)
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
  const { supabaseAdmin, userId: adminUserId } = auth;

  const body = await request.json();
  const { userId, action, requestId } = body;

  const validActions = ['verify', 'unverify', 'approve_request', 'reject_request', 'delete', 'ban', 'unban'];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: 'Missing or invalid action' }, { status: 400 });
  }

  if (
    (action === 'verify' || action === 'unverify' || action === 'delete' || action === 'ban' || action === 'unban') &&
    !userId
  ) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }
  if ((action === 'approve_request' || action === 'reject_request') && (!requestId || !userId)) {
    return NextResponse.json({ error: 'Missing requestId or userId' }, { status: 400 });
  }

  if (action === 'delete') {
    if (userId === adminUserId) {
      return NextResponse.json(
        { error: "You can't delete your own account from here." },
        { status: 400 }
      );
    }

    // Same full cleanup as the self-service "Delete account" in Settings,
    // just triggered by an admin instead of the user themselves.
    await supabaseAdmin.from('messages').delete().eq('sender_id', userId);
    await supabaseAdmin.from('reviews').delete().eq('reviewer_id', userId);
    await supabaseAdmin.from('reviews').delete().eq('reviewed_user_id', userId);
    await supabaseAdmin.from('reports').delete().eq('reporter_id', userId);
    await supabaseAdmin.from('reports').delete().eq('reported_user_id', userId);
    await supabaseAdmin.from('blocks').delete().eq('blocker_id', userId);
    await supabaseAdmin.from('blocks').delete().eq('blocked_id', userId);
    await supabaseAdmin.from('chats').delete().or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
    await supabaseAdmin.from('listings').delete().eq('seller_id', userId);

    const filesResult = await supabaseAdmin.storage.from('listing-photos').list(userId);
    if (filesResult.data && filesResult.data.length > 0) {
      const paths = filesResult.data.map((f) => `${userId}/${f.name}`);
      await supabaseAdmin.storage.from('listing-photos').remove(paths);
    }

    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      return NextResponse.json({ error: deleteUserError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'ban') {
    if (userId === adminUserId) {
      return NextResponse.json({ error: "You can't ban your own account." }, { status: 400 });
    }

    const bannedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Ban at the Supabase Auth level so they're actually blocked from
    // logging in / staying logged in, not just hidden in the UI.
    const banResult = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: '24h',
    });
    if (banResult.error) {
      return NextResponse.json({ error: banResult.error.message }, { status: 500 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ banned_until: bannedUntil })
      .eq('id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, bannedUntil });
  }

  if (action === 'unban') {
    const banResult = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
    });
    if (banResult.error) {
      return NextResponse.json({ error: banResult.error.message }, { status: 500 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ banned_until: null })
      .eq('id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
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

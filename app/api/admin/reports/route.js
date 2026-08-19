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

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = auth;

  const { data: reportRows, error: reportsError } = await supabaseAdmin
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (reportsError) {
    return NextResponse.json({ error: reportsError.message }, { status: 500 });
  }

  const results = [];
  for (const row of reportRows || []) {
    const [reporterResult, reportedResult, listingResult] = await Promise.all([
      supabaseAdmin.from('profiles').select('username, full_name').eq('id', row.reporter_id).single(),
      supabaseAdmin.from('profiles').select('username, full_name').eq('id', row.reported_user_id).single(),
      supabaseAdmin.from('listings').select('title, status').eq('id', row.listing_id).single(),
    ]);

    results.push({
      id: row.id,
      reason: row.reason,
      details: row.details,
      createdAt: row.created_at,
      reporterId: row.reporter_id,
      reporterName: reporterResult.data ? (reporterResult.data.full_name || reporterResult.data.username) : 'Unknown user',
      reportedUserId: row.reported_user_id,
      reportedUserName: reportedResult.data ? (reportedResult.data.full_name || reportedResult.data.username) : 'Unknown user',
      listingId: row.listing_id,
      listingTitle: listingResult.data ? listingResult.data.title : 'Listing not found',
      listingStatus: listingResult.data ? listingResult.data.status : null,
    });
  }

  return NextResponse.json({ reports: results });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = auth;

  const body = await request.json();
  const { reportId, action } = body;

  if (!reportId || !action) {
    return NextResponse.json({ error: 'Missing reportId or action' }, { status: 400 });
  }

  const { data: report } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  if (action === 'dismiss') {
    await supabaseAdmin.from('reports').delete().eq('id', reportId);
    return NextResponse.json({ success: true });
  }

  if (action === 'remove_listing') {
    await supabaseAdmin.from('listings').update({ status: 'removed' }).eq('id', report.listing_id);

    const { data: removedListing } = await supabaseAdmin
      .from('listings')
      .select('seller_id, title')
      .eq('id', report.listing_id)
      .single();

    if (removedListing) {
      await supabaseAdmin.from('notifications').insert({
        user_id: removedListing.seller_id,
        type: 'listing_removed',
        message: `Your listing "${removedListing.title}" was removed for violating our policies.`,
        link: '/listing/' + report.listing_id,
      });
    }

    await supabaseAdmin.from('reports').delete().eq('id', reportId);
    return NextResponse.json({ success: true });
  }

  if (action === 'ban_user') {
    const bannedUserId = report.reported_user_id;

    // Same full-deletion steps as the account deletion flow.
    await supabaseAdmin.from('messages').delete().eq('sender_id', bannedUserId);
    await supabaseAdmin.from('reviews').delete().eq('reviewer_id', bannedUserId);
    await supabaseAdmin.from('reviews').delete().eq('reviewed_user_id', bannedUserId);
    await supabaseAdmin.from('reports').delete().eq('reporter_id', bannedUserId);
    await supabaseAdmin.from('reports').delete().eq('reported_user_id', bannedUserId);
    await supabaseAdmin.from('blocks').delete().eq('blocker_id', bannedUserId);
    await supabaseAdmin.from('blocks').delete().eq('blocked_id', bannedUserId);
    await supabaseAdmin.from('chats').delete().or(`buyer_id.eq.${bannedUserId},seller_id.eq.${bannedUserId}`);
    await supabaseAdmin.from('listings').delete().eq('seller_id', bannedUserId);

    const filesResult = await supabaseAdmin.storage.from('listing-photos').list(bannedUserId);
    if (filesResult.data && filesResult.data.length > 0) {
      const paths = filesResult.data.map((f) => `${bannedUserId}/${f.name}`);
      await supabaseAdmin.storage.from('listing-photos').remove(paths);
    }

    await supabaseAdmin.from('profiles').delete().eq('id', bannedUserId);
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(bannedUserId);

    if (deleteUserError) {
      return NextResponse.json({ error: deleteUserError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

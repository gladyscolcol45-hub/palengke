import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Fully deletes a user's account: their login, profile, listings, chats,
// messages, reviews, reports, blocks, and uploaded photos.
// This runs server-side only, using the Supabase secret key, which is
// never exposed to the browser.
export async function POST(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json(
      { error: 'Server is missing SUPABASE_SECRET_KEY. Add it to .env.local (and Vercel) and restart the server.' },
      { status: 500 }
    );
  }

  // Verify who is actually making the request, using their own access token.
  const supabaseAsUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser();

  if (userError || !userData || !userData.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = userData.user.id;

  // Admin client (secret key) — bypasses RLS, can delete the login itself.
  const supabaseAdmin = createClient(supabaseUrl, secretKey);

  // Delete everything tied to this user first, so we don't depend on
  // whatever cascade rules may or may not exist on each table.
  await supabaseAdmin.from('messages').delete().eq('sender_id', userId);
  await supabaseAdmin.from('reviews').delete().eq('reviewer_id', userId);
  await supabaseAdmin.from('reviews').delete().eq('reviewed_user_id', userId);
  await supabaseAdmin.from('reports').delete().eq('reporter_id', userId);
  await supabaseAdmin.from('reports').delete().eq('reported_user_id', userId);
  await supabaseAdmin.from('blocks').delete().eq('blocker_id', userId);
  await supabaseAdmin.from('blocks').delete().eq('blocked_id', userId);
  await supabaseAdmin.from('chats').delete().or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
  await supabaseAdmin.from('listings').delete().eq('seller_id', userId);

  // Best-effort cleanup of their uploaded photos in storage.
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

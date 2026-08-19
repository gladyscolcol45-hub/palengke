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

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  if (!q) {
    return NextResponse.json({ users: [] });
  }

  const { data: users, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name, is_admin, verified_until')
    .ilike('username', `%${q}%`)
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: users || [] });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = auth;

  const body = await request.json();
  const { userId, action } = body;

  if (!userId || !['verify', 'unverify'].includes(action)) {
    return NextResponse.json({ error: 'Missing userId or action' }, { status: 400 });
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

  // action === 'unverify'
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ is_verified: false, verified_until: null })
    .eq('id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

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

  return { supabaseAdmin };
}

function generateTempPassword() {
  // Easy to read aloud/type over phone/Messenger: no ambiguous characters
  // like 0/O or 1/l/I.
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = auth;

  const { data: requests, error } = await supabaseAdmin
    .from('password_reset_requests')
    .select('id, user_id, username, phone, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: requests || [] });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabaseAdmin } = auth;

  const body = await request.json();
  const { requestId, userId, action } = body;

  if (!requestId || !action || (action === 'approve' && !userId)) {
    return NextResponse.json({ error: 'Missing requestId, userId, or action' }, { status: 400 });
  }

  if (action === 'reject') {
    const { error } = await supabaseAdmin
      .from('password_reset_requests')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'approve') {
    const tempPassword = generateTempPassword();

    const updateResult = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (updateResult.error) {
      return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
    }

    await supabaseAdmin
      .from('password_reset_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', requestId);

    // The temp password is only ever returned here, once, to the admin —
    // it's never stored anywhere. It's on the admin to relay it to the user
    // directly (phone/Messenger, etc.) after confirming who they are.
    return NextResponse.json({ success: true, tempPassword });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

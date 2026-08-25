import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

async function emailTempPasswordToUser(email, username, tempPassword) {
  if (!resendApiKey || !email) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Palengke <noreply@palengkeapp.com>',
        to: [email],
        subject: 'Your Palengke password has been reset',
        text: `Hi ${username},\n\nYour Palengke password was reset. Here is a temporary password:\n\n${tempPassword}\n\nLog in at https://palengke-ten.vercel.app/login with your username and this temporary password, then set your own password from Settings right away.\n\nIf you didn't request this, contact us at palengke.app23@gmail.com.`,
      }),
    });
    return response.ok;
  } catch (e) {
    return false;
  }
}

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
    .select('id, user_id, username, email, phone, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Recently decided ones (approved or rejected), most recent first, so the
  // page isn't only ever showing what's still pending.
  const { data: history, error: historyError } = await supabaseAdmin
    .from('password_reset_requests')
    .select('id, username, email, status, created_at, reviewed_at')
    .in('status', ['approved', 'rejected'])
    .order('reviewed_at', { ascending: false })
    .limit(30);

  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 });
  }

  return NextResponse.json({ requests: requests || [], history: history || [] });
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

    const profileResult = await supabaseAdmin
      .from('profiles')
      .select('username, email')
      .eq('id', userId)
      .single();
    const profile = profileResult.data;

    // Try to email the user directly. If this fails (no email on file, or
    // Resend can't deliver to this address yet), the temp password is still
    // returned below so the admin can relay it themselves as a fallback —
    // it's only ever shown here once either way.
    const emailed = profile
      ? await emailTempPasswordToUser(profile.email, profile.username, tempPassword)
      : false;

    return NextResponse.json({ success: true, tempPassword, emailed });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

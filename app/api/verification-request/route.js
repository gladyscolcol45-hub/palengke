import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

const ADMIN_EMAIL = 'palengke.app23@gmail.com';

async function requireUser(request) {
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
  return { userId: userData.user.id, supabaseAdmin };
}

async function sendEmail(to, subject, text) {
  if (!resendApiKey) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Palengke <noreply@palengkeapp.com>',
        to: [to],
        subject,
        text,
      }),
    });
    return response.ok;
  } catch (e) {
    return false;
  }
}

// Called after the browser has already inserted the verification_requests
// row and the in-app notification for admins (that part uses the anon key
// and works fine under RLS). This route's only job is the two emails, which
// need the Resend key and so have to run server-side. Best-effort either
// way — the request itself is already saved by the time this runs, so a
// failure here just means one fewer email, not a lost request.
export async function POST(request) {
  const auth = await requireUser(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { userId, supabaseAdmin } = auth;

  const profileResult = await supabaseAdmin
    .from('profiles')
    .select('username, full_name, email')
    .eq('id', userId)
    .single();
  const profile = profileResult.data;
  const sellerName = (profile && (profile.full_name || profile.username)) || 'A seller';

  const adminEmailed = await sendEmail(
    ADMIN_EMAIL,
    `Palengke: ${sellerName} paid for Verified Seller`,
    `${sellerName} says they sent the ₱99 GCash payment and is requesting the Verified Seller badge.\n\nConfirm the payment came in, then approve or reject it here:\nhttps://palengkeapp.com/admin/users`
  );

  let sellerEmailed = false;
  if (profile && profile.email) {
    sellerEmailed = await sendEmail(
      profile.email,
      "We've received your Verified Seller payment request",
      `Hi ${sellerName},\n\nWe got your request for the Verified Seller badge. We'll confirm your ₱99 GCash payment and activate it, usually within a day.\n\nYou'll get a notification once it's confirmed. If anything's off, contact us at palengke.app23@gmail.com.`
    );
  }

  return NextResponse.json({ success: true, adminEmailed, sellerEmailed });
}

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

// Same best-effort pattern as /api/verification-request and
// /api/boost-request: the bookings row is already updated to
// commission_status='pending_review' and the in-app admin notification
// already saved by the browser before this runs. This route just sends the
// two emails, which need the Resend key.
export async function POST(request) {
  const auth = await requireUser(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { userId, supabaseAdmin } = auth;

  const body = await request.json().catch(() => ({}));
  const listingTitle = body.listingTitle || 'a booking';
  const bookingId = body.bookingId;

  let commissionAmount = null;
  if (bookingId) {
    const bookingResult = await supabaseAdmin
      .from('bookings')
      .select('commission_amount')
      .eq('id', bookingId)
      .single();
    commissionAmount = bookingResult.data ? bookingResult.data.commission_amount : null;
  }
  const amountText = commissionAmount != null ? `₱${Number(commissionAmount).toLocaleString()}` : 'the';

  const profileResult = await supabaseAdmin
    .from('profiles')
    .select('username, full_name, email')
    .eq('id', userId)
    .single();
  const profile = profileResult.data;
  const sellerName = (profile && (profile.full_name || profile.username)) || 'A seller';

  const adminEmailed = await sendEmail(
    ADMIN_EMAIL,
    `Palengke: ${sellerName} paid a booking commission for "${listingTitle}"`,
    `${sellerName} says they sent the ${amountText} GCash commission payment for a completed booking on "${listingTitle}".\n\nConfirm the payment came in, then approve or reject it here:\nhttps://palengkeapp.com/admin/bookings`
  );

  let sellerEmailed = false;
  if (profile && profile.email) {
    sellerEmailed = await sendEmail(
      profile.email,
      "We've received your booking commission payment",
      `Hi ${sellerName},\n\nWe got your commission payment for "${listingTitle}". We'll confirm it, usually within a day.\n\nYou'll get a notification once it's confirmed. If anything's off, contact us at palengke.app23@gmail.com.`
    );
  }

  return NextResponse.json({ success: true, adminEmailed, sellerEmailed });
}

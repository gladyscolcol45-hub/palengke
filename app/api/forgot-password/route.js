import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export async function POST(request) {
  const body = await request.json();
  const username = (body.username || '').trim().toLowerCase();

  // Always return the same generic message whether or not the username
  // exists, so this can't be used to check which usernames are registered.
  const genericResponse = NextResponse.json({
    success: true,
    message: "If that username exists, we've received your request. An admin will reach out to help you reset your password.",
  });

  if (!username) return genericResponse;

  const supabaseAdmin = createClient(supabaseUrl, secretKey);

  const profileResult = await supabaseAdmin
    .from('profiles')
    .select('id, username, phone')
    .ilike('username', username)
    .maybeSingle();

  const profile = profileResult.data;
  if (!profile) return genericResponse;

  // Don't pile up duplicate pending requests if someone taps submit twice.
  const existingResult = await supabaseAdmin
    .from('password_reset_requests')
    .select('id')
    .eq('user_id', profile.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (!existingResult.data) {
    await supabaseAdmin.from('password_reset_requests').insert({
      user_id: profile.id,
      username: profile.username,
      phone: profile.phone,
    });

    // Best-effort: let admins know a request is waiting, same as the
    // Verified Seller request flow. If this fails the request itself was
    // still saved, so an admin will still see it next time they check
    // Password resets.
    const adminsResult = await supabaseAdmin.from('profiles').select('id').eq('is_admin', true);
    const admins = adminsResult.data || [];
    for (let i = 0; i < admins.length; i++) {
      await supabaseAdmin.from('notifications').insert({
        user_id: admins[i].id,
        type: 'password_reset_requested',
        message: profile.username + ' requested a password reset — review it in Password resets.',
        link: '/admin/password-resets',
      });
    }
  }

  return genericResponse;
}

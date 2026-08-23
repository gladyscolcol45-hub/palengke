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
  }

  return genericResponse;
}

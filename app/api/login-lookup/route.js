import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

// Lets the login page accept either a username or an email address. Emails
// aren't the real Supabase Auth login (that's still the internal
// username@palengke.local pattern under the hood) — this route just looks
// up which username a given email belongs to, server-side, so the browser
// never needs direct read access to other people's emails.
export async function POST(request) {
  const body = await request.json();
  const identifier = (body.identifier || '').trim().toLowerCase();

  if (!identifier) {
    return NextResponse.json({ authEmail: null });
  }

  const supabaseAdmin = createClient(supabaseUrl, secretKey);

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('email', identifier)
    .maybeSingle();

  if (!profile || !profile.username) {
    return NextResponse.json({ authEmail: null });
  }

  return NextResponse.json({ authEmail: `${profile.username}@palengke.local` });
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

// Signup now only asks for email + password. A username still exists under
// the hood (used for login-by-username, notifications, and admin search),
// so this route generates one automatically from the email address and
// makes sure it's unique before creating the account.
export async function POST(request) {
  const body = await request.json();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, secretKey);

  // Prevent duplicate accounts on the same email address.
  const existingResult = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingResult.data) {
    return NextResponse.json(
      { error: 'That email is already registered. Try logging in instead.' },
      { status: 400 }
    );
  }

  // Build a base username from the email (letters/numbers/underscore only),
  // padding it out if it ends up too short.
  let base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (base.length < 3) base = 'user' + base;
  base = base.slice(0, 16);

  let username = base;
  let suffix = 0;
  while (suffix < 50) {
    const checkResult = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (!checkResult.data) break;
    suffix += 1;
    username = `${base}${suffix}`;
  }

  const fakeEmail = `${username}@palengke.local`;

  const createResult = await supabaseAdmin.auth.admin.createUser({
    email: fakeEmail,
    password,
    email_confirm: true,
  });

  if (createResult.error) {
    return NextResponse.json({ error: createResult.error.message }, { status: 500 });
  }

  const newUserId = createResult.data.user.id;

  await supabaseAdmin
    .from('profiles')
    .update({ username, email })
    .eq('id', newUserId);

  return NextResponse.json({ success: true, authEmail: fakeEmail });
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

// Where "Report a problem" messages get emailed. Change this if the contact
// address ever changes again — it only needs to be updated in this one spot.
const REPORT_TO_EMAIL = 'palengke.app23@gmail.com';

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

export async function POST(request) {
  const auth = await requireUser(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { userId, supabaseAdmin } = auth;

  const body = await request.json();
  const message = (body.message || '').trim();

  if (!message) {
    return NextResponse.json({ error: 'Please describe the problem before sending.' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'That message is too long (2000 characters max).' }, { status: 400 });
  }

  const profileResult = await supabaseAdmin
    .from('profiles')
    .select('username, full_name')
    .eq('id', userId)
    .single();
  const profile = profileResult.data;
  const username = profile ? profile.username : null;

  const insertResult = await supabaseAdmin
    .from('problem_reports')
    .insert({ user_id: userId, username, message })
    .select()
    .single();

  if (insertResult.error) {
    return NextResponse.json({ error: 'Something went wrong saving your report. Please try again.' }, { status: 500 });
  }

  const reportId = insertResult.data.id;
  let emailed = false;

  // Best-effort: the report is already saved above, so a failure here (e.g.
  // Resend not configured yet, or its sandbox mode blocking this recipient)
  // never loses the report — it just means the admin checks Supabase instead
  // of their inbox for this one.
  if (resendApiKey) {
    try {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Palengke <onboarding@resend.dev>',
          to: [REPORT_TO_EMAIL],
          subject: `Palengke problem report from ${username || 'a user'}`,
          text: `From: ${username || 'unknown user'} (user id ${userId})\n\n${message}`,
        }),
      });
      emailed = emailResponse.ok;
    } catch (e) {
      emailed = false;
    }
  }

  if (emailed) {
    await supabaseAdmin.from('problem_reports').update({ emailed: true }).eq('id', reportId);
  }

  return NextResponse.json({ success: true, emailed });
}

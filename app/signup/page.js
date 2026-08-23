'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSignup(e) {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      setError('Username must be 3-20 characters: letters, numbers, underscore only.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!/^09\d{9}$/.test(cleanPhone)) {
      setError('Enter a valid phone number, e.g. 09XX XXX XXXX. We only use this to help you back into your account if you forget your password.');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const fakeEmail = `${cleanUsername}@palengke.local`;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: fakeEmail,
      password,
    });

    if (signUpError) {
      setSaving(false);
      if (signUpError.message.includes('already registered')) {
        setError('That username is already taken.');
      } else {
        setError(signUpError.message);
      }
      return;
    }

    if (data.user) {
      await supabase
        .from('profiles')
        .update({ username: cleanUsername, phone: cleanPhone })
        .eq('id', data.user.id);
    }

    setSaving(false);
    router.push('/');
  }

  return (
    <div className="max-w-sm mx-auto py-12">
      <h1 className="text-2xl font-bold mb-2">Create your Palengke account</h1>
      <p className="text-stone-700 text-sm mb-1 font-medium">How to sign up?</p>
      <p className="text-stone-500 text-sm mb-6">
        Make a username and choose your own password. No email needed.
      </p>
      <form onSubmit={handleSignup} className="flex flex-col gap-1">
        <input
          required
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border border-stone-300 rounded-md px-3 py-2"
        />
        <p className="text-xs text-stone-400 mb-2">3-20 characters: letters, numbers, and underscores only. No spaces.</p>

        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-stone-300 rounded-md px-3 py-2"
        />
        <p className="text-xs text-stone-400 mb-2">At least 6 characters.</p>

        <input
          type="tel"
          required
          placeholder="Phone number (09XX XXX XXXX)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border border-stone-300 rounded-md px-3 py-2"
        />
        <p className="text-xs text-stone-400 mb-2">
          Only used to help you get back into your account if you forget your password &mdash;
          never shown to other users.
        </p>

        <button
          type="submit"
          disabled={saving}
          className="bg-green-700 text-white rounded-md py-2 font-semibold hover:bg-green-800 disabled:opacity-50 mt-2"
        >
          {saving ? 'Creating account…' : 'Create account'}
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>
      <p className="text-sm text-stone-500 mt-4">
        Already have an account? <a href="/login" className="text-green-700 underline">Log in</a>
      </p>
    </div>
  );
}

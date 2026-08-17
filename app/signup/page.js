'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      await supabase.from('profiles').update({ username: cleanUsername }).eq('id', data.user.id);
    }

    setSaving(false);
    router.push('/');
  }

  return (
    <div className="max-w-sm mx-auto py-12">
      <h1 className="text-2xl font-bold mb-6">Sign up for Palengke</h1>
      <form onSubmit={handleSignup} className="flex flex-col gap-3">
        <input
          required
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border border-stone-300 rounded-md px-3 py-2"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-stone-300 rounded-md px-3 py-2"
        />
        <button
          type="submit"
          disabled={saving}
          className="bg-green-700 text-white rounded-md py-2 font-semibold hover:bg-green-800 disabled:opacity-50"
        >
          {saving ? 'Signing up…' : 'Sign up'}
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>
      <p className="text-sm text-stone-500 mt-4">
        Don't have an account? <a href="/login" className="text-green-700 underline">Log in</a>
      </p>
    </div>
  );
}

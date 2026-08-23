'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import PasswordInput from '@/components/PasswordInput';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const cleanIdentifier = identifier.trim().toLowerCase();
    let fakeEmail;

    if (cleanIdentifier.includes('@')) {
      // Logging in with an email address — look up which username it
      // belongs to first, then log in the same way as always under the hood.
      const lookupResponse = await fetch('/api/login-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanIdentifier }),
      });
      const lookupResult = await lookupResponse.json();
      fakeEmail = lookupResult.authEmail;
    } else {
      fakeEmail = `${cleanIdentifier}@palengke.local`;
    }

    if (!fakeEmail) {
      setSaving(false);
      setError('Incorrect username/email or password.');
      return;
    }

    const supabase = createClient();

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password,
    });

    setSaving(false);

    if (loginError) {
      setError('Incorrect username/email or password.');
      return;
    }

    router.push('/');
  }

  return (
    <div className="max-w-sm mx-auto py-12">
      <h1 className="text-2xl font-bold mb-6">Log in to Palengke</h1>
      <form onSubmit={handleLogin} className="flex flex-col gap-3">
        <input
          required
          placeholder="Username or email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="border border-stone-300 rounded-md px-3 py-2"
        />
        <PasswordInput
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
          {saving ? 'Logging in…' : 'Log in'}
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>
      <p className="text-sm text-stone-500 mt-4">
        Don't have an account? <a href="/signup" className="text-green-700 underline">Sign up</a>
      </p>
      <p className="text-sm text-stone-500 mt-2">
        <a href="/forgot-password" className="text-green-700 underline">Forgot your password?</a>
      </p>
    </div>
  );
}

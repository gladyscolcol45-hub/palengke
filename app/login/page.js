'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import PasswordInput from '@/components/PasswordInput';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const cleanUsername = username.trim().toLowerCase();
    const fakeEmail = `${cleanUsername}@palengke.local`;
    const supabase = createClient();

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password,
    });

    setSaving(false);

    if (loginError) {
      setError('Incorrect username or password.');
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
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
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

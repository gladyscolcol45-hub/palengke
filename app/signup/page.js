'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import PasswordInput from '@/components/PasswordInput';

export default function SignupPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSignup(e) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    setSaving(true);

    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    });

    let result = {};
    try {
      result = await response.json();
    } catch (e2) {
      result = {};
    }

    if (!response.ok) {
      setSaving(false);
      setError(result.error || 'Something went wrong. Please try again.');
      return;
    }

    const supabase = createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: result.authEmail,
      password,
    });

    setSaving(false);

    if (loginError) {
      setError('Account created, but something went wrong logging you in. Please log in from the login page.');
      return;
    }

    router.push('/');
  }

  return (
    <div className="max-w-sm mx-auto py-12">
      <h1 className="text-2xl font-bold mb-2">Create your Palengke account</h1>
      <p className="text-stone-700 text-sm mb-1 font-medium">How to sign up?</p>
      <p className="text-stone-500 text-sm mb-6">
        Enter your email and choose a password. You'll get a username automatically, and you can log in later with either your username or your email.
      </p>
      <form onSubmit={handleSignup} className="flex flex-col gap-1">
        <input
          type="email"
          required
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-stone-300 rounded-md px-3 py-2"
        />
        <p className="text-xs text-stone-400 mb-2">
          Used to log in and to help you get back into your account if you forget your password.
        </p>

        <PasswordInput
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-stone-300 rounded-md px-3 py-2"
        />
        <p className="text-xs text-stone-400 mb-2">At least 6 characters.</p>

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

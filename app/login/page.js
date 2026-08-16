'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();

    // Magic link login - no password needed. Swap for OAuth (Google/Facebook)
    // by calling supabase.auth.signInWithOAuth({ provider: 'google' }) instead.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="max-w-sm mx-auto text-center py-12">
        <p className="text-lg font-semibold">Check your email</p>
        <p className="text-stone-500 mt-2">We sent a login link to {email}.</p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto py-12">
      <h1 className="text-2xl font-bold mb-6">Log in to Palengke</h1>
      <form onSubmit={handleLogin} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-stone-300 rounded-md px-3 py-2"
        />
        <button
          type="submit"
          className="bg-green-700 text-white rounded-md py-2 font-semibold hover:bg-green-800"
        >
          Send login link
        </button>
        
<button
  onClick={() => setActiveCategory(null)}
  className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
    activeCategory === null ? 'bg-orange-700 text-white' : 'bg-stone-100 text-stone-600'
  }`}
>
  All
</button>
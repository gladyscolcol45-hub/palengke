'use client';

import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim()) return;

    setSending(true);
    await fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim() }),
    });
    setSending(false);
    setSent(true);
  }

  return (
    <div className="max-w-sm mx-auto py-12">
      <h1 className="text-2xl font-bold mb-2">Forgot your password?</h1>

      {sent ? (
        <p className="text-stone-700 text-sm">
          If that username exists, we&apos;ve received your request. An admin will reach out to
          you directly (using the phone number on your profile, if you set one) to help you get
          back in.
        </p>
      ) : (
        <>
          <p className="text-stone-500 text-sm mb-6">
            Enter your username and an admin will help you reset your password.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              required
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border border-stone-300 rounded-md px-3 py-2"
            />
            <button
              type="submit"
              disabled={sending}
              className="bg-green-700 text-white rounded-md py-2 font-semibold hover:bg-green-800 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send request'}
            </button>
          </form>
        </>
      )}

      <p className="text-sm text-stone-500 mt-4">
        <a href="/login" className="text-green-700 underline">Back to log in</a>
      </p>
    </div>
  );
}

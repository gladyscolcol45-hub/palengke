'use client';

import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!identifier.trim()) return;

    setSending(true);
    await fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifier.trim() }),
    });
    setSending(false);
    setSent(true);
  }

  return (
    <div className="max-w-sm mx-auto py-12">
      <h1 className="text-2xl font-bold mb-2">Forgot your password?</h1>

      {sent ? (
        <p className="text-stone-700 text-sm">
          If that account exists, we&apos;ve received your request. Once an admin verifies it,
          a temporary password will be emailed to the address on your account &mdash; check your
          inbox (and spam folder) for it.
        </p>
      ) : (
        <>
          <p className="text-stone-500 text-sm mb-6">
            Enter your username or email and an admin will help you reset your password.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              required
              placeholder="Username or email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
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

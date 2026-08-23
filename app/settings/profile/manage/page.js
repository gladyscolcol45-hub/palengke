'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function ManageAccountPage() {
  const router = useRouter();
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  async function handleDeleteAccount() {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;

    const confirmed = window.confirm(
      'This will permanently delete your account: your login, profile, listings, chats, and reviews. This cannot be undone. Continue?'
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    const supabase = createClient();

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

    if (!accessToken) {
      setDeleting(false);
      setDeleteError('You need to be logged in to do this.');
      return;
    }

    const response = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken },
    });

    let result = {};
    try {
      result = await response.json();
    } catch (e) {
      result = {};
    }

    if (!response.ok) {
      setDeleting(false);
      setDeleteError(result.error || 'Something went wrong. Please try again.');
      return;
    }

    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <a href="/settings/profile" className="text-sm text-green-700 hover:underline">&larr; Back to Profile Details</a>
      <h1 className="text-2xl font-bold mb-6 mt-2">Manage account</h1>

      <div className="border border-red-200 rounded-lg p-4 bg-red-50">
        <h2 className="text-lg font-bold mb-1 text-red-800">Delete account</h2>
        <p className="text-sm text-red-700 mb-3">
          This will permanently delete your account: your login, profile, listings, chats, messages, reviews, reports, and photos. This cannot be undone.
        </p>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Type DELETE to confirm
        </label>
        <input
          value={deleteConfirmText}
          onChange={function (e) { setDeleteConfirmText(e.target.value); }}
          className="w-full border border-stone-300 rounded-md px-3 py-2 mb-3"
          placeholder="DELETE"
        />
        {deleteError && <p className="text-red-600 text-sm mb-2">{deleteError}</p>}
        <button
          onClick={handleDeleteAccount}
          disabled={deleting || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
          className="bg-red-600 text-white rounded-md px-4 py-2 font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deleting ? 'Deleting...' : 'Delete my account'}
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function AdminUsersPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;
      if (!user) {
        router.push('/login');
        return;
      }

      const profileResult = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      setIsAdmin(!!(profileResult.data && profileResult.data.is_admin));
      setChecking(false);
    }

    init();
  }, [router]);

  async function handleSearch(e) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

    const response = await fetch('/api/admin/users?q=' + encodeURIComponent(query), {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    const result = await response.json();
    setSearching(false);

    if (!response.ok) {
      setError(result.error || 'Something went wrong.');
      return;
    }

    setUsers(result.users || []);
  }

  async function handleToggleVerified(userId, currentlyVerified) {
    setActioningId(userId);
    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({ userId, verified: !currentlyVerified }),
    });

    const result = await response.json();
    setActioningId(null);

    if (!response.ok) {
      alert(result.error || 'Something went wrong.');
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_verified: !currentlyVerified } : u))
    );
  }

  if (checking) {
    return <p className="text-stone-400 text-sm">Loading...</p>;
  }

  if (!isAdmin) {
    return <p className="text-stone-400 text-sm">You don&apos;t have access to this page.</p>;
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Verify sellers</h1>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username"
          className="flex-1 border border-stone-300 rounded-md px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={searching}
          className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {users.length === 0 ? (
        <p className="text-stone-400 text-sm">No users found. Try searching a username above.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between border border-stone-200 rounded-lg p-3"
            >
              <div>
                <p className="font-medium flex items-center gap-1">
                  {u.username || 'Unnamed user'}
                  {u.is_verified && (
                    <span className="text-green-700" title="Verified Seller">✓</span>
                  )}
                  {u.is_admin && (
                    <span className="text-xs text-stone-400 ml-1">(admin)</span>
                  )}
                </p>
                {u.full_name && <p className="text-sm text-stone-500">{u.full_name}</p>}
              </div>
              <button
                onClick={() => handleToggleVerified(u.id, u.is_verified)}
                disabled={actioningId === u.id}
                className={`text-sm rounded-md px-3 py-1.5 disabled:opacity-50 ${
                  u.is_verified
                    ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    : 'bg-green-700 text-white hover:bg-green-800'
                }`}
              >
                {actioningId === u.id
                  ? 'Updating...'
                  : u.is_verified
                  ? 'Remove verified'
                  : 'Make verified'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

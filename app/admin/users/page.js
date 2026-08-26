'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

function isCurrentlyVerified(verifiedUntil) {
  return !!verifiedUntil && new Date(verifiedUntil) > new Date();
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isCurrentlyBanned(bannedUntil) {
  return !!bannedUntil && new Date(bannedUntil) > new Date();
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);

  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestHistory, setRequestHistory] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [actioningRequestId, setActioningRequestId] = useState(null);

  const [allUsers, setAllUsers] = useState([]);
  const [allUsersLoading, setAllUsersLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [banningId, setBanningId] = useState(null);
  const [signupsQuery, setSignupsQuery] = useState('');

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

      const admin = !!(profileResult.data && profileResult.data.is_admin);
      setIsAdmin(admin);
      setChecking(false);

      if (admin) {
        loadPending();
        loadAllUsers();
      }
    }

    async function loadPending() {
      setPendingLoading(true);
      const supabase2 = createClient();
      const sessionResult = await supabase2.auth.getSession();
      const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

      const response = await fetch('/api/admin/users', {
        headers: { Authorization: 'Bearer ' + accessToken },
      });
      const result = await response.json();
      setPendingLoading(false);

      if (response.ok) {
        setPendingRequests(result.pendingRequests || []);
        setRequestHistory(result.requestHistory || []);
      }
    }

    async function loadAllUsers() {
      setAllUsersLoading(true);
      const supabase3 = createClient();
      const sessionResult = await supabase3.auth.getSession();
      const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

      const response = await fetch('/api/admin/users', {
        headers: { Authorization: 'Bearer ' + accessToken },
      });
      const result = await response.json();
      setAllUsersLoading(false);

      if (response.ok) {
        setAllUsers(result.users || []);
      }
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
    if (result.pendingRequests) {
      setPendingRequests(result.pendingRequests);
    }
    if (result.requestHistory) {
      setRequestHistory(result.requestHistory);
    }
  }

  async function handleAction(userId, action) {
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
      body: JSON.stringify({ userId, action }),
    });

    const result = await response.json();
    setActioningId(null);

    if (!response.ok) {
      alert(result.error || 'Something went wrong.');
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, verified_until: action === 'verify' ? result.verifiedUntil : null } : u
      )
    );
  }

  async function handleRequestAction(requestId, userId, action) {
    setActioningRequestId(requestId);
    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({ userId, requestId, action }),
    });

    const result = await response.json();
    setActioningRequestId(null);

    if (!response.ok) {
      alert(result.error || 'Something went wrong.');
      return;
    }

    setPendingRequests((prev) => prev.filter((r) => r.requestId !== requestId));
    if (result.requestHistory) {
      setRequestHistory(result.requestHistory);
    }

    if (action === 'approve_request') {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, verified_until: result.verifiedUntil } : u))
      );
    }
  }

  async function handleDeleteUser(userId, username) {
    const confirmed = window.confirm(
      'Permanently delete ' +
        (username || 'this user') +
        "'s account? This deletes their profile, listings, chats, messages, reviews, and photos. This cannot be undone."
    );
    if (!confirmed) return;

    setDeletingId(userId);
    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({ userId, action: 'delete' }),
    });

    const result = await response.json();
    setDeletingId(null);

    if (!response.ok) {
      alert(result.error || 'Something went wrong.');
      return;
    }

    setAllUsers((prev) => prev.filter((u) => u.id !== userId));
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  async function handleBanUser(userId, username) {
    const confirmed = window.confirm(
      'Ban ' + (username || 'this user') + " for 1 day? They won't be able to log in until then."
    );
    if (!confirmed) return;

    setBanningId(userId);
    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({ userId, action: 'ban' }),
    });

    const result = await response.json();
    setBanningId(null);

    if (!response.ok) {
      alert(result.error || 'Something went wrong.');
      return;
    }

    setAllUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, banned_until: result.bannedUntil } : u))
    );
  }

  async function handleUnbanUser(userId) {
    setBanningId(userId);
    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({ userId, action: 'unban' }),
    });

    const result = await response.json();
    setBanningId(null);

    if (!response.ok) {
      alert(result.error || 'Something went wrong.');
      return;
    }

    setAllUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, banned_until: null } : u))
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
      <h1 className="text-2xl font-bold mb-1">Manage users</h1>
      <p className="text-sm text-stone-500 mb-6">
        See everyone who has signed up, verify sellers, and ban or delete an account directly if you need to &mdash; you don&apos;t need a report first.
      </p>

      <div className="mb-8">
        <h2 className="text-lg font-bold mb-1">Pending requests</h2>
        <p className="text-sm text-stone-500 mb-3">
          Sellers who tapped &quot;I&apos;ve Paid&quot; in Settings show up here. Confirm the GCash payment came in before approving.
        </p>

        {pendingLoading ? (
          <p className="text-stone-400 text-sm">Loading...</p>
        ) : pendingRequests.length === 0 ? (
          <p className="text-stone-400 text-sm">No pending requests right now.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pendingRequests.map((r) => (
              <div
                key={r.requestId}
                className="flex items-center justify-between border border-green-200 bg-green-50 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  {r.paymentProofUrl && (
                    <a href={r.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                      <img
                        src={r.paymentProofUrl}
                        alt="Payment screenshot"
                        className="w-14 h-14 rounded-md object-cover border border-stone-200 hover:opacity-80"
                      />
                    </a>
                  )}
                  <div>
                    <p className="font-medium">{r.username || 'Unnamed user'}</p>
                    {r.fullName && <p className="text-sm text-stone-500">{r.fullName}</p>}
                    <p className="text-xs text-stone-400 mt-0.5">
                      Requested {formatDate(r.createdAt)} &middot; via {r.paymentMethod === 'gotyme' ? 'GoTyme Bank' : 'GCash'}
                    </p>
                    {!r.paymentProofUrl && (
                      <p className="text-xs text-amber-600 mt-0.5">No screenshot attached</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRequestAction(r.requestId, r.userId, 'approve_request')}
                    disabled={actioningRequestId === r.requestId}
                    className="text-sm bg-green-700 text-white rounded-md px-3 py-1.5 hover:bg-green-800 disabled:opacity-50"
                  >
                    {actioningRequestId === r.requestId ? 'Working...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleRequestAction(r.requestId, r.userId, 'reject_request')}
                    disabled={actioningRequestId === r.requestId}
                    className="text-sm bg-stone-100 text-stone-600 rounded-md px-3 py-1.5 hover:bg-stone-200 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-bold mb-1">Verification request history</h2>
        <p className="text-sm text-stone-500 mb-3">Recently approved or rejected Verified Seller requests.</p>

        {requestHistory.length === 0 ? (
          <p className="text-stone-400 text-sm">No decisions yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {requestHistory.map((h) => (
              <div
                key={h.requestId}
                className="flex items-center justify-between border border-stone-200 rounded-lg p-3"
              >
                <div>
                  <p className="font-medium">{h.username || 'Unnamed user'}</p>
                  {h.fullName && <p className="text-sm text-stone-500">{h.fullName}</p>}
                  <p className="text-xs text-stone-400 mt-0.5">
                    {h.reviewedAt ? formatDate(h.reviewedAt) : ''}
                  </p>
                </div>
                <span
                  className={
                    'text-xs font-semibold px-2 py-1 rounded-full ' +
                    (h.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-stone-100 text-stone-600')
                  }
                >
                  {h.status === 'approved' ? 'Approved' : 'Rejected'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-lg font-bold mb-3">Manage any seller</h2>

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
        <p className="text-stone-400 text-sm mb-8">No users found. Try searching a username above.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-8">
          {users.map((u) => {
            const verified = isCurrentlyVerified(u.verified_until);
            const expired = !!u.verified_until && !verified;
            return (
              <div
                key={u.id}
                className="flex items-center justify-between border border-stone-200 rounded-lg p-3"
              >
                <div>
                  <p className="font-medium flex items-center gap-1">
                    {u.username || 'Unnamed user'}
                    {verified && (
                      <span className="text-green-700" title="Verified Seller">✓</span>
                    )}
                    {u.is_admin && (
                      <span className="text-xs text-stone-400 ml-1">(admin)</span>
                    )}
                  </p>
                  {u.full_name && <p className="text-sm text-stone-500">{u.full_name}</p>}
                  {verified && (
                    <p className="text-xs text-green-700 mt-0.5">Verified until {formatDate(u.verified_until)}</p>
                  )}
                  {expired && (
                    <p className="text-xs text-stone-400 mt-0.5">Expired {formatDate(u.verified_until)}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleAction(u.id, 'verify')}
                    disabled={actioningId === u.id}
                    className="text-sm bg-green-700 text-white rounded-md px-3 py-1.5 hover:bg-green-800 disabled:opacity-50"
                  >
                    {actioningId === u.id ? 'Updating...' : verified ? 'Extend 30 days' : 'Verify (30 days)'}
                  </button>
                  {verified && (
                    <button
                      onClick={() => handleAction(u.id, 'unverify')}
                      disabled={actioningId === u.id}
                      className="text-sm bg-stone-100 text-stone-600 rounded-md px-3 py-1.5 hover:bg-stone-200 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold mb-1">All signups</h2>
        <p className="text-sm text-stone-500 mb-3">
          Everyone who has created a Palengke account, most recent first. Search a username to ban or delete it.
        </p>

        <input
          value={signupsQuery}
          onChange={(e) => setSignupsQuery(e.target.value)}
          placeholder="Search by username to ban or delete..."
          className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mb-3"
        />

        {allUsersLoading ? (
          <p className="text-stone-400 text-sm">Loading...</p>
        ) : allUsers.length === 0 ? (
          <p className="text-stone-400 text-sm">No signups yet.</p>
        ) : (() => {
          const filteredUsers = allUsers.filter((u) =>
            signupsQuery.trim()
              ? (u.username || '').toLowerCase().includes(signupsQuery.trim().toLowerCase())
              : true
          );

          if (filteredUsers.length === 0) {
            return <p className="text-stone-400 text-sm">No accounts match that username.</p>;
          }

          return (
          <div className="flex flex-col gap-2">
            {filteredUsers.map((u) => {
              const banned = isCurrentlyBanned(u.banned_until);
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between border border-stone-200 rounded-lg p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium flex items-center gap-1">
                      {u.username || 'Unnamed user'}
                      {u.is_admin && <span className="text-xs text-stone-400 ml-1">(admin)</span>}
                    </p>
                    {u.full_name && <p className="text-sm text-stone-500">{u.full_name}</p>}
                    {u.email && <p className="text-xs text-stone-400">{u.email}</p>}
                    {u.phone && <p className="text-xs text-stone-400">{u.phone}</p>}
                    <p className="text-xs text-stone-400 mt-0.5">Signed up {formatDate(u.created_at)}</p>
                    {banned && (
                      <p className="text-xs text-red-600 font-medium mt-0.5">
                        Banned until {formatDateTime(u.banned_until)}
                      </p>
                    )}
                  </div>
                  {!u.is_admin && (
                    <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                      {banned ? (
                        <button
                          onClick={() => handleUnbanUser(u.id)}
                          disabled={banningId === u.id}
                          className="text-sm bg-stone-100 text-stone-600 rounded-md px-3 py-1.5 hover:bg-stone-200 disabled:opacity-50 whitespace-nowrap"
                        >
                          {banningId === u.id ? 'Working...' : 'Unban'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBanUser(u.id, u.username)}
                          disabled={banningId === u.id}
                          className="text-sm bg-amber-500 text-white rounded-md px-3 py-1.5 hover:bg-amber-600 disabled:opacity-50 whitespace-nowrap"
                        >
                          {banningId === u.id ? 'Working...' : 'Ban 1 day'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        disabled={deletingId === u.id}
                        className="text-sm bg-red-600 text-white rounded-md px-3 py-1.5 hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {deletingId === u.id ? 'Deleting...' : 'Delete account'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          );
        })()}
      </div>
    </div>
  );
}

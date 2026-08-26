'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminBoostsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestHistory, setRequestHistory] = useState([]);
  const [loading, setLoading] = useState(true);
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

      const admin = !!(profileResult.data && profileResult.data.is_admin);
      setIsAdmin(admin);
      setChecking(false);

      if (admin) {
        loadRequests();
      }
    }

    async function loadRequests() {
      setLoading(true);
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

      const response = await fetch('/api/admin/boosts', {
        headers: { Authorization: 'Bearer ' + accessToken },
      });
      const result = await response.json();
      setLoading(false);

      if (response.ok) {
        setPendingRequests(result.pendingRequests || []);
        setRequestHistory(result.requestHistory || []);
      }
    }

    init();
  }, [router]);

  async function handleAction(requestId, listingId, userId, action) {
    setActioningId(requestId);
    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

    const response = await fetch('/api/admin/boosts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({ requestId, listingId, userId, action }),
    });

    const result = await response.json();
    setActioningId(null);

    if (!response.ok) {
      alert(result.error || 'Something went wrong.');
      return;
    }

    setPendingRequests((prev) => prev.filter((r) => r.requestId !== requestId));
    if (result.requestHistory) {
      setRequestHistory(result.requestHistory);
    }
  }

  if (checking) {
    return <p className="text-stone-400 text-sm">Loading...</p>;
  }

  if (!isAdmin) {
    return <p className="text-stone-400 text-sm">You don&apos;t have access to this page.</p>;
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-1">Boost requests</h1>
      <p className="text-sm text-stone-500 mb-6">
        Sellers who paid to boost a listing show up here. Confirm the GCash payment came in before approving.
      </p>

      <div className="mb-8">
        <h2 className="text-lg font-bold mb-3">Pending requests</h2>

        {loading ? (
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
                    <p className="font-medium">{r.listingTitle}</p>
                    <p className="text-sm text-stone-500">by {r.username || r.fullName || 'Unnamed user'}</p>
                    <p className="text-xs text-stone-400 mt-0.5">Requested {formatDate(r.createdAt)}</p>
                    {!r.paymentProofUrl && (
                      <p className="text-xs text-amber-600 mt-0.5">No screenshot attached</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleAction(r.requestId, r.listingId, r.userId, 'approve_request')}
                    disabled={actioningId === r.requestId}
                    className="text-sm bg-green-700 text-white rounded-md px-3 py-1.5 hover:bg-green-800 disabled:opacity-50"
                  >
                    {actioningId === r.requestId ? 'Working...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleAction(r.requestId, r.listingId, r.userId, 'reject_request')}
                    disabled={actioningId === r.requestId}
                    className="text-sm bg-stone-100 text-stone-700 rounded-md px-3 py-1.5 hover:bg-stone-200 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3">History</h2>
        {requestHistory.length === 0 ? (
          <p className="text-stone-400 text-sm">No reviewed requests yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {requestHistory.map((h) => (
              <div
                key={h.requestId}
                className="flex items-center justify-between border border-stone-200 rounded-lg p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{h.listingTitle}</p>
                  <p className="text-stone-500">by {h.username || h.fullName || 'Unnamed user'}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{formatDate(h.reviewedAt || h.createdAt)}</p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    h.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {h.status === 'approved' ? 'Approved' : 'Rejected'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

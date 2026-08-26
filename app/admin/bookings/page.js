'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminBookingsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [pendingReviews, setPendingReviews] = useState([]);
  const [history, setHistory] = useState([]);
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
        loadReviews();
      }
    }

    async function loadReviews() {
      setLoading(true);
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

      const response = await fetch('/api/admin/bookings', {
        headers: { Authorization: 'Bearer ' + accessToken },
      });
      const result = await response.json();
      setLoading(false);

      if (response.ok) {
        setPendingReviews(result.pendingReviews || []);
        setHistory(result.history || []);
      }
    }

    init();
  }, [router]);

  async function handleAction(bookingId, sellerId, listingId, action) {
    setActioningId(bookingId);
    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

    const response = await fetch('/api/admin/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({ bookingId, sellerId, listingId, action }),
    });

    const result = await response.json();
    setActioningId(null);

    if (!response.ok) {
      alert(result.error || 'Something went wrong.');
      return;
    }

    setPendingReviews((prev) => prev.filter((r) => r.bookingId !== bookingId));
    if (result.history) {
      setHistory(result.history);
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
      <h1 className="text-2xl font-bold mb-1">Booking commissions</h1>
      <p className="text-sm text-stone-500 mb-6">
        Sellers who completed a Resorts &amp; Venues booking and paid their commission show up here. Confirm the
        GCash payment came in before approving.
      </p>

      <div className="mb-8">
        <h2 className="text-lg font-bold mb-3">Pending review</h2>

        {loading ? (
          <p className="text-stone-400 text-sm">Loading...</p>
        ) : pendingReviews.length === 0 ? (
          <p className="text-stone-400 text-sm">Nothing to review right now.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pendingReviews.map((r) => (
              <div
                key={r.bookingId}
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
                    <p className="text-sm text-stone-500">
                      {r.username || r.fullName || 'Unnamed user'} owes ₱{Number(r.commissionAmount || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">Submitted {formatDate(r.createdAt)}</p>
                    {!r.paymentProofUrl && (
                      <p className="text-xs text-amber-600 mt-0.5">No screenshot attached</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleAction(r.bookingId, r.sellerId, r.listingId, 'approve')}
                    disabled={actioningId === r.bookingId}
                    className="text-sm bg-green-700 text-white rounded-md px-3 py-1.5 hover:bg-green-800 disabled:opacity-50"
                  >
                    {actioningId === r.bookingId ? 'Working...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleAction(r.bookingId, r.sellerId, r.listingId, 'reject')}
                    disabled={actioningId === r.bookingId}
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
        {history.length === 0 ? (
          <p className="text-stone-400 text-sm">No confirmed commission payments yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <div
                key={h.bookingId}
                className="flex items-center justify-between border border-stone-200 rounded-lg p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{h.listingTitle}</p>
                  <p className="text-stone-500">
                    {h.username || h.fullName || 'Unnamed user'} &mdash; ₱{Number(h.commissionAmount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">{formatDate(h.updatedAt)}</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  Paid
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function AdminReportsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
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

      const admin = !!(profileResult.data && profileResult.data.is_admin);
      setIsAdmin(admin);
      setChecking(false);

      if (admin) {
        loadReports();
      }
    }

    async function loadReports() {
      setLoading(true);
      setError(null);
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

      const response = await fetch('/api/admin/reports', {
        headers: { Authorization: 'Bearer ' + accessToken },
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Something went wrong.');
        setLoading(false);
        return;
      }

      setReports(result.reports || []);
      setLoading(false);
    }

    init();
  }, [router]);

  async function handleAction(reportId, action, confirmMessage) {
    if (confirmMessage) {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) return;
    }

    setActioningId(reportId);
    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

    const response = await fetch('/api/admin/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({ reportId, action }),
    });

    const result = await response.json();
    setActioningId(null);

    if (!response.ok) {
      alert(result.error || 'Something went wrong.');
      return;
    }

    setReports((prev) => prev.filter((r) => r.id !== reportId));
  }

  if (checking) {
    return <p className="text-stone-400 text-sm">Loading...</p>;
  }

  if (!isAdmin) {
    return <p className="text-stone-400 text-sm">You don&apos;t have access to this page.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Reports</h1>

      {loading ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : reports.length === 0 ? (
        <p className="text-stone-400 text-sm">No open reports.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((r) => (
            <div key={r.id} className="border border-stone-200 rounded-lg p-4">
              <p className="text-sm text-stone-500 mb-1">
                Reported by <span className="font-medium text-stone-700">{r.reporterName}</span>
              </p>
              <p className="text-sm text-stone-500 mb-2">
                Against <span className="font-semibold text-red-700">{r.reportedUserName}</span>
              </p>
              <p className="font-medium mb-1">Reason: {r.reason}</p>
              {r.details && <p className="text-sm text-stone-600 mb-2">&quot;{r.details}&quot;</p>}
              <p className="text-sm text-stone-500 mb-3">
                Listing: {r.listingTitle}
                {r.listingStatus ? ' (' + r.listingStatus + ')' : ''}
              </p>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={function () {
                    handleAction(
                      r.id,
                      'remove_listing',
                      'Remove this listing? The seller’s account stays active.'
                    );
                  }}
                  disabled={actioningId === r.id}
                  className="text-sm bg-stone-100 hover:bg-stone-200 rounded-md px-3 py-1.5 disabled:opacity-50"
                >
                  Remove listing
                </button>
                <button
                  onClick={function () {
                    handleAction(
                      r.id,
                      'ban_user',
                      'Permanently delete ' + r.reportedUserName + '’s account? This cannot be undone.'
                    );
                  }}
                  disabled={actioningId === r.id}
                  className="text-sm bg-red-600 text-white hover:bg-red-700 rounded-md px-3 py-1.5 disabled:opacity-50"
                >
                  Ban user
                </button>
                <button
                  onClick={function () { handleAction(r.id, 'dismiss', null); }}
                  disabled={actioningId === r.id}
                  className="text-sm text-stone-500 hover:text-stone-700 underline disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

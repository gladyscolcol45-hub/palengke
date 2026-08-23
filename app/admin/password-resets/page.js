'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminPasswordResetsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [emailedStatus, setEmailedStatus] = useState({});

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

      if (admin) loadRequests();
    }

    async function loadRequests() {
      setLoading(true);
      const supabase2 = createClient();
      const sessionResult = await supabase2.auth.getSession();
      const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

      const response = await fetch('/api/admin/password-resets', {
        headers: { Authorization: 'Bearer ' + accessToken },
      });
      const result = await response.json();
      setLoading(false);
      if (response.ok) setRequests(result.requests || []);
    }

    init();
  }, [router]);

  async function handleAction(requestId, userId, action) {
    setActioningId(requestId);
    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

    const response = await fetch('/api/admin/password-resets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({ requestId, userId, action }),
    });

    const result = await response.json();
    setActioningId(null);

    if (!response.ok) {
      alert(result.error || 'Something went wrong.');
      return;
    }

    if (action === 'approve') {
      setRevealedPasswords((prev) => ({ ...prev, [requestId]: result.tempPassword }));
      setEmailedStatus((prev) => ({ ...prev, [requestId]: !!result.emailed }));
    } else {
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    }
  }

  if (checking) return <p className="text-stone-400 text-sm">Loading...</p>;
  if (!isAdmin) return <p className="text-stone-400 text-sm">You don&apos;t have access to this page.</p>;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-1">Password reset requests</h1>
      <p className="text-sm text-stone-500 mb-6">
        Before approving, verify the person&apos;s identity yourself (their email/phone on file, or
        another channel you trust) &mdash; approving generates a temporary password immediately
        and tries to email it to them automatically. If that email doesn&apos;t go through, the
        temp password is still shown below so you can send it to them yourself; it&apos;s only
        ever shown once here.
      </p>

      {loading ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-stone-400 text-sm">No pending requests right now.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((r) => (
            <div key={r.id} className="border border-stone-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{r.username}</p>
                  <p className="text-sm text-stone-500">{r.email || 'No email on file'}</p>
                  {r.phone && <p className="text-sm text-stone-500">{r.phone}</p>}
                  <p className="text-xs text-stone-400 mt-0.5">Requested {formatDate(r.created_at)}</p>
                </div>
                {!revealedPasswords[r.id] && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAction(r.id, r.user_id, 'approve')}
                      disabled={actioningId === r.id}
                      className="text-sm bg-green-700 text-white rounded-md px-3 py-1.5 hover:bg-green-800 disabled:opacity-50"
                    >
                      {actioningId === r.id ? 'Working...' : 'Verified — generate temp password'}
                    </button>
                    <button
                      onClick={() => handleAction(r.id, r.user_id, 'reject')}
                      disabled={actioningId === r.id}
                      className="text-sm bg-stone-100 text-stone-600 rounded-md px-3 py-1.5 hover:bg-stone-200 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>

              {revealedPasswords[r.id] && (
                <div className="mt-2 bg-green-50 border border-green-200 rounded-md p-2 text-sm">
                  {emailedStatus[r.id] ? (
                    <p className="text-green-800">
                      Emailed the temp password to <strong>{r.username}</strong> automatically at{' '}
                      {r.email}.
                    </p>
                  ) : (
                    <>
                      <p className="text-green-800">
                        Couldn&apos;t auto-email this one &mdash; temp password for{' '}
                        <strong>{r.username}</strong>:{' '}
                        <span className="font-mono font-bold">{revealedPasswords[r.id]}</span>
                      </p>
                      <p className="text-green-700 text-xs mt-1">
                        Send this to them yourself now &mdash; it won&apos;t be shown again.
                      </p>
                    </>
                  )}
                  <p className="text-green-700 text-xs mt-1">
                    Tell them to set their own password in Settings once they log in.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

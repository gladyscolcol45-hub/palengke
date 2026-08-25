'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function SettingsPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);

  const [verifiedUntil, setVerifiedUntil] = useState(null);
  const [verificationRequest, setVerificationRequest] = useState(null);
  const [requestingVerification, setRequestingVerification] = useState(false);
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState(null);
  const [paymentProofError, setPaymentProofError] = useState(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState(null);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);

      const profileResult = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const profile = profileResult.data;
      if (profile) {
        setFullName(profile.full_name || '');
        setVerifiedUntil(profile.verified_until || null);
      }

      const requestResult = await supabase
        .from('verification_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setVerificationRequest(requestResult.data || null);

      setLoading(false);
      loadBlockedUsers(user.id);
    }

    async function loadBlockedUsers(currentUserId) {
      setBlockedLoading(true);

      const blocksResult = await supabase
        .from('blocks')
        .select('id, blocked_id, created_at')
        .eq('blocker_id', currentUserId)
        .order('created_at', { ascending: false });

      const blockRows = blocksResult.data || [];
      const results = [];

      for (let i = 0; i < blockRows.length; i++) {
        const row = blockRows[i];
        const profileResult = await supabase
          .from('profiles')
          .select('full_name, username, avatar_url')
          .eq('id', row.blocked_id)
          .single();

        const p = profileResult.data;
        results.push({
          blockId: row.id,
          userId: row.blocked_id,
          name: (p && (p.full_name || p.username)) || 'Unnamed user',
          avatarUrl: p ? p.avatar_url : null,
        });
      }

      setBlockedUsers(results);
      setBlockedLoading(false);
    }

    load();
  }, [router]);

  async function handleUnblock(blockId) {
    const confirmed = window.confirm('Unblock this user? You will be able to message each other again.');
    if (!confirmed) return;

    setUnblockingId(blockId);
    const supabase = createClient();
    const { error: unblockError } = await supabase
      .from('blocks')
      .delete()
      .eq('id', blockId);
    setUnblockingId(null);

    if (!unblockError) {
      setBlockedUsers((prev) => prev.filter((u) => u.blockId !== blockId));
    }
  }

  function handlePaymentProofChange(e) {
    const file = (e.target.files || [])[0];
    e.target.value = ''; // lets them pick the same file again later if they remove it
    if (!file) return;
    setPaymentProofError(null);
    setPaymentProofFile(file);
    setPaymentProofPreview(URL.createObjectURL(file));
  }

  function handleRemovePaymentProof() {
    setPaymentProofFile(null);
    setPaymentProofPreview(null);
  }

  async function handleRequestVerification() {
    if (!userId) return;

    if (!paymentProofFile) {
      setPaymentProofError('Please attach a screenshot of your GCash payment first.');
      return;
    }

    setPaymentProofError(null);
    setRequestingVerification(true);
    const supabase = createClient();

    const proofPath = `${userId}/${Date.now()}-${paymentProofFile.name}`;
    const uploadResult = await supabase.storage
      .from('payment-proofs')
      .upload(proofPath, paymentProofFile);

    if (uploadResult.error) {
      setRequestingVerification(false);
      setPaymentProofError('Could not upload your screenshot. Please try again.');
      return;
    }

    const insertResult = await supabase
      .from('verification_requests')
      .insert({ user_id: userId, status: 'pending', payment_proof_path: proofPath })
      .select()
      .single();

    if (insertResult.error) {
      setRequestingVerification(false);
      alert('Something went wrong sending your request. Please try again.');
      return;
    }

    // Best-effort: let admins know a request is waiting. If this fails the
    // request itself was still saved, so the admin will still see it in the
    // Verify sellers queue next time they check.
    const adminsResult = await supabase.from('profiles').select('id').eq('is_admin', true);
    const admins = adminsResult.data || [];
    const sellerName = fullName || 'A seller';
    for (let i = 0; i < admins.length; i++) {
      await supabase.from('notifications').insert({
        user_id: admins[i].id,
        type: 'verification_requested',
        message: sellerName + ' requested the Verified Seller badge — review it in Verify sellers.',
        link: '/admin/users',
      });
    }

    // Best-effort: also email the admin so it's not only an in-app
    // notification, and email the seller a confirmation their request went
    // through. The request itself is already saved above either way.
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;
    if (accessToken) {
      try {
        await fetch('/api/verification-request', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + accessToken },
        });
      } catch (e) {
        // Ignore — the request row and in-app notification already succeeded.
      }
    }

    setVerificationRequest(insertResult.data);
    setRequestingVerification(false);
  }

  async function handleSendReport() {
    if (!reportMessage.trim()) return;

    setReportSending(true);
    setReportError(null);
    const supabase = createClient();

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session ? sessionResult.data.session.access_token : null;

    if (!accessToken) {
      setReportSending(false);
      setReportError('You need to be logged in to do this.');
      return;
    }

    const response = await fetch('/api/report-problem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({ message: reportMessage.trim() }),
    });

    let result = {};
    try {
      result = await response.json();
    } catch (e) {
      result = {};
    }

    setReportSending(false);

    if (!response.ok) {
      setReportError(result.error || 'Something went wrong. Please try again.');
      return;
    }

    setReportMessage('');
    setReportSent(true);
  }

  if (loading) {
    return <p className="text-stone-400 text-sm">Loading...</p>;
  }

  const isVerified = !!verifiedUntil && new Date(verifiedUntil) > new Date();
  const daysLeft = isVerified
    ? Math.max(1, Math.ceil((new Date(verifiedUntil) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;
  const hasPendingRequest = !!verificationRequest && verificationRequest.status === 'pending';
  const wasRejected = !!verificationRequest && verificationRequest.status === 'rejected';

  return (
    <div className="max-w-lg mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <a
        href="/settings/profile"
        className="flex items-center justify-between border border-stone-200 rounded-lg p-4 mb-6 hover:bg-stone-50"
      >
        <div>
          <p className="font-semibold text-stone-800">Profile Details</p>
          <p className="text-sm text-stone-500 mt-0.5">
            Your name, email, phone number, photo, and password
          </p>
        </div>
        <span className="text-stone-400">&rarr;</span>
      </a>

      <div
        className={`mb-6 rounded-lg p-4 border ${
          isVerified ? 'border-green-200 bg-green-50' : 'border-stone-200 bg-stone-50'
        }`}
      >
        {isVerified ? (
          <>
            <p className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-700 text-white text-xs">✓</span>
              Verified Seller
            </p>
            <p className="text-sm text-green-700 mt-1">
              Your badge is active for {daysLeft} more day{daysLeft !== 1 ? 's' : ''}. To keep it after that, send your renewal payment and tap the button below again a few days before it expires.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-stone-700">Not a Verified Seller yet</p>

            {hasPendingRequest ? (
              <p className="text-sm text-stone-500 mt-1">
                Your payment is being reviewed by the admin. You&apos;ll get a notification once it&apos;s confirmed &mdash; usually within a day.
              </p>
            ) : (
              <>
                <p className="text-sm text-stone-500 mt-1">
                  Get the checkmark badge on your profile and listings for 30 days.
                </p>

                {wasRejected && (
                  <p className="text-sm text-red-600 mt-2">
                    Your last request couldn&apos;t be confirmed. Please double-check your payment, then try again below.
                  </p>
                )}

                <div className="mt-3 bg-white border border-stone-200 rounded-md p-3 text-sm">
                  <p className="font-medium text-stone-700">Step 1 &mdash; Send ₱99 via GCash</p>
                  <p className="text-stone-500 mt-0.5">GCash: Gladys C. &mdash; 0963 307 7826</p>
                  <p className="font-medium text-stone-700 mt-3">Step 2 &mdash; Attach your payment screenshot</p>

                  {paymentProofPreview ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <img
                        src={paymentProofPreview}
                        alt="Payment screenshot"
                        className="w-14 h-14 rounded-md object-cover border border-stone-200"
                      />
                      <button
                        type="button"
                        onClick={handleRemovePaymentProof}
                        className="text-xs text-stone-500 hover:text-red-600 underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="mt-1.5 inline-block text-sm text-green-700 hover:underline cursor-pointer">
                      Choose screenshot...
                      <input type="file" accept="image/*" onChange={handlePaymentProofChange} className="hidden" />
                    </label>
                  )}

                  <p className="font-medium text-stone-700 mt-3">Step 3 &mdash; Tap the button below</p>
                  <p className="text-stone-500 mt-0.5">The admin will confirm your payment and activate your badge, usually within a day.</p>
                </div>

                {paymentProofError && <p className="text-red-600 text-sm mt-2">{paymentProofError}</p>}

                <button
                  onClick={handleRequestVerification}
                  disabled={requestingVerification}
                  className="mt-3 bg-green-700 text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
                >
                  {requestingVerification ? 'Submitting...' : "I've Paid — Request Verification"}
                </button>
              </>
            )}
          </>
        )}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-bold mb-3">Blocked users</h2>
        {blockedLoading ? (
          <p className="text-stone-400 text-sm">Loading...</p>
        ) : blockedUsers.length === 0 ? (
          <p className="text-stone-400 text-sm">You haven't blocked anyone.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {blockedUsers.map(function (u) {
              return (
                <div key={u.blockId} className="flex items-center gap-3 border border-stone-200 rounded-lg p-3">
                  <div className="w-10 h-10 rounded-full bg-stone-100 overflow-hidden flex-shrink-0">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">?</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{u.name}</p>
                  </div>
                  <button
                    onClick={function () { handleUnblock(u.blockId); }}
                    disabled={unblockingId === u.blockId}
                    className="text-xs text-stone-500 hover:text-green-700 underline disabled:opacity-50 flex-shrink-0"
                  >
                    {unblockingId === u.blockId ? 'Unblocking...' : 'Unblock'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-bold mb-3">About</h2>
        <div className="flex flex-col gap-2 text-sm">
          <a href="/about" className="text-green-700 hover:underline">About Palengke</a>
          <a href="/terms" className="text-green-700 hover:underline">Terms of Service</a>
          <a href="/privacy" className="text-green-700 hover:underline">Privacy Policy</a>

          {!reportOpen ? (
            <button
              type="button"
              onClick={function () { setReportOpen(true); setReportSent(false); setReportError(null); }}
              className="text-green-700 hover:underline text-left"
            >
              Report a problem
            </button>
          ) : reportSent ? (
            <p className="text-green-700">Thanks &mdash; we got your report and will look into it.</p>
          ) : (
            <div className="mt-1 border border-stone-200 rounded-md p-3">
              <label className="block text-sm font-medium text-stone-700 mb-1">
                What went wrong?
              </label>
              <textarea
                value={reportMessage}
                onChange={function (e) { setReportMessage(e.target.value); }}
                rows={4}
                maxLength={2000}
                placeholder="Describe the problem you ran into..."
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
              />
              {reportError && <p className="text-red-600 text-sm mt-1">{reportError}</p>}
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleSendReport}
                  disabled={reportSending || !reportMessage.trim()}
                  className="bg-green-700 text-white rounded-md px-4 py-1.5 text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
                >
                  {reportSending ? 'Sending...' : 'Send'}
                </button>
                <button
                  type="button"
                  onClick={function () { setReportOpen(false); setReportError(null); }}
                  className="text-stone-500 text-sm px-2 hover:text-stone-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

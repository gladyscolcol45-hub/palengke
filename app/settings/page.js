'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function SettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    barangay: '',
    city: '',
  });
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState(null);

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);

  const [verifiedUntil, setVerifiedUntil] = useState(null);
  const [verificationRequest, setVerificationRequest] = useState(null);
  const [requestingVerification, setRequestingVerification] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

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
        setForm({
          full_name: profile.full_name || '',
          phone: profile.phone || '',
          barangay: profile.barangay || '',
          city: profile.city || '',
        });
        setAvatarUrl(profile.avatar_url || null);
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

  async function handleRequestVerification() {
    if (!userId) return;
    setRequestingVerification(true);
    const supabase = createClient();

    const insertResult = await supabase
      .from('verification_requests')
      .insert({ user_id: userId, status: 'pending' })
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
    const sellerName = form.full_name || 'A seller';
    for (let i = 0; i < admins.length; i++) {
      await supabase.from('notifications').insert({
        user_id: admins[i].id,
        type: 'verification_requested',
        message: sellerName + ' requested the Verified Seller badge — review it in Verify sellers.',
        link: '/admin/users',
      });
    }

    setVerificationRequest(insertResult.data);
    setRequestingVerification(false);
  }

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

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const supabase = createClient();

    let newAvatarUrl = avatarUrl;
    if (avatarFile) {
      const fileName = userId + '/' + Date.now() + '-' + avatarFile.name;
      const uploadResult = await supabase.storage
        .from('listing-photos')
        .upload(fileName, avatarFile);

      if (uploadResult.error) {
        setError(uploadResult.error.message);
        setSaving(false);
        return;
      }
      const publicUrlResult = supabase.storage.from('listing-photos').getPublicUrl(fileName);
      newAvatarUrl = publicUrlResult.data.publicUrl;
    }

    const updateResult = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name,
        phone: form.phone,
        barangay: form.barangay,
        city: form.city,
        avatar_url: newAvatarUrl,
      })
      .eq('id', userId);

    setSaving(false);

    if (updateResult.error) {
      setError(updateResult.error.message);
      return;
    }

    setAvatarUrl(newAvatarUrl);
    setSaved(true);
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
                  <p className="font-medium text-stone-700 mt-3">Step 2 &mdash; Tap the button below</p>
                  <p className="text-stone-500 mt-0.5">The admin will confirm your payment and activate your badge, usually within a day.</p>
                </div>

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
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Profile photo</label>
          {avatarPreview ? (
            <img src={avatarPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover border border-stone-200 mb-2" />
          ) : avatarUrl ? (
            <img src={avatarUrl} alt="Current" className="w-20 h-20 rounded-full object-cover border border-stone-200 mb-2" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-stone-200 flex items-center justify-center text-stone-400 mb-2">No photo</div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={function (e) {
              const file = e.target.files[0];
              setAvatarFile(file);
              setAvatarPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Full name</label>
          <input
            value={form.full_name}
            onChange={function (e) { setForm({ ...form, full_name: e.target.value }); }}
            className="w-full border border-stone-300 rounded-md px-3 py-2"
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Phone number</label>
          <input
            value={form.phone}
            onChange={function (e) { setForm({ ...form, phone: e.target.value }); }}
            className="w-full border border-stone-300 rounded-md px-3 py-2"
            placeholder="09XX XXX XXXX"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-stone-700 mb-1">Barangay</label>
            <input
              value={form.barangay}
              onChange={function (e) { setForm({ ...form, barangay: e.target.value }); }}
              className="w-full border border-stone-300 rounded-md px-3 py-2"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-stone-700 mb-1">City</label>
            <input
              value={form.city}
              onChange={function (e) { setForm({ ...form, city: e.target.value }); }}
              className="w-full border border-stone-300 rounded-md px-3 py-2"
            />
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {saved && <p className="text-green-700 text-sm">Saved!</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-green-700 text-white rounded-md py-2 font-semibold hover:bg-green-800 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>

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
          <a
            href="mailto:palengke.app23@gmail.com?subject=Palengke%20app%20problem"
            className="text-green-700 hover:underline"
          >
            Report a problem
          </a>
        </div>
      </div>

      <div className="mt-10 border border-red-200 rounded-lg p-4 bg-red-50">
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

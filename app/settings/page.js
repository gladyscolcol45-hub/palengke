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
      }

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

  return (
    <div className="max-w-lg mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
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

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import PasswordInput from '@/components/PasswordInput';

export default function ProfileInfoPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    barangay: '',
    city: '',
  });
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordChanged, setPasswordChanged] = useState(false);

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
          email: profile.email || '',
          phone: profile.phone || '',
          barangay: profile.barangay || '',
          city: profile.city || '',
        });
        setUsername(profile.username || '');
        setAvatarUrl(profile.avatar_url || null);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const cleanEmail = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    setSaving(true);
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
        email: cleanEmail,
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

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordChanged(false);

    if (!currentPassword) {
      setPasswordError('Enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords don’t match.');
      return;
    }

    setChangingPassword(true);
    const supabase = createClient();

    // Confirm they actually know the current password before changing it.
    const cleanUsername = username.trim().toLowerCase();
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: `${cleanUsername}@palengke.local`,
      password: currentPassword,
    });

    if (reauthError) {
      setChangingPassword(false);
      setPasswordError('Current password is incorrect.');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);

    if (updateError) {
      setPasswordError(updateError.message);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordChanged(true);
  }

  if (loading) {
    return <p className="text-stone-400 text-sm">Loading...</p>;
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <a href="/settings" className="text-sm text-green-700 hover:underline">&larr; Back to Settings</a>
      <h1 className="text-2xl font-bold mb-1 mt-2">Profile Details</h1>
      {username && (
        <p className="text-sm text-stone-400 mb-5">
          Your username: <span className="font-medium text-stone-600">{username}</span>
        </p>
      )}

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
          <label className="block text-sm font-medium text-stone-700 mb-1">Email address</label>
          <input
            type="email"
            value={form.email}
            onChange={function (e) { setForm({ ...form, email: e.target.value }); }}
            className="w-full border border-stone-300 rounded-md px-3 py-2"
            placeholder="you@example.com"
          />
          <p className="text-xs text-stone-400 mt-1">
            Used to help you get back into your account if you forget your password.
          </p>
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
        <h2 className="text-lg font-bold mb-3">Change password</h2>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
          <PasswordInput
            placeholder="Current password"
            value={currentPassword}
            onChange={function (e) { setCurrentPassword(e.target.value); }}
            className="border border-stone-300 rounded-md px-3 py-2"
          />
          <PasswordInput
            placeholder="New password"
            value={newPassword}
            onChange={function (e) { setNewPassword(e.target.value); }}
            className="border border-stone-300 rounded-md px-3 py-2"
          />
          <PasswordInput
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={function (e) { setConfirmPassword(e.target.value); }}
            className="border border-stone-300 rounded-md px-3 py-2"
          />
          {passwordError && <p className="text-red-600 text-sm">{passwordError}</p>}
          {passwordChanged && <p className="text-green-700 text-sm">Password updated!</p>}
          <button
            type="submit"
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="bg-green-700 text-white rounded-md py-2 font-semibold hover:bg-green-800 disabled:opacity-50 self-start px-4"
          >
            {changingPassword ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>

      <a
        href="/settings/profile/manage"
        className="flex items-center justify-between border border-stone-200 rounded-lg p-4 mt-10 hover:bg-stone-50"
      >
        <div>
          <p className="font-semibold text-stone-800">Manage account</p>
          <p className="text-sm text-stone-500 mt-0.5">
            Delete your account
          </p>
        </div>
        <span className="text-stone-400">&rarr;</span>
      </a>
    </div>
  );
}

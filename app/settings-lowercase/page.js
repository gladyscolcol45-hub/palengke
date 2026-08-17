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
    }

    load();
  }, [router]);

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
    </div>
  );
}

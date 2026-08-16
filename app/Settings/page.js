'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function SettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: '', phone: '', barangay: '', city: '', avatar_url: '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setForm({
          full_name: profile.full_name || '',
          phone: profile.phone || '',
          barangay: profile.barangay || '',
          city: profile.city || '',
          avatar_url: profile.avatar_url || '',
        });
      }
      setLoading(false);
    }

    load();
  }, [router]);

  function handleAvatarChange(e) {
    const file = e.target.files[0];
    setAvatarFile(file);
    if (file) setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    let avatar_url = form.avatar_url;
    if (avatarFile) {
      const fileName = `${user.id}/${Date.now()}-${avatarFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('listing-photos')
        .upload(fileName, avatarFile);

      if (uploadError) {
        setError(uploadError.message);
        setSaving(false);
        return;
      }
      const { data: publicUrl } = supabase.storage.from('listing-photos').getPublicUrl(fileName);
      avatar_url = publicUrl.publicUrl;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name,
        phone: form.phone,
        barangay: form.barangay,
        city: form.city,
        avatar_url,
      })
      .eq('id', user.id);

    setSaving(false);
    if (updateError) setError(updateError.message);
    else {
      setSuccess(true);
      setForm({ ...form, avatar_url });
    }
  }

  if (loading) {
    return <p className="text-stone-400 text-sm text-center py-12">Loading…</p>;
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1">Full name</label>
          <input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="border border-stone-300 rounded-md px-3 py-2 w-full"
          />
        </div>

        <div>
          <label className="block text-sm text-stone-600 mb-1">Phone number</label>
          <input
            type="tel"
            placeholder="09XX XXX XXXX"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="border border-stone-300 rounded-md px-3 py-2 w-full"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm text-stone-600 mb-1">Barangay</label>
            <input
              value={form.barangay}
              onChange={(e) => setForm({ ...form, barangay: e.target.value })}
              className="border border-stone-300 rounded-md px-3 py-2 w-full"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-stone-600 mb-1">City</label>
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="border border-stone-300 rounded-md px-3 py-2 w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-stone-600 mb-1">Profile photo</label>
          <input type="file" accept="image/*" onChange={handleAvatarChange} />
          {(avatarPreview || form.avatar_url) && (
            <img
              src={avatarPreview || form.avatar_url}
              alt="Avatar preview"
              className="mt-2 w-20 h-20 object-cover rounded-full border border-stone-200"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-green-700 text-white rounded-md py-2 font-semibold hover:bg-green-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && <p className="text-green-700 text-sm">Saved!</p>}
      </form>
    </div>
  );
}
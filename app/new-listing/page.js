'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { geocodeAddress } from '@/lib/geocode';
import LocationPicker from '@/components/DynamicLocationPicker';

export default function NewListingPage() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', price: '', unit: 'each',
    category_id: '', barangay: '', city: '', photo: null,
    latitude: null, longitude: null,
  });
  const [locationSource, setLocationSource] = useState(null); // null | 'auto' | 'manual'
  const [geocoding, setGeocoding] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('categories').select('*').order('name').then(({ data }) => setCategories(data || []));
  }, []);

  async function autoLocateFromAddress(barangay, city) {
    if (locationSource === 'manual') return; // don't override a manual pin
    if (!barangay && !city) return;
    setGeocoding(true);
    const result = await geocodeAddress(barangay, city);
    setGeocoding(false);
    if (result) {
      setForm((prev) => ({ ...prev, latitude: result.lat, longitude: result.lng }));
      setLocationSource('auto');
    }
  }

  function handleLocationChange(lat, lng, source) {
    setForm({ ...form, latitude: lat, longitude: lng });
    setLocationSource(source);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Please log in first.');
      setSaving(false);
      router.push('/login');
      return;
    }

    let { latitude, longitude } = form;
    if ((latitude == null || longitude == null) && (form.barangay || form.city)) {
      const result = await geocodeAddress(form.barangay, form.city);
      if (result) {
        latitude = result.lat;
        longitude = result.lng;
      }
    }

    let photo_urls = [];
    if (form.photo) {
      const fileName = `${user.id}/${Date.now()}-${form.photo.name}`;
      const { error: uploadError } = await supabase.storage
        .from('listing-photos')
        .upload(fileName, form.photo);

      if (uploadError) {
        setError(uploadError.message);
        setSaving(false);
        return;
      }
      const { data: publicUrl } = supabase.storage.from('listing-photos').getPublicUrl(fileName);
      photo_urls = [publicUrl.publicUrl];
    }

    const { error: insertError } = await supabase.from('listings').insert({
      seller_id: user.id,
      title: form.title,
      description: form.description,
      price: parseFloat(form.price),
      unit: form.unit,
      category_id: form.category_id || null,
      barangay: form.barangay,
      city: form.city,
      photo_urls,
      latitude,
      longitude,
    });

    setSaving(false);
    if (insertError) setError(insertError.message);
    else router.push('/');
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Post a listing</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          required placeholder="What are you selling?"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="border border-stone-300 rounded-md px-3 py-2"
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="border border-stone-300 rounded-md px-3 py-2"
          rows={3}
        />
        <div className="flex gap-2">
          <input
            required type="number" step="0.01" placeholder="Price (₱)"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="border border-stone-300 rounded-md px-3 py-2 flex-1"
          />
          <select
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="border border-stone-300 rounded-md px-3 py-2"
          >
            <option value="each">each</option>
            <option value="kg">per kg</option>
            <option value="bundle">per bundle</option>
            <option value="night">per night</option>
            <option value="group">per group</option>
          </select>
        </div>
        <select
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          className="border border-stone-300 rounded-md px-3 py-2"
        >
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            placeholder="Barangay"
            value={form.barangay}
            onChange={(e) => setForm({ ...form, barangay: e.target.value })}
            onBlur={() => autoLocateFromAddress(form.barangay, form.city)}
            className="border border-stone-300 rounded-md px-3 py-2 flex-1"
          />
          <input
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            onBlur={() => autoLocateFromAddress(form.barangay, form.city)}
            className="border border-stone-300 rounded-md px-3 py-2 flex-1"
          />
        </div>

        <LocationPicker
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={handleLocationChange}
          autoNote={
            geocoding
              ? 'Looking up that area…'
              : locationSource === 'auto'
              ? 'Location guessed from your barangay/city. Tap the map to set your exact spot.'
              : null
          }
        />

        <div>
          <input
            type="file" accept="image/*"
            onChange={(e) => {
              const file = e.target.files[0];
              setForm({ ...form, photo: file });
              setPhotoPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Preview"
              className="mt-2 w-32 h-32 object-cover rounded-md border border-stone-200"
            />
          )}
        </div>
        <button
          type="submit" disabled={saving}
          className="bg-green-700 text-white rounded-md py-2 font-semibold hover:bg-green-800 disabled:opacity-50"
        >
          {saving ? 'Posting…' : 'Post listing'}
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>
    </div>
  );
}

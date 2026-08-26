'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { geocodeAddress } from '@/lib/geocode';
import LocationPicker from '@/components/DynamicLocationPicker';
import { getCategoryIcon } from '@/lib/categoryIcons';
import { RESORT_AMENITIES } from '@/lib/resortAmenities';

const MAX_PHOTOS = 5;

export default function NewListingPage() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', price: '', unit: 'each',
    category_id: '', barangay: '', city: '',
    latitude: null, longitude: null,
    max_guests: '', amenities: [], house_rules: '',
  });
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [locationSource, setLocationSource] = useState(null); // null | 'auto' | 'manual'
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('categories').select('*').order('name').then(({ data }) => {
      // Alphabetical, but "Other" always goes last no matter where it falls in the alphabet.
      const sorted = (data || []).slice().sort((a, b) => {
        if (a.name === 'Other') return 1;
        if (b.name === 'Other') return -1;
        return 0;
      });
      setCategories(sorted);
    });
  }, []);

  function handleAddPhotos(e) {
    const selected = Array.from(e.target.files || []);
    const combined = [...photos, ...selected].slice(0, MAX_PHOTOS);
    setPhotos(combined);
    setPhotoPreviews(combined.map((file) => URL.createObjectURL(file)));
    e.target.value = ''; // lets the user pick the same file again later if they remove it
  }

  function handleRemovePhoto(index) {
    const updated = photos.filter((_, i) => i !== index);
    setPhotos(updated);
    setPhotoPreviews(updated.map((file) => URL.createObjectURL(file)));
  }

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

  function handleToggleAmenity(amenity) {
    setForm((prev) => {
      const has = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: has ? prev.amenities.filter((a) => a !== amenity) : [...prev.amenities, amenity],
      };
    });
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

    const photo_urls = [];
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];
      const fileName = `${user.id}/${Date.now()}-${i}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('listing-photos')
        .upload(fileName, file);

      if (uploadError) {
        setError(uploadError.message);
        setSaving(false);
        return;
      }
      const { data: publicUrl } = supabase.storage.from('listing-photos').getPublicUrl(fileName);
      photo_urls.push(publicUrl.publicUrl);
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
      max_guests: isResort && form.max_guests ? parseInt(form.max_guests, 10) : null,
      amenities: isResort ? form.amenities : [],
      house_rules: isResort ? form.house_rules || null : null,
    });

    setSaving(false);
    if (insertError) setError(insertError.message);
    else router.push('/');
  }

  const selectedCategory = categories.find((c) => String(c.id) === String(form.category_id));
  const isResort = !!selectedCategory && selectedCategory.slug === 'resorts-venues';

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
            <option key={c.id} value={c.id}>{getCategoryIcon(c.slug)} {c.name}</option>
          ))}
        </select>

        {isResort && (
          <div className="border border-stone-200 rounded-md p-3 flex flex-col gap-3">
            <p className="text-sm font-medium text-stone-700">Resort / venue details</p>

            <input
              type="number"
              min="1"
              placeholder="Max number of guests (optional)"
              value={form.max_guests}
              onChange={(e) => setForm({ ...form, max_guests: e.target.value })}
              className="border border-stone-300 rounded-md px-3 py-2"
            />

            <div>
              <p className="text-sm text-stone-600 mb-1">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {RESORT_AMENITIES.map((a) => (
                  <label
                    key={a}
                    className={`text-sm px-3 py-1.5 rounded-full border cursor-pointer ${
                      form.amenities.includes(a)
                        ? 'bg-green-700 text-white border-green-700'
                        : 'bg-white text-stone-600 border-stone-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.amenities.includes(a)}
                      onChange={() => handleToggleAmenity(a)}
                      className="hidden"
                    />
                    {a}
                  </label>
                ))}
              </div>
            </div>

            <textarea
              placeholder="House rules / check-in & check-out notes (optional)"
              value={form.house_rules}
              onChange={(e) => setForm({ ...form, house_rules: e.target.value })}
              className="border border-stone-300 rounded-md px-3 py-2"
              rows={2}
            />
          </div>
        )}

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
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Photos ({photos.length}/{MAX_PHOTOS})
          </label>
          {photoPreviews.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {photoPreviews.map((url, i) => (
                <div key={i} className="relative w-24 h-24">
                  <img
                    src={url}
                    alt={`Preview ${i + 1}`}
                    className="w-24 h-24 object-cover rounded-md border border-stone-200"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(i)}
                    aria-label="Remove photo"
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-stone-900 text-white text-sm flex items-center justify-center hover:bg-red-600"
                  >
                    ×
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 bg-green-700 text-white text-[10px] px-1.5 py-0.5 rounded">
                      Cover
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {photos.length < MAX_PHOTOS && (
            <input
              type="file" accept="image/*" multiple
              onChange={handleAddPhotos}
            />
          )}
          <p className="text-xs text-stone-400 mt-1">
            Up to {MAX_PHOTOS} photos. The first photo is used as the cover image.
          </p>
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

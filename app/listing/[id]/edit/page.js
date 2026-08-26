'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { geocodeAddress } from '@/lib/geocode';
import LocationPicker from '@/components/DynamicLocationPicker';
import { getCategoryIcon } from '@/lib/categoryIcons';
import { RESORT_AMENITIES } from '@/lib/resortAmenities';

const MAX_PHOTOS = 5;

export default function EditListingPage() {
  const { id } = useParams();
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', price: '', unit: 'each',
    category_id: '', barangay: '', city: '',
    latitude: null, longitude: null,
    max_guests: '', amenities: [], house_rules: '',
  });
  const [locationSource, setLocationSource] = useState(null); // null | 'auto' | 'manual'
  const [geocoding, setGeocoding] = useState(false);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [newPhotos, setNewPhotos] = useState([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);

  const totalPhotos = existingPhotos.length + newPhotos.length;

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: listing } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single();

      if (!listing) {
        setLoading(false);
        return;
      }

      if (listing.seller_id !== user.id) {
        setNotAllowed(true);
        setLoading(false);
        return;
      }

      setForm({
        title: listing.title || '',
        description: listing.description || '',
        price: listing.price || '',
        unit: listing.unit || 'each',
        category_id: listing.category_id || '',
        barangay: listing.barangay || '',
        city: listing.city || '',
        latitude: listing.latitude || null,
        longitude: listing.longitude || null,
        max_guests: listing.max_guests != null ? String(listing.max_guests) : '',
        amenities: listing.amenities || [],
        house_rules: listing.house_rules || '',
      });
      if (listing.latitude != null && listing.longitude != null) {
        setLocationSource('manual');
      }
      setExistingPhotos(listing.photo_urls || []);
      setLoading(false);
    }

    load();

    supabase.from('categories').select('*').order('name').then(({ data }) => {
      // Alphabetical, but "Other" always goes last no matter where it falls in the alphabet.
      const sorted = (data || []).slice().sort((a, b) => {
        if (a.name === 'Other') return 1;
        if (b.name === 'Other') return -1;
        return 0;
      });
      setCategories(sorted);
    });
  }, [id, router]);

  async function autoLocateFromAddress(barangay, city) {
    if (locationSource === 'manual') return; // don't override an existing/manual pin
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

  function handleRemoveExistingPhoto(index) {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddPhotos(e) {
    const selected = Array.from(e.target.files || []);
    const remainingSlots = Math.max(0, MAX_PHOTOS - existingPhotos.length - newPhotos.length);
    const toAdd = selected.slice(0, remainingSlots);
    const combined = [...newPhotos, ...toAdd];
    setNewPhotos(combined);
    setNewPhotoPreviews(combined.map((file) => URL.createObjectURL(file)));
    e.target.value = '';
  }

  function handleRemoveNewPhoto(index) {
    const updated = newPhotos.filter((_, i) => i !== index);
    setNewPhotos(updated);
    setNewPhotoPreviews(updated.map((file) => URL.createObjectURL(file)));
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

    const uploadedUrls = [];
    for (let i = 0; i < newPhotos.length; i++) {
      const file = newPhotos[i];
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
      uploadedUrls.push(publicUrl.publicUrl);
    }

    const updateData = {
      title: form.title,
      description: form.description,
      price: parseFloat(form.price),
      unit: form.unit,
      category_id: form.category_id || null,
      barangay: form.barangay,
      city: form.city,
      latitude,
      longitude,
      photo_urls: [...existingPhotos, ...uploadedUrls],
      max_guests: isResort && form.max_guests ? parseInt(form.max_guests, 10) : null,
      amenities: isResort ? form.amenities : [],
      house_rules: isResort ? form.house_rules || null : null,
    };

    const { error: updateError } = await supabase
      .from('listings')
      .update(updateData)
      .eq('id', id);

    setSaving(false);
    if (updateError) setError(updateError.message);
    else router.push(`/listing/${id}`);
  }

  if (loading) return <p className="text-stone-400 text-sm">Loading…</p>;
  if (notAllowed) return <p className="text-red-600 text-sm">You can only edit your own listings.</p>;

  const selectedCategory = categories.find((c) => String(c.id) === String(form.category_id));
  const isResort = !!selectedCategory && selectedCategory.slug === 'resorts-venues';

  return (
    <div className="max-w-lg mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Edit listing</h1>
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
            Photos ({totalPhotos}/{MAX_PHOTOS})
          </label>

          {(existingPhotos.length > 0 || newPhotoPreviews.length > 0) && (
            <div className="flex flex-wrap gap-2 mb-2">
              {existingPhotos.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <div key={'existing-' + i} className="relative w-24 h-24">
                  <img
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="w-24 h-24 object-cover rounded-md border border-stone-200"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveExistingPhoto(i)}
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
              {newPhotoPreviews.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <div key={'new-' + i} className="relative w-24 h-24">
                  <img
                    src={url}
                    alt={`New photo ${i + 1}`}
                    className="w-24 h-24 object-cover rounded-md border border-stone-200"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveNewPhoto(i)}
                    aria-label="Remove photo"
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-stone-900 text-white text-sm flex items-center justify-center hover:bg-red-600"
                  >
                    ×
                  </button>
                  {existingPhotos.length === 0 && i === 0 && (
                    <span className="absolute bottom-1 left-1 bg-green-700 text-white text-[10px] px-1.5 py-0.5 rounded">
                      Cover
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {totalPhotos < MAX_PHOTOS && (
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
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>
    </div>
  );
}

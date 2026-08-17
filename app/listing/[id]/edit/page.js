'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function EditListingPage() {
  const { id } = useParams();
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', price: '', unit: 'each',
    category_id: '', barangay: '', city: '', photo: null,
  });
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);

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
        photo: null,
      });
      setCurrentPhotoUrl(listing.photo_urls?.[0] || null);
      setLoading(false);
    }

    load();

    supabase.from('categories').select('*').order('id').then(({ data }) => setCategories(data || []));
  }, [id, router]);

  async function handleSubmit(e) {
    e.preventDefault();
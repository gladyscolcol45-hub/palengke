'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import ListingCard from '@/components/ListingCard';
import { useSearch } from '@/components/SearchContext';

export default function HomePage() {
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const { searchTerm } = useSearch();

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      setLoading(true);

      const { data: cats } = await supabase.from('categories').select('*').order('name');
      // Alphabetical, but "Other" always goes last no matter where it falls in the alphabet.
      const sortedCats = (cats || []).slice().sort((a, b) => {
        if (a.name === 'Other') return 1;
        if (b.name === 'Other') return -1;
        return 0;
      });
      setCategories(sortedCats);

      let query = supabase
        .from('listings')
        .select('*')
        .in('status', ['active', 'sold'])
        .order('created_at', { ascending: false });

      if (activeCategory) query = query.eq('category_id', activeCategory);
      if (searchTerm) query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);

      const { data: rows, error } = await query;
      if (error) console.error(error);
      setListings(rows || []);
      setLoading(false);
    }

    load();
  }, [activeCategory, searchTerm]);

  const activeCategoryObj = categories.find((c) => c.id === activeCategory);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex gap-2 overflow-x-auto pb-4 border-b border-stone-200 flex-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
              activeCategory === null ? 'bg-green-700 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                activeCategory === c.id ? 'bg-green-700 text-white' : 'bg-stone-100 text-stone-600'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <a
          href="/map"
          className="ml-3 mb-4 text-sm font-medium text-green-700 hover:underline whitespace-nowrap"
        >
          View on map
        </a>
      </div>

      {activeCategoryObj && activeCategoryObj.description && (
        <p className="text-sm text-stone-500 mb-4">{activeCategoryObj.description}</p>
      )}

      {loading ? (
        <p className="text-stone-400 text-sm">Loading listings…</p>
      ) : listings.length === 0 ? (
        <p className="text-stone-400 text-sm">
          {searchTerm ? `No results for "${searchTerm}".` : 'No listings yet. Be the first to sell something!'}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}

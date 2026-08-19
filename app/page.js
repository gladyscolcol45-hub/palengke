'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import ListingCard from '@/components/ListingCard';

export default function HomePage() {
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setSearchTerm(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      setLoading(true);

      const { data: cats } = await supabase.from('categories').select('*').order('id');
      setCategories(cats || []);

      let query = supabase
        .from('listings')
        .select('*')
        .eq('status', 'active')
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

  return (
    <div>
      <div className="relative mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search items, resorts & venues…"
          className="w-full border border-stone-300 rounded-full px-4 py-2.5 pl-10 text-sm outline-none focus:border-green-600"
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-sm"
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
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

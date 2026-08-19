'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { useSearch } from './SearchContext';

export default function HeaderSearch() {
  const [user, setUser] = useState(null);
  const router = useRouter();
  const pathname = usePathname();
  const { searchOpen, setSearchOpen, searchInput, setSearchInput, closeSearch } = useSearch();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!user) return null;

  function openSearch() {
    setSearchOpen(true);
    if (pathname !== '/') router.push('/');
  }

  if (searchOpen) {
    return (
      <div className="relative w-36 sm:w-56">
        <input
          autoFocus
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search…"
          className="w-full border border-stone-300 rounded-full pl-8 pr-7 py-1.5 text-sm outline-none focus:border-green-600"
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-4 h-4 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <button
          onClick={closeSearch}
          aria-label="Close search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-sm"
        >
          &times;
        </button>
      </div>
    );
  }

  return (
    <button onClick={openSearch} aria-label="Search" className="text-stone-600 hover:text-green-700 px-1">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </button>
  );
}

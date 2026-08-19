'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const SearchContext = createContext(null);

export function SearchProvider({ children }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setSearchTerm(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  function closeSearch() {
    setSearchOpen(false);
    setSearchInput('');
  }

  return (
    <SearchContext.Provider
      value={{ searchOpen, setSearchOpen, searchInput, setSearchInput, searchTerm, closeSearch }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  return useContext(SearchContext);
}

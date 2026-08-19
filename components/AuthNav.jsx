'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabaseClient';
export default function AuthNav() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
      setLoading(false);
      if (data?.user) {
        supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            setIsAdmin(!!(profile && profile.is_admin));
          });
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setMenuOpen(false);
  }
  if (loading) return null;
  if (user) {
    return (
      <div className="relative" ref={menuRef}>
        <button onClick={() => setMenuOpen(!menuOpen)} className="text-stone-600 hover:text-green-700 px-2 py-1 text-xl leading-none" aria-label="Menu">&#8942;</button>
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-40 bg-white border border-stone-200 rounded-md shadow-lg py-1 z-20">
            {isAdmin && (
              <a href="/admin/reports" className="block px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 hover:text-green-700" onClick={() => setMenuOpen(false)}>Reports (Admin)</a>
            )}
            <a href="/favorites" className="block px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 hover:text-green-700" onClick={() => setMenuOpen(false)}>Saved</a>
            <a href="/settings" className="block px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 hover:text-green-700" onClick={() => setMenuOpen(false)}>Settings</a>
            <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 hover:text-green-700">Log out</button>
          </div>
        )}
      </div>
    );
  }
  return (
    <a href="/login" className="text-stone-600 hover:text-green-700">Log in</a>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

export default function AuthNav() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }

  if (loading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <a href="/settings" className="text-stone-600 hover:text-green-700">
          Settings
        </a>
        <button
          onClick={handleLogout}
          className="text-stone-600 hover:text-green-700"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <a href="/login" className="text-stone-600 hover:text-green-700">
      Log in
    </a>
  );
}
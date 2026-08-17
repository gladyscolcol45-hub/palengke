'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

export default function FloatingSell() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!user) return null;

  return (
    <a href="/new-listing" className="fixed bottom-6 right-6 bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-3 rounded-full shadow-lg z-20">Sell</a>
  );
}

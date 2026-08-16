'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function RequireAuth({ children }) {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
      setChecking(false);
      if (!data?.user && pathname !== '/login') {
        router.push('/login');
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (!session?.user && pathname !== '/login') {
        router.push('/login');
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [pathname, router]);

  if (checking) {
    return <p className="text-stone-400 text-sm text-center py-12">Loading…</p>;
  }

  if (!user && pathname !== '/login') {
    return null;
  }

  return children;
}
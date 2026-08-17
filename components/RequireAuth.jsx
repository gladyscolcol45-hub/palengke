'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

const PUBLIC_PATHS = ['/login', '/signup'];

export default function RequireAuth({ children }) {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
      setChecking(false);
      if (!data?.user && !isPublic) {
        router.push('/login');
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (!session?.user && !isPublic) {
        router.push('/login');
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [pathname, router, isPublic]);

  if (checking) {
    return <p className="text-stone-400 text-sm text-center py-12">Loading…</p>;
  }

  if (!user && !isPublic) {
    return null;
  }

  return children;
}

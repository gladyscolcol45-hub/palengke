'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function BottomNav() {
  const [user, setUser] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!user) return null;

  const items = [
    { href: '/', label: 'Home' },
    { href: '/map', label: 'Map' },
    { href: '/messages', label: 'Chats' },
    { href: `/profile/${user.id}`, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex justify-around items-center py-2 z-20">
      {items.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <a
            key={item.href}
            href={item.href}
            className={`text-xs font-medium px-4 py-1.5 rounded-md ${
              active ? 'text-green-700' : 'text-stone-500 hover:text-green-700'
            }`}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

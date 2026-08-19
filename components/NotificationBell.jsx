'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

export default function NotificationBell() {
  const [user, setUser] = useState(null);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let channel;

    async function checkUnread(userId) {
      if (!userId) {
        setHasUnread(false);
        return;
      }
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);
      setHasUnread(!!count && count > 0);
    }

    function subscribe(userId) {
      if (!userId) return;
      channel = supabase
        .channel(`notifications-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          () => checkUnread(userId)
        )
        .subscribe();
    }

    supabase.auth.getUser().then(({ data }) => {
      const currentUser = data?.user || null;
      setUser(currentUser);
      checkUnread(currentUser?.id || null);
      subscribe(currentUser?.id || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      checkUnread(session?.user?.id || null);
    });

    return () => {
      listener.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  if (!user) return null;

  return (
    <a href="/notifications" aria-label="Notifications" className="relative text-stone-600 hover:text-green-700 px-1">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {hasUnread && <span className="absolute top-0 right-0 w-2 h-2 bg-orange-700 rounded-full" />}
    </a>
  );
}

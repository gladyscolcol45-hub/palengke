'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

export default function NotificationBell() {
  const [user, setUser] = useState(null);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function checkUnread(currentUser) {
      if (!currentUser) return;

      const { data: chats } = await supabase
        .from('chats')
        .select('id, buyer_id, seller_id, buyer_last_read_at, seller_last_read_at')
        .or('buyer_id.eq.' + currentUser.id + ',seller_id.eq.' + currentUser.id);

      if (!chats || chats.length === 0) {
        if (!cancelled) setHasUnread(false);
        return;
      }

      for (const chat of chats) {
        const isBuyer = chat.buyer_id === currentUser.id;
        const myLastRead = isBuyer ? chat.buyer_last_read_at : chat.seller_last_read_at;

        const { data: lastMsgRows } = await supabase
          .from('messages')
          .select('sender_id, created_at')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMsg = lastMsgRows && lastMsgRows.length > 0 ? lastMsgRows[0] : null;
        const unread = !!(
          lastMsg &&
          lastMsg.sender_id !== currentUser.id &&
          (!myLastRead || new Date(lastMsg.created_at) > new Date(myLastRead))
        );

        if (unread) {
          if (!cancelled) setHasUnread(true);
          return;
        }
      }

      if (!cancelled) setHasUnread(false);
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
      checkUnread(data?.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      checkUnread(session?.user || null);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!user) return null;

  return (
    <a href="/messages" aria-label="Notifications" className="relative text-stone-600 hover:text-green-700 px-1">
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

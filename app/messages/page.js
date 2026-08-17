'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

export default function MessagesPage() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const chatsResult = await supabase
        .from('chats')
        .select('id, listing_id, buyer_id, seller_id, created_at')
        .or('buyer_id.eq.' + user.id + ',seller_id.eq.' + user.id)
        .order('created_at', { ascending: false });

      const chatList = chatsResult.data || [];

      const enriched = await Promise.all(
        chatList.map(async (chat) => {
          const otherId = chat.buyer_id === user.id ? chat.seller_id : chat.buyer_id;

          const listingResult = await supabase
            .from('listings')
            .select('title, photo_urls')
            .eq('id', chat.listing_id)
            .single();

          const profileResult = await supabase
            .from('profiles')
            .select('username')
            .eq('id', otherId)
            .single();

          const lastMsgResult = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...chat,
            listingTitle: listingResult.data ? listingResult.data.title : 'Listing',
            listingPhoto: listingResult.data && listingResult.data.photo_urls ? listingResult.data.photo_urls[0] : null,
            otherUsername: profileResult.data ? profileResult.data.username : 'User',
            lastMessage: lastMsgResult.data ? lastMsgResult.data.content : null,
          };
        })
      );

      setChats(enriched);
      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return <p className="text-stone-400 text-sm">Loading...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>
      {chats.length === 0 ? (
        <p className="text-stone-400 text-sm">No conversations yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {chats.map((chat) => (
            
              key={chat.id}
              href={'/chat/' + chat.id}
              className="flex items-center gap-3 border border-stone-200 rounded-lg p-3 hover:bg-stone-50"
            >
              <div className="w-14 h-14 rounded-md bg-stone-100 overflow-hidden flex-shrink-0">
                {chat.listingPhoto ? (
                  <img src={chat.listingPhoto} alt={chat.listingTitle} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">No photo</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{chat.listingTitle}</p>
                <p className="text-sm text-stone-500 truncate">with {chat.otherUsername}</p>
                {chat.lastMessage && (
                  <p className="text-sm text-stone-400 truncate">{chat.lastMessage}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'selling', label: 'Selling' },
  { key: 'buying', label: 'Buying' },
  { key: 'unread', label: 'Unread' },
];

export default function MessagesPage() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const chatsResult = await supabase
        .from('chats')
        .select('id, listing_id, buyer_id, seller_id, created_at, buyer_last_read_at, seller_last_read_at')
        .or('buyer_id.eq.' + user.id + ',seller_id.eq.' + user.id)
        .order('created_at', { ascending: false });

      const chatList = chatsResult.data || [];
      const results = [];

      for (let i = 0; i < chatList.length; i++) {
        const chat = chatList[i];
        const isBuyer = chat.buyer_id === user.id;
        const otherId = isBuyer ? chat.seller_id : chat.buyer_id;
        const role = isBuyer ? 'buying' : 'selling';
        const myLastRead = isBuyer ? chat.buyer_last_read_at : chat.seller_last_read_at;

        const listingResult = await supabase
          .from('listings')
          .select('title, photo_urls')
          .eq('id', chat.listing_id)
          .single();

        const profileResult = await supabase
          .from('profiles')
          .select('username, verified_until')
          .eq('id', otherId)
          .single();

        const msgsResult = await supabase
          .from('messages')
          .select('content, created_at, sender_id')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMsg = msgsResult.data && msgsResult.data.length > 0 ? msgsResult.data[0] : null;

        const isUnread = !!(
          lastMsg &&
          lastMsg.sender_id !== user.id &&
          (!myLastRead || new Date(lastMsg.created_at) > new Date(myLastRead))
        );

        results.push({
          id: chat.id,
          role,
          isUnread,
          listingTitle: listingResult.data ? listingResult.data.title : 'Listing',
          listingPhoto: listingResult.data && listingResult.data.photo_urls ? listingResult.data.photo_urls[0] : null,
          otherUsername: profileResult.data && profileResult.data.username ? profileResult.data.username : 'Unnamed user',
          otherVerified: !!(
            profileResult.data &&
            profileResult.data.verified_until &&
            new Date(profileResult.data.verified_until) > new Date()
          ),
          lastMessage: lastMsg ? lastMsg.content : null,
        });
      }

      setChats(results);
      setLoading(false);
    }

    load();
  }, []);

  const filteredChats = chats.filter((chat) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return chat.isUnread;
    return chat.role === activeTab;
  });

  if (loading) {
    return <p className="text-stone-400 text-sm">Loading...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Chats</h1>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 border-b border-stone-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
              activeTab === tab.key ? 'bg-green-700 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredChats.length === 0 ? (
        <p className="text-stone-400 text-sm">No conversations here yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredChats.map(function (chat) {
            const chatUrl = '/chat/' + chat.id;
            return (
              <a key={chat.id} href={chatUrl} className="flex items-center gap-3 border border-stone-200 rounded-lg p-3 hover:bg-stone-50">
                <div className="w-14 h-14 rounded-md bg-stone-100 overflow-hidden flex-shrink-0 relative">
                  {chat.listingPhoto ? (
                    <img src={chat.listingPhoto} alt={chat.listingTitle} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">No photo</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`truncate ${chat.isUnread ? 'font-bold text-stone-900' : 'font-medium'}`}>{chat.listingTitle}</p>
                    {chat.isUnread && <span className="w-2 h-2 rounded-full bg-orange-700 flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-stone-500 truncate flex items-center gap-1">
                    with {chat.otherUsername}
                    {chat.otherVerified && (
                      <span
                        title="Verified Seller"
                        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-700 text-white text-[9px] flex-shrink-0"
                      >
                        ✓
                      </span>
                    )}
                    · {chat.role === 'selling' ? 'Selling' : 'Buying'}
                  </p>
                  <p className={`text-sm truncate ${chat.isUnread ? 'text-stone-700 font-medium' : 'text-stone-400'}`}>
                    {chat.lastMessage ? chat.lastMessage : 'No messages yet'}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

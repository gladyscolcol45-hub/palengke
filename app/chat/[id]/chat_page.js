'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function ChatPage() {
  const { id: chatId } = useParams();
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [userId, setUserId] = useState(null);
  const [otherUserId, setOtherUserId] = useState(null);
  const [blocking, setBlocking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const supabase = createClient();
    let channel;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);

      const { data: chat } = await supabase
        .from('chats')
        .select('buyer_id, seller_id')
        .eq('id', chatId)
        .single();

      if (chat && user) {
        const other = chat.buyer_id === user.id ? chat.seller_id : chat.buyer_id;
        setOtherUserId(other);
      }

      const { data: existing } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      setMessages(existing || []);

      // Subscribe to new messages in real time
      channel = supabase
        .channel(`chat-${chatId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
          (payload) => setMessages((prev) => [...prev, payload.new])
        )
        .subscribe();
    }

    init();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const supabase = createClient();
    await supabase.from('messages').insert({ chat_id: chatId, sender_id: userId, content: text.trim() });
    setText('');
  }

  async function handleBlock() {
    if (!otherUserId) return;
    const confirmed = window.confirm('Block this user? You will no longer see their messages or listings.');
    if (!confirmed) return;

    setBlocking(true);
    const supabase = createClient();
    const { error } = await supabase.from('blocks').insert({
      blocker_id: userId,
      blocked_id: otherUserId,
    });
    setBlocking(false);

    if (!error) {
      setBlocked(true);
      setTimeout(() => router.push('/'), 1500);
    }
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col h-[70vh]">
      <div className="flex justify-end mb-2">
        {!blocked && otherUserId && (
          <button
            onClick={handleBlock}
            disabled={blocking}
            className="text-xs text-stone-400 hover:text-red-600 underline disabled:opacity-50"
          >
            {blocking ? 'Blocking…' : 'Block user'}
          </button>
        )}
      </div>

      {blocked && (
        <p className="text-sm text-green-700 mb-2">User blocked. Redirecting…</p>
      )}

      <div className="flex-1 overflow-y-auto border border-stone-200 rounded-t-lg p-4 bg-white">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`mb-2 flex ${m.sender_id === userId ? 'justify-end' : 'justify-start'}`}
          >
            <span
              className={`inline-block px-3 py-2 rounded-lg max-w-[75%] ${
                m.sender_id === userId ? 'bg-orange-700 text-white' : 'bg-stone-100 text-stone-800'
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={sendMessage} className="flex border border-t-0 border-stone-200 rounded-b-lg overflow-hidden">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 px-3 py-2 outline-none"
          disabled={blocked}
        />
        <button type="submit" disabled={blocked} className="bg-orange-700 text-white px-4 font-semibold hover:bg-orange-800 disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
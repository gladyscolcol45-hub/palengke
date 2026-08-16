'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function ChatPage() {
  const { id: chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [userId, setUserId] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const supabase = createClient();
    let channel;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);

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

  return (
    <div className="max-w-xl mx-auto flex flex-col h-[70vh]">
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
        />
        <button type="submit" className="bg-orange-700 text-white px-4 font-semibold hover:bg-orange-800">
          Send
        </button>
      </form>
    </div>
  );
}

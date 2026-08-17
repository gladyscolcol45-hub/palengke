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

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);

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

      if (user) {
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id')
          .eq('reviewer_id', user.id)
          .eq('chat_id', chatId)
          .maybeSingle();
        if (existingReview) setReviewSubmitted(true);
      }

      const { data: existing } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      setMessages(existing || []);

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

  async function handleSubmitReview() {
    if (rating === 0) {
      setReviewError('Please select a star rating.');
      return;
    }
    setReviewSubmitting(true);
    setReviewError('');
    const supabase = createClient();

    const { error } = await supabase.from('reviews').insert({
      reviewer_id: userId,
      reviewed_user_id: otherUserId,
      chat_id: chatId,
      rating,
      comment: reviewComment || null,
    });

    setReviewSubmitting(false);

    if (error) {
      setReviewError('Something went wrong. Please try again.');
      return;
    }

    setReviewSubmitted(true);
    setShowReviewForm(false);
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col h-[70vh]">
      <div className="flex justify-between items-center mb-2">
        {!reviewSubmitted && otherUserId && (
          <button
            onClick={() => setShowReviewForm((v) => !v)}
            className="text-xs text-green-700 hover:text-green-800 underline"
          >
            Leave a review
          </button>
        )}
        {reviewSubmitted && (
          <span className="text-xs text-green-700">Review submitted ✓</span>
        )}

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

      {showReviewForm && (
        <div className="mb-3 border border-stone-200 rounded-md p-4 bg-stone-50">
          <p className="text-sm font-medium text-stone-700 mb-2">Rate this user</p>
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="text-2xl leading-none"
              >
                <span className={(hoverRating || rating) >= star ? 'text-yellow-500' : 'text-stone-300'}>
                  ★
                </span>
              </button>
            ))}
          </div>
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            rows={2}
            placeholder="Optional comment"
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          {reviewError && <p className="text-sm text-red-600 mb-2">{reviewError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSubmitReview}
              disabled={reviewSubmitting}
              className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
            >
              {reviewSubmitting ? 'Submitting…' : 'Submit review'}
            </button>
            <button
              onClick={() => setShowReviewForm(false)}
              className="text-stone-500 text-sm px-4 py-2 hover:text-stone-700"
            >
              Cancel
            </button>
          </div>
        </div>
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

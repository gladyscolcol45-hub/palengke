'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

const TYPE_ICON = {
  message: '💬',
  review: '⭐',
  listing_reported: '⚠️',
  listing_removed: '🚫',
  verified: '✅',
};

function timeAgo(dateString) {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days + 'd ago';
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      setLoading(true);
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setNotifications(data || []);
      setLoading(false);

      const unreadIds = (data || []).filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length > 0) {
        await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
      }
    }

    load();
  }, []);

  if (loading) {
    return <p className="text-stone-400 text-sm">Loading...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Notifications</h1>
      {notifications.length === 0 ? (
        <p className="text-stone-400 text-sm">No notifications yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <a
              key={n.id}
              href={n.link || '#'}
              className={`flex items-start gap-3 border rounded-lg p-3 hover:bg-stone-50 ${
                n.read ? 'border-stone-200' : 'border-green-200 bg-green-50'
              }`}
            >
              <span className="text-xl leading-none">{TYPE_ICON[n.type] || '🔔'}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${n.read ? 'text-stone-700' : 'text-stone-900 font-medium'}`}>{n.message}</p>
                <p className="text-xs text-stone-400 mt-1">{timeAgo(n.created_at)}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

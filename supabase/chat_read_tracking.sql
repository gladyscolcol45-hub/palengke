-- Tracks when each side of a chat last read it, so the Chats list can show
-- an "Unread" filter.
-- Run this in Supabase SQL Editor.

alter table chats
  add column if not exists buyer_last_read_at timestamptz,
  add column if not exists seller_last_read_at timestamptz;

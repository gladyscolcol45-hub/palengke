-- Notifications: reviews received, listing reported, listing removed by admin,
-- and new chat messages all create a row here, which powers the bell icon.
-- Run this whole file in Supabase SQL Editor.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

drop policy if exists "select own notifications" on notifications;
create policy "select own notifications" on notifications
  for select using (auth.uid() = user_id);

drop policy if exists "insert notifications" on notifications;
create policy "insert notifications" on notifications
  for insert to authenticated with check (true);

drop policy if exists "update own notifications" on notifications;
create policy "update own notifications" on notifications
  for update using (auth.uid() = user_id);

-- Favorites (saved listings)
create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  listing_id uuid references listings(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

alter table favorites enable row level security;

drop policy if exists "select own favorites" on favorites;
create policy "select own favorites" on favorites
  for select using (auth.uid() = user_id);

drop policy if exists "insert own favorites" on favorites;
create policy "insert own favorites" on favorites
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "delete own favorites" on favorites;
create policy "delete own favorites" on favorites
  for delete using (auth.uid() = user_id);

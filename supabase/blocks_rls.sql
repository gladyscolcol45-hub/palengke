-- Blocked users list support
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to run even if the "blocks" table already exists.

create table if not exists blocks (
  id uuid primary key default uuid_generate_v4(),
  blocker_id uuid references profiles(id) on delete cascade not null,
  blocked_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id)
);

alter table blocks enable row level security;

-- Users can see who THEY blocked
drop policy if exists "Users can view their own blocks" on blocks;
create policy "Users can view their own blocks" on blocks
  for select using (auth.uid() = blocker_id);

-- Users can block someone (already existed, re-created here to be safe)
drop policy if exists "Users can block others" on blocks;
create policy "Users can block others" on blocks
  for insert with check (auth.uid() = blocker_id);

-- Users can unblock (delete their own block rows)
drop policy if exists "Users can remove their own blocks" on blocks;
create policy "Users can remove their own blocks" on blocks
  for delete using (auth.uid() = blocker_id);

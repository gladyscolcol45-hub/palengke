-- Boosted listings: sellers pay a small fee to have their listing pinned to
-- the top of the home feed for 7 days. Uses the same manual GCash + admin
-- approval pattern as verification_requests. Run this whole file in the
-- Supabase SQL Editor.

alter table listings
  add column if not exists boosted_until timestamptz;

create table if not exists boost_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  payment_proof_path text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists boost_requests_status_idx on boost_requests(status);
create index if not exists boost_requests_listing_idx on boost_requests(listing_id);

alter table boost_requests enable row level security;

drop policy if exists "select own boost requests" on boost_requests;
create policy "select own boost requests" on boost_requests
  for select using (auth.uid() = user_id);

drop policy if exists "insert own boost requests" on boost_requests;
create policy "insert own boost requests" on boost_requests
  for insert to authenticated with check (auth.uid() = user_id);

-- No update/delete policy for regular users on purpose: only the admin API
-- route (which uses the Supabase secret key and bypasses RLS) can move a
-- request to 'approved' or 'rejected'.

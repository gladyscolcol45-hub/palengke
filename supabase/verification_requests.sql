-- Lets a seller request the Verified Seller badge themselves after paying via
-- GCash ("I've paid" button in Settings), instead of the admin granting it
-- unprompted. Each request starts as 'pending' and an admin approves or
-- rejects it from /admin/users. Run this whole file in Supabase SQL Editor.

create table if not exists verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists verification_requests_status_idx on verification_requests(status);
create index if not exists verification_requests_user_idx on verification_requests(user_id);

alter table verification_requests enable row level security;

drop policy if exists "select own verification requests" on verification_requests;
create policy "select own verification requests" on verification_requests
  for select using (auth.uid() = user_id);

drop policy if exists "insert own verification requests" on verification_requests;
create policy "insert own verification requests" on verification_requests
  for insert to authenticated with check (auth.uid() = user_id);

-- No update/delete policy for regular users on purpose: only the admin API
-- route (which uses the Supabase secret key and bypasses RLS) can move a
-- request to 'approved' or 'rejected'.

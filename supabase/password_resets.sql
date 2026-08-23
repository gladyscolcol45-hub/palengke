-- "Forgot password" flow. Since accounts use username + a fake email
-- (username@palengke.local) instead of a real inbox, there's no way to send
-- a normal password-reset email. Instead: a user requests a reset, an admin
-- verifies who they are off-app (phone/Messenger, using the phone number on
-- their profile) and generates a one-time temporary password for them via
-- /admin/password-resets, then tells them the temp password directly. The
-- user logs in with it and should set their own password from Settings
-- right away.
-- Run this whole file in Supabase SQL Editor.

create table if not exists password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  username text not null,
  phone text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists password_reset_requests_status_idx on password_reset_requests(status);

alter table password_reset_requests enable row level security;

-- No client-facing policies on purpose: the request is submitted by someone
-- who isn't logged in yet, and approving it changes someone's password, so
-- both the insert (POST /api/forgot-password) and the approve/reject
-- (POST /api/admin/password-resets) go through server routes using the
-- Supabase secret key, which bypasses RLS entirely.

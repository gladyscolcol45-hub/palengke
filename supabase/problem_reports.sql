-- "Report a problem" feature: an in-app message box (replaces the mailto
-- link in Settings). Every submission is saved here so nothing is lost even
-- if the email notification below fails to send; the admin can always check
-- this table in the Supabase Table Editor as a backup.
-- Run this whole file in Supabase SQL Editor.

create table if not exists problem_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  username text,
  message text not null,
  emailed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists problem_reports_created_idx on problem_reports(created_at desc);

alter table problem_reports enable row level security;

-- Regular users can insert their own report but never read reports (including
-- their own) back — this is a one-way "send to admin" box, not a ticket
-- history. Only the API route (using the Supabase secret key, which bypasses
-- RLS) reads from this table.
drop policy if exists "insert own problem report" on problem_reports;
create policy "insert own problem report" on problem_reports
  for insert to authenticated with check (auth.uid() = user_id);

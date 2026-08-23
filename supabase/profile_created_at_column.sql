-- Records when each account signed up (used by the admin "All signups" list).
-- Safe to run even if this column already exists.

alter table profiles
  add column if not exists created_at timestamptz not null default now();

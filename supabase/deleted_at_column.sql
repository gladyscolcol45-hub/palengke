-- Adds account-deactivation support ("Delete account" in Settings)
-- Run this in Supabase SQL Editor. Safe to run even if the column already exists.

alter table profiles
  add column if not exists deleted_at timestamptz;

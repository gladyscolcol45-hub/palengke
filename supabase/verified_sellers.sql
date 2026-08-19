-- Adds a "Verified Seller" badge that only an admin can grant.
-- Run this in Supabase SQL Editor.

alter table profiles
  add column if not exists is_verified boolean not null default false;

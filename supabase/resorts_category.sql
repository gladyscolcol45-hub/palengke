-- Adds a "Resorts & Venues" category so owners can list places to gather
-- (resorts, event venues, etc.) using the existing listing system.
-- Run this in Supabase SQL Editor.

insert into categories (name, slug) values
  ('Resorts & Venues', 'resorts-venues')
on conflict (slug) do nothing;

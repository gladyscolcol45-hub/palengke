-- Adds "Motors" (vehicles) and "Food & Snacks" (home-based food businesses
-- like BBQ, halo-halo, banana-q) categories, using the existing listing
-- system — no app code changes needed, since the category dropdown and the
-- home page filter chips already read straight from this table.
-- Run this in Supabase SQL Editor.

insert into categories (name, slug) values
  ('Motors', 'motors'),
  ('Food & Snacks', 'food-snacks')
on conflict (slug) do nothing;

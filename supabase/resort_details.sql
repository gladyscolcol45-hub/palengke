-- Extra fields for Resorts & Venues listings: how many guests it fits,
-- which amenities it has, and any house rules / check-in-check-out notes.
-- These columns are harmless on non-resort listings too (they just stay
-- empty). Run this whole file in the Supabase SQL Editor.

alter table listings
  add column if not exists max_guests int;

alter table listings
  add column if not exists amenities text[] default '{}';

alter table listings
  add column if not exists house_rules text;

-- Adds "Reserved" and "In Use" as listing statuses, on top of the existing
-- active/sold/removed. Meant for Resorts & Venues listings, where the owner
-- can manually mark a place as reserved or currently in use (this is
-- separate from the bookings table — it's just a manual flag the owner
-- controls, the same way "Mark as sold" already works for other listings).
-- Run this whole file in the Supabase SQL Editor.

alter table listings drop constraint if exists listings_status_check;

alter table listings add constraint listings_status_check
  check (status in ('active', 'sold', 'removed', 'reserved', 'in_use'));

-- Lets a category carry an optional short helper note, shown under the
-- category filter bar on the home page when that category is selected.
-- Run this in Supabase SQL Editor.

alter table categories add column if not exists description text;

update categories
set description = 'Selling halo-halo, BBQ, banana-q, or other homemade snacks? Add photos and your location so buyers can find you.'
where slug = 'food-snacks';

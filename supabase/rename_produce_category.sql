-- Renames the "Produce" category to "Vegetable". Existing listings already
-- posted under this category keep working since they're linked by category
-- id, not by name.
-- Run this in Supabase SQL Editor.

update categories set name = 'Vegetable' where slug = 'produce';

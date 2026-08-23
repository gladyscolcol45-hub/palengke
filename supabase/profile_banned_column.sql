-- Lets the admin temporarily suspend an account (e.g. "ban for a day")
-- instead of only being able to delete it. Safe to run even if this column
-- already exists.

alter table profiles
  add column if not exists banned_until timestamptz;

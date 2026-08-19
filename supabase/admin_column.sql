-- Adds an admin flag so only you can access the reports moderation page.
-- Run this in Supabase SQL Editor.

alter table profiles
  add column if not exists is_admin boolean default false;

-- Make your own account (username: gladys123) the admin.
update profiles
set is_admin = true
where username = 'gladys123';

-- Signup now collects a real email (replacing the phone-number requirement)
-- so password-reset temp passwords can be emailed directly to the user
-- instead of relying on the admin to relay them by phone.
-- Run this whole file in Supabase SQL Editor.

alter table profiles
  add column if not exists email text;

alter table password_reset_requests
  add column if not exists email text;

-- Turns the Verified Seller badge into a 30-day billing cycle instead of a
-- permanent on/off flag. verified_until holds the expiry date; the badge
-- disappears automatically once that date passes.
-- Safe to run even if you already ran verified_sellers.sql before this.

alter table profiles
  add column if not exists is_verified boolean not null default false;

alter table profiles
  add column if not exists verified_until timestamptz;

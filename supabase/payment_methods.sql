-- Lets sellers/buyers pick GCash or GoTyme Bank when they pay for Verified
-- Seller, a boosted listing, or a booking commission. Defaults to 'gcash' so
-- existing rows stay valid. Run this whole file in the Supabase SQL Editor.

alter table verification_requests
  add column if not exists payment_method text not null default 'gcash';

alter table boost_requests
  add column if not exists payment_method text not null default 'gcash';

alter table bookings
  add column if not exists commission_payment_method text not null default 'gcash';

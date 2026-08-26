-- Bookings for Resorts & Venues listings, with a commission Palengke collects
-- from the seller once a booking is completed. There's no live calendar —
-- dates are a free-text note the buyer and seller agree on via chat/booking
-- messages. Commission is paid the same manual GCash + screenshot way as
-- Verified Seller and boosted listings; the payment proof reuses the
-- existing private 'payment-proofs' storage bucket (no new bucket needed).
-- Run this whole file in the Supabase SQL Editor.

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id) on delete cascade not null,
  buyer_id uuid references auth.users(id) on delete cascade not null,
  seller_id uuid references auth.users(id) on delete cascade not null,
  dates_note text,
  guest_count int,
  message text,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'completed')),
  total_price numeric(10,2),
  commission_rate numeric(4,3) not null default 0.10,
  commission_amount numeric(10,2),
  commission_status text not null default 'unpaid' check (commission_status in ('unpaid', 'pending_review', 'paid')),
  commission_proof_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_listing_idx on bookings(listing_id);
create index if not exists bookings_buyer_idx on bookings(buyer_id);
create index if not exists bookings_seller_idx on bookings(seller_id);
create index if not exists bookings_commission_status_idx on bookings(commission_status);

alter table bookings enable row level security;

drop policy if exists "participants can view their bookings" on bookings;
create policy "participants can view their bookings" on bookings
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "buyers can request a booking" on bookings;
create policy "buyers can request a booking" on bookings
  for insert to authenticated with check (auth.uid() = buyer_id);

drop policy if exists "seller or buyer can update their booking" on bookings;
create policy "seller or buyer can update their booking" on bookings
  for update using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- No delete policy on purpose — bookings stay as a record even if declined.

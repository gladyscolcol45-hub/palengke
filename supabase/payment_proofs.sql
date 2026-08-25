-- Lets a seller attach a screenshot of their GCash payment when requesting
-- the Verified Seller badge in Settings. The screenshot is stored in a
-- PRIVATE bucket (not public like listing photos) since it may show a
-- reference number or sender name — only the seller who uploaded it and the
-- admin (via the service key, which bypasses RLS) can view it. Run this
-- whole file in Supabase SQL Editor.

alter table verification_requests add column if not exists payment_proof_path text;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own payment proof" on storage.objects;
create policy "Users can upload their own payment proof" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can view their own payment proof" on storage.objects;
create policy "Users can view their own payment proof" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

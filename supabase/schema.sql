-- Palengke marketplace schema
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================
-- PROFILES (extends Supabase auth.users)
-- ============================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  barangay text,           -- neighborhood / area, used for location filtering
  city text,
  created_at timestamptz default now()
);

-- Auto-create a profile row whenever someone signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================
-- CATEGORIES
-- ============================
create table if not exists categories (
  id serial primary key,
  name text not null unique,
  slug text not null unique
);

insert into categories (name, slug) values
  ('Produce', 'produce'),
  ('Seafood', 'seafood'),
  ('Meat & Poultry', 'meat-poultry'),
  ('Home Goods', 'home-goods'),
  ('Electronics', 'electronics'),
  ('Clothing', 'clothing'),
  ('Other', 'other')
on conflict (slug) do nothing;

-- ============================
-- LISTINGS
-- ============================
create table if not exists listings (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid references profiles(id) on delete cascade not null,
  category_id int references categories(id),
  title text not null,
  description text,
  price numeric(10,2) not null,
  unit text default 'each',        -- e.g. 'kg', 'each', 'bundle'
  photo_urls text[] default '{}',
  barangay text,                   -- copied from seller at post time, editable
  city text,
  latitude double precision,
  longitude double precision,
  status text default 'active' check (status in ('active','sold','removed')),
  created_at timestamptz default now()
);

create index if not exists listings_category_idx on listings(category_id);
create index if not exists listings_status_idx on listings(status);
create index if not exists listings_created_idx on listings(created_at desc);

-- ============================
-- CHATS (one per buyer-seller-listing combination)
-- ============================
create table if not exists chats (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references listings(id) on delete cascade,
  buyer_id uuid references profiles(id) on delete cascade,
  seller_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (listing_id, buyer_id, seller_id)
);

-- ============================
-- MESSAGES
-- ============================
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid references chats(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists messages_chat_idx on messages(chat_id, created_at);

-- ============================
-- ROW LEVEL SECURITY
-- ============================
alter table profiles enable row level security;
alter table listings enable row level security;
alter table chats enable row level security;
alter table messages enable row level security;

-- Profiles: anyone can view, only the owner can edit
create policy "Profiles are viewable by everyone" on profiles
  for select using (true);
create policy "Users can update their own profile" on profiles
  for update using (auth.uid() = id);

-- Listings: anyone can view active listings; only the seller can insert/edit/delete their own
create policy "Listings are viewable by everyone" on listings
  for select using (true);
create policy "Sellers can insert their own listings" on listings
  for insert with check (auth.uid() = seller_id);
create policy "Sellers can update their own listings" on listings
  for update using (auth.uid() = seller_id);
create policy "Sellers can delete their own listings" on listings
  for delete using (auth.uid() = seller_id);

-- Chats: only buyer or seller in the chat can see/create it
create policy "Participants can view their chats" on chats
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "Buyers can start a chat" on chats
  for insert with check (auth.uid() = buyer_id);

-- Messages: only participants of the parent chat can read/send
create policy "Participants can view messages" on messages
  for select using (
    exists (
      select 1 from chats
      where chats.id = messages.chat_id
      and (chats.buyer_id = auth.uid() or chats.seller_id = auth.uid())
    )
  );
create policy "Participants can send messages" on messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from chats
      where chats.id = messages.chat_id
      and (chats.buyer_id = auth.uid() or chats.seller_id = auth.uid())
    )
  );

-- ============================
-- STORAGE (run in Storage settings, or via SQL)
-- ============================
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

create policy "Anyone can view listing photos" on storage.objects
  for select using (bucket_id = 'listing-photos');
create policy "Authenticated users can upload listing photos" on storage.objects
  for insert with check (bucket_id = 'listing-photos' and auth.role() = 'authenticated');

-- ============================
-- REALTIME
-- ============================
alter publication supabase_realtime add table messages;

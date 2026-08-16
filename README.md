# Palengke

A neighborhood marketplace app — post listings, browse by category, and chat with sellers in real time.

Built with **Next.js** (frontend) + **Supabase** (database, auth, storage, realtime chat).

## What's included

- Home feed with category filters (`app/page.js`)
- Post a listing with photo upload (`app/new-listing/page.js`)
- Listing detail page (`app/listing/[id]/page.js`)
- Passwordless email login (`app/login/page.js`)
- Real-time buyer-seller chat (`app/chat/[id]/page.js`)
- Full database schema with row-level security (`supabase/schema.sql`)

## Setup

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com), create a free project, and note your **Project URL** and **anon public key** (Settings → API).

### 2. Run the database schema
In the Supabase dashboard: **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it. This creates all tables, security rules, the photo storage bucket, and turns on realtime for chat.

### 3. Configure environment variables
```bash
cp .env.local.example .env.local
```
Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the values from step 1.

### 4. Install and run
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy
Push this project to a GitHub repo, then import it in [Vercel](https://vercel.com). Add the same two environment variables in the Vercel project settings, and it will deploy automatically on every push.

## How login works

This uses **magic link** (passwordless email) login by default — simplest to set up. To add Google or Facebook login instead:
1. Enable the provider in Supabase: **Authentication → Providers**.
2. In `app/login/page.js`, replace the `signInWithOtp` call with:
   ```js
   supabase.auth.signInWithOAuth({ provider: 'google' })
   ```

## Next steps to round it out

- Add a "My Listings" page so sellers can edit or mark items sold
- Add a distance/map filter using the `latitude`/`longitude` columns already in the schema (Google Maps Platform)
- Add push or email notifications for new chat messages
- Add image resizing/compression before upload to keep storage costs down
- Register the business (DTI for sole proprietor, or SEC for a corporation) before handling real transactions, and add Terms of Service + a Privacy Policy

# KidneyGuard — Supabase Setup (auth + prediction history)

The app runs fine **without** Supabase (auth simply stays off). To turn on
login, roles, saved predictions, and Trend Analysis, do this once.

## 1. Create a free Supabase project
1. Go to https://supabase.com → sign in → **New project**.
2. Pick a name + database password, choose a region near your users, create it.
3. Wait ~2 minutes for it to provision.

## 2. Create the database tables
1. In your project: **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this repo, copy everything, paste it in, click **Run**.
   - This creates `profiles` (with Admin/Doctor/Nurse roles) and `predictions`,
     plus the security policies and the auto-profile trigger. It's safe to re-run.

## 3. Get your API keys
1. **Project Settings** (gear) → **API**.
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - (The `anon` key is safe for the browser. Never use the `service_role` key here.)

## 4. Add the keys to Vercel
1. Vercel → your project → **Settings → Environment Variables**.
2. Add both variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Redeploy** (these are `NEXT_PUBLIC_*`, baked in at build time).

For local dev, put the same two lines in a `.env.local` file (see `.env.example`).

## 5. (Optional) Email confirmation
By default Supabase emails a confirmation link on signup. For quick testing:
**Authentication → Providers → Email** → toggle **Confirm email** off, so new
accounts can sign in immediately. Turn it back on for real use.

## 6. Create your first user
- Open your deployed site → you'll be redirected to **/login**.
- Click **Create account**, pick a role (Admin/Doctor/Nurse), sign up.
- The `profiles` row (with your role) is created automatically.

## What each role is for
- **Admin** — can delete any prediction record (via row-level security).
- **Doctor / Nurse** — create predictions, view the shared history and trends.
- All signed-in users can read the shared prediction log; only the author or an
  Admin can delete a record. Adjust the policies in `supabase/schema.sql` to taste.

## Troubleshooting
- **Still redirected to /login after signing in:** confirm both env vars are set
  in Vercel and you redeployed.
- **"row-level security" error on save:** make sure you ran `schema.sql` fully.
- **No trend data:** run at least two predictions for the *same patient name*.

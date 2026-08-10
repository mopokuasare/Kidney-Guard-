-- KidneyGuard — Supabase schema
-- Run this once in your Supabase project: SQL Editor → paste → Run.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE).

-- ─────────────────────────────────────────────────────────────
-- 1. PROFILES  (one row per auth user, holds the clinical role)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'doctor' check (role in ('admin', 'doctor', 'nurse')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Everyone signed in can read profiles (needed to show names/roles).
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- A user may update only their own profile.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Auto-create a profile whenever a new auth user signs up.
-- The signup form passes full_name + role in the user's metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'doctor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. PREDICTIONS  (history for Trend Analysis + Patient Records)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.predictions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  patient_name      text,
  patient_ref       text,            -- optional MRN / patient identifier
  age               numeric,
  sex               text,
  risk_probability  numeric,         -- 0–100
  predicted_class   text,
  tier              text,            -- Low / Moderate / High / Critical Risk
  egfr              numeric,
  egfr_stage        text,
  inputs            jsonb,           -- full PatientInput payload
  created_at        timestamptz not null default now()
);

create index if not exists predictions_patient_idx
  on public.predictions (lower(patient_name), created_at);
create index if not exists predictions_created_idx
  on public.predictions (created_at desc);

alter table public.predictions enable row level security;

-- Any signed-in clinician can read the shared prediction log.
drop policy if exists "predictions_select_authenticated" on public.predictions;
create policy "predictions_select_authenticated"
  on public.predictions for select
  to authenticated
  using (true);

-- A clinician inserts predictions as themselves.
drop policy if exists "predictions_insert_own" on public.predictions;
create policy "predictions_insert_own"
  on public.predictions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Only the author (or an admin) may delete a record.
drop policy if exists "predictions_delete_own_or_admin" on public.predictions;
create policy "predictions_delete_own_or_admin"
  on public.predictions for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

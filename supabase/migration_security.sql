-- KidneyGuard — security hardening
-- Run once in Supabase: SQL Editor → paste → Run. Safe to re-run.
--
-- Fixes two weaknesses in the original policies:
--
--   1. Any authenticated user could read EVERY patient and EVERY assessment
--      (`using (true)`). Combined with open registration, anyone who found the
--      URL could sign up and read the whole database.
--
--   2. The role was taken from user-supplied signup metadata, so a user could
--      self-assign 'admin' and gain delete rights over all records.
--
-- After this, a clinician sees only the records they created; an administrator
-- sees everything; and the role can only be changed inside the database.

-- ─────────────────────────────────────────────────────────────
-- 1. Role is assigned by the database, never by the client
-- ─────────────────────────────────────────────────────────────
-- Ignore any role supplied in signup metadata. New accounts start as 'doctor'
-- with no delete rights; an administrator promotes them deliberately (see the
-- note at the bottom of this file).
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
    'doctor'                       -- never trust a client-supplied role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Stop users editing their own role through the profiles table. The existing
-- update policy allowed a user to update their own row, which included `role`.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own_name_only"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- role must match what is already stored: name changes only
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Helper so policies don't repeat the admin lookup.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Assessments: own records only, unless administrator
-- ─────────────────────────────────────────────────────────────
drop policy if exists "predictions_select_authenticated" on public.predictions;
drop policy if exists "predictions_select_own_or_admin" on public.predictions;
create policy "predictions_select_own_or_admin"
  on public.predictions for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 3. Patients: visible only to clinicians who assessed them
-- ─────────────────────────────────────────────────────────────
drop policy if exists "patients_select_authenticated" on public.patients;
drop policy if exists "patients_select_own_or_admin" on public.patients;
create policy "patients_select_own_or_admin"
  on public.patients for select
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_admin()
    -- also visible if this clinician has assessed them
    or exists (
      select 1 from public.predictions pr
      where pr.patient_id = patients.id and pr.user_id = auth.uid()
    )
  );

drop policy if exists "patients_update_authenticated" on public.patients;
drop policy if exists "patients_update_own_or_admin" on public.patients;
create policy "patients_update_own_or_admin"
  on public.patients for update
  to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- PROMOTING AN ADMINISTRATOR
-- There is intentionally no way to do this from the application. Run this
-- yourself, replacing the email, so administrator rights are always a
-- deliberate act performed directly against the database:
--
--   update public.profiles
--   set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
-- ─────────────────────────────────────────────────────────────

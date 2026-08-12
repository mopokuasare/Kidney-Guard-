-- KidneyGuard — patient records
-- Run once in Supabase: SQL Editor → paste → Run. Safe to re-run.
--
-- Until now a "patient" was only a name typed onto each assessment, so the same
-- person spelled differently became several patients and there was nowhere to
-- record an MRN, date of birth or contact details. This makes patients real
-- rows and links every assessment to one.

-- ─────────────────────────────────────────────────────────────
-- 1. PATIENTS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.patients (
  id            uuid primary key default gen_random_uuid(),
  mrn           text,                    -- medical record number / hospital ID
  full_name     text not null,
  date_of_birth date,
  sex           text check (sex in ('male', 'female', 'other') or sex is null),
  phone         text,
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One MRN cannot identify two patients. Partial index so blank MRNs are allowed.
create unique index if not exists patients_mrn_unique
  on public.patients (lower(mrn)) where mrn is not null and mrn <> '';

create index if not exists patients_name_idx on public.patients (lower(full_name));

alter table public.patients enable row level security;

-- Any signed-in clinician may read the patient list.
drop policy if exists "patients_select_authenticated" on public.patients;
create policy "patients_select_authenticated"
  on public.patients for select to authenticated using (true);

drop policy if exists "patients_insert_authenticated" on public.patients;
create policy "patients_insert_authenticated"
  on public.patients for insert to authenticated with check (true);

-- Correcting a name or adding a phone number is ordinary clinical admin.
drop policy if exists "patients_update_authenticated" on public.patients;
create policy "patients_update_authenticated"
  on public.patients for update to authenticated using (true);

-- Deleting a patient removes their history, so restrict it to admins.
drop policy if exists "patients_delete_admin" on public.patients;
create policy "patients_delete_admin"
  on public.patients for delete to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.role = 'admin'));

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists patients_touch_updated_at on public.patients;
create trigger patients_touch_updated_at
  before update on public.patients
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 2. LINK ASSESSMENTS TO PATIENTS
-- ─────────────────────────────────────────────────────────────
alter table public.predictions
  add column if not exists patient_id uuid references public.patients(id) on delete cascade;

create index if not exists predictions_patient_id_idx
  on public.predictions (patient_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 3. BACKFILL existing assessments
--    Creates one patient per distinct name already recorded, then links the
--    assessments to it. Nothing is lost and it is idempotent.
-- ─────────────────────────────────────────────────────────────
insert into public.patients (full_name, created_by, created_at)
select distinct on (lower(p.patient_name))
       p.patient_name,
       p.user_id,
       min(p.created_at) over (partition by lower(p.patient_name))
from public.predictions p
where p.patient_name is not null
  and btrim(p.patient_name) <> ''
  and p.patient_id is null
  and not exists (
    select 1 from public.patients pt
    where lower(pt.full_name) = lower(p.patient_name)
  );

update public.predictions p
set patient_id = pt.id
from public.patients pt
where p.patient_id is null
  and p.patient_name is not null
  and lower(pt.full_name) = lower(p.patient_name);

-- ─────────────────────────────────────────────────────────────
-- 4. Convenience view: latest assessment per patient
-- ─────────────────────────────────────────────────────────────
create or replace view public.patient_summary as
select
  pt.id,
  pt.mrn,
  pt.full_name,
  pt.date_of_birth,
  pt.sex,
  pt.phone,
  count(pr.id)                          as assessment_count,
  max(pr.created_at)                    as last_assessed,
  (array_agg(pr.risk_probability order by pr.created_at desc))[1] as latest_risk,
  (array_agg(pr.tier             order by pr.created_at desc))[1] as latest_tier
from public.patients pt
left join public.predictions pr on pr.patient_id = pt.id
group by pt.id;

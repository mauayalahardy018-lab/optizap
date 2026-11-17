-- Initial Optizap schema. Apply to a fresh Supabase database through migrations.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions;

create type public.user_role as enum ('admin', 'optometrista', 'vendedor', 'cliente');
create type public.brand_category as enum ('lujo', 'deportivo', 'moda', 'accesible', 'infantil');
create type public.frame_material as enum ('acetato', 'metal', 'titanio', 'tr90', 'mixto');
create type public.frame_shape as enum ('rectangular', 'redondo', 'aviador', 'cat-eye', 'cuadrado', 'ovalado');
create type public.frame_gender as enum ('unisex', 'hombre', 'mujer', 'infantil');
create type public.lens_type as enum ('monofocal', 'bifocal', 'progresivo');
create type public.lens_material as enum ('cr39', 'policarbonato', 'trivex', 'alto_indice', 'mineral');
create type public.eye_side as enum ('OD', 'OI');
create type public.appointment_status as enum ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'cliente',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles(role);

-- This lookup avoids recursive profiles RLS. It only returns the caller's role,
-- never trusts editable JWT user_metadata, and is not a PostgREST RPC.
create function private.current_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
    and (select auth.uid()) is not null
$$;
revoke all on function private.current_role() from public, anon, authenticated;
grant execute on function private.current_role() to authenticated;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.guard_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Profile identity is immutable' using errcode = '23514';
  end if;
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'supabase_admin', 'service_role')
     and private.current_role() is distinct from 'admin'::public.user_role then
    raise exception 'Only administrators may assign roles' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
for each row execute function private.guard_profile();
create trigger profiles_touch before update on public.profiles
for each row execute function private.touch_updated_at();

-- Trigger-only definer: signup always starts as cliente, regardless of metadata.
create function private.sync_auth_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profiles(id, email, full_name)
    values (new.id, coalesce(new.email, ''), nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''));
  else
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.sync_auth_profile();
create trigger on_auth_user_email_changed after update of email on auth.users
for each row execute function private.sync_auth_profile();
-- Also supports users created before this migration.
insert into public.profiles(id, email, full_name)
select id, coalesce(email, ''), nullif(btrim(raw_user_meta_data ->> 'full_name'), '') from auth.users;

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url text,
  description text,
  country text,
  category public.brand_category,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.frames (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  sku text not null unique check (sku = btrim(sku) and length(sku) > 0),
  name text not null check (length(btrim(name)) > 0),
  material public.frame_material not null,
  shape public.frame_shape not null,
  gender public.frame_gender not null default 'unisex',
  color text not null,
  lens_width_mm numeric(5,2) not null check (lens_width_mm between 20 and 90),
  bridge_width_mm numeric(5,2) not null check (bridge_width_mm between 5 and 40),
  temple_length_mm numeric(5,2) not null check (temple_length_mm between 80 and 180),
  lens_height_mm numeric(5,2) check (lens_height_mm between 10 and 90),
  price numeric(12,2) not null check (price >= 0 and price <> 'NaN'::numeric),
  currency text not null default 'MXN' check (currency = 'MXN'),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index frames_brand_id_idx on public.frames(brand_id);
create index frames_active_price_idx on public.frames(price, id) where is_active;

create table public.lenses (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  sku text not null unique check (sku = btrim(sku) and length(sku) > 0),
  name text not null check (length(btrim(name)) > 0),
  lens_type public.lens_type not null,
  material public.lens_material not null,
  refractive_index numeric(3,2) not null check (refractive_index between 1.49 and 1.90),
  diameter_mm numeric(5,2) not null check (diameter_mm between 40 and 100),
  coatings text[] not null default '{}',
  price numeric(12,2) not null check (price >= 0 and price <> 'NaN'::numeric),
  currency text not null default 'MXN' check (currency = 'MXN'),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lenses_brand_id_idx on public.lenses(brand_id);
create index lenses_active_price_idx on public.lenses(price, id) where is_active;

-- Contact/registration data is separate from confidential clinical information.
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null check (length(btrim(full_name)) > 0),
  birth_date date check (birth_date >= date '1900-01-01'),
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  optometrist_id uuid not null references public.profiles(id) on delete restrict,
  examined_at timestamptz not null default now() check (isfinite(examined_at)),
  chief_complaint text,
  medical_history text,
  allergies text,
  diagnosis text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clinical_records_patient_exam_idx on public.clinical_records(patient_id, examined_at desc);
create index clinical_records_optometrist_idx on public.clinical_records(optometrist_id);

-- One row per eye (OD = derecho, OI = izquierdo) per examination.
create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  clinical_record_id uuid not null references public.clinical_records(id) on delete restrict,
  eye public.eye_side not null,
  sphere numeric(4,2) not null check (sphere between -30 and 30),
  cylinder numeric(4,2) not null default 0 check (cylinder between -12 and 12),
  axis smallint check (axis between 0 and 180),
  addition numeric(3,2) not null default 0 check (addition between 0 and 4),
  pupillary_distance_mm numeric(4,2) check (pupillary_distance_mm between 20 and 45),
  visual_acuity text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinical_record_id, eye),
  check (cylinder = 0 or axis is not null)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  optometrist_id uuid not null references public.profiles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  reason text,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at
         and ends_at <= starts_at + interval '4 hours'),
  -- Half-open ranges allow adjacent slots. Exclusion constraints also prevent
  -- races between concurrent bookings; a SELECT-before-INSERT would not.
  constraint appointments_optometrist_no_overlap exclude using gist
    (optometrist_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
    where (status <> 'cancelled'),
  constraint appointments_patient_no_overlap exclude using gist
    (patient_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
    where (status <> 'cancelled')
);
create index appointments_patient_start_idx on public.appointments(patient_id, starts_at);
create index appointments_optometrist_start_idx on public.appointments(optometrist_id, starts_at);
create index appointments_created_by_idx on public.appointments(created_by);

-- Definer is required to validate staff roles without exposing other profiles.
create function private.validate_optometrist() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.optometrist_id and role = 'optometrista') then
    raise exception 'Assigned profile must be an optometrista' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger clinical_records_validate_optometrist before insert or update of optometrist_id
on public.clinical_records for each row execute function private.validate_optometrist();
create trigger appointments_validate_optometrist before insert or update of optometrist_id
on public.appointments for each row execute function private.validate_optometrist();

create function private.guard_clinical_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'clinical_records' then
    if new.patient_id is distinct from old.patient_id or new.optometrist_id is distinct from old.optometrist_id then
      raise exception 'Clinical patient and author are immutable' using errcode = '23514';
    end if;
  elsif new.clinical_record_id is distinct from old.clinical_record_id or new.eye is distinct from old.eye then
    raise exception 'Prescription examination and eye are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger clinical_records_guard before update on public.clinical_records
for each row execute function private.guard_clinical_identity();
create trigger prescriptions_guard before update on public.prescriptions
for each row execute function private.guard_clinical_identity();

create function private.guard_appointment() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Appointment identity and creator are immutable' using errcode = '23514';
    end if;
    if private.current_role() = 'cliente' then
      if old.status not in ('scheduled', 'confirmed') or old.starts_at <= now()
         or new.status <> 'cancelled'
         or (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
        raise exception 'Clients may only cancel their upcoming appointments' using errcode = '42501';
      end if;
    end if;
  end if;
  if tg_op = 'INSERT' then
    if new.starts_at <= now() then
      raise exception 'Appointment must start in the future' using errcode = '23514';
    end if;
  elsif (new.starts_at, new.ends_at) is distinct from (old.starts_at, old.ends_at) and new.starts_at <= now() then
    raise exception 'Rescheduled appointment must start in the future' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger appointments_guard before insert or update on public.appointments
for each row execute function private.guard_appointment();

do $$
declare table_name text;
begin
  foreach table_name in array array['brands','frames','lenses','patients','clinical_records','prescriptions','appointments'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.touch_updated_at()', table_name || '_touch', table_name);
  end loop;
  foreach table_name in array array['profiles','brands','frames','lenses','patients','clinical_records','prescriptions','appointments'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end;
$$;

grant select on public.profiles to authenticated;
grant update(full_name, avatar_url, role) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.current_role()) = 'admin');
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select private.current_role()) = 'admin')
with check (id = (select auth.uid()) or (select private.current_role()) = 'admin');

grant select on public.brands, public.frames, public.lenses to anon, authenticated;
grant insert, update, delete on public.brands, public.frames, public.lenses to authenticated;
create policy brands_read on public.brands for select to anon, authenticated using (is_active);
create policy frames_read on public.frames for select to anon, authenticated
using (is_active and exists (select 1 from public.brands b where b.id = brand_id and b.is_active));
create policy lenses_read on public.lenses for select to anon, authenticated
using (is_active and exists (select 1 from public.brands b where b.id = brand_id and b.is_active));
do $$
declare table_name text;
begin
  foreach table_name in array array['brands','frames','lenses'] loop
    execute format('create policy catalog_admin on public.%I for all to authenticated using ((select private.current_role()) = ''admin'') with check ((select private.current_role()) = ''admin'')', table_name);
  end loop;
end;
$$;

grant select, insert, update on public.patients, public.clinical_records, public.prescriptions, public.appointments to authenticated;
create policy patients_read on public.patients for select to authenticated
using (profile_id = (select auth.uid()) or (select private.current_role()) in ('admin','optometrista','vendedor'));
create policy patients_insert on public.patients for insert to authenticated
with check ((select private.current_role()) in ('admin','optometrista','vendedor'));
create policy patients_update on public.patients for update to authenticated
using ((select private.current_role()) in ('admin','optometrista','vendedor'))
with check ((select private.current_role()) in ('admin','optometrista','vendedor'));

create policy clinical_read on public.clinical_records for select to authenticated
using ((select private.current_role()) in ('admin','optometrista') or exists
  (select 1 from public.patients p where p.id = patient_id and p.profile_id = (select auth.uid())));
create policy clinical_insert on public.clinical_records for insert to authenticated
with check ((select private.current_role()) = 'admin' or
  ((select private.current_role()) = 'optometrista' and optometrist_id = (select auth.uid())));
create policy clinical_update on public.clinical_records for update to authenticated
using ((select private.current_role()) = 'admin' or
  ((select private.current_role()) = 'optometrista' and optometrist_id = (select auth.uid())))
with check ((select private.current_role()) = 'admin' or
  ((select private.current_role()) = 'optometrista' and optometrist_id = (select auth.uid())));

create policy prescriptions_read on public.prescriptions for select to authenticated
using (exists (select 1 from public.clinical_records c where c.id = clinical_record_id));
create policy prescriptions_insert on public.prescriptions for insert to authenticated
with check (exists (select 1 from public.clinical_records c where c.id = clinical_record_id and
  ((select private.current_role()) = 'admin' or
   ((select private.current_role()) = 'optometrista' and c.optometrist_id = (select auth.uid())))));
create policy prescriptions_update on public.prescriptions for update to authenticated
using (exists (select 1 from public.clinical_records c where c.id = clinical_record_id and
  ((select private.current_role()) = 'admin' or
   ((select private.current_role()) = 'optometrista' and c.optometrist_id = (select auth.uid())))))
with check (exists (select 1 from public.clinical_records c where c.id = clinical_record_id and
  ((select private.current_role()) = 'admin' or
   ((select private.current_role()) = 'optometrista' and c.optometrist_id = (select auth.uid())))));

create policy appointments_read on public.appointments for select to authenticated
using ((select private.current_role()) in ('admin','vendedor')
  or ((select private.current_role()) = 'optometrista' and optometrist_id = (select auth.uid()))
  or exists (select 1 from public.patients p where p.id = patient_id and p.profile_id = (select auth.uid())));
create policy appointments_insert on public.appointments for insert to authenticated
with check (created_by = (select auth.uid()) and
  ((select private.current_role()) in ('admin','vendedor')
   or ((select private.current_role()) = 'optometrista' and optometrist_id = (select auth.uid()))
   or ((select private.current_role()) = 'cliente' and status = 'scheduled' and exists
     (select 1 from public.patients p where p.id = patient_id and p.profile_id = (select auth.uid())))));
create policy appointments_update on public.appointments for update to authenticated
using ((select private.current_role()) in ('admin','vendedor')
  or ((select private.current_role()) = 'optometrista' and optometrist_id = (select auth.uid()))
  or ((select private.current_role()) = 'cliente' and exists
    (select 1 from public.patients p where p.id = patient_id and p.profile_id = (select auth.uid()))))
with check ((select private.current_role()) in ('admin','vendedor')
  or ((select private.current_role()) = 'optometrista' and optometrist_id = (select auth.uid()))
  or ((select private.current_role()) = 'cliente' and status = 'cancelled' and exists
    (select 1 from public.patients p where p.id = patient_id and p.profile_id = (select auth.uid()))));

-- Trigger functions cannot be called as RPCs, including definer helpers.
revoke all on function private.sync_auth_profile(), private.touch_updated_at(),
  private.guard_profile(), private.validate_optometrist(), private.guard_clinical_identity(),
  private.guard_appointment() from public, anon, authenticated;

-- Reference brands only: no invented product prices or medical/customer data.
insert into public.brands(name, slug) values
  ('Ray-Ban', 'ray-ban'), ('Oakley', 'oakley'), ('Persol', 'persol'),
  ('Tom Ford', 'tom-ford'), ('Essilor', 'essilor'), ('ZEISS', 'zeiss');
commit;

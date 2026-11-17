begin;

-- Cross-patient occupancy must bypass appointment RLS, but only free slots,
-- never appointments or identifying fields, leave this private helper.
create function private.available_slots(p_date date, p_optometrist_id uuid, p_duration_minutes integer)
returns table(starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.current_role() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_date is null or p_date < (now() at time zone 'America/Mexico_City')::date
     or p_date > (now() at time zone 'America/Mexico_City')::date + 90
     or p_duration_minutes is null or p_duration_minutes < 15 or p_duration_minutes > 240
     or p_duration_minutes % 15 <> 0 then
    raise exception 'Invalid availability date or duration' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles where id = p_optometrist_id and role = 'optometrista') then
    raise exception 'Optometrist not found' using errcode = '23514';
  end if;
  return query
  select slot, slot + make_interval(mins => p_duration_minutes)
  from generate_series(
    (p_date + time '09:00') at time zone 'America/Mexico_City',
    (p_date + time '18:00') at time zone 'America/Mexico_City' - make_interval(mins => p_duration_minutes),
    interval '15 minutes'
  ) slot
  where slot > now() and not exists (
    select 1 from public.appointments a
    where a.optometrist_id = p_optometrist_id and a.status <> 'cancelled'
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(slot, slot + make_interval(mins => p_duration_minutes), '[)')
  ) order by slot;
end;
$$;
revoke all on function private.available_slots(date, uuid, integer) from public, anon, authenticated;
grant execute on function private.available_slots(date, uuid, integer) to authenticated;

create function public.get_available_slots(p_date date, p_optometrist_id uuid, p_duration_minutes integer default 30)
returns table(starts_at timestamptz, ends_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select * from private.available_slots(p_date, p_optometrist_id, p_duration_minutes)
$$;
revoke all on function public.get_available_slots(date, uuid, integer) from public, anon;
grant execute on function public.get_available_slots(date, uuid, integer) to authenticated;

create function private.optometrist_directory()
returns table(id uuid, full_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name from public.profiles p
  where p.role = 'optometrista' and (select auth.uid()) is not null
    and (select private.current_role()) is not null order by p.full_name, p.id
$$;
revoke all on function private.optometrist_directory() from public, anon, authenticated;
grant execute on function private.optometrist_directory() to authenticated;
create function public.list_optometrists() returns table(id uuid, full_name text)
language sql stable security invoker set search_path = '' as $$
  select * from private.optometrist_directory()
$$;
revoke all on function public.list_optometrists() from public, anon;
grant execute on function public.list_optometrists() to authenticated;

-- SECURITY INVOKER keeps existing RLS, grants and author checks in force.
-- A failed eye insert rolls back the examination and every prior eye insert.
create function public.create_clinical_exam(p_record jsonb, p_prescriptions jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  exam public.clinical_records;
  eye_data jsonb;
begin
  if (select auth.uid()) is null or (select private.current_role()) is null
     or (select private.current_role()) not in ('admin', 'optometrista') then
    raise exception 'Clinical staff required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_record) is distinct from 'object'
     or jsonb_typeof(p_prescriptions) is distinct from 'array' then
    raise exception 'Invalid clinical payload' using errcode = '23514';
  end if;
  if jsonb_array_length(p_prescriptions) < 1 or jsonb_array_length(p_prescriptions) > 2 then
    raise exception 'One or two eye prescriptions required' using errcode = '23514';
  end if;
  insert into public.clinical_records(patient_id, optometrist_id, examined_at,
    chief_complaint, medical_history, allergies, diagnosis, notes)
  values ((p_record->>'patient_id')::uuid, (p_record->>'optometrist_id')::uuid,
    coalesce((p_record->>'examined_at')::timestamptz, now()),
    p_record->>'chief_complaint', p_record->>'medical_history', p_record->>'allergies',
    p_record->>'diagnosis', p_record->>'notes') returning * into exam;
  for eye_data in select value from jsonb_array_elements(p_prescriptions) loop
    insert into public.prescriptions(clinical_record_id, eye, sphere, cylinder, axis,
      addition, pupillary_distance_mm, visual_acuity)
    values (exam.id, (eye_data->>'eye')::public.eye_side, (eye_data->>'sphere')::numeric,
      coalesce((eye_data->>'cylinder')::numeric, 0), (eye_data->>'axis')::smallint,
      coalesce((eye_data->>'addition')::numeric, 0),
      (eye_data->>'pupillary_distance_mm')::numeric, eye_data->>'visual_acuity');
  end loop;
  return jsonb_build_object('record', to_jsonb(exam), 'prescriptions', (
    select jsonb_agg(to_jsonb(p) order by p.eye) from public.prescriptions p where p.clinical_record_id = exam.id
  ));
end;
$$;
revoke all on function public.create_clinical_exam(jsonb, jsonb) from public, anon;
grant execute on function public.create_clinical_exam(jsonb, jsonb) to authenticated;
commit;

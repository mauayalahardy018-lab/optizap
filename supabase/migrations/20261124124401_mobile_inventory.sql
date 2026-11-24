begin;

-- Mobile stock changes share public.frames with the web service.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  frame_id uuid not null references public.frames(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  delta integer not null check (delta between -999 and 999 and delta <> 0),
  stock_before integer not null check (stock_before >= 0),
  stock_after integer not null check (stock_after >= 0 and stock_after = stock_before + delta),
  note text check (length(note) <= 200),
  created_at timestamptz not null default now()
);
create index stock_movements_frame_time_idx on public.stock_movements(frame_id, created_at desc);
alter table public.stock_movements enable row level security;
revoke all on public.stock_movements from public, anon, authenticated;
grant select on public.stock_movements to authenticated;
create policy stock_movements_staff_read on public.stock_movements for select to authenticated
using ((select private.current_role()) in ('admin', 'vendedor'));

-- Public RPC is callable only by authenticated staff. Its definer privileges
-- are needed because sellers cannot update frames directly; the function
-- validates the trusted profiles role and performs the whole change atomically.
create function public.record_frame_movement(
  p_frame_id uuid, p_delta integer, p_note text, p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_existing public.stock_movements;
  v_frame public.frames;
  v_after integer;
  v_note text := nullif(btrim(p_note), '');
begin
  if v_actor is null or coalesce((select private.current_role()) in ('admin', 'vendedor'), false) is not true then
    raise exception 'Inventory staff required' using errcode = '42501';
  end if;
  if p_frame_id is null or p_request_id is null or p_delta is null
     or p_delta = 0 or p_delta < -999 or p_delta > 999
     or length(coalesce(p_note, '')) > 200 then
    raise exception 'Invalid movement' using errcode = '23514';
  end if;

  -- Serialize retries with the same request ID, including concurrent calls.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_existing from public.stock_movements where request_id = p_request_id;
  if found then
    if v_existing.actor_id <> v_actor or v_existing.frame_id <> p_frame_id
       or v_existing.delta <> p_delta or v_existing.note is distinct from v_note then
      raise exception 'Request ID already used' using errcode = '23505';
    end if;
    return jsonb_build_object('delta', v_existing.delta,
      'stock_after', v_existing.stock_after, 'created_at', v_existing.created_at);
  end if;

  select * into v_frame from public.frames
    where id = p_frame_id and is_active for update;
  if not found then
    raise exception 'Frame not found' using errcode = 'P0002';
  end if;
  v_after := v_frame.stock + p_delta;
  if v_after < 0 then
    raise exception 'Insufficient stock' using errcode = '23514';
  end if;
  update public.frames set stock = v_after where id = p_frame_id;
  insert into public.stock_movements(request_id, frame_id, actor_id, delta,
    stock_before, stock_after, note)
  values (p_request_id, p_frame_id, v_actor, p_delta, v_frame.stock, v_after, v_note);
  return jsonb_build_object('delta', p_delta, 'stock_after', v_after,
    'created_at', now());
end;
$$;
revoke all on function public.record_frame_movement(uuid, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_frame_movement(uuid, integer, text, uuid)
  to authenticated;

commit;

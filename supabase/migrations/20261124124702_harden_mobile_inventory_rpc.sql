begin;

-- Keep the privileged implementation outside the exposed API schema.
alter function public.record_frame_movement(uuid, integer, text, uuid) set schema private;
revoke all on function private.record_frame_movement(uuid, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function private.record_frame_movement(uuid, integer, text, uuid)
  to authenticated;

create function public.record_frame_movement(
  p_frame_id uuid, p_delta integer, p_note text, p_request_id uuid
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.record_frame_movement(p_frame_id, p_delta, p_note, p_request_id)
$$;
revoke all on function public.record_frame_movement(uuid, integer, text, uuid)
  from public, anon;
grant execute on function public.record_frame_movement(uuid, integer, text, uuid)
  to authenticated;

commit;

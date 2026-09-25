-- T019: keep the public history reader as SECURITY INVOKER.
-- The private helper remains responsible for the controlled SECURITY DEFINER boundary.

alter function public.get_circle_history(
  uuid, uuid, timestamptz, timestamptz, integer
) security invoker;

revoke all on function public.get_circle_history(
  uuid, uuid, timestamptz, timestamptz, integer
) from public, anon;

grant execute on function public.get_circle_history(
  uuid, uuid, timestamptz, timestamptz, integer
) to authenticated;

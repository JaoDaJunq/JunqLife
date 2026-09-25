-- T019 final boundary: the public RPC is the only authenticated entrypoint.
-- The private helper stays non-executable by authenticated clients.

revoke usage on schema private from authenticated;

revoke all on function private.get_circle_history_internal(
  uuid, uuid, uuid, timestamptz, timestamptz, integer
) from public, anon, authenticated, service_role;

alter function public.get_circle_history(
  uuid, uuid, timestamptz, timestamptz, integer
) security definer;

revoke all on function public.get_circle_history(
  uuid, uuid, timestamptz, timestamptz, integer
) from public, anon, service_role;

grant execute on function public.get_circle_history(
  uuid, uuid, timestamptz, timestamptz, integer
) to authenticated;

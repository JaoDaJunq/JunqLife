grant usage on schema private to service_role;
grant insert on private.location_history_visibility to service_role;

revoke all on function private.get_circle_history_internal(
  uuid, uuid, uuid, timestamptz, timestamptz, integer
) from public;
revoke all on function private.get_circle_history_internal(
  uuid, uuid, uuid, timestamptz, timestamptz, integer
) from anon;
revoke all on function private.get_circle_history_internal(
  uuid, uuid, uuid, timestamptz, timestamptz, integer
) from authenticated;
revoke all on function private.get_circle_history_internal(
  uuid, uuid, uuid, timestamptz, timestamptz, integer
) from service_role;

alter function public.get_circle_history(
  uuid, uuid, timestamptz, timestamptz, integer
) security definer;

revoke all on function public.get_circle_history(
  uuid, uuid, timestamptz, timestamptz, integer
) from public;
revoke all on function public.get_circle_history(
  uuid, uuid, timestamptz, timestamptz, integer
) from anon;
revoke all on function public.get_circle_history(
  uuid, uuid, timestamptz, timestamptz, integer
) from service_role;
grant execute on function public.get_circle_history(
  uuid, uuid, timestamptz, timestamptz, integer
) to authenticated;

revoke all on function public.ingest_location_internal(
  uuid, uuid, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision,
  timestamptz
) from public;
revoke all on function public.ingest_location_internal(
  uuid, uuid, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision,
  timestamptz
) from anon;
revoke all on function public.ingest_location_internal(
  uuid, uuid, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision,
  timestamptz
) from authenticated;
grant execute on function public.ingest_location_internal(
  uuid, uuid, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision,
  timestamptz
) to service_role;

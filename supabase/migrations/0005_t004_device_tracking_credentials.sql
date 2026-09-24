-- T004: device credentials, least-privilege grants, and atomic location ingestion.

alter table public.devices
  add column ingest_token_hash text,
  add column ingest_token_created_at timestamptz;

alter table public.devices
  add constraint devices_ingest_token_hash_check
  check (ingest_token_hash is null or ingest_token_hash ~ '^[0-9a-f]{64}$');

create unique index devices_ingest_token_hash_uidx
  on public.devices(ingest_token_hash)
  where ingest_token_hash is not null;

revoke all on public.profiles from anon, authenticated;
revoke all on public.circles from anon, authenticated;
revoke all on public.circle_members from anon, authenticated;
revoke all on public.circle_member_sharing from anon, authenticated;
revoke all on public.devices from anon, authenticated;
revoke all on public.current_locations from anon, authenticated;
revoke all on public.location_history from anon, authenticated;
revoke all on public.places from anon, authenticated;
revoke all on public.circle_invites from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.circles to authenticated;
grant select, delete on public.circle_members to authenticated;
grant select, update on public.circle_member_sharing to authenticated;

grant select (id, user_id, label, platform, battery_level, last_seen_at, created_at)
  on public.devices to authenticated;
grant update (label) on public.devices to authenticated;
grant delete on public.devices to authenticated;

grant select on public.current_locations to authenticated;
grant select on public.location_history to authenticated;
grant select, insert, update, delete on public.places to authenticated;

revoke all on all sequences in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger
  on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, public;

create or replace function public.ingest_location_internal(
  p_user_id uuid,
  p_device_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_speed_mps double precision,
  p_heading_deg double precision,
  p_altitude_m double precision,
  p_battery_level double precision,
  p_recorded_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.circle_member_sharing cms
    where cms.user_id = p_user_id
      and cms.sharing_enabled = true
      and cms.updated_at <= p_recorded_at
  ) then
    return false;
  end if;

  insert into public.location_history (
    user_id, device_id, latitude, longitude, accuracy_m, speed_mps,
    heading_deg, altitude_m, battery_level, recorded_at
  ) values (
    p_user_id, p_device_id, p_latitude, p_longitude, p_accuracy_m, p_speed_mps,
    p_heading_deg, p_altitude_m, p_battery_level, p_recorded_at
  );

  insert into public.current_locations (
    user_id, device_id, latitude, longitude, accuracy_m, speed_mps,
    heading_deg, altitude_m, battery_level, recorded_at
  ) values (
    p_user_id, p_device_id, p_latitude, p_longitude, p_accuracy_m, p_speed_mps,
    p_heading_deg, p_altitude_m, p_battery_level, p_recorded_at
  )
  on conflict (user_id) do update
    set device_id = excluded.device_id,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy_m = excluded.accuracy_m,
        speed_mps = excluded.speed_mps,
        heading_deg = excluded.heading_deg,
        altitude_m = excluded.altitude_m,
        battery_level = excluded.battery_level,
        recorded_at = excluded.recorded_at,
        received_at = now()
    where excluded.recorded_at >= public.current_locations.recorded_at;

  update public.devices
  set battery_level = coalesce(p_battery_level, battery_level),
      last_seen_at = now()
  where id = p_device_id
    and user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.ingest_location_internal(
  uuid, uuid, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.ingest_location_internal(
  uuid, uuid, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision,
  timestamptz
) to service_role;

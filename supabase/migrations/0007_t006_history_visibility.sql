-- T006 privacy foundation: bind each historical point to the circles that
-- were actively receiving the user's location at the moment the point was recorded.

create table private.location_history_visibility (
  history_id bigint not null references public.location_history(id) on delete cascade,
  circle_id uuid not null references public.circles(id) on delete cascade,
  primary key (history_id, circle_id)
);

create index location_history_visibility_circle_idx
  on private.location_history_visibility(circle_id, history_id);

revoke all on private.location_history_visibility from public, anon, authenticated;
grant all on private.location_history_visibility to service_role;

create or replace function private.can_view_history_point(
  p_history_id bigint,
  p_target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    auth.uid() = p_target_user_id
    or exists (
      select 1
      from private.location_history_visibility hv
      join public.circle_members viewer
        on viewer.circle_id = hv.circle_id
      where hv.history_id = p_history_id
        and viewer.user_id = auth.uid()
    )
  );
$$;

revoke all on function private.can_view_history_point(bigint, uuid) from public;
grant execute on function private.can_view_history_point(bigint, uuid) to authenticated;

drop policy if exists location_history_select_authorized on public.location_history;
create policy location_history_select_authorized
on public.location_history
for select
to authenticated
using (private.can_view_history_point(id, user_id));

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
declare
  history_id bigint;
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
    user_id,
    device_id,
    latitude,
    longitude,
    accuracy_m,
    speed_mps,
    heading_deg,
    altitude_m,
    battery_level,
    recorded_at
  ) values (
    p_user_id,
    p_device_id,
    p_latitude,
    p_longitude,
    p_accuracy_m,
    p_speed_mps,
    p_heading_deg,
    p_altitude_m,
    p_battery_level,
    p_recorded_at
  )
  returning id into history_id;

  insert into private.location_history_visibility(history_id, circle_id)
  select history_id, cms.circle_id
  from public.circle_member_sharing cms
  where cms.user_id = p_user_id
    and cms.sharing_enabled = true
    and cms.updated_at <= p_recorded_at;

  insert into public.current_locations (
    user_id,
    device_id,
    latitude,
    longitude,
    accuracy_m,
    speed_mps,
    heading_deg,
    altitude_m,
    battery_level,
    recorded_at
  ) values (
    p_user_id,
    p_device_id,
    p_latitude,
    p_longitude,
    p_accuracy_m,
    p_speed_mps,
    p_heading_deg,
    p_altitude_m,
    p_battery_level,
    p_recorded_at
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

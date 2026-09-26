-- T007B: evaluate saved Places during location ingestion and record transitions.
-- The service-only ingestion RPC remains the only writer for location-derived data.

create table public.place_events (
  id bigint generated always as identity primary key,
  place_id uuid not null references public.places(id) on delete cascade,
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('entered', 'exited')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index place_events_circle_time_idx
  on public.place_events(circle_id, occurred_at desc);
create index place_events_user_time_idx
  on public.place_events(user_id, occurred_at desc);

alter table public.place_events enable row level security;

create policy place_events_select_member
on public.place_events
for select
to authenticated
using (private.is_circle_member(circle_id));

revoke all on public.place_events from anon, authenticated;
grant select on public.place_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create table private.place_presence (
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  inside boolean not null,
  last_observed_at timestamptz not null,
  last_distance_m double precision not null check (last_distance_m >= 0),
  updated_at timestamptz not null default now(),
  primary key (place_id, user_id)
);

revoke all on private.place_presence from public, anon, authenticated, service_role;
grant select, insert, update on private.place_presence to service_role;

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
  current_point extensions.geography;
  place_row record;
  current_inside boolean;
  previous_observed_at timestamptz;
  previous_distance_m double precision;
  next_inside boolean;
  distance_m double precision;
  margin_m double precision;
  event_type text;
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
  ) returning id into history_id;

  insert into private.location_history_visibility(history_id, circle_id)
  select history_id, cms.circle_id
  from public.circle_member_sharing cms
  where cms.user_id = p_user_id
    and cms.sharing_enabled = true
    and cms.updated_at <= p_recorded_at;

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
  where id = p_device_id and user_id = p_user_id;

  current_point := extensions.st_setsrid(
    extensions.st_makepoint(p_longitude, p_latitude), 4326
  )::extensions.geography;

  for place_row in
    select p.id, p.circle_id, p.name, p.radius_m, p.latitude, p.longitude
    from public.places p
    join public.circle_member_sharing cms
      on cms.circle_id = p.circle_id
     and cms.user_id = p_user_id
     and cms.sharing_enabled = true
     and cms.updated_at <= p_recorded_at
  loop
    select pp.inside, pp.last_observed_at, pp.last_distance_m
      into current_inside, previous_observed_at, previous_distance_m
    from private.place_presence pp
    where pp.place_id = place_row.id and pp.user_id = p_user_id
    for update;

    if previous_observed_at is not null and p_recorded_at < previous_observed_at then
      continue;
    end if;

    distance_m := extensions.st_distance(
      extensions.st_setsrid(
        extensions.st_makepoint(place_row.longitude, place_row.latitude), 4326
      )::extensions.geography,
      current_point
    );
    margin_m := greatest(coalesce(p_accuracy_m, 0), 25);

    if current_inside is null then
      next_inside := distance_m <= place_row.radius_m + margin_m;
    elsif current_inside then
      next_inside := distance_m <= place_row.radius_m + (margin_m * 1.5);
    else
      next_inside := distance_m <= place_row.radius_m + margin_m;
    end if;

    if previous_observed_at is null then
      insert into private.place_presence(
        place_id, user_id, inside, last_observed_at, last_distance_m
      ) values (
        place_row.id, p_user_id, next_inside, p_recorded_at, distance_m
      );
      if next_inside then
        insert into public.place_events(
          place_id, circle_id, user_id, event_type, latitude, longitude,
          accuracy_m, occurred_at
        ) values (
          place_row.id, place_row.circle_id, p_user_id, 'entered', p_latitude,
          p_longitude, p_accuracy_m, p_recorded_at
        );
      end if;
    else
      if current_inside = false and next_inside = true then
        event_type := 'entered';
      elsif current_inside = true and next_inside = false then
        event_type := 'exited';
      else
        event_type := null;
      end if;

      update private.place_presence
      set inside = next_inside,
          last_observed_at = p_recorded_at,
          last_distance_m = distance_m,
          updated_at = now()
      where place_id = place_row.id and user_id = p_user_id;

      if event_type is not null then
        insert into public.place_events(
          place_id, circle_id, user_id, event_type, latitude, longitude,
          accuracy_m, occurred_at
        ) values (
          place_row.id, place_row.circle_id, p_user_id, event_type, p_latitude,
          p_longitude, p_accuracy_m, p_recorded_at
        );
      end if;
    end if;
  end loop;

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

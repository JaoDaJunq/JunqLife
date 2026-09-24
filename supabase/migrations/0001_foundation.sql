-- JunqLife foundation schema for a consent-based location sharing app.
-- Intended for a NEW Supabase project.

create schema if not exists extensions;
create schema if not exists private;

create extension if not exists postgis with schema extensions;

create type public.circle_role as enum ('owner', 'admin', 'member');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.circle_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table public.circle_member_sharing (
  circle_id uuid not null,
  user_id uuid not null,
  sharing_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (circle_id, user_id),
  foreign key (circle_id, user_id)
    references public.circle_members(circle_id, user_id)
    on delete cascade
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  platform text not null check (platform in ('android', 'ios')),
  battery_level double precision check (battery_level is null or battery_level between 0 and 1),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index devices_user_id_idx on public.devices(user_id);

create table public.current_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  device_id uuid,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  speed_mps double precision,
  heading_deg double precision check (heading_deg is null or heading_deg between 0 and 360),
  altitude_m double precision,
  battery_level double precision check (battery_level is null or battery_level between 0 and 1),
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  location extensions.geography(Point, 4326)
    generated always as (
      extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
    ) stored,
  foreign key (device_id, user_id)
    references public.devices(id, user_id)
);

create index current_locations_geo_idx
  on public.current_locations using gist(location);

create table public.location_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  speed_mps double precision,
  heading_deg double precision check (heading_deg is null or heading_deg between 0 and 360),
  altitude_m double precision,
  battery_level double precision check (battery_level is null or battery_level between 0 and 1),
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  location extensions.geography(Point, 4326)
    generated always as (
      extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
    ) stored,
  foreign key (device_id, user_id)
    references public.devices(id, user_id)
);

create index location_history_user_time_idx
  on public.location_history(user_id, recorded_at desc);
create index location_history_geo_idx
  on public.location_history using gist(location);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_m integer not null default 100 check (radius_m between 25 and 5000),
  location extensions.geography(Point, 4326)
    generated always as (
      extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
    ) stored,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index places_circle_id_idx on public.places(circle_id);
create index places_geo_idx on public.places using gist(location);

create or replace function private.is_circle_member(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.user_id = auth.uid()
  );
$$;

create or replace function private.is_circle_owner(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.circles c
    where c.id = p_circle_id
      and c.owner_id = auth.uid()
  );
$$;

create or replace function private.shares_circle_with_user(p_target_user_id uuid)
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
      from public.circle_members viewer
      join public.circle_members target
        on target.circle_id = viewer.circle_id
      where viewer.user_id = auth.uid()
        and target.user_id = p_target_user_id
    )
  );
$$;

create or replace function private.can_view_user_location(p_target_user_id uuid)
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
      from public.circle_members viewer
      join public.circle_member_sharing target_sharing
        on target_sharing.circle_id = viewer.circle_id
      where viewer.user_id = auth.uid()
        and target_sharing.user_id = p_target_user_id
        and target_sharing.sharing_enabled = true
    )
  );
$$;

revoke all on function private.is_circle_member(uuid) from public;
revoke all on function private.is_circle_owner(uuid) from public;
revoke all on function private.shares_circle_with_user(uuid) from public;
revoke all on function private.can_view_user_location(uuid) from public;
grant execute on function private.is_circle_member(uuid) to authenticated;
grant execute on function private.is_circle_owner(uuid) to authenticated;
grant execute on function private.shares_circle_with_user(uuid) to authenticated;
grant execute on function private.can_view_user_location(uuid) to authenticated;

create or replace function private.add_circle_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.circle_members(circle_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (circle_id, user_id) do nothing;
  return new;
end;
$$;
revoke all on function private.add_circle_owner_membership() from public;

create trigger circles_add_owner_member
  after insert on public.circles
  for each row execute function private.add_circle_owner_membership();

create or replace function private.add_member_sharing_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.circle_member_sharing(circle_id, user_id, sharing_enabled)
  values (new.circle_id, new.user_id, false)
  on conflict (circle_id, user_id) do nothing;
  return new;
end;
$$;
revoke all on function private.add_member_sharing_row() from public;

create trigger circle_members_add_sharing
  after insert on public.circle_members
  for each row execute function private.add_member_sharing_row();

alter table public.profiles enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_member_sharing enable row level security;
alter table public.devices enable row level security;
alter table public.current_locations enable row level security;
alter table public.location_history enable row level security;
alter table public.places enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (private.shares_circle_with_user(id));

create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (id = auth.uid());

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy circles_select_member on public.circles
for select to authenticated
using (private.is_circle_member(id));

create policy circles_insert_owner on public.circles
for insert to authenticated
with check (owner_id = auth.uid());

create policy circles_update_owner on public.circles
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy circles_delete_owner on public.circles
for delete to authenticated
using (owner_id = auth.uid());

create policy circle_members_select_member on public.circle_members
for select to authenticated
using (private.is_circle_member(circle_id));

create policy circle_members_insert_owner on public.circle_members
for insert to authenticated
with check (private.is_circle_owner(circle_id) and role = 'member');

create policy circle_members_delete_owner_or_self on public.circle_members
for delete to authenticated
using (
  role <> 'owner'
  and (private.is_circle_owner(circle_id) or user_id = auth.uid())
);

create policy sharing_select_member on public.circle_member_sharing
for select to authenticated
using (private.is_circle_member(circle_id));

create policy sharing_update_self on public.circle_member_sharing
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy devices_select_self on public.devices
for select to authenticated using (user_id = auth.uid());
create policy devices_insert_self on public.devices
for insert to authenticated with check (user_id = auth.uid());
create policy devices_update_self on public.devices
for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy devices_delete_self on public.devices
for delete to authenticated using (user_id = auth.uid());

create policy current_locations_select_authorized on public.current_locations
for select to authenticated
using (private.can_view_user_location(user_id));

create policy location_history_select_authorized on public.location_history
for select to authenticated
using (private.can_view_user_location(user_id));

create policy places_select_member on public.places
for select to authenticated
using (private.is_circle_member(circle_id));

create policy places_insert_owner on public.places
for insert to authenticated
with check (private.is_circle_owner(circle_id) and created_by = auth.uid());

create policy places_update_owner on public.places
for update to authenticated
using (private.is_circle_owner(circle_id))
with check (private.is_circle_owner(circle_id) and created_by = auth.uid());

create policy places_delete_owner on public.places
for delete to authenticated
using (private.is_circle_owner(circle_id));

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.circles to authenticated;
grant select, insert, delete on public.circle_members to authenticated;
grant select, update on public.circle_member_sharing to authenticated;
grant select, insert, update, delete on public.devices to authenticated;
revoke all on public.current_locations from authenticated;
revoke all on public.location_history from authenticated;
grant select on public.current_locations to authenticated;
grant select on public.location_history to authenticated;
grant select, insert, update, delete on public.places to authenticated;
grant usage, select on all sequences in schema public to authenticated;

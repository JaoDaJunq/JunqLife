-- JunqLife performance hardening after initial Supabase advisor review.

create index if not exists circle_members_user_id_idx
  on public.circle_members(user_id);

create index if not exists circles_owner_id_idx
  on public.circles(owner_id);

create index if not exists current_locations_device_user_idx
  on public.current_locations(device_id, user_id);

create index if not exists location_history_device_user_idx
  on public.location_history(device_id, user_id);

create index if not exists places_created_by_idx
  on public.places(created_by);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (id = (select auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists circles_insert_owner on public.circles;
create policy circles_insert_owner on public.circles
for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists circles_update_owner on public.circles;
create policy circles_update_owner on public.circles
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists circles_delete_owner on public.circles;
create policy circles_delete_owner on public.circles
for delete to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists circle_members_delete_owner_or_self on public.circle_members;
create policy circle_members_delete_owner_or_self on public.circle_members
for delete to authenticated
using (
  role <> 'owner'
  and (private.is_circle_owner(circle_id) or user_id = (select auth.uid()))
);

drop policy if exists sharing_update_self on public.circle_member_sharing;
create policy sharing_update_self on public.circle_member_sharing
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists devices_select_self on public.devices;
create policy devices_select_self on public.devices
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists devices_insert_self on public.devices;
create policy devices_insert_self on public.devices
for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists devices_update_self on public.devices;
create policy devices_update_self on public.devices
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists devices_delete_self on public.devices;
create policy devices_delete_self on public.devices
for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists places_insert_owner on public.places;
create policy places_insert_owner on public.places
for insert to authenticated
with check (private.is_circle_owner(circle_id) and created_by = (select auth.uid()));

drop policy if exists places_update_owner on public.places;
create policy places_update_owner on public.places
for update to authenticated
using (private.is_circle_owner(circle_id))
with check (private.is_circle_owner(circle_id) and created_by = (select auth.uid()));

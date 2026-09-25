-- T019 follow-up: allow the invoker wrapper to reach the private helper
-- while binding the helper to the authenticated request identity.

grant usage on schema private to authenticated;

create or replace function private.get_circle_history_internal(
  p_viewer_id uuid,
  p_circle_id uuid,
  p_target_user_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_limit integer
)
returns table (
  id bigint,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  speed_mps double precision,
  heading_deg double precision,
  battery_level double precision,
  recorded_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    lh.id,
    lh.latitude,
    lh.longitude,
    lh.accuracy_m,
    lh.speed_mps,
    lh.heading_deg,
    lh.battery_level,
    lh.recorded_at
  from public.location_history lh
  join private.location_history_visibility hv
    on hv.history_id = lh.id
   and hv.circle_id = p_circle_id
  where p_viewer_id is not null
    and p_viewer_id = auth.uid()
    and exists (
      select 1
      from public.circle_members viewer
      where viewer.circle_id = p_circle_id
        and viewer.user_id = p_viewer_id
    )
    and exists (
      select 1
      from public.circle_members target
      where target.circle_id = p_circle_id
        and target.user_id = p_target_user_id
    )
    and lh.user_id = p_target_user_id
    and lh.recorded_at >= p_start_at
    and lh.recorded_at < p_end_at
  order by lh.recorded_at asc
  limit greatest(1, least(coalesce(p_limit, 2000), 5000));
$$;

revoke all on function private.get_circle_history_internal(
  uuid, uuid, uuid, timestamptz, timestamptz, integer
) from public, anon;

grant execute on function private.get_circle_history_internal(
  uuid, uuid, uuid, timestamptz, timestamptz, integer
) to authenticated;

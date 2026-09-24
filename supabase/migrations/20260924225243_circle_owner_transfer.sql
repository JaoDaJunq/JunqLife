create or replace function public.transfer_circle_ownership_internal(
  p_circle_id uuid,
  p_current_owner_id uuid,
  p_new_owner_id uuid
)
returns table (
  transferred_circle_id uuid,
  old_owner_id uuid,
  new_owner_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_target_exists boolean;
begin
  if p_current_owner_id is null or p_new_owner_id is null then
    raise exception 'owner ids are required';
  end if;

  if p_current_owner_id = p_new_owner_id then
    raise exception 'new owner must be a different member';
  end if;

  select c.owner_id
    into v_owner_id
  from public.circles as c
  where c.id = p_circle_id
  for update;

  if v_owner_id is null then
    raise exception 'circle not found';
  end if;

  if v_owner_id <> p_current_owner_id then
    raise exception 'current owner mismatch';
  end if;

  select exists (
    select 1
    from public.circle_members as cm
    where cm.circle_id = p_circle_id
      and cm.user_id = p_new_owner_id
      and cm.role <> 'owner'::public.circle_role
  )
  into v_target_exists;

  if not v_target_exists then
    raise exception 'new owner must already be a circle member';
  end if;

  update public.circle_members as cm
  set role = case
    when cm.user_id = p_current_owner_id then 'member'::public.circle_role
    when cm.user_id = p_new_owner_id then 'owner'::public.circle_role
    else cm.role
  end
  where cm.circle_id = p_circle_id
    and cm.user_id in (p_current_owner_id, p_new_owner_id);

  update public.circles as c
  set owner_id = p_new_owner_id
  where c.id = p_circle_id;

  return query
  select p_circle_id, p_current_owner_id, p_new_owner_id;
end;
$$;

revoke all on function public.transfer_circle_ownership_internal(uuid,uuid,uuid) from public;
revoke all on function public.transfer_circle_ownership_internal(uuid,uuid,uuid) from anon;
revoke all on function public.transfer_circle_ownership_internal(uuid,uuid,uuid) from authenticated;
grant execute on function public.transfer_circle_ownership_internal(uuid,uuid,uuid) to service_role;

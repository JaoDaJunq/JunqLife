-- T003 hardening: circle membership joins only through trusted server flows.

drop policy if exists circle_members_insert_owner on public.circle_members;
revoke insert on public.circle_members from authenticated;
grant select, delete on public.circle_members to authenticated;

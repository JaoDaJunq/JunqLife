alter policy circles_select_member
on public.circles
using (
  owner_id = (select auth.uid())
  or private.is_circle_member(id)
);

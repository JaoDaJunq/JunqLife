-- T005: live map realtime sources.
alter publication supabase_realtime add table public.current_locations;
alter publication supabase_realtime add table public.circle_member_sharing;

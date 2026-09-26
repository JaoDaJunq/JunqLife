create index if not exists place_presence_user_idx
  on private.place_presence(user_id);

create index if not exists place_events_place_idx
  on public.place_events(place_id);

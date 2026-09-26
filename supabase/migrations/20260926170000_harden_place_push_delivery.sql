create table if not exists private.place_push_deliveries (
  event_id bigint primary key references public.place_events(id) on delete cascade,
  created_at timestamptz not null default now()
);

revoke all on private.place_push_deliveries from public, anon, authenticated, service_role;
grant select, insert on private.place_push_deliveries to service_role;

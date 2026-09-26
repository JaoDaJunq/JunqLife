create extension if not exists pg_net with schema extensions;

create or replace function private.enqueue_place_event_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform extensions.http_post(
    url := 'https://hgthtzihywggrmnuwhog.supabase.co/functions/v1/place-event-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhndGh0emloeXdnZ3JtbnV3aG9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMTYzNjUsImV4cCI6MjEwNTc5MjM2NX0.-NfdugLHHCYTWDAr72YtNjj7yyRnQnIVTqiqMIvwmPc'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'place_events',
      'schema', 'public',
      'record', to_jsonb(NEW),
      'old_record', null
    )
  );
  return NEW;
end;
$$;

revoke all on function private.enqueue_place_event_push() from public, anon, authenticated;

drop trigger if exists place_event_push_webhook on public.place_events;
create trigger place_event_push_webhook
after insert on public.place_events
for each row execute function private.enqueue_place_event_push();

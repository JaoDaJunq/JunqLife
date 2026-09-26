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
      'record', jsonb_build_object(
        'place_id', NEW.place_id,
        'circle_id', NEW.circle_id,
        'user_id', NEW.user_id,
        'event_type', NEW.event_type,
        'occurred_at', NEW.occurred_at
      ),
      'old_record', null
    )
  );
  return NEW;
end;
$$;

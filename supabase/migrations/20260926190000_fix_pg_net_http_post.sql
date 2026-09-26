create or replace function private.enqueue_place_event_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
begin
  select secret into webhook_secret
  from public.push_webhook_secrets
  where id = 'place-event-push';

  if webhook_secret is null then
    raise warning 'place-event-push webhook secret is not configured';
    return new;
  end if;

  perform net.http_post(
    url := 'https://hgthtzihywggrmnuwhog.supabase.co/functions/v1/place-event-push',
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'place_events',
      'schema', 'public',
      'record', jsonb_build_object(
        'id', NEW.id,
        'place_id', NEW.place_id,
        'circle_id', NEW.circle_id,
        'user_id', NEW.user_id,
        'event_type', NEW.event_type,
        'occurred_at', NEW.occurred_at
      ),
      'old_record', null
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-junqlife-webhook-secret', webhook_secret
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

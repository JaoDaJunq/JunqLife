create table if not exists public.push_webhook_secrets (
  id text primary key,
  secret text not null check (length(secret) >= 32),
  created_at timestamptz not null default now()
);

alter table public.push_webhook_secrets enable row level security;
revoke all on public.push_webhook_secrets from public, anon, authenticated;
grant select on public.push_webhook_secrets to service_role;

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

  perform extensions.http_post(
    url := 'https://hgthtzihywggrmnuwhog.supabase.co/functions/v1/place-event-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-junqlife-webhook-secret', webhook_secret
    ),
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
    )
  );
  return new;
end;
$$;

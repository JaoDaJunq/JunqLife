-- T002 + T003: profiles bootstrap and hashed circle invitations.

create table public.circle_invites (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  code_hint text not null check (char_length(code_hint) between 2 and 8),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_uses integer not null default 10 check (max_uses between 1 and 50),
  use_count integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  check (expires_at > created_at)
);

create index circle_invites_circle_id_idx on public.circle_invites(circle_id);
create index circle_invites_created_by_idx on public.circle_invites(created_by);
create index circle_invites_expires_at_idx on public.circle_invites(expires_at)
  where revoked_at is null;

alter table public.circle_invites enable row level security;

revoke all on public.circle_invites from anon, authenticated;
grant all on public.circle_invites to service_role;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

create trigger sharing_touch_updated_at
before update on public.circle_member_sharing
for each row execute function private.touch_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_name text;
begin
  candidate_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Usuário'
  );

  insert into public.profiles(id, display_name)
  values (new.id, left(candidate_name, 80))
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

insert into public.profiles(id, display_name)
select
  u.id,
  left(
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Usuário'
    ),
    80
  )
from auth.users u
on conflict (id) do nothing;

create or replace function public.accept_circle_invite_internal(
  p_user_id uuid,
  p_code_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.circle_invites%rowtype;
begin
  if p_user_id is null or p_code_hash is null then
    raise exception 'invalid_invite';
  end if;

  select *
  into invite_row
  from public.circle_invites
  where code_hash = lower(p_code_hash)
  for update;

  if not found then
    raise exception 'invalid_invite';
  end if;

  if invite_row.revoked_at is not null
     or invite_row.expires_at <= now()
     or invite_row.use_count >= invite_row.max_uses then
    raise exception 'invalid_invite';
  end if;

  if exists (
    select 1
    from public.circle_members
    where circle_id = invite_row.circle_id
      and user_id = p_user_id
  ) then
    return invite_row.circle_id;
  end if;

  insert into public.circle_members(circle_id, user_id, role)
  values (invite_row.circle_id, p_user_id, 'member');

  update public.circle_invites
  set use_count = use_count + 1
  where id = invite_row.id;

  return invite_row.circle_id;
end;
$$;

revoke all on function public.accept_circle_invite_internal(uuid, text)
from public, anon, authenticated;
grant execute on function public.accept_circle_invite_internal(uuid, text)
to service_role;

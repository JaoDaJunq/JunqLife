create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists push_tokens_user_idx on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_select_self on public.push_tokens;
create policy push_tokens_select_self on public.push_tokens for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists push_tokens_insert_self on public.push_tokens;
create policy push_tokens_insert_self on public.push_tokens for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists push_tokens_update_self on public.push_tokens;
create policy push_tokens_update_self on public.push_tokens for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists push_tokens_delete_self on public.push_tokens;
create policy push_tokens_delete_self on public.push_tokens for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.push_tokens to authenticated;
drop trigger if exists push_tokens_touch_updated_at on public.push_tokens;
create trigger push_tokens_touch_updated_at before update on public.push_tokens for each row execute function private.touch_updated_at();

begin;

select plan(16);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'member@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'outsider@test.local');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$insert into public.circles(id, name, owner_id)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Regression Circle',
      '11111111-1111-4111-8111-111111111111'
    )
    returning id$$,
  'owner can create a circle with INSERT ... RETURNING'
);

reset role;

select is(
  (
    select role::text
    from public.circle_members
    where circle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and user_id = '11111111-1111-4111-8111-111111111111'
  ),
  'owner',
  'circle trigger creates owner membership'
);

select is(
  (
    select sharing_enabled
    from public.circle_member_sharing
    where circle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and user_id = '11111111-1111-4111-8111-111111111111'
  ),
  false,
  'owner sharing starts disabled'
);

insert into public.circle_members(circle_id, user_id, role)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '22222222-2222-4222-8222-222222222222',
  'member'
);

insert into public.devices(id, user_id, platform)
values (
  '44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',
  'android'
);

insert into public.current_locations(
  user_id,
  device_id,
  latitude,
  longitude,
  accuracy_m,
  battery_level,
  recorded_at
)
values (
  '11111111-1111-4111-8111-111111111111',
  '44444444-4444-4444-8444-444444444444',
  -29.45,
  -51.97,
  12,
  0.75,
  now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select count(*)::integer
    from public.current_locations
    where user_id = '11111111-1111-4111-8111-111111111111'
  ),
  0,
  'member cannot see location while target sharing is off'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update public.circle_member_sharing
set sharing_enabled = true,
    updated_at = now() - interval '1 second'
where circle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id = '11111111-1111-4111-8111-111111111111';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select count(*)::integer
    from public.current_locations
    where user_id = '11111111-1111-4111-8111-111111111111'
  ),
  1,
  'member can see location while target sharing is on'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select count(*)::integer
    from public.current_locations
    where user_id = '11111111-1111-4111-8111-111111111111'
  ),
  0,
  'outsider cannot see current location'
);

select is(
  (
    select count(*)::integer
    from public.circles
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  0,
  'outsider cannot see circle'
);

reset role;
set local role service_role;

select is(
  public.ingest_location_internal(
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    -29.451,
    -51.971,
    9,
    0,
    0,
    0,
    0.74,
    now()
  ),
  true,
  'service role can ingest an accepted location point'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select count(*)::integer
    from public.get_circle_history(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      now() - interval '5 minutes',
      now() + interval '5 minutes',
      100
    )
  ),
  1,
  'authorized member can read circle-scoped history'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select count(*)::integer
    from public.get_circle_history(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      now() - interval '5 minutes',
      now() + interval '5 minutes',
      100
    )
  ),
  0,
  'outsider cannot read circle-scoped history'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update public.circle_member_sharing
set sharing_enabled = false,
    updated_at = now()
where circle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id = '11111111-1111-4111-8111-111111111111';

reset role;
set local role service_role;

select is(
  public.ingest_location_internal(
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    -29.452,
    -51.972,
    8,
    0,
    0,
    0,
    0.73,
    now() - interval '10 seconds'
  ),
  false,
  'buffered point recorded before sharing-off transition is rejected'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.location_history
    where user_id = '11111111-1111-4111-8111-111111111111'
  ),
  1,
  'rejected buffered point does not create history'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.get_circle_history_internal(uuid,uuid,uuid,timestamptz,timestamptz,integer)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute private history reader directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.transfer_circle_ownership_internal(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute owner-transfer RPC directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.transfer_circle_ownership_internal(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  true,
  'service role can execute owner-transfer RPC'
);

set local role service_role;

select lives_ok(
  $$select * from public.transfer_circle_ownership_internal(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    )$$,
  'owner transfer completes atomically'
);

reset role;

select is(
  (
    select owner_id::text
    from public.circles
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  '22222222-2222-4222-8222-222222222222',
  'circles.owner_id follows the new owner'
);

select is(
  (
    select count(*)::integer
    from public.circle_members
    where circle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and role = 'owner'
  ),
  1,
  'circle has exactly one owner after transfer'
);

select * from finish();
rollback;

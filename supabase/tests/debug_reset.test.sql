begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000801',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'keeper@example.test', '',
    timezone('utc', now()), '{}'::jsonb, '{"display_name":"Keeper"}',
    timezone('utc', now()), timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000802',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'remove@example.test', '',
    timezone('utc', now()), '{}'::jsonb, '{"display_name":"Remove"}',
    timezone('utc', now()), timezone('utc', now())
  );

insert into public.clubs (id, name)
values ('10000000-0000-0000-0000-000000000801', 'Debug Club');

insert into public.memberships (
  id, club_id, user_id, role, status, invited_by, activated_at
)
values
  (
    '20000000-0000-0000-0000-000000000801',
    '10000000-0000-0000-0000-000000000801',
    '00000000-0000-0000-0000-000000000801',
    'admin', 'active',
    '00000000-0000-0000-0000-000000000801',
    timezone('utc', now())
  ),
  (
    '20000000-0000-0000-0000-000000000802',
    '10000000-0000-0000-0000-000000000801',
    '00000000-0000-0000-0000-000000000802',
    'member', 'active',
    '00000000-0000-0000-0000-000000000801',
    timezone('utc', now())
  );

insert into public.seasons (
  id, club_id, name, status, created_by, starts_at
)
values (
  '40000000-0000-0000-0000-000000000801',
  '10000000-0000-0000-0000-000000000801',
  'Debug Season', 'open',
  '00000000-0000-0000-0000-000000000801',
  timezone('utc', now())
);

insert into public.games (
  id, club_id, season_id, name, status, created_by, started_at
)
values (
  '50000000-0000-0000-0000-000000000801',
  '10000000-0000-0000-0000-000000000801',
  '40000000-0000-0000-0000-000000000801',
  'Debug Game', 'active',
  '00000000-0000-0000-0000-000000000801',
  timezone('utc', now())
);

insert into public.game_players (
  id, game_id, member_id, total_buy_in
)
values (
  '70000000-0000-0000-0000-000000000801',
  '50000000-0000-0000-0000-000000000801',
  '20000000-0000-0000-0000-000000000802',
  1000
);

insert into public.game_transactions (
  game_id, game_player_id, type, amount, request_id, created_by
)
values (
  '50000000-0000-0000-0000-000000000801',
  '70000000-0000-0000-0000-000000000801',
  'initial_buy_in', 1000,
  '80000000-0000-0000-0000-000000000801',
  '00000000-0000-0000-0000-000000000801'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000801',
  true
);

select throws_ok(
  $$
    select public.reset_debug_club(
      'keeper@example.test',
      'DELETE_ALL_DEBUG_DATA',
      '90000000-0000-0000-0000-000000000801'
    )
  $$,
  '42501',
  'Service role required',
  'authenticated administrators cannot invoke destructive reset'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$
    select public.reset_debug_club(
      'keeper@example.test',
      'wrong',
      '90000000-0000-0000-0000-000000000802'
    )
  $$,
  '22023',
  'Exact destructive confirmation required',
  'incorrect confirmation is rejected'
);

select lives_ok(
  $$
    select public.reset_debug_club(
      'keeper@example.test',
      'DELETE_ALL_DEBUG_DATA',
      '90000000-0000-0000-0000-000000000803'
    )
  $$,
  'service role can perform confirmed debug reset'
);

select results_eq(
  $$ select email::text from auth.users $$,
  $$ values ('keeper@example.test'::text) $$,
  'only the retained Auth user remains'
);

select results_eq(
  $$
    select role::text, status::text
    from public.memberships
  $$,
  $$ values ('admin'::text, 'active'::text) $$,
  'only the retained active admin membership remains'
);

select results_eq(
  $$
    select
      (select count(*) from public.games),
      (select count(*) from public.seasons),
      (select count(*) from public.audit_logs where action <> 'debug.reset')
  $$,
  $$ values (0::bigint, 0::bigint, 0::bigint) $$,
  'game, season, and prior audit data are removed'
);

select * from finish();
rollback;

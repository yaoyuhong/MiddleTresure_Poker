begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000701',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'request-admin@example.test', '',
    timezone('utc', now()), '{}'::jsonb, '{"display_name":"Request Admin"}',
    timezone('utc', now()), timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000702',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'request-member@example.test', '',
    timezone('utc', now()), '{}'::jsonb, '{"display_name":"Request Member"}',
    timezone('utc', now()), timezone('utc', now())
  );

insert into public.clubs (id, name)
values ('10000000-0000-0000-0000-000000000701', 'Request Club');

insert into public.memberships (
  id, club_id, user_id, role, status, invited_by, activated_at
)
values
  (
    '20000000-0000-0000-0000-000000000701',
    '10000000-0000-0000-0000-000000000701',
    '00000000-0000-0000-0000-000000000701',
    'admin', 'active',
    '00000000-0000-0000-0000-000000000701',
    timezone('utc', now())
  ),
  (
    '20000000-0000-0000-0000-000000000702',
    '10000000-0000-0000-0000-000000000701',
    '00000000-0000-0000-0000-000000000702',
    'member', 'active',
    '00000000-0000-0000-0000-000000000701',
    timezone('utc', now())
  );

insert into public.seasons (
  id, club_id, name, status, created_by, starts_at
)
values (
  '40000000-0000-0000-0000-000000000701',
  '10000000-0000-0000-0000-000000000701',
  'Request Season', 'open',
  '00000000-0000-0000-0000-000000000701',
  timezone('utc', now())
);

insert into public.games (
  id, club_id, season_id, name, status, created_by, started_at
)
values (
  '50000000-0000-0000-0000-000000000701',
  '10000000-0000-0000-0000-000000000701',
  '40000000-0000-0000-0000-000000000701',
  'Request Game', 'active',
  '00000000-0000-0000-0000-000000000701',
  timezone('utc', now())
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000702',
  true
);

select lives_ok(
  $$
    select public.submit_game_action_request(
      '50000000-0000-0000-0000-000000000701',
      'join',
      1000,
      '60000000-0000-0000-0000-000000000701'
    )
  $$,
  'member can request a mid-game join'
);

select is(
  (
    select count(*)
    from public.game_action_requests
    where membership_id = '20000000-0000-0000-0000-000000000702'
      and status = 'pending'
  ),
  1::bigint,
  'member can read the pending request'
);

select throws_ok(
  $$
    select public.review_game_action_request(
      (
        select id from public.game_action_requests
        where membership_id = '20000000-0000-0000-0000-000000000702'
      ),
      'approve',
      null,
      '60000000-0000-0000-0000-000000000702'
    )
  $$,
  '42501',
  'Active club administrator required',
  'members cannot review requests'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000701',
  true
);

select lives_ok(
  $$
    select public.review_game_action_request(
      (
        select id from public.game_action_requests
        where membership_id = '20000000-0000-0000-0000-000000000702'
      ),
      'approve',
      'At the table',
      '60000000-0000-0000-0000-000000000702'
    )
  $$,
  'administrator approves a join atomically'
);

select is(
  (
    select total_buy_in
    from public.game_players
    where member_id = '20000000-0000-0000-0000-000000000702'
  ),
  1000::bigint,
  'approval writes the official ledger'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000702',
  true
);

select lives_ok(
  $$
    select public.submit_game_action_request(
      '50000000-0000-0000-0000-000000000701',
      'add_on',
      500,
      '60000000-0000-0000-0000-000000000703'
    )
  $$,
  'joined member can request an add-on'
);

select lives_ok(
  $$
    select public.cancel_game_action_request(
      (
        select id from public.game_action_requests
        where request_id = '60000000-0000-0000-0000-000000000703'
      ),
      '60000000-0000-0000-0000-000000000704'
    )
  $$,
  'member can cancel a pending request'
);

select is(
  (
    select status::text
    from public.game_action_requests
    where request_id = '60000000-0000-0000-0000-000000000703'
  ),
  'cancelled',
  'cancel persists without a ledger mutation'
);

reset role;
update public.games
set status = 'finalized', finalized_at = timezone('utc', now())
where id = '50000000-0000-0000-0000-000000000701';
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000702',
  true
);

select throws_ok(
  $$
    select public.submit_game_action_request(
      '50000000-0000-0000-0000-000000000701',
      'exit',
      1200,
      '60000000-0000-0000-0000-000000000705'
    )
  $$,
  '55000',
  'Requests require an open game',
  'finalized games reject requests'
);

reset role;
select is(
  (
    select count(*)
    from public.audit_logs
    where action like 'game.request.%'
  ),
  4::bigint,
  'submit, review, submit, and cancellation are audited'
);

select * from finish();
rollback;

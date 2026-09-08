begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'finalize-' || n || '@example.test',
  '',
  timezone('utc', now()),
  '{}'::jsonb,
  jsonb_build_object('display_name', 'Finalize ' || n),
  timezone('utc', now()),
  timezone('utc', now())
from generate_series(201, 203) n;

insert into public.clubs (id, name)
values ('10000000-0000-0000-0000-000000000201', 'Finalization Club');

insert into public.memberships (
  id, club_id, user_id, role, status, invited_by, activated_at
)
select
  ('20000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '10000000-0000-0000-0000-000000000201'::uuid,
  ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  case when n = 201 then 'admin'::public.club_role else 'member'::public.club_role end,
  'active'::public.membership_status,
  '00000000-0000-0000-0000-000000000201'::uuid,
  timezone('utc', now())
from generate_series(201, 203) n;

create function pg_temp.attempt_unbalanced_close(
  target_game_id uuid,
  expected_version bigint,
  close_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_player_id uuid;
begin
  select id
  into target_player_id
  from public.game_players
  where game_id = target_game_id
  order by id
  limit 1;

  insert into public.game_transactions (
    game_id, game_player_id, type, amount, request_id, created_by
  )
  values (
    target_game_id,
    target_player_id,
    'add_on',
    1,
    extensions.gen_random_uuid(),
    '00000000-0000-0000-0000-000000000201'
  );

  perform public.finalize_game(
    target_game_id,
    expected_version,
    close_request_id,
    '[]'::jsonb
  );
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);

create temporary table finalize_ids (kind text primary key, id uuid not null);

insert into finalize_ids
select
  'season',
  ((public.create_season(
    '10000000-0000-0000-0000-000000000201',
    'Finalization Season',
    '30000000-0000-0000-0000-000000000201'
  )) ->> 'id')::uuid;

select public.open_season(
  (select id from finalize_ids where kind = 'season'),
  '30000000-0000-0000-0000-000000000202'
);

insert into finalize_ids
select
  'balanced_game',
  ((public.create_game(
    (select id from finalize_ids where kind = 'season'),
    'Balanced Game',
    '30000000-0000-0000-0000-000000000204'
  )) ->> 'id')::uuid
;

do $$
declare
  fixture_game_id uuid;
  player_number integer;
  current_version bigint;
  cash_out bigint;
  request_number integer := 210;
begin
  select id into fixture_game_id from finalize_ids where kind = 'balanced_game';

  for player_number in 202..203 loop
    select version into current_version from public.games where id = fixture_game_id;
    perform public.add_game_player(
      fixture_game_id,
      ('20000000-0000-0000-0000-' || lpad(player_number::text, 12, '0'))::uuid,
      100,
      current_version,
      ('30000000-0000-0000-0000-' || lpad(request_number::text, 12, '0'))::uuid
    );
    request_number := request_number + 1;
  end loop;

  select version into current_version from public.games where id = fixture_game_id;
  perform public.start_game(
    fixture_game_id,
    current_version,
    ('30000000-0000-0000-0000-' || lpad(request_number::text, 12, '0'))::uuid
  );
  request_number := request_number + 1;

  for player_number in 202..203 loop
    cash_out := case when player_number = 202 then 150 else 50 end;
    select version into current_version from public.games where id = fixture_game_id;
    perform public.exit_game_player(
      (
        select gp.id from public.game_players gp
        where gp.game_id = fixture_game_id
          and gp.member_id = ('20000000-0000-0000-0000-' || lpad(player_number::text, 12, '0'))::uuid
      ),
      cash_out,
      current_version,
      ('30000000-0000-0000-0000-' || lpad(request_number::text, 12, '0'))::uuid
    );
    request_number := request_number + 1;
  end loop;
end;
$$;

select throws_ok(
  format(
    'select pg_temp.attempt_unbalanced_close(%L::uuid, %s, %L::uuid)',
    (select id from finalize_ids where kind = 'balanced_game'),
    (select version from public.games where id = (select id from finalize_ids where kind = 'balanced_game')),
    '30000000-0000-0000-0000-000000000220'
  ),
  '23514',
  null,
  'unbalanced game cannot close'
);

select throws_ok(
  format(
    'select public.finalize_game(%L::uuid, %s, %L::uuid, %L::jsonb)',
    (select id from finalize_ids where kind = 'balanced_game'),
    (select version from public.games where id = (select id from finalize_ids where kind = 'balanced_game')),
    '30000000-0000-0000-0000-000000000221',
    jsonb_build_array(jsonb_build_object(
      'from_game_player_id',
      (select id from public.game_players where game_id = (select id from finalize_ids where kind = 'balanced_game') and member_id = '20000000-0000-0000-0000-000000000203'),
      'to_game_player_id',
      (select id from public.game_players where game_id = (select id from finalize_ids where kind = 'balanced_game') and member_id = '20000000-0000-0000-0000-000000000202'),
      'amount', 49,
      'position', 1
    ))
  ),
  '23514',
  null,
  'plan that does not reconcile every player is rejected'
);

select is(
  (
    public.finalize_game(
      (select id from finalize_ids where kind = 'balanced_game'),
      (select version from public.games where id = (select id from finalize_ids where kind = 'balanced_game')),
      '30000000-0000-0000-0000-000000000222',
      jsonb_build_array(jsonb_build_object(
        'from_game_player_id',
        (select id from public.game_players where game_id = (select id from finalize_ids where kind = 'balanced_game') and member_id = '20000000-0000-0000-0000-000000000203'),
        'to_game_player_id',
        (select id from public.game_players where game_id = (select id from finalize_ids where kind = 'balanced_game') and member_id = '20000000-0000-0000-0000-000000000202'),
        'amount', 50,
        'position', 1
      ))
    )
  ) ->> 'status',
  'finalized',
  'balanced game finalizes atomically'
);

select is(
  (select settlement_revision from public.games where id = (select id from finalize_ids where kind = 'balanced_game')),
  1,
  'initial finalization stores settlement revision one'
);

select is(
  (select count(*) from public.settlement_transfers where game_id = (select id from finalize_ids where kind = 'balanced_game')),
  1::bigint,
  'initial finalization stores the validated transfer once'
);

select lives_ok(
  format(
    'select public.finalize_game(%L::uuid, 1, %L::uuid, %L::jsonb)',
    (select id from finalize_ids where kind = 'balanced_game'),
    '30000000-0000-0000-0000-000000000222',
    '[]'
  ),
  'retrying the successful close request is idempotent'
);

select is(
  (select count(*) from public.settlement_transfers where game_id = (select id from finalize_ids where kind = 'balanced_game')),
  1::bigint,
  'exact-once close does not duplicate transfers'
);

select is(
  (
    public.correct_finalized_game(
      (select id from finalize_ids where kind = 'balanced_game'),
      (select version from public.games where id = (select id from finalize_ids where kind = 'balanced_game')),
      '30000000-0000-0000-0000-000000000223',
      jsonb_build_array(
        jsonb_build_object(
          'game_player_id',
          (select id from public.game_players where game_id = (select id from finalize_ids where kind = 'balanced_game') and member_id = '20000000-0000-0000-0000-000000000202'),
          'correction_of',
          (select id from public.game_transactions where game_id = (select id from finalize_ids where kind = 'balanced_game') and game_player_id = (select id from public.game_players where game_id = (select id from finalize_ids where kind = 'balanced_game') and member_id = '20000000-0000-0000-0000-000000000202') and type = 'cash_out'),
          'buy_in_delta', 0,
          'cash_out_delta', -10
        ),
        jsonb_build_object(
          'game_player_id',
          (select id from public.game_players where game_id = (select id from finalize_ids where kind = 'balanced_game') and member_id = '20000000-0000-0000-0000-000000000203'),
          'correction_of',
          (select id from public.game_transactions where game_id = (select id from finalize_ids where kind = 'balanced_game') and game_player_id = (select id from public.game_players where game_id = (select id from finalize_ids where kind = 'balanced_game') and member_id = '20000000-0000-0000-0000-000000000203') and type = 'cash_out'),
          'buy_in_delta', 0,
          'cash_out_delta', 10
        )
      ),
      jsonb_build_array(jsonb_build_object(
        'from_game_player_id',
        (select id from public.game_players where game_id = (select id from finalize_ids where kind = 'balanced_game') and member_id = '20000000-0000-0000-0000-000000000203'),
        'to_game_player_id',
        (select id from public.game_players where game_id = (select id from finalize_ids where kind = 'balanced_game') and member_id = '20000000-0000-0000-0000-000000000202'),
        'amount', 40,
        'position', 1
      )),
      'Corrected swapped cash-out units'
    )
  ) ->> 'settlement_revision',
  '2',
  'audited correction creates a new settlement revision'
);

select is(
  (select count(*) from public.settlement_transfers where game_id = (select id from finalize_ids where kind = 'balanced_game') and revision = 1),
  1::bigint,
  'correction preserves the prior settlement revision'
);

select results_eq(
  $$
    select revision, amount
    from public.settlement_transfers
    where game_id = (select id from finalize_ids where kind = 'balanced_game')
    order by revision
  $$,
  $$ values (1, 50::bigint), (2, 40::bigint) $$,
  'new settlement revision reflects corrected balances'
);

select is(
  (
    select profit
    from public.season_rankings
    where season_id = (select id from finalize_ids where kind = 'season')
      and membership_id = '20000000-0000-0000-0000-000000000202'
  ),
  40::bigint,
  'season ranking uses corrected totals without double counting'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'game.correct'
      and entity_id = (select id from finalize_ids where kind = 'balanced_game')
  ),
  1::bigint,
  'correction is attributable in immutable audit history'
);

select is(
  (
    public.close_season(
      (select id from finalize_ids where kind = 'season'),
      '30000000-0000-0000-0000-000000000224'
    )
  ) ->> 'status',
  'closed',
  'administrator closes a season after all games are finalized'
);

select * from finish();
rollback;

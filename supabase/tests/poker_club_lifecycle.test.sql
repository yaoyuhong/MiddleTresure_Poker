begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'lifecycle-' || n || '@example.test',
  '',
  timezone('utc', now()),
  '{}'::jsonb,
  jsonb_build_object('display_name', 'Lifecycle ' || n),
  timezone('utc', now()),
  timezone('utc', now())
from generate_series(101, 118) n;

insert into public.clubs (id, name)
values ('10000000-0000-0000-0000-000000000101', 'Lifecycle Club');

insert into public.memberships (
  id, club_id, user_id, role, status, invited_by, activated_at
)
select
  ('20000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '10000000-0000-0000-0000-000000000101'::uuid,
  ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  case when n = 101 then 'admin'::public.club_role else 'member'::public.club_role end,
  'active'::public.membership_status,
  '00000000-0000-0000-0000-000000000101'::uuid,
  timezone('utc', now())
from generate_series(101, 118) n;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

create temporary table lifecycle_ids (kind text primary key, id uuid not null);

insert into lifecycle_ids
select
  'season',
  ((public.create_season(
    '10000000-0000-0000-0000-000000000101',
    'Season One',
    '30000000-0000-0000-0000-000000000101'
  )) ->> 'id')::uuid;

select is(
  (select status::text from public.seasons where id = (select id from lifecycle_ids where kind = 'season')),
  'draft',
  'administrator creates a draft season'
);

select is(
  (public.open_season(
    (select id from lifecycle_ids where kind = 'season'),
    '30000000-0000-0000-0000-000000000102'
  )) ->> 'status',
  'open',
  'administrator opens a draft season'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);

select throws_ok(
  $$ select public.create_game(
    (select id from lifecycle_ids where kind = 'season'),
    'Forbidden Game',
    '30000000-0000-0000-0000-000000000103'
  ) $$,
  '42501',
  null,
  'non-administrator cannot call a write RPC'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

insert into lifecycle_ids
select
  'game',
  ((public.create_game(
    (select id from lifecycle_ids where kind = 'season'),
    'Lifecycle Game',
    '30000000-0000-0000-0000-000000000104'
  )) ->> 'id')::uuid;

select is(
  (select status::text from public.games where id = (select id from lifecycle_ids where kind = 'game')),
  'draft',
  'administrator creates a draft game in an open season'
);

select lives_ok(
  format(
    $sql$
      select public.add_game_player(
        %L::uuid,
        %L::uuid,
        100,
        %s,
        %L::uuid
      )
    $sql$,
    (select id from lifecycle_ids where kind = 'game'),
    '20000000-0000-0000-0000-000000000102',
    (select version from public.games where id = (select id from lifecycle_ids where kind = 'game')),
    '30000000-0000-0000-0000-000000000105'
  ),
  'administrator adds a participant with an initial buy-in'
);

select is(
  (select total_buy_in from public.game_players where game_id = (select id from lifecycle_ids where kind = 'game')),
  100::bigint,
  'initial buy-in updates the participant aggregate'
);

select is(
  (
    public.add_game_player(
      (select id from lifecycle_ids where kind = 'game'),
      '20000000-0000-0000-0000-000000000102',
      100,
      1,
      '30000000-0000-0000-0000-000000000105'
    )
  ) ->> 'id',
  (
    select id::text
    from public.game_players
    where game_id = (select id from lifecycle_ids where kind = 'game')
  ),
  'repeating a request returns the original result'
);

select is(
  (select count(*) from public.game_transactions where game_id = (select id from lifecycle_ids where kind = 'game')),
  1::bigint,
  'duplicate request does not append another transaction'
);

select throws_ok(
  format(
    $sql$
      select public.add_game_player(
        %L::uuid,
        %L::uuid,
        50,
        1,
        %L::uuid
      )
    $sql$,
    (select id from lifecycle_ids where kind = 'game'),
    '20000000-0000-0000-0000-000000000103',
    '30000000-0000-0000-0000-000000000106'
  ),
  '40001',
  null,
  'stale expected version is rejected'
);

do $$
declare
  n integer;
  current_version bigint;
begin
  for n in 103..117 loop
    select version into current_version
    from public.games
    where id = (select id from lifecycle_ids where kind = 'game');

    perform public.add_game_player(
      (select id from lifecycle_ids where kind = 'game'),
      ('20000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
      100,
      current_version,
      ('31000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
    );
  end loop;
end;
$$;

select is(
  (select count(*) from public.game_players where game_id = (select id from lifecycle_ids where kind = 'game')),
  16::bigint,
  'game accepts sixteen distinct participants'
);

select throws_ok(
  format(
    $sql$
      select public.add_game_player(
        %L::uuid,
        %L::uuid,
        100,
        %s,
        %L::uuid
      )
    $sql$,
    (select id from lifecycle_ids where kind = 'game'),
    '20000000-0000-0000-0000-000000000118',
    (select version from public.games where id = (select id from lifecycle_ids where kind = 'game')),
    '30000000-0000-0000-0000-000000000107'
  ),
  '23514',
  null,
  'seventeenth participant is rejected'
);

select lives_ok(
  format(
    'select public.start_game(%L::uuid, %s, %L::uuid)',
    (select id from lifecycle_ids where kind = 'game'),
    (select version from public.games where id = (select id from lifecycle_ids where kind = 'game')),
    '30000000-0000-0000-0000-000000000108'
  ),
  'administrator starts a draft game'
);

select lives_ok(
  format(
    'select public.add_game_player_add_on(%L::uuid, 25, %s, %L::uuid)',
    (
      select id from public.game_players
      where game_id = (select id from lifecycle_ids where kind = 'game')
        and member_id = '20000000-0000-0000-0000-000000000102'
    ),
    (select version from public.games where id = (select id from lifecycle_ids where kind = 'game')),
    '30000000-0000-0000-0000-000000000110'
  ),
  'administrator records an add-on for an active player'
);

select is(
  (
    select total_buy_in from public.game_players
    where game_id = (select id from lifecycle_ids where kind = 'game')
      and member_id = '20000000-0000-0000-0000-000000000102'
  ),
  125::bigint,
  'add-on updates the participant aggregate'
);

select is(
  (
    public.exit_game_player(
      (
        select id from public.game_players
        where game_id = (select id from lifecycle_ids where kind = 'game')
          and member_id = '20000000-0000-0000-0000-000000000102'
      ),
      100,
      (select version from public.games where id = (select id from lifecycle_ids where kind = 'game')),
      '30000000-0000-0000-0000-000000000109'
    )
  ) ->> 'status',
  'exited',
  'exit records a cash-out and marks the participant exited'
);

select * from finish();
rollback;

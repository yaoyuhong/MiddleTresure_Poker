alter table public.game_transactions
add column correction_buy_in_delta bigint,
add column correction_cash_out_delta bigint;

alter table public.game_transactions
add constraint game_transactions_correction_deltas_check
check (
  (
    type = 'correction'
    and amount = 0
    and correction_buy_in_delta is not null
    and correction_cash_out_delta is not null
    and (correction_buy_in_delta <> 0 or correction_cash_out_delta <> 0)
  )
  or (
    type <> 'correction'
    and correction_buy_in_delta is null
    and correction_cash_out_delta is null
  )
);

create or replace function public._require_club_admin(target_club_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1
    from public.memberships
    where club_id = target_club_id
      and user_id = actor
      and role = 'admin'
      and status = 'active'
  ) then
    raise exception using
      errcode = '42501',
      message = 'Active club administrator required';
  end if;

  return actor;
end;
$$;

create or replace function public._request_result(
  target_action text,
  target_request_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select after_data
  from public.audit_logs
  where actor_id = auth.uid()
    and request_id = target_request_id
    and action = target_action
$$;

create or replace function public._write_audit(
  target_club_id uuid,
  target_actor_id uuid,
  target_action text,
  target_entity_type text,
  target_entity_id uuid,
  target_request_id uuid,
  target_before_data jsonb,
  target_after_data jsonb
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.audit_logs (
    club_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    request_id,
    before_data,
    after_data
  )
  values (
    target_club_id,
    target_actor_id,
    target_action,
    target_entity_type,
    target_entity_id,
    target_request_id,
    target_before_data,
    target_after_data
  )
$$;

create or replace function public.create_season(
  target_club_id uuid,
  season_name text,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  previous_result jsonb;
  created_season public.seasons%rowtype;
begin
  if target_request_id is null then
    raise exception using errcode = '22004', message = 'Request ID is required';
  end if;

  perform 1 from public.clubs where id = target_club_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  actor := public._require_club_admin(target_club_id);
  previous_result := public._request_result('season.create', target_request_id);
  if previous_result is not null then
    return previous_result;
  end if;

  insert into public.seasons (club_id, name, created_by)
  values (target_club_id, season_name, actor)
  returning * into created_season;

  previous_result := to_jsonb(created_season);
  perform public._write_audit(
    target_club_id, actor, 'season.create', 'season', created_season.id,
    target_request_id, null, previous_result
  );
  return previous_result;
end;
$$;

create or replace function public.open_season(
  target_season_id uuid,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  previous_result jsonb;
  before_row public.seasons%rowtype;
  changed_row public.seasons%rowtype;
begin
  select * into before_row
  from public.seasons
  where id = target_season_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Season not found';
  end if;

  actor := public._require_club_admin(before_row.club_id);
  previous_result := public._request_result('season.open', target_request_id);
  if previous_result is not null then
    return previous_result;
  end if;
  if before_row.status <> 'draft' then
    raise exception using errcode = '55000', message = 'Only a draft season can be opened';
  end if;
  if exists (
    select 1 from public.seasons
    where club_id = before_row.club_id and status = 'open' and id <> before_row.id
  ) then
    raise exception using errcode = '23514', message = 'The club already has an open season';
  end if;

  update public.seasons
  set status = 'open',
      starts_at = coalesce(starts_at, timezone('utc', now()))
  where id = target_season_id
  returning * into changed_row;

  previous_result := to_jsonb(changed_row);
  perform public._write_audit(
    changed_row.club_id, actor, 'season.open', 'season', changed_row.id,
    target_request_id, to_jsonb(before_row), previous_result
  );
  return previous_result;
end;
$$;

create or replace function public.close_season(
  target_season_id uuid,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  previous_result jsonb;
  before_row public.seasons%rowtype;
  changed_row public.seasons%rowtype;
begin
  select * into before_row
  from public.seasons
  where id = target_season_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Season not found';
  end if;

  actor := public._require_club_admin(before_row.club_id);
  previous_result := public._request_result('season.close', target_request_id);
  if previous_result is not null then
    return previous_result;
  end if;
  if before_row.status <> 'open' then
    raise exception using errcode = '55000', message = 'Only an open season can be closed';
  end if;
  if exists (
    select 1 from public.games
    where season_id = target_season_id and status <> 'finalized'
  ) then
    raise exception using errcode = '55000', message = 'All season games must be finalized';
  end if;

  update public.seasons
  set status = 'closed', ends_at = timezone('utc', now())
  where id = target_season_id
  returning * into changed_row;

  previous_result := to_jsonb(changed_row);
  perform public._write_audit(
    changed_row.club_id, actor, 'season.close', 'season', changed_row.id,
    target_request_id, to_jsonb(before_row), previous_result
  );
  return previous_result;
end;
$$;

create or replace function public.create_game(
  target_season_id uuid,
  game_name text,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  previous_result jsonb;
  target_season public.seasons%rowtype;
  created_game public.games%rowtype;
begin
  select * into target_season
  from public.seasons
  where id = target_season_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Season not found';
  end if;

  actor := public._require_club_admin(target_season.club_id);
  previous_result := public._request_result('game.create', target_request_id);
  if previous_result is not null then
    return previous_result;
  end if;
  if target_season.status <> 'open' then
    raise exception using errcode = '55000', message = 'Games require an open season';
  end if;

  insert into public.games (club_id, season_id, name, created_by)
  values (target_season.club_id, target_season.id, game_name, actor)
  returning * into created_game;

  previous_result := to_jsonb(created_game);
  perform public._write_audit(
    created_game.club_id, actor, 'game.create', 'game', created_game.id,
    target_request_id, null, previous_result
  );
  return previous_result;
end;
$$;

create or replace function public.start_game(
  target_game_id uuid,
  expected_version bigint,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  previous_result jsonb;
  before_row public.games%rowtype;
  changed_row public.games%rowtype;
begin
  select * into before_row from public.games where id = target_game_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Game not found';
  end if;
  actor := public._require_club_admin(before_row.club_id);
  previous_result := public._request_result('game.start', target_request_id);
  if previous_result is not null then
    return previous_result;
  end if;
  if before_row.version <> expected_version then
    raise exception using errcode = '40001', message = 'Stale game version';
  end if;
  if before_row.status <> 'draft' then
    raise exception using errcode = '55000', message = 'Only a draft game can be started';
  end if;
  if not exists (select 1 from public.game_players where game_id = target_game_id) then
    raise exception using errcode = '23514', message = 'A game requires at least one participant';
  end if;

  update public.games
  set status = 'active',
      started_at = timezone('utc', now()),
      version = version + 1
  where id = target_game_id
  returning * into changed_row;

  previous_result := to_jsonb(changed_row);
  perform public._write_audit(
    changed_row.club_id, actor, 'game.start', 'game', changed_row.id,
    target_request_id, to_jsonb(before_row), previous_result
  );
  return previous_result;
end;
$$;

create or replace function public.add_game_player(
  target_game_id uuid,
  target_member_id uuid,
  initial_buy_in bigint,
  expected_version bigint,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  previous_result jsonb;
  target_game public.games%rowtype;
  created_player public.game_players%rowtype;
begin
  select * into target_game from public.games where id = target_game_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Game not found';
  end if;
  actor := public._require_club_admin(target_game.club_id);
  previous_result := public._request_result('game.player.add', target_request_id);
  if previous_result is not null then
    return previous_result;
  end if;
  if target_game.version <> expected_version then
    raise exception using errcode = '40001', message = 'Stale game version';
  end if;
  if target_game.status not in ('draft', 'active') then
    raise exception using errcode = '55000', message = 'Cannot add a player to a finalized game';
  end if;
  if initial_buy_in <= 0 then
    raise exception using errcode = '22003', message = 'Initial buy-in must be positive';
  end if;
  if not exists (
    select 1 from public.memberships
    where id = target_member_id
      and club_id = target_game.club_id
      and status = 'active'
  ) then
    raise exception using errcode = '23514', message = 'Player must be an active club member';
  end if;

  insert into public.game_players (game_id, member_id, total_buy_in)
  values (target_game_id, target_member_id, initial_buy_in)
  returning * into created_player;

  insert into public.game_transactions (
    game_id, game_player_id, type, amount, request_id, created_by
  )
  values (
    target_game_id, created_player.id, 'initial_buy_in',
    initial_buy_in, target_request_id, actor
  );

  update public.games
  set version = version + 1
  where id = target_game_id
  returning * into target_game;

  previous_result := to_jsonb(created_player)
    || jsonb_build_object('game_version', target_game.version);
  perform public._write_audit(
    target_game.club_id, actor, 'game.player.add', 'game_player', created_player.id,
    target_request_id, null, previous_result
  );
  return previous_result;
end;
$$;

create or replace function public.add_game_player_add_on(
  target_game_player_id uuid,
  add_on_amount bigint,
  expected_version bigint,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  previous_result jsonb;
  target_game public.games%rowtype;
  before_player public.game_players%rowtype;
  changed_player public.game_players%rowtype;
begin
  select gp.* into before_player
  from public.game_players gp
  where gp.id = target_game_player_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Game player not found';
  end if;
  select * into target_game
  from public.games where id = before_player.game_id for update;
  select gp.* into before_player
  from public.game_players gp
  where gp.id = target_game_player_id
  for update;

  actor := public._require_club_admin(target_game.club_id);
  previous_result := public._request_result('game.player.add_on', target_request_id);
  if previous_result is not null then
    return previous_result;
  end if;
  if target_game.version <> expected_version then
    raise exception using errcode = '40001', message = 'Stale game version';
  end if;
  if target_game.status <> 'active' or before_player.status <> 'active' then
    raise exception using errcode = '55000', message = 'Add-ons require an active game player';
  end if;
  if add_on_amount <= 0 then
    raise exception using errcode = '22003', message = 'Add-on must be positive';
  end if;

  insert into public.game_transactions (
    game_id, game_player_id, type, amount, request_id, created_by
  )
  values (
    target_game.id, before_player.id, 'add_on', add_on_amount,
    target_request_id, actor
  );

  update public.game_players
  set total_buy_in = total_buy_in + add_on_amount
  where id = before_player.id
  returning * into changed_player;
  update public.games set version = version + 1 where id = target_game.id
  returning * into target_game;

  previous_result := to_jsonb(changed_player)
    || jsonb_build_object('game_version', target_game.version);
  perform public._write_audit(
    target_game.club_id, actor, 'game.player.add_on', 'game_player', changed_player.id,
    target_request_id, to_jsonb(before_player), previous_result
  );
  return previous_result;
end;
$$;

create or replace function public.exit_game_player(
  target_game_player_id uuid,
  cash_out_amount bigint,
  expected_version bigint,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  previous_result jsonb;
  target_game public.games%rowtype;
  before_player public.game_players%rowtype;
  changed_player public.game_players%rowtype;
begin
  select gp.* into before_player
  from public.game_players gp
  where gp.id = target_game_player_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Game player not found';
  end if;
  select * into target_game
  from public.games where id = before_player.game_id for update;
  select gp.* into before_player
  from public.game_players gp
  where gp.id = target_game_player_id
  for update;

  actor := public._require_club_admin(target_game.club_id);
  previous_result := public._request_result('game.player.exit', target_request_id);
  if previous_result is not null then
    return previous_result;
  end if;
  if target_game.version <> expected_version then
    raise exception using errcode = '40001', message = 'Stale game version';
  end if;
  if target_game.status <> 'active' or before_player.status <> 'active' then
    raise exception using errcode = '55000', message = 'Exit requires an active game player';
  end if;
  if cash_out_amount < 0 then
    raise exception using errcode = '22003', message = 'Cash-out cannot be negative';
  end if;

  insert into public.game_transactions (
    game_id, game_player_id, type, amount, request_id, created_by
  )
  values (
    target_game.id,
    before_player.id,
    case when cash_out_amount = 0 then 'exit'::public.game_transaction_type
      else 'cash_out'::public.game_transaction_type
    end,
    cash_out_amount,
    target_request_id, actor
  );

  update public.game_players
  set status = 'exited',
      total_cash_out = cash_out_amount,
      exited_at = timezone('utc', now())
  where id = before_player.id
  returning * into changed_player;
  update public.games set version = version + 1 where id = target_game.id
  returning * into target_game;

  previous_result := to_jsonb(changed_player)
    || jsonb_build_object('game_version', target_game.version);
  perform public._write_audit(
    target_game.club_id, actor, 'game.player.exit', 'game_player', changed_player.id,
    target_request_id, to_jsonb(before_player), previous_result
  );
  return previous_result;
end;
$$;

create or replace function public._recompute_game_players(target_game_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.game_players gp
  set total_buy_in = totals.total_buy_in,
      total_cash_out = totals.total_cash_out
  from (
    select
      player.id,
      coalesce(sum(
        case
          when tx.type in ('initial_buy_in', 'add_on') then tx.amount
          when tx.type = 'correction' then tx.correction_buy_in_delta
          else 0
        end
      ), 0)::bigint as total_buy_in,
      coalesce(sum(
        case
          when tx.type = 'cash_out' then tx.amount
          when tx.type = 'correction' then tx.correction_cash_out_delta
          else 0
        end
      ), 0)::bigint as total_cash_out
    from public.game_players player
    left join public.game_transactions tx on tx.game_player_id = player.id
    where player.game_id = target_game_id
    group by player.id
  ) totals
  where gp.id = totals.id
$$;

create or replace function public._validate_settlement_plan(
  target_game_id uuid,
  proposed_plan jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  invalid_count integer;
begin
  if proposed_plan is null or jsonb_typeof(proposed_plan) <> 'array' then
    raise exception using errcode = '22023', message = 'Settlement plan must be a JSON array';
  end if;

  with plan as (
    select *
    from jsonb_to_recordset(proposed_plan) as p(
      from_game_player_id uuid,
      to_game_player_id uuid,
      amount bigint,
      position smallint
    )
  )
  select count(*) into invalid_count
  from plan p
  left join public.game_players debtor
    on debtor.id = p.from_game_player_id and debtor.game_id = target_game_id
  left join public.game_players creditor
    on creditor.id = p.to_game_player_id and creditor.game_id = target_game_id
  where debtor.id is null
    or creditor.id is null
    or p.from_game_player_id = p.to_game_player_id
    or p.amount is null
    or p.amount <= 0
    or p.position is null
    or p.position <= 0
    or debtor.net_result >= 0
    or creditor.net_result <= 0;

  if invalid_count > 0 then
    raise exception using errcode = '23514', message = 'Settlement plan has an invalid transfer';
  end if;

  with plan as (
    select *
    from jsonb_to_recordset(proposed_plan) as p(
      from_game_player_id uuid,
      to_game_player_id uuid,
      amount bigint,
      position smallint
    )
  )
  select count(*) into invalid_count
  from (
    select position from plan group by position having count(*) > 1
  ) duplicates;
  if invalid_count > 0 then
    raise exception using errcode = '23514', message = 'Settlement positions must be unique';
  end if;

  with plan as (
    select *
    from jsonb_to_recordset(proposed_plan) as p(
      from_game_player_id uuid,
      to_game_player_id uuid,
      amount bigint,
      position smallint
    )
  ),
  flow as (
    select
      gp.id,
      gp.net_result,
      coalesce(sum(p.amount) filter (where p.to_game_player_id = gp.id), 0)::bigint
        - coalesce(sum(p.amount) filter (where p.from_game_player_id = gp.id), 0)::bigint
        as reconciled_result
    from public.game_players gp
    left join plan p
      on p.from_game_player_id = gp.id or p.to_game_player_id = gp.id
    where gp.game_id = target_game_id
    group by gp.id, gp.net_result
  )
  select count(*) into invalid_count
  from flow
  where net_result <> reconciled_result;

  if invalid_count > 0 then
    raise exception using errcode = '23514', message = 'Settlement plan does not reconcile every player';
  end if;
end;
$$;

create or replace function public.finalize_game(
  target_game_id uuid,
  expected_version bigint,
  target_request_id uuid,
  proposed_plan jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  previous_result jsonb;
  before_row public.games%rowtype;
  changed_row public.games%rowtype;
  balance bigint;
begin
  select * into before_row from public.games where id = target_game_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Game not found';
  end if;
  actor := public._require_club_admin(before_row.club_id);
  previous_result := public._request_result('game.finalize', target_request_id);
  if previous_result is not null then
    return previous_result;
  end if;
  if before_row.version <> expected_version then
    raise exception using errcode = '40001', message = 'Stale game version';
  end if;
  if before_row.status <> 'active' then
    raise exception using errcode = '55000', message = 'Only an active game can be finalized';
  end if;
  if exists (
    select 1 from public.game_players
    where game_id = target_game_id and status <> 'exited'
  ) then
    raise exception using errcode = '23514', message = 'All players must exit before finalization';
  end if;

  perform public._recompute_game_players(target_game_id);
  select coalesce(sum(net_result), 0)::bigint into balance
  from public.game_players where game_id = target_game_id;
  if balance <> 0 then
    raise exception using
      errcode = '23514',
      message = format('Game is not zero-sum (difference %s)', balance);
  end if;
  perform public._validate_settlement_plan(target_game_id, proposed_plan);

  insert into public.settlement_transfers (
    game_id, from_game_player_id, to_game_player_id, revision, amount, position
  )
  select
    target_game_id, p.from_game_player_id, p.to_game_player_id, 1, p.amount, p.position
  from jsonb_to_recordset(proposed_plan) as p(
    from_game_player_id uuid,
    to_game_player_id uuid,
    amount bigint,
    position smallint
  );

  update public.games
  set status = 'finalized',
      finalized_at = timezone('utc', now()),
      settlement_revision = 1,
      version = version + 1
  where id = target_game_id
  returning * into changed_row;

  previous_result := to_jsonb(changed_row)
    || jsonb_build_object('settlement_plan', proposed_plan);
  perform public._write_audit(
    changed_row.club_id, actor, 'game.finalize', 'game', changed_row.id,
    target_request_id, to_jsonb(before_row), previous_result
  );
  return previous_result;
end;
$$;

create or replace function public.correct_finalized_game(
  target_game_id uuid,
  expected_version bigint,
  target_request_id uuid,
  corrections jsonb,
  proposed_plan jsonb,
  correction_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  previous_result jsonb;
  before_row public.games%rowtype;
  changed_row public.games%rowtype;
  correction record;
  invalid_count integer;
  balance bigint;
  next_revision integer;
begin
  select * into before_row from public.games where id = target_game_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Game not found';
  end if;
  actor := public._require_club_admin(before_row.club_id);
  previous_result := public._request_result('game.correct', target_request_id);
  if previous_result is not null then
    return previous_result;
  end if;
  if before_row.version <> expected_version then
    raise exception using errcode = '40001', message = 'Stale game version';
  end if;
  if before_row.status <> 'finalized' then
    raise exception using errcode = '55000', message = 'Only a finalized game can be corrected';
  end if;
  if corrections is null
    or jsonb_typeof(corrections) <> 'array'
    or jsonb_array_length(corrections) = 0 then
    raise exception using errcode = '22023', message = 'Corrections must be a non-empty JSON array';
  end if;
  if correction_note is null or length(trim(correction_note)) = 0 or length(correction_note) > 500 then
    raise exception using errcode = '22023', message = 'A correction note is required';
  end if;

  with correction_rows as (
    select *
    from jsonb_to_recordset(corrections) as c(
      game_player_id uuid,
      correction_of uuid,
      buy_in_delta bigint,
      cash_out_delta bigint
    )
  )
  select count(*) into invalid_count
  from correction_rows c
  left join public.game_players gp
    on gp.id = c.game_player_id and gp.game_id = target_game_id
  left join public.game_transactions tx
    on tx.id = c.correction_of
    and tx.game_id = target_game_id
    and tx.game_player_id = c.game_player_id
  where gp.id is null
    or tx.id is null
    or c.buy_in_delta is null
    or c.cash_out_delta is null
    or (c.buy_in_delta = 0 and c.cash_out_delta = 0);
  if invalid_count > 0 then
    raise exception using errcode = '23514', message = 'Invalid correction entry';
  end if;

  with correction_rows as (
    select *
    from jsonb_to_recordset(corrections) as c(
      game_player_id uuid,
      correction_of uuid,
      buy_in_delta bigint,
      cash_out_delta bigint
    )
  )
  select count(*) into invalid_count
  from (
    select game_player_id from correction_rows
    group by game_player_id having count(*) > 1
  ) duplicate_players;
  if invalid_count > 0 then
    raise exception using errcode = '23514', message = 'Only one correction entry per player is allowed';
  end if;

  for correction in
    select *
    from jsonb_to_recordset(corrections) as c(
      game_player_id uuid,
      correction_of uuid,
      buy_in_delta bigint,
      cash_out_delta bigint
    )
  loop
    insert into public.game_transactions (
      game_id,
      game_player_id,
      type,
      amount,
      request_id,
      correction_of,
      correction_buy_in_delta,
      correction_cash_out_delta,
      note,
      created_by
    )
    values (
      target_game_id,
      correction.game_player_id,
      'correction',
      0,
      extensions.gen_random_uuid(),
      correction.correction_of,
      correction.buy_in_delta,
      correction.cash_out_delta,
      correction_note,
      actor
    );
  end loop;

  perform set_config('poker_club.allow_finalized_player_recompute', 'on', true);
  perform public._recompute_game_players(target_game_id);
  if exists (
    select 1 from public.game_players
    where game_id = target_game_id
      and (total_buy_in < 0 or total_cash_out < 0)
  ) then
    raise exception using errcode = '23514', message = 'Correction produces a negative player total';
  end if;

  select coalesce(sum(net_result), 0)::bigint into balance
  from public.game_players where game_id = target_game_id;
  if balance <> 0 then
    raise exception using
      errcode = '23514',
      message = format('Corrected game is not zero-sum (difference %s)', balance);
  end if;
  perform public._validate_settlement_plan(target_game_id, proposed_plan);

  next_revision := before_row.settlement_revision + 1;
  insert into public.settlement_transfers (
    game_id, from_game_player_id, to_game_player_id, revision, amount, position
  )
  select
    target_game_id, p.from_game_player_id, p.to_game_player_id,
    next_revision, p.amount, p.position
  from jsonb_to_recordset(proposed_plan) as p(
    from_game_player_id uuid,
    to_game_player_id uuid,
    amount bigint,
    position smallint
  );

  update public.games
  set settlement_revision = next_revision,
      version = version + 1
  where id = target_game_id
  returning * into changed_row;

  previous_result := to_jsonb(changed_row)
    || jsonb_build_object(
      'corrections', corrections,
      'settlement_plan', proposed_plan,
      'note', correction_note
    );
  perform public._write_audit(
    changed_row.club_id, actor, 'game.correct', 'game', changed_row.id,
    target_request_id,
    to_jsonb(before_row),
    previous_result
  );
  return previous_result;
end;
$$;

create or replace function public.reject_finalized_player_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.games
    where id = old.game_id and status = 'finalized'
  ) and coalesce(
    current_setting('poker_club.allow_finalized_player_recompute', true),
    'off'
  ) <> 'on' then
    raise exception using errcode = '55000', message = 'Finalized player totals require an audited correction';
  end if;
  return new;
end;
$$;

create trigger game_players_reject_finalized_mutation
before update on public.game_players
for each row execute function public.reject_finalized_player_mutation();

revoke all on function public._require_club_admin(uuid) from public;
revoke all on function public._request_result(text, uuid) from public;
revoke all on function public._write_audit(uuid, uuid, text, text, uuid, uuid, jsonb, jsonb) from public;
revoke all on function public._recompute_game_players(uuid) from public;
revoke all on function public._validate_settlement_plan(uuid, jsonb) from public;

revoke all on function public.create_season(uuid, text, uuid) from public;
revoke all on function public.open_season(uuid, uuid) from public;
revoke all on function public.close_season(uuid, uuid) from public;
revoke all on function public.create_game(uuid, text, uuid) from public;
revoke all on function public.start_game(uuid, bigint, uuid) from public;
revoke all on function public.add_game_player(uuid, uuid, bigint, bigint, uuid) from public;
revoke all on function public.add_game_player_add_on(uuid, bigint, bigint, uuid) from public;
revoke all on function public.exit_game_player(uuid, bigint, bigint, uuid) from public;
revoke all on function public.finalize_game(uuid, bigint, uuid, jsonb) from public;
revoke all on function public.correct_finalized_game(uuid, bigint, uuid, jsonb, jsonb, text) from public;

grant execute on function public.create_season(uuid, text, uuid) to authenticated;
grant execute on function public.open_season(uuid, uuid) to authenticated;
grant execute on function public.close_season(uuid, uuid) to authenticated;
grant execute on function public.create_game(uuid, text, uuid) to authenticated;
grant execute on function public.start_game(uuid, bigint, uuid) to authenticated;
grant execute on function public.add_game_player(uuid, uuid, bigint, bigint, uuid) to authenticated;
grant execute on function public.add_game_player_add_on(uuid, bigint, bigint, uuid) to authenticated;
grant execute on function public.exit_game_player(uuid, bigint, bigint, uuid) to authenticated;
grant execute on function public.finalize_game(uuid, bigint, uuid, jsonb) to authenticated;
grant execute on function public.correct_finalized_game(uuid, bigint, uuid, jsonb, jsonb, text) to authenticated;

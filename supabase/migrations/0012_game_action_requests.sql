create type public.game_request_action as enum ('join', 'add_on', 'exit');
create type public.game_request_status as enum (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);
create type public.game_request_decision as enum ('approve', 'reject');

alter table public.games
add column registration_open boolean not null default true;

create table public.game_action_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  game_id uuid not null references public.games (id) on delete restrict,
  membership_id uuid not null references public.memberships (id) on delete restrict,
  game_player_id uuid references public.game_players (id) on delete restrict,
  action public.game_request_action not null,
  amount bigint not null,
  status public.game_request_status not null default 'pending',
  request_id uuid not null,
  reviewed_by uuid references public.profiles (id) on delete restrict,
  review_note text check (review_note is null or length(review_note) <= 500),
  reviewed_at timestamptz,
  approved_transaction_id uuid references public.game_transactions (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (membership_id, request_id),
  check (
    (action in ('join', 'add_on') and amount > 0)
    or (action = 'exit' and amount >= 0)
  ),
  check (amount <= 9007199254740991),
  check (
    (action = 'join' and game_player_id is null)
    or (action in ('add_on', 'exit') and game_player_id is not null)
  ),
  check (
    (status in ('pending', 'cancelled')
      and reviewed_by is null
      and reviewed_at is null
      and approved_transaction_id is null)
    or (status = 'rejected'
      and reviewed_by is not null
      and reviewed_at is not null
      and approved_transaction_id is null)
    or (status = 'approved'
      and reviewed_by is not null
      and reviewed_at is not null
      and approved_transaction_id is not null)
  )
);

create unique index game_action_requests_one_pending_member_idx
on public.game_action_requests (game_id, membership_id)
where status = 'pending';

create index game_action_requests_admin_queue_idx
on public.game_action_requests (club_id, status, created_at);

alter table public.game_action_requests enable row level security;

create policy game_action_requests_read_own_or_admin
on public.game_action_requests
for select
to authenticated
using (
  membership_id in (
    select membership.id
    from public.memberships membership
    where membership.user_id = auth.uid()
      and membership.status = 'active'
  )
  or public.is_club_admin(club_id)
);

create or replace function public.submit_game_action_request(
  target_game_id uuid,
  target_action public.game_request_action,
  target_amount bigint,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_game public.games%rowtype;
  actor_membership public.memberships%rowtype;
  target_player public.game_players%rowtype;
  existing_request public.game_action_requests%rowtype;
  created_request public.game_action_requests%rowtype;
  result jsonb;
begin
  if actor is null or target_request_id is null or target_action is null then
    raise exception using errcode = '42501', message = 'Active membership required';
  end if;

  select *
  into target_game
  from public.games
  where id = target_game_id
  for update;
  if target_game.id is null then
    raise exception using errcode = 'P0002', message = 'Game not found';
  end if;

  select *
  into actor_membership
  from public.memberships
  where club_id = target_game.club_id
    and user_id = actor
    and status = 'active'
  limit 1
  for update;
  if actor_membership.id is null then
    raise exception using errcode = '42501', message = 'Active membership required';
  end if;

  select *
  into existing_request
  from public.game_action_requests
  where membership_id = actor_membership.id
    and request_id = target_request_id;
  if existing_request.id is not null then
    return to_jsonb(existing_request);
  end if;

  if target_game.status = 'finalized'
    or (target_action in ('add_on', 'exit') and target_game.status <> 'active')
    or (target_action = 'join' and not target_game.registration_open)
  then
    raise exception using errcode = '55000', message = 'Requests require an open game';
  end if;

  if target_amount > 9007199254740991
    or (target_action in ('join', 'add_on') and target_amount <= 0)
    or (target_action = 'exit' and target_amount < 0)
  then
    raise exception using errcode = '22003', message = 'Invalid request amount';
  end if;

  select *
  into target_player
  from public.game_players
  where game_id = target_game.id
    and member_id = actor_membership.id
  for update;

  if target_action = 'join' and target_player.id is not null then
    raise exception using errcode = '55000', message = 'Member already joined this game';
  end if;
  if target_action in ('add_on', 'exit')
    and (target_player.id is null or target_player.status <> 'active')
  then
    raise exception using errcode = '55000', message = 'Request requires an active game player';
  end if;

  insert into public.game_action_requests (
    club_id,
    game_id,
    membership_id,
    game_player_id,
    action,
    amount,
    request_id
  )
  values (
    target_game.club_id,
    target_game.id,
    actor_membership.id,
    case when target_action = 'join' then null else target_player.id end,
    target_action,
    target_amount,
    target_request_id
  )
  returning * into created_request;

  result := to_jsonb(created_request);
  perform public._write_audit(
    target_game.club_id,
    actor,
    'game.request.submitted',
    'game_action_request',
    created_request.id,
    target_request_id,
    null,
    result
  );
  return result;
end;
$$;

create or replace function public.cancel_game_action_request(
  target_game_request_id uuid,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  before_request public.game_action_requests%rowtype;
  changed_request public.game_action_requests%rowtype;
  previous_result jsonb;
begin
  previous_result := public._request_result(
    'game.request.cancelled',
    target_request_id
  );
  if previous_result is not null then
    return previous_result;
  end if;

  select request.*
  into before_request
  from public.game_action_requests request
  join public.memberships membership on membership.id = request.membership_id
  where request.id = target_game_request_id
    and membership.user_id = actor
    and membership.status = 'active'
  for update of request;

  if before_request.id is null then
    raise exception using errcode = 'P0002', message = 'Request not found';
  end if;
  if before_request.status <> 'pending' then
    raise exception using errcode = '55000', message = 'Only pending requests can be cancelled';
  end if;

  update public.game_action_requests
  set status = 'cancelled', updated_at = timezone('utc', now())
  where id = before_request.id
  returning * into changed_request;

  previous_result := to_jsonb(changed_request);
  perform public._write_audit(
    changed_request.club_id,
    actor,
    'game.request.cancelled',
    'game_action_request',
    changed_request.id,
    target_request_id,
    to_jsonb(before_request),
    previous_result
  );
  return previous_result;
end;
$$;

create or replace function public.review_game_action_request(
  target_game_request_id uuid,
  target_decision public.game_request_decision,
  target_note text,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  before_request public.game_action_requests%rowtype;
  changed_request public.game_action_requests%rowtype;
  target_game public.games%rowtype;
  ledger_result jsonb;
  transaction_id uuid;
  previous_result jsonb;
begin
  if target_request_id is null
    or target_decision is null
    or length(coalesce(target_note, '')) > 500
  then
    raise exception using errcode = '22023', message = 'Invalid review';
  end if;

  select *
  into before_request
  from public.game_action_requests
  where id = target_game_request_id;
  if before_request.id is null then
    raise exception using errcode = 'P0002', message = 'Request not found';
  end if;

  select *
  into target_game
  from public.games
  where id = before_request.game_id
  for update;
  select *
  into before_request
  from public.game_action_requests
  where id = target_game_request_id
  for update;
  actor := public._require_club_admin(before_request.club_id);

  previous_result := public._request_result(
    'game.request.reviewed',
    target_request_id
  );
  if previous_result is not null then
    return previous_result;
  end if;
  if before_request.status <> 'pending' then
    raise exception using errcode = '55000', message = 'Request is no longer pending';
  end if;

  if target_decision = 'approve' then
    if before_request.action = 'join' then
      ledger_result := public.add_game_player(
        before_request.game_id,
        before_request.membership_id,
        before_request.amount,
        target_game.version,
        target_request_id
      );
    elsif before_request.action = 'add_on' then
      ledger_result := public.add_game_player_add_on(
        before_request.game_player_id,
        before_request.amount,
        target_game.version,
        target_request_id
      );
    else
      ledger_result := public.exit_game_player(
        before_request.game_player_id,
        before_request.amount,
        target_game.version,
        target_request_id
      );
    end if;

    select id
    into transaction_id
    from public.game_transactions
    where game_id = before_request.game_id
      and request_id = target_request_id;
  end if;

  update public.game_action_requests
  set
    status = case
      when target_decision = 'approve'
        then 'approved'::public.game_request_status
      else 'rejected'::public.game_request_status
    end,
    reviewed_by = actor,
    review_note = nullif(trim(target_note), ''),
    reviewed_at = timezone('utc', now()),
    approved_transaction_id = transaction_id,
    updated_at = timezone('utc', now())
  where id = before_request.id
  returning * into changed_request;

  previous_result := to_jsonb(changed_request)
    || jsonb_build_object('ledger_result', ledger_result);
  perform public._write_audit(
    changed_request.club_id,
    actor,
    'game.request.reviewed',
    'game_action_request',
    changed_request.id,
    target_request_id,
    to_jsonb(before_request),
    previous_result
  );
  return previous_result;
end;
$$;

create or replace function public.set_game_registration(
  target_game_id uuid,
  target_open boolean,
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
  before_game public.games%rowtype;
  changed_game public.games%rowtype;
  previous_result jsonb;
begin
  if target_open is null or target_request_id is null then
    raise exception using errcode = '22023', message = 'Invalid registration state';
  end if;
  select *
  into before_game
  from public.games
  where id = target_game_id
  for update;
  if before_game.id is null then
    raise exception using errcode = 'P0002', message = 'Game not found';
  end if;
  actor := public._require_club_admin(before_game.club_id);
  previous_result := public._request_result(
    'game.registration.toggle',
    target_request_id
  );
  if previous_result is not null then
    return previous_result;
  end if;
  if before_game.status = 'finalized' then
    raise exception using errcode = '55000', message = 'Finalized registration cannot change';
  end if;
  if before_game.version <> expected_version then
    raise exception using errcode = '40001', message = 'Stale game version';
  end if;

  update public.games
  set
    registration_open = target_open,
    version = version + 1,
    updated_at = timezone('utc', now())
  where id = before_game.id
  returning * into changed_game;

  previous_result := to_jsonb(changed_game);
  perform public._write_audit(
    changed_game.club_id,
    actor,
    'game.registration.toggle',
    'game',
    changed_game.id,
    target_request_id,
    to_jsonb(before_game),
    previous_result
  );
  return previous_result;
end;
$$;

create or replace function public.block_finalize_with_pending_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'finalized'
    and old.status <> 'finalized'
    and exists (
      select 1
      from public.game_action_requests request
      where request.game_id = new.id
        and request.status = 'pending'
    )
  then
    raise exception using errcode = '55000', message = 'Pending requests must be reviewed before finalization';
  end if;
  return new;
end;
$$;

create trigger games_block_pending_request_finalization
before update of status on public.games
for each row execute function public.block_finalize_with_pending_requests();

revoke all on table public.game_action_requests from public;
grant select on table public.game_action_requests to authenticated;

revoke all on function public.submit_game_action_request(uuid, public.game_request_action, bigint, uuid) from public;
grant execute on function public.submit_game_action_request(uuid, public.game_request_action, bigint, uuid) to authenticated;

revoke all on function public.cancel_game_action_request(uuid, uuid) from public;
grant execute on function public.cancel_game_action_request(uuid, uuid) to authenticated;

revoke all on function public.review_game_action_request(uuid, public.game_request_decision, text, uuid) from public;
grant execute on function public.review_game_action_request(uuid, public.game_request_decision, text, uuid) to authenticated;

revoke all on function public.set_game_registration(uuid, boolean, bigint, uuid) from public;
grant execute on function public.set_game_registration(uuid, boolean, bigint, uuid) to authenticated;

alter publication supabase_realtime add table public.game_action_requests;

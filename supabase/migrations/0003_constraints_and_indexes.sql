alter table public.seasons
add constraint seasons_id_club_unique unique (id, club_id);

alter table public.memberships
add constraint memberships_id_club_unique unique (id, club_id);

alter table public.games
add constraint games_id_club_unique unique (id, club_id);

alter table public.games
add constraint games_season_club_fk
foreign key (season_id, club_id)
references public.seasons (id, club_id)
on delete restrict;

alter table public.game_players
add constraint game_players_id_game_unique unique (id, game_id);

alter table public.game_transactions
add constraint game_transactions_player_game_fk
foreign key (game_player_id, game_id)
references public.game_players (id, game_id)
on delete restrict;

alter table public.settlement_transfers
add constraint settlement_from_player_game_fk
foreign key (from_game_player_id, game_id)
references public.game_players (id, game_id)
on delete restrict;

alter table public.settlement_transfers
add constraint settlement_to_player_game_fk
foreign key (to_game_player_id, game_id)
references public.game_players (id, game_id)
on delete restrict;

create unique index seasons_one_open_per_club
on public.seasons (club_id)
where status = 'open';

create unique index games_one_active_per_club
on public.games (club_id)
where status = 'active';

create index memberships_user_status_idx
on public.memberships (user_id, status);

create index games_club_created_idx
on public.games (club_id, created_at desc);

create index games_season_status_idx
on public.games (season_id, status);

create index game_players_game_status_idx
on public.game_players (game_id, status);

create index game_transactions_game_created_idx
on public.game_transactions (game_id, created_at, id);

create index settlement_transfers_game_revision_idx
on public.settlement_transfers (game_id, revision, position);

create index audit_logs_club_created_idx
on public.audit_logs (club_id, created_at desc);

create or replace function public.assert_game_player_membership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  game_club_id uuid;
  membership_club_id uuid;
  participant_count integer;
begin
  select club_id
  into game_club_id
  from public.games
  where id = new.game_id
  for update;

  select club_id
  into membership_club_id
  from public.memberships
  where id = new.member_id
    and status = 'active';

  if game_club_id is null or membership_club_id is null or game_club_id <> membership_club_id then
    raise exception 'Player must have an active membership in the game club'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    select count(*)
    into participant_count
    from public.game_players
    where game_id = new.game_id;

    if participant_count >= 16 then
      raise exception 'A game supports at most 16 participants'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger game_players_validate_membership
before insert or update of game_id, member_id on public.game_players
for each row execute function public.assert_game_player_membership();

create or replace function public.reject_immutable_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name
    using errcode = '55000';
end;
$$;

create trigger game_transactions_are_append_only
before update or delete on public.game_transactions
for each row execute function public.reject_immutable_mutation();

create trigger settlement_transfers_are_append_only
before update or delete on public.settlement_transfers
for each row execute function public.reject_immutable_mutation();

create trigger audit_logs_are_append_only
before update or delete on public.audit_logs
for each row execute function public.reject_immutable_mutation();

create view public.season_rankings
with (security_invoker = true)
as
select
  s.id as season_id,
  m.id as membership_id,
  p.display_name,
  coalesce(sum(gp.net_result) filter (where g.status = 'finalized'), 0)::bigint as profit,
  rank() over (
    partition by s.id
    order by coalesce(sum(gp.net_result) filter (where g.status = 'finalized'), 0) desc
  )::bigint as rank
from public.seasons s
join public.memberships m
  on m.club_id = s.club_id
  and m.status = 'active'
join public.profiles p on p.id = m.user_id
left join public.games g
  on g.season_id = s.id
  and g.status = 'finalized'
left join public.game_players gp
  on gp.game_id = g.id
  and gp.member_id = m.id
group by s.id, m.id, p.display_name;

alter publication supabase_realtime
add table public.games, public.game_players, public.game_transactions;

alter table public.clubs enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.seasons enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_transactions enable row level security;
alter table public.settlement_transfers enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.clubs from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.memberships from anon, authenticated;
revoke all on table public.seasons from anon, authenticated;
revoke all on table public.games from anon, authenticated;
revoke all on table public.game_players from anon, authenticated;
revoke all on table public.game_transactions from anon, authenticated;
revoke all on table public.settlement_transfers from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;
revoke all on table public.season_rankings from anon, authenticated;

grant select on table public.clubs to authenticated;
grant select, update (display_name) on table public.profiles to authenticated;
grant select on table public.memberships to authenticated;
grant select on table public.seasons to authenticated;
grant select on table public.games to authenticated;
grant select on table public.game_players to authenticated;
grant select on table public.game_transactions to authenticated;
grant select on table public.settlement_transfers to authenticated;
grant select on table public.audit_logs to authenticated;
grant select on table public.season_rankings to authenticated;

create policy clubs_read_active_members
on public.clubs
for select
to authenticated
using (public.is_active_club_member(id));

create policy profiles_read_shared_club
on public.profiles
for select
to authenticated
using (public.shares_active_club(id));

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy memberships_read_self_or_club
on public.memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_active_club_member(club_id)
);

create policy seasons_read_active_members
on public.seasons
for select
to authenticated
using (public.is_active_club_member(club_id));

create policy games_read_active_members
on public.games
for select
to authenticated
using (public.is_active_club_member(club_id));

create policy game_players_read_active_members
on public.game_players
for select
to authenticated
using (
  exists (
    select 1
    from public.games
    where games.id = game_players.game_id
      and public.is_active_club_member(games.club_id)
  )
);

create policy game_transactions_read_active_members
on public.game_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.games
    where games.id = game_transactions.game_id
      and public.is_active_club_member(games.club_id)
  )
);

create policy settlement_transfers_read_active_members
on public.settlement_transfers
for select
to authenticated
using (
  exists (
    select 1
    from public.games
    where games.id = settlement_transfers.game_id
      and public.is_active_club_member(games.club_id)
  )
);

create policy audit_logs_read_admins
on public.audit_logs
for select
to authenticated
using (public.is_club_admin(club_id));

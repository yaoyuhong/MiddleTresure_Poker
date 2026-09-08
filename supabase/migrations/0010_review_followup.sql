create or replace function public.shares_active_club(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.club_id = mine.club_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and theirs.user_id = target_user_id
      and theirs.status in ('active', 'inactive')
  );
$$;

create or replace function public.assert_safe_season_profits()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  total_buy_in numeric;
  total_cash_out numeric;
begin
  select
    coalesce(sum(game_player.total_buy_in::numeric), 0),
    coalesce(sum(game_player.total_cash_out::numeric), 0)
  into total_buy_in, total_cash_out
  from public.game_players game_player
  where game_player.game_id = new.id;

  if total_buy_in > 9007199254740991
    or total_cash_out > 9007199254740991
  then
    raise exception using
      errcode = '22003',
      message = 'Game totals exceed the safe integer range';
  end if;

  if new.status = 'finalized' and exists (
    select 1
    from public.game_players current_player
    where current_player.game_id = new.id
      and abs(
        current_player.net_result::numeric
        + coalesce((
          select sum(previous_player.net_result::numeric)
          from public.games previous_game
          join public.game_players previous_player
            on previous_player.game_id = previous_game.id
          where previous_game.season_id = new.season_id
            and previous_game.status = 'finalized'
            and previous_game.id <> new.id
            and previous_player.member_id = current_player.member_id
        ), 0)
      ) > 9007199254740991
  ) then
    raise exception using
      errcode = '22003',
      message = 'Season profit exceeds the safe integer range';
  end if;

  return new;
end;
$$;

alter table public.game_players
add constraint game_players_safe_integer_totals
check (
  total_buy_in between 0 and 9007199254740991
  and total_cash_out between 0 and 9007199254740991
);

create or replace view public.season_rankings
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
  and m.status in ('active', 'inactive')
join public.profiles p on p.id = m.user_id
left join public.games g
  on g.season_id = s.id
  and g.status = 'finalized'
left join public.game_players gp
  on gp.game_id = g.id
  and gp.member_id = m.id
group by s.id, m.id, p.display_name;

create or replace function public.assert_safe_season_profits()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
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

create trigger games_assert_safe_season_profits
before update of status, version on public.games
for each row execute function public.assert_safe_season_profits();

create or replace function public.ensure_invited_membership(
  target_club_id uuid,
  target_user_id uuid,
  target_invited_by uuid,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_membership public.memberships%rowtype;
  result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if not exists (
    select 1
    from public.memberships
    where club_id = target_club_id
      and user_id = target_invited_by
      and role = 'admin'
      and status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Active administrator required';
  end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception using errcode = 'P0002', message = 'Invited profile not found';
  end if;

  insert into public.memberships (
    club_id,
    user_id,
    role,
    status,
    invited_by
  )
  values (
    target_club_id,
    target_user_id,
    'member',
    'invited',
    target_invited_by
  )
  on conflict (club_id, user_id)
  do update set invited_by = excluded.invited_by
  returning * into target_membership;

  result := to_jsonb(target_membership);

  insert into public.audit_logs (
    club_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    request_id,
    after_data
  )
  values (
    target_club_id,
    target_invited_by,
    'membership.invited',
    'membership',
    target_membership.id,
    target_request_id,
    result
  )
  on conflict (actor_id, request_id, action) do nothing;

  return result;
end;
$$;

create or replace function public.activate_own_membership(
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row public.memberships%rowtype;
  changed_row public.memberships%rowtype;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select *
  into before_row
  from public.memberships
  where user_id = auth.uid()
    and status = 'invited'
  order by invited_at
  limit 1
  for update;

  if not found then
    select *
    into changed_row
    from public.memberships
    where user_id = auth.uid()
    order by created_at
    limit 1;

    return case
      when changed_row.id is null then null
      else to_jsonb(changed_row)
    end;
  end if;

  update public.memberships
  set
    status = 'active',
    activated_at = timezone('utc', now()),
    deactivated_at = null
  where id = before_row.id
  returning * into changed_row;

  result := to_jsonb(changed_row);
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
    changed_row.club_id,
    auth.uid(),
    'membership.activated',
    'membership',
    changed_row.id,
    target_request_id,
    to_jsonb(before_row),
    result
  );

  return result;
end;
$$;

revoke all on function public.ensure_invited_membership(uuid, uuid, uuid, uuid) from public;
grant execute on function public.ensure_invited_membership(uuid, uuid, uuid, uuid) to service_role;

revoke all on function public.activate_own_membership(uuid) from public;
grant execute on function public.activate_own_membership(uuid) to authenticated;

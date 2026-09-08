create or replace function public.is_active_club_member(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships
    where club_id = target_club_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_club_admin(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships
    where club_id = target_club_id
      and user_id = auth.uid()
      and status = 'active'
      and role = 'admin'
  );
$$;

create or replace function public.shares_active_club(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id = auth.uid()
    or exists (
      select 1
      from public.memberships mine
      join public.memberships theirs on theirs.club_id = mine.club_id
      where mine.user_id = auth.uid()
        and mine.status = 'active'
        and theirs.user_id = target_user_id
        and theirs.status = 'active'
    );
$$;

revoke all on function public.is_active_club_member(uuid) from public;
revoke all on function public.is_club_admin(uuid) from public;
revoke all on function public.shares_active_club(uuid) from public;

grant execute on function public.is_active_club_member(uuid) to authenticated;
grant execute on function public.is_club_admin(uuid) to authenticated;
grant execute on function public.shares_active_club(uuid) to authenticated;

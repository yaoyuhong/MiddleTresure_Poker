create or replace function public.reset_debug_club(
  retained_admin_email text,
  destructive_confirmation text,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  retained_user_id uuid;
  retained_membership public.memberships%rowtype;
  retained_club_id uuid;
  removed_users integer := 0;
  removed_memberships integer := 0;
  removed_games integer := 0;
  removed_seasons integer := 0;
  previous_result jsonb;
  result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if destructive_confirmation <> 'DELETE_ALL_DEBUG_DATA'
    or target_request_id is null
  then
    raise exception using
      errcode = '22023',
      message = 'Exact destructive confirmation required';
  end if;

  select id
  into retained_user_id
  from auth.users
  where lower(email) = lower(trim(retained_admin_email));

  if retained_user_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Retained active administrator not found';
  end if;

  select *
  into retained_membership
  from public.memberships
  where user_id = retained_user_id
    and role = 'admin'
    and status = 'active'
  limit 1
  for update;

  if retained_membership.id is null then
    raise exception using
      errcode = '42501',
      message = 'Retained active administrator not found';
  end if;
  retained_club_id := retained_membership.club_id;

  select after_data
  into previous_result
  from public.audit_logs
  where actor_id = retained_user_id
    and action = 'debug.reset'
    and request_id = target_request_id;
  if previous_result is not null then
    return previous_result;
  end if;

  perform set_config('app.debug_reset', 'enabled', true);

  update public.club_access_codes
  set rotated_by = retained_user_id
  where rotated_by <> retained_user_id;

  update public.memberships
  set invited_by = retained_user_id
  where invited_by is not null
    and invited_by <> retained_user_id;

  delete from public.game_action_requests where id is not null;
  delete from public.settlement_transfers where id is not null;
  delete from public.game_transactions where correction_of is not null;
  delete from public.game_transactions where id is not null;
  delete from public.game_players where id is not null;

  delete from public.games where id is not null;
  get diagnostics removed_games = row_count;

  delete from public.seasons where id is not null;
  get diagnostics removed_seasons = row_count;

  delete from public.audit_logs where id is not null;
  delete from public.registration_attempts where fingerprint is not null;

  delete from public.memberships
  where user_id <> retained_user_id;
  get diagnostics removed_memberships = row_count;

  delete from auth.users
  where id <> retained_user_id;
  get diagnostics removed_users = row_count;

  delete from public.profiles
  where id <> retained_user_id;

  result := jsonb_build_object(
    'ok', true,
    'retained_user_id', retained_user_id,
    'retained_membership_id', retained_membership.id,
    'removed_users', removed_users,
    'removed_memberships', removed_memberships,
    'removed_games', removed_games,
    'removed_seasons', removed_seasons
  );

  perform public._write_audit(
    retained_club_id,
    retained_user_id,
    'debug.reset',
    'club',
    retained_club_id,
    target_request_id,
    null,
    result
  );

  return result;
end;
$$;

revoke all on function public.reset_debug_club(text, text, uuid) from public;
grant execute on function public.reset_debug_club(text, text, uuid) to service_role;

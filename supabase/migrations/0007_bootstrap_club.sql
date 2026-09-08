alter table public.clubs
add column singleton boolean not null default true
check (singleton);

create unique index clubs_singleton_idx on public.clubs (singleton);

create or replace function public.bootstrap_club(
  target_user_id uuid,
  club_name text,
  unit_name text,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_result jsonb;
  target_club public.clubs%rowtype;
  target_membership public.memberships%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Service role required';
  end if;
  if target_request_id is null then
    raise exception using errcode = '22004', message = 'Request ID is required';
  end if;
  if club_name is null or length(trim(club_name)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Invalid club name';
  end if;
  if unit_name is null or length(trim(unit_name)) not between 1 and 24 then
    raise exception using errcode = '22023', message = 'Invalid unit name';
  end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception using errcode = 'P0002', message = 'Administrator profile not found';
  end if;

  select after_data
  into existing_result
  from public.audit_logs
  where actor_id = target_user_id
    and request_id = target_request_id
    and action = 'club.bootstrap';

  if existing_result is not null then
    return existing_result;
  end if;

  select *
  into target_club
  from public.clubs
  order by created_at
  limit 1
  for update;

  if target_club.id is null then
    insert into public.clubs (name, unit_name)
    values (trim(club_name), trim(unit_name))
    returning * into target_club;
  elsif target_club.name <> trim(club_name) then
    raise exception using
      errcode = '23514',
      message = 'A different club is already configured';
  end if;

  insert into public.memberships (
    club_id,
    user_id,
    role,
    status,
    invited_by,
    activated_at
  )
  values (
    target_club.id,
    target_user_id,
    'admin',
    'invited',
    target_user_id,
    null
  )
  on conflict (club_id, user_id)
  do update set
    role = 'admin',
    status = case
      when memberships.status = 'active' then 'active'::public.membership_status
      else 'invited'::public.membership_status
    end,
    deactivated_at = null
  returning * into target_membership;

  existing_result := jsonb_build_object(
    'club_id', target_club.id,
    'membership_id', target_membership.id,
    'user_id', target_user_id,
    'status', target_membership.status
  );

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
    target_club.id,
    target_user_id,
    'club.bootstrap',
    'club',
    target_club.id,
    target_request_id,
    existing_result
  );

  return existing_result;
end;
$$;

revoke all on function public.bootstrap_club(uuid, text, text, uuid) from public;
grant execute on function public.bootstrap_club(uuid, text, text, uuid) to service_role;

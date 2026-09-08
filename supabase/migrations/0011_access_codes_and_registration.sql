create type public.access_code_kind as enum ('member', 'admin');

create table public.club_access_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  kind public.access_code_kind not null,
  code_hash text not null,
  rotated_by uuid not null references public.profiles (id) on delete restrict,
  rotated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (club_id, kind)
);

create table public.registration_attempts (
  fingerprint text primary key,
  attempt_count integer not null check (attempt_count between 1 and 5),
  window_started_at timestamptz not null,
  blocked_until timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.club_access_codes enable row level security;
alter table public.registration_attempts enable row level security;

create or replace function public.check_registration_code(
  raw_code text,
  normalized_email text,
  network_key text,
  target_request_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fingerprint_value text;
  matched_kind public.access_code_kind;
  current_attempt public.registration_attempts%rowtype;
  now_at timestamptz := timezone('utc', now());
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if target_request_id is null
    or normalized_email is null
    or network_key is null
  then
    return null;
  end if;

  fingerprint_value := encode(
    extensions.digest(
      lower(trim(normalized_email)) || ':' || network_key,
      'sha256'
    ),
    'hex'
  );

  select *
  into current_attempt
  from public.registration_attempts
  where fingerprint = fingerprint_value
  for update;

  if found
    and current_attempt.blocked_until is not null
    and current_attempt.blocked_until > now_at
  then
    return null;
  end if;

  select access_code.kind
  into matched_kind
  from public.club_access_codes access_code
  where extensions.crypt(upper(trim(raw_code)), access_code.code_hash)
    = access_code.code_hash
  order by access_code.kind
  limit 1;

  if matched_kind is not null then
    delete from public.registration_attempts
    where fingerprint = fingerprint_value;
    return matched_kind::text;
  end if;

  insert into public.registration_attempts (
    fingerprint,
    attempt_count,
    window_started_at,
    blocked_until,
    updated_at
  )
  values (
    fingerprint_value,
    1,
    now_at,
    null,
    now_at
  )
  on conflict (fingerprint)
  do update set
    attempt_count = case
      when registration_attempts.window_started_at < now_at - interval '1 hour'
        then 1
      else least(5, registration_attempts.attempt_count + 1)
    end,
    window_started_at = case
      when registration_attempts.window_started_at < now_at - interval '1 hour'
        then now_at
      else registration_attempts.window_started_at
    end,
    blocked_until = case
      when registration_attempts.window_started_at >= now_at - interval '1 hour'
        and registration_attempts.attempt_count + 1 >= 5
        then now_at + interval '1 hour'
      else null
    end,
    updated_at = now_at;

  return null;
end;
$$;

create or replace function public.complete_code_registration(
  target_user_id uuid,
  normalized_email text,
  display_name text,
  raw_code text,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_club public.clubs%rowtype;
  access_code public.club_access_codes%rowtype;
  before_membership public.memberships%rowtype;
  target_membership public.memberships%rowtype;
  previous_result jsonb;
  result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if target_request_id is null
    or target_user_id is null
    or length(trim(display_name)) not between 1 and 80
  then
    raise exception using errcode = 'P0001', message = 'Registration unavailable';
  end if;

  select after_data
  into previous_result
  from public.audit_logs
  where actor_id = target_user_id
    and request_id = target_request_id
    and action = 'membership.code_registered';

  if previous_result is not null then
    return previous_result;
  end if;

  select *
  into target_club
  from public.clubs
  order by created_at
  limit 1
  for update;

  if target_club.id is null then
    raise exception using errcode = 'P0001', message = 'Registration unavailable';
  end if;

  select *
  into access_code
  from public.club_access_codes candidate
  where candidate.club_id = target_club.id
    and extensions.crypt(upper(trim(raw_code)), candidate.code_hash)
      = candidate.code_hash
  limit 1
  for update;

  if access_code.id is null or not exists (
    select 1
    from auth.users auth_user
    where auth_user.id = target_user_id
      and lower(auth_user.email) = lower(trim(normalized_email))
  ) then
    raise exception using errcode = 'P0001', message = 'Registration unavailable';
  end if;

  insert into public.profiles (id, display_name)
  values (target_user_id, trim(display_name))
  on conflict (id)
  do update set
    display_name = excluded.display_name,
    updated_at = timezone('utc', now());

  select *
  into before_membership
  from public.memberships
  where club_id = target_club.id
    and user_id = target_user_id
  for update;

  if before_membership.id is not null
    and before_membership.status <> 'invited'
  then
    raise exception using errcode = 'P0001', message = 'Registration unavailable';
  end if;

  if before_membership.id is null then
    insert into public.memberships (
      club_id,
      user_id,
      role,
      status,
      activated_at
    )
    values (
      target_club.id,
      target_user_id,
      access_code.kind::text::public.club_role,
      'active',
      timezone('utc', now())
    )
    returning * into target_membership;
  else
    update public.memberships
    set
      role = access_code.kind::text::public.club_role,
      status = 'active',
      activated_at = timezone('utc', now()),
      deactivated_at = null,
      updated_at = timezone('utc', now())
    where id = before_membership.id
    returning * into target_membership;
  end if;

  result := jsonb_build_object(
    'membership_id', target_membership.id,
    'club_id', target_membership.club_id,
    'role', target_membership.role,
    'status', target_membership.status
  );

  perform public._write_audit(
    target_membership.club_id,
    target_user_id,
    'membership.code_registered',
    'membership',
    target_membership.id,
    target_request_id,
    case
      when before_membership.id is null then null
      else to_jsonb(before_membership)
    end,
    result
  );

  return result;
end;
$$;

create or replace function public.rotate_access_code(
  target_kind public.access_code_kind,
  new_code text,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_club public.clubs%rowtype;
  actor uuid;
  previous_code public.club_access_codes%rowtype;
  changed_code public.club_access_codes%rowtype;
  previous_result jsonb;
  result jsonb;
begin
  if target_request_id is null
    or target_kind is null
    or new_code is null
    or new_code !~ '^MTP-(M-[A-Z2-9]{16}|A-[A-Z2-9]{24})$'
    or (target_kind = 'member' and new_code !~ '^MTP-M-')
    or (target_kind = 'admin' and new_code !~ '^MTP-A-')
  then
    raise exception using errcode = '22023', message = 'Invalid access code';
  end if;

  select *
  into target_club
  from public.clubs
  order by created_at
  limit 1
  for update;

  actor := public._require_club_admin(target_club.id);
  previous_result := public._request_result(
    'access_code.rotated',
    target_request_id
  );
  if previous_result is not null then
    return previous_result;
  end if;

  select *
  into previous_code
  from public.club_access_codes
  where club_id = target_club.id
    and kind = target_kind
  for update;

  insert into public.club_access_codes (
    club_id,
    kind,
    code_hash,
    rotated_by,
    rotated_at
  )
  values (
    target_club.id,
    target_kind,
    extensions.crypt(new_code, extensions.gen_salt('bf', 12)),
    actor,
    timezone('utc', now())
  )
  on conflict (club_id, kind)
  do update set
    code_hash = excluded.code_hash,
    rotated_by = excluded.rotated_by,
    rotated_at = excluded.rotated_at
  returning * into changed_code;

  result := jsonb_build_object(
    'id', changed_code.id,
    'kind', changed_code.kind,
    'rotated_at', changed_code.rotated_at
  );

  perform public._write_audit(
    target_club.id,
    actor,
    'access_code.rotated',
    'club_access_code',
    changed_code.id,
    target_request_id,
    case
      when previous_code.id is null then null
      else jsonb_build_object(
        'id', previous_code.id,
        'kind', previous_code.kind,
        'rotated_at', previous_code.rotated_at
      )
    end,
    result
  );

  return result;
end;
$$;

revoke all on table public.club_access_codes from public;
revoke all on table public.registration_attempts from public;

revoke all on function public.check_registration_code(text, text, text, uuid) from public;
grant execute on function public.check_registration_code(text, text, text, uuid) to service_role;

revoke all on function public.complete_code_registration(uuid, text, text, text, uuid) from public;
grant execute on function public.complete_code_registration(uuid, text, text, text, uuid) to service_role;

revoke all on function public.rotate_access_code(public.access_code_kind, text, uuid) from public;
grant execute on function public.rotate_access_code(public.access_code_kind, text, uuid) to authenticated;

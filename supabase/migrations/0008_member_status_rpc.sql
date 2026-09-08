create or replace function public.set_member_access(
  target_membership_id uuid,
  target_active boolean,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  action_name text;
  previous_result jsonb;
  before_row public.memberships%rowtype;
  changed_row public.memberships%rowtype;
begin
  if target_request_id is null then
    raise exception using errcode = '22004', message = 'Request ID is required';
  end if;

  select *
  into before_row
  from public.memberships
  where id = target_membership_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Membership not found';
  end if;

  actor := public._require_club_admin(before_row.club_id);
  action_name := case
    when target_active then 'membership.reactivate'
    else 'membership.deactivate'
  end;
  previous_result := public._request_result(action_name, target_request_id);

  if previous_result is not null then
    return previous_result;
  end if;
  if before_row.role = 'admin' then
    raise exception using
      errcode = '23514',
      message = 'Administrator access cannot be changed here';
  end if;

  update public.memberships
  set
    status = case
      when target_active and activated_at is not null
        then 'active'::public.membership_status
      when target_active
        then 'invited'::public.membership_status
      else 'inactive'::public.membership_status
    end,
    deactivated_at = case
      when target_active then null
      else timezone('utc', now())
    end
  where id = target_membership_id
  returning * into changed_row;

  previous_result := to_jsonb(changed_row);
  perform public._write_audit(
    changed_row.club_id,
    actor,
    action_name,
    'membership',
    changed_row.id,
    target_request_id,
    to_jsonb(before_row),
    previous_result
  );

  return previous_result;
end;
$$;

revoke all on function public.set_member_access(uuid, boolean, uuid) from public;
grant execute on function public.set_member_access(uuid, boolean, uuid) to authenticated;

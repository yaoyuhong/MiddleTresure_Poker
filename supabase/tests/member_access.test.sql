begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'access-admin@example.test', '',
    timezone('utc', now()), '{}'::jsonb, '{"display_name":"Access Admin"}'::jsonb,
    timezone('utc', now()), timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000502',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'access-member@example.test', '',
    timezone('utc', now()), '{}'::jsonb, '{"display_name":"Access Member"}'::jsonb,
    timezone('utc', now()), timezone('utc', now())
  );

insert into public.clubs (id, name)
values ('10000000-0000-0000-0000-000000000501', 'Access Club');

insert into public.memberships (
  id, club_id, user_id, role, status, invited_by, activated_at
)
values
  (
    '20000000-0000-0000-0000-000000000501',
    '10000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000501',
    'admin', 'active',
    '00000000-0000-0000-0000-000000000501',
    timezone('utc', now())
  ),
  (
    '20000000-0000-0000-0000-000000000502',
    '10000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000502',
    'member', 'active',
    '00000000-0000-0000-0000-000000000501',
    timezone('utc', now())
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000501',
  true
);

select lives_ok(
  $$
    select public.set_member_access(
      '20000000-0000-0000-0000-000000000502',
      false,
      '30000000-0000-0000-0000-000000000501'
    )
  $$,
  'administrator can deactivate a member'
);

select is(
  (
    select status::text
    from public.memberships
    where id = '20000000-0000-0000-0000-000000000502'
  ),
  'inactive',
  'member becomes inactive'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'membership.deactivate'
  ),
  1::bigint,
  'deactivation is audited once'
);

select lives_ok(
  $$
    select public.set_member_access(
      '20000000-0000-0000-0000-000000000502',
      false,
      '30000000-0000-0000-0000-000000000501'
    )
  $$,
  'repeating the same request is idempotent'
);

select lives_ok(
  $$
    select public.set_member_access(
      '20000000-0000-0000-0000-000000000502',
      true,
      '30000000-0000-0000-0000-000000000502'
    )
  $$,
  'administrator can reactivate a member'
);

select throws_ok(
  $$
    select public.set_member_access(
      '20000000-0000-0000-0000-000000000501',
      false,
      '30000000-0000-0000-0000-000000000503'
    )
  $$,
  '23514',
  null,
  'administrator access cannot be changed through member controls'
);

select * from finish();
rollback;

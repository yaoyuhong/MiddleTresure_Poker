begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'bootstrap@example.test',
  '',
  null,
  '{}'::jsonb,
  '{"display_name":"Bootstrap Admin"}'::jsonb,
  timezone('utc', now()),
  timezone('utc', now())
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000401',
  true
);

select throws_ok(
  $$
    select public.bootstrap_club(
      '00000000-0000-0000-0000-000000000401',
      'Bootstrap Club',
      'chips',
      '30000000-0000-0000-0000-000000000401'
    )
  $$,
  '42501',
  null,
  'authenticated users cannot bootstrap a club'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select lives_ok(
  $$
    select public.bootstrap_club(
      '00000000-0000-0000-0000-000000000401',
      'Bootstrap Club',
      'chips',
      '30000000-0000-0000-0000-000000000401'
    )
  $$,
  'service role can bootstrap the first club'
);

select lives_ok(
  $$
    select public.bootstrap_club(
      '00000000-0000-0000-0000-000000000401',
      'Bootstrap Club',
      'chips',
      '30000000-0000-0000-0000-000000000401'
    )
  $$,
  'repeating the same bootstrap request is idempotent'
);

select is(
  (select count(*) from public.clubs),
  1::bigint,
  'bootstrap creates exactly one club'
);

select results_eq(
  $$
    select role::text, status::text
    from public.memberships
    where user_id = '00000000-0000-0000-0000-000000000401'
  $$,
  $$ values ('admin'::text, 'invited'::text) $$,
  'bootstrap creates an invited administrator membership'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'club.bootstrap'
  ),
  1::bigint,
  'bootstrap writes one immutable audit event'
);

select * from finish();
rollback;

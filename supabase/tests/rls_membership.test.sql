begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

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
values
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{"display_name":"Admin"}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'member@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{"display_name":"Member"}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'outsider@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{"display_name":"Outsider"}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  );

insert into public.clubs (id, name)
values ('10000000-0000-0000-0000-000000000001', 'Test Club');

insert into public.memberships (
  club_id,
  user_id,
  role,
  status,
  invited_by,
  activated_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'active',
    '00000000-0000-0000-0000-000000000001',
    timezone('utc', now())
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'member',
    'active',
    '00000000-0000-0000-0000-000000000001',
    timezone('utc', now())
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  true
);

select results_eq(
  $$ select name from public.clubs $$,
  $$ values ('Test Club'::text) $$,
  'active member can read their club'
);

select is(
  (select count(*) from public.memberships),
  2::bigint,
  'active member can read club memberships'
);

select is(
  (select count(*) from public.profiles),
  2::bigint,
  'active member can read profiles in the same club only'
);

select ok(
  public.is_active_club_member('10000000-0000-0000-0000-000000000001'),
  'active member helper returns true'
);

select ok(
  not public.is_club_admin('10000000-0000-0000-0000-000000000001'),
  'member is not an administrator'
);

select throws_ok(
  $$ update public.clubs set name = 'Changed' $$,
  '42501',
  null,
  'member cannot update a club'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000003',
  true
);

select is(
  (select count(*) from public.clubs),
  0::bigint,
  'outsider cannot read club data'
);

select is(
  (select count(*) from public.memberships),
  0::bigint,
  'outsider cannot read memberships'
);

select * from finish();
rollback;

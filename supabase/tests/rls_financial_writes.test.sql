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
values
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin2@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{"display_name":"Admin"}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'member2@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{"display_name":"Member"}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  );

insert into public.clubs (id, name)
values ('10000000-0000-0000-0000-000000000011', 'Financial Test Club');

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
    '10000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000011',
    'admin',
    'active',
    '00000000-0000-0000-0000-000000000011',
    timezone('utc', now())
  ),
  (
    '10000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000012',
    'member',
    'active',
    '00000000-0000-0000-0000-000000000011',
    timezone('utc', now())
  );

insert into public.audit_logs (
  club_id,
  actor_id,
  action,
  entity_type,
  entity_id,
  request_id
)
values (
  '10000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000011',
  'test.action',
  'club',
  '10000000-0000-0000-0000-000000000011',
  '20000000-0000-0000-0000-000000000011'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000012',
  true
);

select ok(
  not public.is_club_admin('10000000-0000-0000-0000-000000000011'),
  'member is not an administrator'
);

select is(
  (select count(*) from public.audit_logs),
  0::bigint,
  'member cannot read audit history'
);

select throws_ok(
  $$
    insert into public.seasons (club_id, name, created_by)
    values (
      '10000000-0000-0000-0000-000000000011',
      'Forbidden',
      '00000000-0000-0000-0000-000000000012'
    )
  $$,
  '42501',
  null,
  'member cannot directly create a season'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000011',
  true
);

select ok(
  public.is_club_admin('10000000-0000-0000-0000-000000000011'),
  'administrator helper returns true'
);

select is(
  (select count(*) from public.audit_logs),
  1::bigint,
  'administrator can read audit history'
);

select throws_ok(
  $$
    insert into public.seasons (club_id, name, created_by)
    values (
      '10000000-0000-0000-0000-000000000011',
      'Direct write',
      '00000000-0000-0000-0000-000000000011'
    )
  $$,
  '42501',
  null,
  'administrator financial writes must use trusted functions'
);

select * from finish();
rollback;

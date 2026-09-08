begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'code-admin@example.test', '',
    timezone('utc', now()), '{}'::jsonb, '{"display_name":"Code Admin"}'::jsonb,
    timezone('utc', now()), timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000602',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'code-member@example.test', '',
    timezone('utc', now()), '{}'::jsonb, '{"display_name":"Code Member"}'::jsonb,
    timezone('utc', now()), timezone('utc', now())
  );

insert into public.clubs (id, name)
values ('10000000-0000-0000-0000-000000000601', 'Code Club');

insert into public.memberships (
  id, club_id, user_id, role, status, invited_by, activated_at
)
values (
  '20000000-0000-0000-0000-000000000601',
  '10000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000601',
  'admin', 'active',
  '00000000-0000-0000-0000-000000000601',
  timezone('utc', now())
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000601',
  true
);

select lives_ok(
  $$
    select public.rotate_access_code(
      'member',
      'MTP-M-23456789ABCDEFGH',
      '30000000-0000-0000-0000-000000000601'
    )
  $$,
  'administrator can initialize the member code'
);

select isnt(
  (
    select code_hash
    from public.club_access_codes
    where club_id = '10000000-0000-0000-0000-000000000601'
      and kind = 'member'
  ),
  'MTP-M-23456789ABCDEFGH',
  'database stores only a salted code hash'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

select is(
  public.check_registration_code(
    'MTP-M-23456789ABCDEFGH',
    'code-member@example.test',
    'network-a',
    '30000000-0000-0000-0000-000000000602'
  ),
  'member',
  'valid member code selects the member role'
);

select is(
  public.check_registration_code(
    'WRONG-CODE',
    'code-member@example.test',
    'network-a',
    '30000000-0000-0000-0000-000000000603'
  ),
  null,
  'invalid code reveals no role'
);

select lives_ok(
  $$
    select public.complete_code_registration(
      '00000000-0000-0000-0000-000000000602',
      'code-member@example.test',
      'Code Member',
      'MTP-M-23456789ABCDEFGH',
      '30000000-0000-0000-0000-000000000604'
    )
  $$,
  'service role completes a valid registration'
);

select results_eq(
  $$
    select role::text, status::text
    from public.memberships
    where user_id = '00000000-0000-0000-0000-000000000602'
  $$,
  $$ values ('member'::text, 'active'::text) $$,
  'registration creates an active member'
);

select lives_ok(
  $$
    select public.complete_code_registration(
      '00000000-0000-0000-0000-000000000602',
      'code-member@example.test',
      'Code Member',
      'MTP-M-23456789ABCDEFGH',
      '30000000-0000-0000-0000-000000000604'
    )
  $$,
  'completion is idempotent for the same request ID'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000602',
  true
);

select is(
  (select count(*) from public.club_access_codes),
  0::bigint,
  'members cannot read access-code hashes'
);

select * from finish();
rollback;

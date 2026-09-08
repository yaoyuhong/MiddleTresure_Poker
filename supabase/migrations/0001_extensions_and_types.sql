create extension if not exists pgcrypto with schema extensions;

create type public.club_role as enum ('admin', 'member');
create type public.membership_status as enum ('invited', 'active', 'inactive');
create type public.season_status as enum ('draft', 'open', 'closed');
create type public.game_status as enum ('draft', 'active', 'finalized');
create type public.game_player_status as enum ('active', 'exited');
create type public.game_transaction_type as enum (
  'join',
  'initial_buy_in',
  'add_on',
  'cash_out',
  'exit',
  'correction'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, new.id::text), '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

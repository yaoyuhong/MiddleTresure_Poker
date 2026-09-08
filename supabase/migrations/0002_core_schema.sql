create table public.clubs (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  unit_name text not null default 'chips' check (length(trim(unit_name)) between 1 and 24),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.club_role not null default 'member',
  status public.membership_status not null default 'invited',
  invited_by uuid references public.profiles (id) on delete restrict,
  invited_at timestamptz not null default timezone('utc', now()),
  activated_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (club_id, user_id),
  check (
    (status = 'active' and activated_at is not null and deactivated_at is null)
    or (status = 'inactive' and deactivated_at is not null)
    or status = 'invited'
  )
);

create table public.seasons (
  id uuid primary key default extensions.gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 80),
  status public.season_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table public.games (
  id uuid primary key default extensions.gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  season_id uuid not null references public.seasons (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  status public.game_status not null default 'draft',
  version bigint not null default 1 check (version > 0),
  settlement_revision integer not null default 0 check (settlement_revision >= 0),
  created_by uuid not null references public.profiles (id) on delete restrict,
  started_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (status = 'draft' and started_at is null and finalized_at is null)
    or (status = 'active' and started_at is not null and finalized_at is null)
    or (status = 'finalized' and started_at is not null and finalized_at is not null)
  )
);

create table public.game_players (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete restrict,
  member_id uuid not null references public.memberships (id) on delete restrict,
  status public.game_player_status not null default 'active',
  total_buy_in bigint not null default 0 check (total_buy_in >= 0),
  total_cash_out bigint not null default 0 check (total_cash_out >= 0),
  net_result bigint generated always as (total_cash_out - total_buy_in) stored,
  joined_at timestamptz not null default timezone('utc', now()),
  exited_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (game_id, member_id),
  check (
    (status = 'active' and exited_at is null)
    or (status = 'exited' and exited_at is not null)
  )
);

create table public.game_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete restrict,
  game_player_id uuid not null references public.game_players (id) on delete restrict,
  type public.game_transaction_type not null,
  amount bigint not null default 0 check (amount >= 0),
  request_id uuid not null,
  correction_of uuid references public.game_transactions (id) on delete restrict,
  note text check (note is null or length(note) <= 500),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (game_id, request_id),
  check (
    (type in ('join', 'exit') and amount = 0)
    or (type in ('initial_buy_in', 'add_on', 'cash_out') and amount > 0)
    or (type = 'correction' and correction_of is not null)
  )
);

create table public.settlement_transfers (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete restrict,
  from_game_player_id uuid not null references public.game_players (id) on delete restrict,
  to_game_player_id uuid not null references public.game_players (id) on delete restrict,
  revision integer not null check (revision > 0),
  amount bigint not null check (amount > 0),
  position smallint not null check (position > 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (game_id, revision, position),
  check (from_game_player_id <> to_game_player_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  club_id uuid not null references public.clubs (id) on delete restrict,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (length(trim(action)) between 1 and 100),
  entity_type text not null check (length(trim(entity_type)) between 1 and 80),
  entity_id uuid not null,
  request_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (actor_id, request_id, action)
);

create trigger clubs_set_updated_at
before update on public.clubs
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger memberships_set_updated_at
before update on public.memberships
for each row execute function public.set_updated_at();

create trigger seasons_set_updated_at
before update on public.seasons
for each row execute function public.set_updated_at();

create trigger games_set_updated_at
before update on public.games
for each row execute function public.set_updated_at();

create trigger game_players_set_updated_at
before update on public.game_players
for each row execute function public.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Ember — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Fasting sessions
create table if not exists public.fasting_sessions (
  uuid        uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  started_at  bigint not null,
  ended_at    bigint,
  target_hours real,
  protocol    text not null,
  notes       text,
  created_at  timestamptz default now()
);

-- Metabolic logs (glucose + ketones)
create table if not exists public.metabolic_logs (
  uuid         uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  timestamp    bigint not null,
  glucose_mmol real,
  ketones_mmol real,
  gki          real,
  notes        text,
  tags         text[] default '{}',
  source_id    text,
  created_at   timestamptz default now()
);

-- Electrolyte logs
create table if not exists public.electrolyte_logs (
  uuid         uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  timestamp    bigint not null,
  sodium_mg    real,
  magnesium_mg real,
  potassium_mg real,
  calcium_mg   real,
  notes        text,
  tags         text[] default '{}',
  created_at   timestamptz default now()
);

-- User settings (one row per user)
create table if not exists public.user_settings (
  user_id           uuid references auth.users(id) on delete cascade primary key,
  preferred_protocol text default '18:6',
  glucose_unit      text default 'mmol/L',
  gki_targets       jsonb default '{"therapeutic": 1, "optimal": [1, 6]}',
  theme             text default 'dark',
  lose_it           jsonb,
  updated_at        timestamptz default now()
);

-- Row-level security (each user sees only their own data)
alter table public.fasting_sessions  enable row level security;
alter table public.metabolic_logs    enable row level security;
alter table public.electrolyte_logs  enable row level security;
alter table public.user_settings     enable row level security;

create policy "own fasting sessions"  on public.fasting_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own metabolic logs"    on public.metabolic_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own electrolyte logs"  on public.electrolyte_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own user settings"     on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

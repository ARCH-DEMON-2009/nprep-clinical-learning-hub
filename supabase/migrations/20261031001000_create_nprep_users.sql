create extension if not exists pgcrypto;

create table if not exists public.nprep_users (
  id uuid primary key default gen_random_uuid(),
  mobile text not null unique,
  country_code text not null default '+91',
  auth_json jsonb not null default '{}'::jsonb,
  profile_json jsonb not null default '{}'::jsonb,
  raw_data_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nprep_users_mobile_idx on public.nprep_users (mobile);

create or replace function public.set_nprep_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_nprep_users_updated_at on public.nprep_users;
create trigger set_nprep_users_updated_at
before update on public.nprep_users
for each row execute function public.set_nprep_users_updated_at();

alter table public.nprep_users enable row level security;

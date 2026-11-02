alter table public.nprep_users
  add column if not exists auth_token text;

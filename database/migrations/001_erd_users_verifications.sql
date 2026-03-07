-- NewsHub ERD core tables (USERS, VERIFICATIONS)
-- Target: Supabase Postgres (run in SQL Editor)

create extension if not exists citext;

create table if not exists public.users (
  id bigserial primary key,
  email citext not null unique,
  password_hash text not null,
  full_name text not null,
  role text not null check (role in ('USER', 'ADMIN')),
  region text,
  created_at timestamptz not null default now()
);

alter table public.users
  add column if not exists email citext,
  add column if not exists password_hash text,
  add column if not exists full_name text,
  add column if not exists role text,
  add column if not exists region text,
  add column if not exists created_at timestamptz default now();

alter table public.users
  alter column email type citext using email::citext,
  alter column email set not null,
  alter column password_hash set not null,
  alter column full_name set not null,
  alter column role set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_email_key'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_email_key unique (email);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_role_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_role_check check (role in ('USER', 'ADMIN'));
  end if;
end $$;

create table if not exists public.verifications (
  id bigserial primary key,
  user_id bigint not null unique references public.users(id) on delete cascade,
  full_name text not null,
  address text not null,
  birthdate date not null,
  photo_id_url text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by_admin_id bigint references public.users(id),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.verifications
  add column if not exists user_id bigint,
  add column if not exists full_name text,
  add column if not exists address text,
  add column if not exists birthdate date,
  add column if not exists photo_id_url text,
  add column if not exists status text default 'PENDING',
  add column if not exists reviewed_by_admin_id bigint,
  add column if not exists submitted_at timestamptz default now(),
  add column if not exists reviewed_at timestamptz;

alter table public.verifications
  alter column user_id set not null,
  alter column full_name set not null,
  alter column address set not null,
  alter column birthdate set not null,
  alter column photo_id_url set not null,
  alter column status set default 'PENDING',
  alter column status set not null,
  alter column submitted_at set default now(),
  alter column submitted_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'verifications_user_id_key'
      and conrelid = 'public.verifications'::regclass
  ) then
    alter table public.verifications
      add constraint verifications_user_id_key unique (user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'verifications_status_check'
      and conrelid = 'public.verifications'::regclass
  ) then
    alter table public.verifications
      add constraint verifications_status_check check (status in ('PENDING', 'APPROVED', 'REJECTED'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'verifications_user_id_fkey'
      and conrelid = 'public.verifications'::regclass
  ) then
    alter table public.verifications
      add constraint verifications_user_id_fkey
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'verifications_reviewed_by_admin_id_fkey'
      and conrelid = 'public.verifications'::regclass
  ) then
    alter table public.verifications
      add constraint verifications_reviewed_by_admin_id_fkey
      foreign key (reviewed_by_admin_id) references public.users(id);
  end if;
end $$;

create index if not exists verifications_status_idx
  on public.verifications (status);

create index if not exists verifications_user_id_idx
  on public.verifications (user_id);

create index if not exists verifications_reviewed_by_admin_id_idx
  on public.verifications (reviewed_by_admin_id);

-- Sync Supabase Auth users into ERD USERS table.
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.users (
    email,
    password_hash,
    full_name,
    role,
    region
  )
  values (
    new.email,
    coalesce(new.encrypted_password, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'USER',
    nullif(new.raw_user_meta_data ->> 'region', '')
  )
  on conflict (email)
  do update set
    password_hash = excluded.password_hash,
    full_name = case when excluded.full_name <> '' then excluded.full_name else public.users.full_name end,
    region = coalesce(excluded.region, public.users.region);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_auth_user_created();

create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.users
     set email = new.email,
         password_hash = coalesce(new.encrypted_password, public.users.password_hash),
         full_name = coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), public.users.full_name),
         region = coalesce(nullif(new.raw_user_meta_data ->> 'region', ''), public.users.region)
   where email = old.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;

create trigger on_auth_user_updated
after update of email, encrypted_password, raw_user_meta_data on auth.users
for each row execute procedure public.handle_auth_user_updated();

-- Secure entry point for submitting/updating a user's verification request.
-- Uses authenticated email claim to resolve ERD user_id.
create or replace function public.submit_verification(
  p_full_name text,
  p_address text,
  p_birthdate date,
  p_photo_id_url text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id bigint;
  v_verification_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select u.id
    into v_user_id
    from public.users u
   where lower(u.email::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
   limit 1;

  if v_user_id is null then
    raise exception 'User profile not found';
  end if;

  insert into public.verifications (
    user_id,
    full_name,
    address,
    birthdate,
    photo_id_url,
    status,
    submitted_at,
    reviewed_at,
    reviewed_by_admin_id
  )
  values (
    v_user_id,
    p_full_name,
    p_address,
    p_birthdate,
    p_photo_id_url,
    'PENDING',
    now(),
    null,
    null
  )
  on conflict (user_id)
  do update set
    full_name = excluded.full_name,
    address = excluded.address,
    birthdate = excluded.birthdate,
    photo_id_url = excluded.photo_id_url,
    status = 'PENDING',
    submitted_at = now(),
    reviewed_at = null,
    reviewed_by_admin_id = null
  returning id into v_verification_id;

  return v_verification_id;
end;
$$;

revoke all on function public.submit_verification(text, text, date, text) from public;
grant execute on function public.submit_verification(text, text, date, text) to authenticated;

alter table public.users enable row level security;
alter table public.verifications enable row level security;

drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
for select
to authenticated
using (lower(email::text) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists verifications_select_self on public.verifications;
create policy verifications_select_self on public.verifications
for select
to authenticated
using (
  user_id in (
    select u.id
    from public.users u
    where lower(u.email::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

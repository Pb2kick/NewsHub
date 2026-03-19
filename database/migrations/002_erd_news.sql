-- NewsHub ERD NEWS table
-- Target: Supabase Postgres (run in SQL Editor)

create table if not exists public.news (
  id bigserial primary key,
  title text not null,
  summary text not null,
  content text not null,
  media_urls text,
  source text,
  country text,
  region text,
  published_at timestamptz not null default now(),
  user_id bigint references public.users(id)
);

alter table public.news
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists content text,
  add column if not exists media_urls text,
  add column if not exists source text,
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists published_at timestamptz default now(),
  add column if not exists user_id bigint;

alter table public.news
  alter column title set not null,
  alter column summary set not null,
  alter column content set not null,
  alter column published_at set default now(),
  alter column published_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'news_user_id_fkey'
      and conrelid = 'public.news'::regclass
  ) then
    alter table public.news
      add constraint news_user_id_fkey
      foreign key (user_id) references public.users(id);
  end if;
end $$;

create index if not exists news_published_at_idx
  on public.news (published_at desc);

create index if not exists news_region_idx
  on public.news (region);

create index if not exists news_country_idx
  on public.news (country);

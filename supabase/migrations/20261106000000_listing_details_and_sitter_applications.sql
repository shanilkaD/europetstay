alter table public.listings
  add column if not exists pet_details text not null default '',
  add column if not exists pet_care_needs text[] not null default '{}',
  add column if not exists house_type text check (house_type in ('apartment', 'house', 'farm', 'studio')),
  add column if not exists offers text[] not null default '{}',
  add column if not exists house_rules text[] not null default '{}';

update public.listings
set title = left('Need a sitter in ' || city || ' for ' || pet_name, 100);

create table if not exists public.sitter_applications (
  id uuid primary key default gen_random_uuid(),
  sitter_id uuid not null references public.profiles (id) on delete cascade,
  destinations text[] not null check (cardinality(destinations) between 1 and 3),
  starts_on date not null,
  ends_on date not null,
  party_type text not null check (party_type in ('single', 'couple', 'family')),
  languages text[] not null default '{}',
  experience text[] not null default '{}',
  about text not null check (char_length(about) between 20 and 2000),
  photo_url text not null,
  created_at timestamptz not null default now(),
  constraint sitter_application_dates_valid check (ends_on >= starts_on)
);

create index if not exists sitter_applications_sitter_idx
  on public.sitter_applications (sitter_id, created_at desc);

alter table public.sitter_applications enable row level security;
grant select, insert on public.sitter_applications to authenticated;

drop policy if exists "Authenticated users can view sitter applications" on public.sitter_applications;
create policy "Authenticated users can view sitter applications"
  on public.sitter_applications for select to authenticated using (true);

drop policy if exists "Sitters can create their applications" on public.sitter_applications;
create policy "Sitters can create their applications"
  on public.sitter_applications for insert to authenticated
  with check (sitter_id = (select auth.uid()));

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profiles (id, display_name, avatar_url)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', ''),
  raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 4 and 100),
  city text not null check (char_length(city) between 1 and 80),
  country text not null check (char_length(country) between 1 and 80),
  pet_type text not null check (pet_type in ('cat', 'dog', 'bird', 'other')),
  pet_name text not null check (char_length(pet_name) between 1 and 80),
  starts_on date not null,
  ends_on date not null,
  description text not null check (char_length(description) between 20 and 2000),
  photo_url text,
  photo_urls text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  constraint listing_dates_valid check (ends_on >= starts_on)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  sitter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint conversation_participants_differ check (owner_id <> sitter_id),
  constraint one_conversation_per_sitter_listing unique (listing_id, sitter_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists listings_active_dates_idx
  on public.listings (status, ends_on, created_at desc);
create index if not exists listings_owner_idx on public.listings (owner_id);
create index if not exists conversations_owner_idx on public.conversations (owner_id, created_at desc);
create index if not exists conversations_sitter_idx on public.conversations (sitter_id, created_at desc);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;
grant select, insert on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;

drop policy if exists "Authenticated users can view profiles" on public.profiles;
drop policy if exists "Profile names are publicly readable" on public.profiles;
create policy "Profile names are publicly readable"
  on public.profiles for select to anon, authenticated using (true);

drop policy if exists "Users can create their profile" on public.profiles;
create policy "Users can create their profile"
  on public.profiles for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "Active listings are public" on public.listings;
create policy "Active listings are public"
  on public.listings for select to anon, authenticated
  using (status = 'active' or owner_id = (select auth.uid()));

drop policy if exists "Owners can create listings" on public.listings;
create policy "Owners can create listings"
  on public.listings for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can update listings" on public.listings;
create policy "Owners can update listings"
  on public.listings for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can delete listings" on public.listings;
create policy "Owners can delete listings"
  on public.listings for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Conversation participants can view conversations" on public.conversations;
create policy "Conversation participants can view conversations"
  on public.conversations for select to authenticated
  using ((select auth.uid()) in (owner_id, sitter_id));

drop policy if exists "Sitters can start conversations on active listings" on public.conversations;
create policy "Sitters can start conversations on active listings"
  on public.conversations for insert to authenticated
  with check (
    sitter_id = (select auth.uid())
    and owner_id <> (select auth.uid())
    and exists (
      select 1 from public.listings
      where listings.id = listing_id
        and listings.owner_id = conversations.owner_id
        and listings.status = 'active'
    )
  );

drop policy if exists "Conversation participants can read messages" on public.messages;
create policy "Conversation participants can read messages"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and (select auth.uid()) in (conversations.owner_id, conversations.sitter_id)
    )
  );

drop policy if exists "Participants can send messages as themselves" on public.messages;
create policy "Participants can send messages as themselves"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and (select auth.uid()) in (conversations.owner_id, conversations.sitter_id)
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos',
  'listing-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Listing photos are publicly readable" on storage.objects;
create policy "Listing photos are publicly readable"
  on storage.objects for select to public
  using (bucket_id = 'listing-photos');

drop policy if exists "Owners can upload listing photos" on storage.objects;
create policy "Owners can upload listing photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Owners can update listing photos" on storage.objects;
create policy "Owners can update listing photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Owners can delete listing photos" on storage.objects;
create policy "Owners can delete listing photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

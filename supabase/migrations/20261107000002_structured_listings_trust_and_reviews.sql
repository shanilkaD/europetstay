alter table public.profiles
  add column if not exists id_verified boolean not null default false,
  add column if not exists references_count integer not null default 0,
  add column if not exists avg_rating numeric(3, 2) not null default 0,
  add column if not exists total_reviews integer not null default 0;

create or replace function public.protect_profile_trust_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'postgres' and auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.id_verified := false;
      new.references_count := 0;
      new.avg_rating := 0;
      new.total_reviews := 0;
    else
      new.id_verified := old.id_verified;
      new.references_count := old.references_count;
      new.avg_rating := old.avg_rating;
      new.total_reviews := old.total_reviews;
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_protect_trust_fields
  before insert or update on public.profiles
  for each row execute function public.protect_profile_trust_fields();

alter table public.listings
  alter column pet_name drop not null,
  alter column pet_name drop default,
  add column if not exists listing_type text not null default 'need_sitter',
  add column if not exists can_care_for text[] not null default '{}',
  add column if not exists experience_years text not null default '',
  add column if not exists special_skills text[] not null default '{}',
  add column if not exists smoker text,
  add column if not exists sitter_type text,
  add column if not exists bring_own_pet text,
  add column if not exists languages text[] not null default '{}';

alter table public.listings drop constraint if exists listings_status_check;
update public.listings
set status = case status
  when 'active' then 'live'
  when 'live' then 'live'
  when 'booked' then 'booked'
  when 'completed' then 'completed'
  else 'cancelled'
end;
alter table public.listings
  alter column status set default 'live',
  add constraint listings_status_check
  check (status in ('live', 'booked', 'completed', 'cancelled'));

alter table public.listings drop constraint if exists listings_listing_type_check;
alter table public.listings
  add constraint listings_listing_type_check
  check (listing_type in ('need_sitter', 'offer_sitting'));

alter table public.listings drop constraint if exists listings_sitter_fields_check;
alter table public.listings
  add constraint listings_sitter_fields_check
  check (
    listing_type <> 'offer_sitting'
    or (
      cardinality(can_care_for) > 0
      and experience_years in ('0-1', '1-3', '3+')
      and smoker in ('smoker', 'non_smoker')
      and sitter_type in ('single', 'couple', 'family')
      and bring_own_pet in ('no', 'dog', 'cat')
      and cardinality(languages) > 0
    )
  );

create index if not exists listings_discovery_idx
  on public.listings (status, listing_type, ends_on, starts_on);

create or replace function public.prevent_duplicate_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.owner_id = old.owner_id
    and new.listing_type = old.listing_type
    and lower(btrim(new.city)) = lower(btrim(old.city))
    and lower(btrim(new.country)) = lower(btrim(old.country))
    and new.starts_on = old.starts_on
    and new.ends_on = old.ends_on
    and new.pet_types = old.pet_types
    and coalesce(lower(btrim(new.pet_name)), '') = coalesce(lower(btrim(old.pet_name)), '') then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(
    new.owner_id::text || '|' || new.listing_type || '|' ||
    lower(btrim(new.city)) || '|' || lower(btrim(new.country)) || '|' ||
    case when new.listing_type = 'need_sitter'
      then coalesce(lower(btrim(new.pet_name)), '') || '|' || new.pet_types::text
      else ''
    end || '|' ||
    new.starts_on::text || '|' || new.ends_on::text
  ));

  if exists (
    select 1
    from public.listings existing
    where existing.owner_id = new.owner_id
      and existing.listing_type = new.listing_type
      and lower(btrim(existing.city)) = lower(btrim(new.city))
      and lower(btrim(existing.country)) = lower(btrim(new.country))
      and existing.starts_on = new.starts_on
      and existing.ends_on = new.ends_on
      and existing.id is distinct from new.id
      and (
        new.listing_type = 'offer_sitting'
        or (
          lower(btrim(coalesce(existing.pet_name, ''))) = lower(btrim(coalesce(new.pet_name, '')))
          and existing.pet_types = new.pet_types
        )
      )
  ) then
    raise exception 'A duplicate listing already exists for these dates and details.';
  end if;
  return new;
end;
$$;
create trigger listings_prevent_duplicates
  before insert or update on public.listings
  for each row execute function public.prevent_duplicate_listing();

alter table public.conversations
  drop constraint if exists one_conversation_per_sitter_listing,
  drop constraint if exists conversations_listing_id_sitter_id_key;
create unique index if not exists one_conversation_per_listing_and_pair_idx
  on public.conversations (listing_id, owner_id, sitter_id);

drop policy if exists "Active listings are public" on public.listings;
create policy "Live listings are public"
  on public.listings for select to anon, authenticated
  using (
    status = 'live'
    or owner_id = (select auth.uid())
    or exists (
      select 1 from public.conversations c
      where c.listing_id = listings.id
        and (select auth.uid()) in (c.owner_id, c.sitter_id)
    )
  );

drop policy if exists "Sitters can start conversations on active listings" on public.conversations;
create policy "Participants can start conversations on live listings"
  on public.conversations for insert to authenticated
  with check (
    owner_id <> sitter_id
    and exists (
      select 1 from public.listings
      where listings.id = listing_id
        and listings.status = 'live'
        and (
          (listings.listing_type = 'need_sitter'
            and listings.owner_id = conversations.owner_id
            and conversations.sitter_id = (select auth.uid()))
          or
          (listings.listing_type = 'offer_sitting'
            and listings.owner_id = conversations.sitter_id
            and conversations.owner_id = (select auth.uid()))
        )
    )
  );

create table if not exists public.listing_private_details (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  medical_needs text not null default '',
  vet_name text not null,
  vet_phone text not null,
  emergency_contact_name text not null,
  emergency_contact_phone text not null,
  who_pays_vet text not null check (who_pays_vet in ('owner', 'shared')),
  updated_at timestamptz not null default now(),
  constraint listing_private_contacts_required check (
    char_length(btrim(vet_name)) > 0
    and char_length(btrim(vet_phone)) > 0
    and char_length(btrim(emergency_contact_name)) > 0
    and char_length(btrim(emergency_contact_phone)) > 0
    and (
      medical_needs = 'no:'
      or (
        medical_needs like 'yes:%'
        and char_length(btrim(substr(medical_needs, 5))) > 0
      )
    )
  )
);
alter table public.listing_private_details enable row level security;
grant select, insert, update, delete on public.listing_private_details to authenticated;
create policy "Listing owners and conversation participants can read private care details"
  on public.listing_private_details for select to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.conversations
      where conversations.listing_id = listing_private_details.listing_id
        and (select auth.uid()) in (conversations.owner_id, conversations.sitter_id)
    )
  );
create policy "Owners manage private care details"
  on public.listing_private_details for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create table if not exists public.sitter_verification_submissions (
  sitter_id uuid primary key references public.profiles(id) on delete cascade,
  id_document_path text not null,
  reference_name text not null,
  reference_contact text not null,
  agreed_to_rules boolean not null check (agreed_to_rules),
  updated_at timestamptz not null default now(),
  constraint sitter_verification_details_required check (
    char_length(btrim(id_document_path)) > 0
    and char_length(btrim(reference_name)) > 0
    and char_length(btrim(reference_contact)) > 0
  )
);
alter table public.sitter_verification_submissions enable row level security;
grant select, insert, update on public.sitter_verification_submissions to authenticated;
create policy "Sitters manage their private verification submission"
  on public.sitter_verification_submissions for all to authenticated
  using (sitter_id = (select auth.uid()))
  with check (sitter_id = (select auth.uid()));

create or replace function public.require_sitter_verification_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.listing_type = 'offer_sitting'
    and (tg_op = 'INSERT' or old.listing_type is distinct from new.listing_type)
    and not exists (
    select 1
    from public.sitter_verification_submissions submission
    where submission.sitter_id = new.owner_id
      and submission.agreed_to_rules
      and char_length(btrim(submission.id_document_path)) > 0
      and char_length(btrim(submission.reference_name)) > 0
      and char_length(btrim(submission.reference_contact)) > 0
  ) then
    raise exception 'A private identity document, reference, and agreement are required before publishing a sitter post.';
  end if;
  return new;
end;
$$;
create trigger listings_require_sitter_verification
  before insert or update on public.listings
  for each row execute function public.require_sitter_verification_submission();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-verification-documents',
  'private-verification-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users manage their verification documents" on storage.objects;
create policy "Users manage their verification documents"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'private-verification-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'private-verification-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewed_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  constraint one_review_per_listing_reviewer unique (listing_id, reviewer_id),
  constraint review_participants_differ check (reviewer_id <> reviewed_id)
);
alter table public.reviews enable row level security;
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;
create policy "Reviews are publicly readable"
  on public.reviews for select to anon, authenticated using (true);
create policy "Completed sit participants can review each other"
  on public.reviews for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      join public.listings l on l.id = c.listing_id
      where c.listing_id = reviews.listing_id
        and (select auth.uid()) in (c.owner_id, c.sitter_id)
        and reviews.reviewed_id in (c.owner_id, c.sitter_id)
        and reviews.reviewed_id <> (select auth.uid())
        and l.status = 'completed'
        and l.ends_on < current_date
    )
  );

create or replace function public.refresh_profile_review_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set total_reviews = totals.total_reviews,
      avg_rating = totals.avg_rating,
      updated_at = now()
  from (
    select count(*)::integer as total_reviews, coalesce(avg(rating), 0)::numeric(3, 2) as avg_rating
    from public.reviews
    where reviewed_id = new.reviewed_id
  ) totals
  where id = new.reviewed_id;
  return new;
end;
$$;
create trigger reviews_refresh_profile_totals
  after insert on public.reviews
  for each row execute function public.refresh_profile_review_totals();

create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_reads enable row level security;
grant select, insert, update on public.conversation_reads to authenticated;
create policy "Participants can view conversation read markers"
  on public.conversation_reads for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_reads.conversation_id
        and (select auth.uid()) in (c.owner_id, c.sitter_id)
    )
  );
create policy "Participants can set their own read markers"
  on public.conversation_reads for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_reads.conversation_id
        and (select auth.uid()) in (c.owner_id, c.sitter_id)
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_reads.conversation_id
        and (select auth.uid()) in (c.owner_id, c.sitter_id)
    )
  );

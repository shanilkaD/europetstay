alter table public.sitter_applications
  add column if not exists experience_years text not null default '',
  add column if not exists pet_experience text not null default '';

delete from public.sitter_applications older
using public.sitter_applications newer
where older.sitter_id = newer.sitter_id
  and (older.created_at, older.id) < (newer.created_at, newer.id);

delete from public.listings older
using public.listings newer
where older.owner_id = newer.owner_id
  and lower(trim(older.city)) = lower(trim(newer.city))
  and lower(trim(older.country)) = lower(trim(newer.country))
  and lower(trim(older.pet_name)) = lower(trim(newer.pet_name))
  and older.pet_type = newer.pet_type
  and older.starts_on = newer.starts_on
  and older.ends_on = newer.ends_on
  and (older.created_at, older.id) < (newer.created_at, newer.id)
  and not exists (
    select 1 from public.conversations
    where conversations.listing_id = older.id
  );

create unique index if not exists sitter_applications_one_profile_per_sitter_idx
  on public.sitter_applications (sitter_id);

grant update on public.sitter_applications to authenticated;

drop policy if exists "Sitters can update their profile" on public.sitter_applications;
create policy "Sitters can update their profile"
  on public.sitter_applications for update to authenticated
  using (sitter_id = (select auth.uid()))
  with check (sitter_id = (select auth.uid()));

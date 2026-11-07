alter table public.listings
  add column if not exists pet_types text[] not null default '{}';

update public.listings
set pet_types = case
  when pet_type = 'both' then array['cat', 'dog']
  else array[pet_type]
end
where cardinality(pet_types) = 0;

alter table public.listings
  drop constraint if exists listings_pet_type_check;

alter table public.listings
  add constraint listings_pet_type_check
  check (pet_type in ('cat', 'dog', 'bird', 'other', 'both'));

alter table public.listings
  add constraint listings_pet_types_check
  check (
    cardinality(pet_types) between 1 and 4
    and pet_types <@ array['cat', 'dog', 'bird', 'other']::text[]
  );

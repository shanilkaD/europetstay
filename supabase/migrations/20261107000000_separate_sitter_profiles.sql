alter table public.listings
  add column if not exists pet_age text not null default '',
  add column if not exists pet_breed text not null default '';

alter table public.sitter_applications
  add column if not exists animals text[] not null default '{}',
  alter column destinations drop not null,
  alter column destinations set default '{}',
  alter column starts_on drop not null,
  alter column ends_on drop not null,
  drop constraint if exists sitter_applications_destinations_check,
  drop constraint if exists sitter_application_dates_valid;

update public.sitter_applications
set animals = array_remove(
      array[
        case when experience @> array['cats'] then 'cat' end,
        case when experience @> array['dogs'] then 'dog' end
      ],
      null
    ),
    experience = array_remove(array_remove(experience, 'cats'), 'dogs')
where animals = '{}';

drop policy if exists "Public can view available sitter applications" on public.sitter_applications;
create policy "Public can view sitter profiles"
  on public.sitter_applications for select to anon
  using (true);

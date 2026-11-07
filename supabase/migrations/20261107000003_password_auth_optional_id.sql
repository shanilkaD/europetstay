update public.profiles profile
set display_name = coalesce(nullif(btrim(profile.display_name), ''), nullif(split_part(auth_user.email, '@', 1), ''), 'Member'),
    updated_at = now()
from auth.users auth_user
where profile.id = auth_user.id
  and nullif(btrim(profile.display_name), '') is null;

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
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Member'
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update
  set display_name = case
        when nullif(btrim(public.profiles.display_name), '') is null then excluded.display_name
        else public.profiles.display_name
      end,
      avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
      updated_at = now();
  return new;
end;
$$;

alter table public.sitter_verification_submissions
  alter column id_document_path drop not null;

alter table public.sitter_verification_submissions
  drop constraint if exists sitter_verification_details_required,
  add constraint sitter_verification_details_required check (
    char_length(btrim(reference_name)) > 0
    and char_length(btrim(reference_contact)) > 0
  );

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
        and char_length(btrim(submission.reference_name)) > 0
        and char_length(btrim(submission.reference_contact)) > 0
    ) then
    raise exception 'A reference and agreement to the community rules are required before publishing a sitter post.';
  end if;
  return new;
end;
$$;

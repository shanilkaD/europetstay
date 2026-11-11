alter table public.sitter_verification_submissions
  alter column agreed_to_rules set default true,
  drop constraint if exists sitter_verification_submissions_agreed_to_rules_check;

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
        and char_length(btrim(submission.reference_name)) > 0
        and char_length(btrim(submission.reference_contact)) > 0
    ) then
    raise exception 'A reference is required before publishing a sitter post.';
  end if;
  return new;
end;
$$;

alter table public.profiles
  add column if not exists full_name text not null default '',
  add column if not exists sitter_type text not null default 'both';

update public.profiles profile
set full_name = coalesce(
  nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
  nullif(btrim(auth_user.raw_user_meta_data ->> 'name'), ''),
  case
    when profile.display_name <> split_part(coalesce(auth_user.email, ''), '@', 1) then profile.display_name
    else ''
  end
)
from auth.users auth_user
where profile.id = auth_user.id
  and coalesce(profile.full_name, '') = '';

update public.profiles
set sitter_type = 'both'
where sitter_type is null
   or sitter_type not in ('local', 'travelling', 'both');

alter table public.profiles
  alter column sitter_type set default 'both',
  alter column sitter_type set not null,
  drop constraint if exists profiles_sitter_type_check,
  add constraint profiles_sitter_type_check
    check (sitter_type in ('local', 'travelling', 'both'));

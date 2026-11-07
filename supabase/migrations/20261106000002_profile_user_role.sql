alter table public.profiles
  add column if not exists user_role text
  check (user_role in ('owner', 'sitter'));

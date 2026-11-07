create or replace function public.is_conversation_participant_for_listing(target_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    where c.listing_id = target_listing_id
      and (select auth.uid()) in (c.owner_id, c.sitter_id)
  );
$$;

revoke all on function public.is_conversation_participant_for_listing(uuid) from public;
grant execute on function public.is_conversation_participant_for_listing(uuid) to anon, authenticated;

drop policy if exists "Live listings are public" on public.listings;
create policy "Live listings are public"
  on public.listings for select to anon, authenticated
  using (
    status = 'live'
    or owner_id = (select auth.uid())
    or public.is_conversation_participant_for_listing(id)
  );

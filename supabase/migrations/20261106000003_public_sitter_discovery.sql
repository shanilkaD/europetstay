grant select on public.sitter_applications to anon, authenticated;

create policy "Public can view available sitter applications"
  on public.sitter_applications for select to anon
  using (ends_on >= current_date);

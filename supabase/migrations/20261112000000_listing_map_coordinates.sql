alter table public.listings
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.listings
  drop constraint if exists listing_coordinates_valid;

alter table public.listings
  add constraint listing_coordinates_valid check (
    (latitude is null and longitude is null)
    or (
      latitude is not null and longitude is not null
      and latitude between -90 and 90
      and longitude between -180 and 180
    )
  );

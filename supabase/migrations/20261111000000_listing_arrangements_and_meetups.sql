alter table public.listings
  add column if not exists sitter_fee_amount numeric(10, 2),
  add column if not exists sitter_fee_currency text not null default 'EUR',
  add column if not exists sitter_fee_period text not null default 'per_stay',
  add column if not exists owner_payment_amount numeric(10, 2),
  add column if not exists owner_payment_currency text not null default 'EUR',
  add column if not exists owner_payment_period text not null default 'per_stay',
  add column if not exists in_person_meet_required boolean not null default false;

alter table public.listings
  drop constraint if exists listings_sitter_fee_amount_check,
  add constraint listings_sitter_fee_amount_check
    check (sitter_fee_amount is null or sitter_fee_amount between 0 and 1000000),
  drop constraint if exists listings_sitter_fee_currency_check,
  add constraint listings_sitter_fee_currency_check
    check (sitter_fee_currency ~ '^[A-Z]{3}$'),
  drop constraint if exists listings_sitter_fee_period_check,
  add constraint listings_sitter_fee_period_check
    check (sitter_fee_period in ('per_day', 'per_week', 'per_stay')),
  drop constraint if exists listings_owner_payment_amount_check,
  add constraint listings_owner_payment_amount_check
    check (owner_payment_amount is null or owner_payment_amount between 0 and 1000000),
  drop constraint if exists listings_owner_payment_currency_check,
  add constraint listings_owner_payment_currency_check
    check (owner_payment_currency ~ '^[A-Z]{3}$'),
  drop constraint if exists listings_owner_payment_period_check,
  add constraint listings_owner_payment_period_check
    check (owner_payment_period in ('per_day', 'per_week', 'per_stay'));

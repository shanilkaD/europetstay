alter table public.listing_private_details
  alter column vet_name set default '',
  alter column vet_phone set default '',
  drop constraint if exists listing_private_contacts_required,
  add constraint listing_private_contacts_required check (
    char_length(btrim(emergency_contact_name)) > 0
    and char_length(btrim(emergency_contact_phone)) > 0
    and (
      medical_needs = 'no:'
      or (
        medical_needs like 'yes:%'
        and char_length(btrim(substr(medical_needs, 5))) > 0
      )
    )
  );

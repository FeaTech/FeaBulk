-- Accounts created before business onboarding was deployed have valid Auth
-- identities and signup metadata, but no profile, organization, or membership.
-- Provision only complete buyer/seller registrations and leave unrelated Auth
-- identities untouched.
do $$
declare
  account record;
  organization_id uuid;
  requested_kind public.organization_kind;
  legal_name_input text;
  display_name_input text;
  full_name_input text;
  phone_input text;
  gstin_input text;
  business_type_input text;
  pan_last4_input text;
  cin_or_llpin_input text;
  udyam_input text;
  address_input jsonb;
begin
  for account in
    select u.*
    from auth.users u
    where not exists (
      select 1 from public.organization_members m where m.user_id = u.id
    )
  loop
    if coalesce(account.raw_user_meta_data->>'requested_workspace', '') not in ('buyer', 'seller') then
      continue;
    end if;

    requested_kind := (account.raw_user_meta_data->>'requested_workspace')::public.organization_kind;
    full_name_input := nullif(trim(account.raw_user_meta_data->>'full_name'), '');
    phone_input := nullif(regexp_replace(account.raw_user_meta_data->>'phone_e164', '[()[:space:]-]', '', 'g'), '');
    if phone_input ~ '^[0-9]{10}$' then phone_input := '+91' || phone_input; end if;
    legal_name_input := nullif(trim(account.raw_user_meta_data->>'legal_business_name'), '');
    display_name_input := coalesce(nullif(trim(account.raw_user_meta_data->>'trading_name'), ''), legal_name_input);
    gstin_input := nullif(upper(trim(account.raw_user_meta_data->>'gstin')), '');
    business_type_input := nullif(trim(account.raw_user_meta_data->>'business_type'), '');
    pan_last4_input := nullif(upper(trim(account.raw_user_meta_data->>'pan_last4')), '');
    cin_or_llpin_input := nullif(upper(trim(account.raw_user_meta_data->>'cin_or_llpin')), '');
    udyam_input := nullif(upper(trim(account.raw_user_meta_data->>'udyam_registration')), '');
    address_input := account.raw_user_meta_data->'registered_address';

    if full_name_input is null or char_length(full_name_input) not between 2 and 120
      or phone_input is null or phone_input !~ '^\+[1-9][0-9]{7,14}$'
      or legal_name_input is null or char_length(legal_name_input) not between 2 and 200
      or display_name_input is null or char_length(display_name_input) not between 2 and 120
      or business_type_input is null
      or (gstin_input is not null and gstin_input !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$')
      or (pan_last4_input is not null and pan_last4_input !~ '^[A-Z0-9]{4}$')
      or (cin_or_llpin_input is not null and cin_or_llpin_input !~ '^[A-Z0-9-]{4,21}$')
      or (udyam_input is not null and udyam_input !~ '^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$')
      or jsonb_typeof(address_input) <> 'object'
      or char_length(trim(coalesce(address_input->>'address_line', ''))) < 5
      or char_length(trim(coalesce(address_input->>'city', ''))) < 2
      or char_length(trim(coalesce(address_input->>'state', ''))) < 2
      or coalesce(address_input->>'pin_code', '') !~ '^[0-9]{6}$'
    then
      continue;
    end if;

    insert into public.profiles(id, full_name, phone_e164)
    values(account.id, full_name_input, phone_input)
    on conflict (id) do update set
      full_name = excluded.full_name,
      phone_e164 = excluded.phone_e164,
      updated_at = now();

    insert into public.organizations(legal_name, display_name, kind, gstin)
    values(legal_name_input, display_name_input, requested_kind, gstin_input::citext)
    returning id into organization_id;

    insert into public.organization_members(organization_id, user_id, role)
    values(organization_id, account.id, 'owner');

    insert into public.verification_cases(
      organization_id, business_type, pan_last4, cin_or_llpin,
      udyam_registration, registered_address, operating_address
    ) values(
      organization_id, business_type_input, pan_last4_input, cin_or_llpin_input,
      udyam_input, address_input,
      coalesce(account.raw_user_meta_data->'operating_address', address_input)
    );

    insert into public.audit_events(organization_id, actor_id, action, entity_type, entity_id, metadata)
    values(
      organization_id, account.id, 'organization.backfilled', 'organization', organization_id,
      jsonb_build_object('source', 'legacy_signup_metadata')
    );
  end loop;
end;
$$;

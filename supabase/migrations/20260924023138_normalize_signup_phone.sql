-- Accept common Indian national formats and E.164 while storing E.164 only.
-- Invalid numbers remain rejected by the signup trigger.
create or replace function private.normalize_signup_phone(raw_phone text)
returns text language sql immutable strict set search_path = pg_catalog as $$
  with cleaned as (
    select regexp_replace(raw_phone, '[()[:space:]-]', '', 'g') as value
  )
  select case
    when value ~ '^[6-9][0-9]{9}$' then '+91' || value
    when value ~ '^91[6-9][0-9]{9}$' then '+' || value
    when value ~ '^0[6-9][0-9]{9}$' then '+91' || substring(value from 2)
    when value ~ '^[+][1-9][0-9]{7,14}$' then value
    else null
  end
  from cleaned;
$$;
revoke all on function private.normalize_signup_phone(text) from public;

create or replace function private.create_profile_for_user()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare organization_id uuid;
declare requested_kind public.organization_kind;
declare requested_kind_text text;
declare legal_name_input text;
declare display_name_input text;
declare full_name_input text;
declare phone_input text;
declare gstin_input text;
declare business_type_input text;
declare pan_last4_input text;
declare cin_or_llpin_input text;
declare udyam_input text;
declare address_input jsonb;
begin
  full_name_input := nullif(trim(new.raw_user_meta_data->>'full_name'),'');
  phone_input := private.normalize_signup_phone(new.raw_user_meta_data->>'phone_e164');
  requested_kind_text := nullif(new.raw_user_meta_data->>'requested_workspace','');
  insert into public.profiles(id,full_name,phone_e164) values(new.id,full_name_input,phone_input);
  if requested_kind_text is null then return new; end if;
  if requested_kind_text not in ('buyer','seller') then raise exception 'A buyer or seller workspace is required'; end if;
  requested_kind := requested_kind_text::public.organization_kind;
  legal_name_input := nullif(trim(new.raw_user_meta_data->>'legal_business_name'),'');
  display_name_input := coalesce(nullif(trim(new.raw_user_meta_data->>'trading_name'),''),legal_name_input);
  gstin_input := nullif(upper(trim(new.raw_user_meta_data->>'gstin')),'');
  business_type_input := nullif(trim(new.raw_user_meta_data->>'business_type'),'');
  pan_last4_input := nullif(upper(trim(new.raw_user_meta_data->>'pan_last4')),'');
  cin_or_llpin_input := nullif(upper(trim(new.raw_user_meta_data->>'cin_or_llpin')),'');
  udyam_input := nullif(upper(trim(new.raw_user_meta_data->>'udyam_registration')),'');
  address_input := new.raw_user_meta_data->'registered_address';
  if full_name_input is null or char_length(full_name_input) not between 2 and 120 then raise exception 'Full name must contain 2 to 120 characters'; end if;
  if phone_input is null or phone_input !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'A valid international mobile number is required'; end if;
  if legal_name_input is null or char_length(legal_name_input) not between 2 and 200 then raise exception 'Legal business name must contain 2 to 200 characters'; end if;
  if display_name_input is null or char_length(display_name_input) not between 2 and 120 then raise exception 'Trading name must contain 2 to 120 characters'; end if;
  if business_type_input is null then raise exception 'Business type is required'; end if;
  if gstin_input is not null and gstin_input !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$' then raise exception 'Invalid GSTIN format'; end if;
  if pan_last4_input is not null and pan_last4_input !~ '^[A-Z0-9]{4}$' then raise exception 'PAN last four must be four letters or digits'; end if;
  if cin_or_llpin_input is not null and cin_or_llpin_input !~ '^[A-Z0-9-]{4,21}$' then raise exception 'Invalid CIN or LLPIN format'; end if;
  if udyam_input is not null and udyam_input !~ '^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$' then raise exception 'Invalid Udyam registration format'; end if;
  if jsonb_typeof(address_input)<>'object'
    or char_length(trim(coalesce(address_input->>'address_line','')))<5
    or char_length(trim(coalesce(address_input->>'city','')))<2
    or char_length(trim(coalesce(address_input->>'state','')))<2
    or coalesce(address_input->>'pin_code','') !~ '^[0-9]{6}$'
  then raise exception 'A complete Indian registered address is required'; end if;
  insert into public.organizations(legal_name,display_name,kind,gstin)
  values(legal_name_input,display_name_input,requested_kind,gstin_input::citext)
  returning id into organization_id;
  insert into public.organization_members(organization_id,user_id,role) values(organization_id,new.id,'owner');
  insert into public.verification_cases(organization_id,business_type,pan_last4,cin_or_llpin,udyam_registration,registered_address,operating_address)
  values(organization_id,business_type_input,pan_last4_input,cin_or_llpin_input,udyam_input,address_input,coalesce(new.raw_user_meta_data->'operating_address',address_input));
  insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id)
  values(organization_id,new.id,'organization.created','organization',organization_id);
  return new;
end;
$$;

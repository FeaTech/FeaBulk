create or replace function public.update_seller_business_profile_command(
  organization_id_input uuid,
  payload jsonb,
  idempotency_key_input uuid
)
returns public.organizations
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare updated_organization public.organizations;
declare existing_response jsonb;
declare current_status public.verification_status;
begin
  if (select auth.uid()) is null
    or not private.has_any_role(
      organization_id_input,
      array['owner', 'administrator']::public.organization_role[]
    )
  then
    raise exception 'Business profile access denied';
  end if;

  if not exists (
    select 1 from public.organizations
    where id = organization_id_input and kind in ('seller', 'both')
  ) then
    raise exception 'Seller organization not found';
  end if;

  select response into existing_response
  from public.command_requests
  where idempotency_key = idempotency_key_input and actor_id = (select auth.uid());
  if found then
    return (select jsonb_populate_record(null::public.organizations, existing_response));
  end if;

  select status into current_status
  from public.verification_cases
  where organization_id = organization_id_input;

  if payload ? 'registration'
    and current_status is not null
    and current_status not in ('draft', 'rejected', 'resubmission_required', 'expired')
  then
    raise exception 'Registration details are locked during verification';
  end if;

  if char_length(trim(coalesce(payload ->> 'legal_name', ''))) not between 2 and 200
    or char_length(trim(coalesce(payload ->> 'display_name', ''))) not between 2 and 120
  then
    raise exception 'Business names are invalid';
  end if;

  if coalesce(trim(payload ->> 'gstin'), '') <> ''
    and upper(trim(payload ->> 'gstin')) !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$'
  then
    raise exception 'GSTIN is invalid';
  end if;

  if payload ? 'registration' then
    if coalesce(trim(payload #>> '{registration,business_type}'), '') = ''
      or coalesce(trim(payload #>> '{registration,pan_last4}'), '') !~ '^([A-Za-z0-9]{4})?$'
      or coalesce(trim(payload #>> '{registration,cin_or_llpin}'), '') !~ '^([A-Za-z0-9-]{4,21})?$'
      or coalesce(trim(payload #>> '{registration,udyam_registration}'), '') !~* '^(UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7})?$'
    then
      raise exception 'Registration details are invalid';
    end if;
    if jsonb_typeof(payload #> '{registration,registered_address}') <> 'object'
      or char_length(trim(coalesce(payload #>> '{registration,registered_address,address_line}', ''))) < 5
      or char_length(trim(coalesce(payload #>> '{registration,registered_address,city}', ''))) < 2
      or char_length(trim(coalesce(payload #>> '{registration,registered_address,state}', ''))) < 2
      or coalesce(payload #>> '{registration,registered_address,pin_code}', '') !~ '^[0-9]{6}$'
    then
      raise exception 'A complete Indian registered address is required';
    end if;
    if payload #> '{registration,operating_address}' is not null and (
      jsonb_typeof(payload #> '{registration,operating_address}') <> 'object'
      or char_length(trim(coalesce(payload #>> '{registration,operating_address,address_line}', ''))) < 5
      or char_length(trim(coalesce(payload #>> '{registration,operating_address,city}', ''))) < 2
      or char_length(trim(coalesce(payload #>> '{registration,operating_address,state}', ''))) < 2
      or coalesce(payload #>> '{registration,operating_address,pin_code}', '') !~ '^[0-9]{6}$'
    ) then
      raise exception 'A complete operating address is required';
    end if;
  end if;

  insert into public.command_requests (idempotency_key, actor_id, action)
  values (idempotency_key_input, (select auth.uid()), 'seller_profile.update');

  update public.organizations set
    legal_name = trim(payload ->> 'legal_name'),
    display_name = trim(payload ->> 'display_name'),
    gstin = nullif(upper(trim(payload ->> 'gstin')), '')::citext
  where id = organization_id_input
  returning * into updated_organization;

  if payload ? 'registration' then
    insert into public.verification_cases (organization_id)
    values (organization_id_input)
    on conflict (organization_id) do nothing;

    update public.verification_cases set
      business_type = nullif(trim(payload #>> '{registration,business_type}'), ''),
      pan_last4 = nullif(upper(trim(payload #>> '{registration,pan_last4}')), ''),
      cin_or_llpin = nullif(upper(trim(payload #>> '{registration,cin_or_llpin}')), ''),
      udyam_registration = nullif(upper(trim(payload #>> '{registration,udyam_registration}')), ''),
      registered_address = coalesce(payload #> '{registration,registered_address}', '{}'::jsonb),
      operating_address = coalesce(
        payload #> '{registration,operating_address}',
        payload #> '{registration,registered_address}',
        '{}'::jsonb
      )
    where organization_id = organization_id_input;
  end if;

  update public.command_requests
  set response = to_jsonb(updated_organization)
  where idempotency_key = idempotency_key_input;

  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id)
  values (
    organization_id_input,
    (select auth.uid()),
    'seller_profile.updated',
    'organization',
    organization_id_input
  );

  return updated_organization;
exception when unique_violation then
  select response into existing_response
  from public.command_requests
  where idempotency_key = idempotency_key_input and actor_id = (select auth.uid());
  if existing_response is not null then
    return (select jsonb_populate_record(null::public.organizations, existing_response));
  end if;
  raise;
end;
$$;

revoke all on function public.update_seller_business_profile_command(uuid, jsonb, uuid) from public;
grant execute on function public.update_seller_business_profile_command(uuid, jsonb, uuid) to authenticated;

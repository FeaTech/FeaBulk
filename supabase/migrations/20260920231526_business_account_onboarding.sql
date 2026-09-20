-- Self-service users can only create buyer or seller organizations. Platform
-- operations roles are assigned through the controlled operations workflow.
create or replace function private.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare organization_id uuid;
declare requested_kind public.organization_kind;
declare legal_name_input text;
declare display_name_input text;
begin
  insert into public.profiles (id, full_name, phone_e164)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(new.raw_user_meta_data ->> 'phone_e164'), ''));

  requested_kind := nullif(new.raw_user_meta_data ->> 'requested_workspace', '')::public.organization_kind;
  legal_name_input := nullif(trim(new.raw_user_meta_data ->> 'legal_business_name'), '');
  display_name_input := coalesce(nullif(trim(new.raw_user_meta_data ->> 'trading_name'), ''), legal_name_input);
  if requested_kind not in ('buyer', 'seller') or legal_name_input is null then
    return new;
  end if;

  insert into public.organizations (legal_name, display_name, kind, gstin)
  values (legal_name_input, display_name_input, requested_kind, nullif(upper(trim(new.raw_user_meta_data ->> 'gstin')), '')::citext)
  returning id into organization_id;
  insert into public.organization_members (organization_id, user_id, role)
  values (organization_id, new.id, 'owner');
  insert into public.verification_cases (organization_id, business_type, registered_address, operating_address)
  values (
    organization_id,
    nullif(trim(new.raw_user_meta_data ->> 'business_type'), ''),
    coalesce(new.raw_user_meta_data -> 'registered_address', '{}'::jsonb),
    coalesce(new.raw_user_meta_data -> 'operating_address', new.raw_user_meta_data -> 'registered_address', '{}'::jsonb)
  );
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id)
  values (organization_id, new.id, 'organization.created', 'organization', organization_id);
  return new;
end;
$$;

create or replace function public.complete_order_inspection_command(order_id_input uuid)
 returns orders
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
declare target public.orders;
begin
  select * into target from public.orders where id=order_id_input for update;
  if not found then raise exception 'Order not found'; end if;
  if not private.has_any_role(target.buyer_organization_id,array['owner','administrator','procurement_manager','purchase_approver']::public.organization_role[]) then raise exception 'Inspection access denied'; end if;
  if target.status='delivered' then
    update public.orders set status='inspection' where id=target.id returning * into target;
  elsif target.status='inspection' then
    update public.orders set status='completed' where id=target.id returning * into target;
  else raise exception 'Inspection cannot be completed yet';
  end if;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (target.buyer_organization_id,(select auth.uid()),'order.inspection_updated','order',target.id,jsonb_build_object('status',target.status));
  return target;
end;
$function$;

create or replace function public.create_business_organization_command(legal_name_input text, display_name_input text, kind_input organization_kind, gstin_input text default null::text, business_type_input text default null::text, address_input jsonb default null::jsonb)
 returns organizations
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
declare created_organization public.organizations;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if kind_input not in ('buyer', 'seller', 'both') then raise exception 'Invalid business type'; end if;
  if char_length(trim(legal_name_input)) < 2 or char_length(trim(display_name_input)) < 2 then raise exception 'Business name is required'; end if;
  insert into public.profiles (id) values ((select auth.uid())) on conflict (id) do nothing;
  insert into public.organizations (legal_name, display_name, kind, gstin)
  values (trim(legal_name_input), trim(display_name_input), kind_input, nullif(upper(trim(gstin_input)), '')::citext)
  returning * into created_organization;
  insert into public.organization_members (organization_id, user_id, role)
  values (created_organization.id, (select auth.uid()), 'owner');
  insert into public.verification_cases (organization_id, business_type, registered_address, operating_address)
  values (created_organization.id, nullif(trim(business_type_input), ''), address_input, address_input);
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id)
  values (created_organization.id, (select auth.uid()), 'organization.created', 'organization', created_organization.id);
  return created_organization;
end;
$function$;

revoke execute on function public.complete_order_inspection_command(uuid) from anon, public;
revoke execute on function public.create_business_organization_command(text, text, organization_kind, text, text, jsonb) from anon, public;
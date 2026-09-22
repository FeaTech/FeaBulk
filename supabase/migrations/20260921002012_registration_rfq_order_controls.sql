-- Complete the first buyer/seller command path and close unsafe transitions.
create sequence if not exists public.order_number_sequence;

create or replace function public.create_business_organization_command(
  legal_name_input text, display_name_input text, kind_input public.organization_kind,
  gstin_input text default null, business_type_input text default null, address_input jsonb default null
)
returns public.organizations language plpgsql security definer set search_path = public, private, pg_temp as $$
declare created_organization public.organizations;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if kind_input not in ('buyer', 'seller', 'both') then raise exception 'Invalid business type'; end if;
  if char_length(trim(legal_name_input)) < 2 or char_length(trim(display_name_input)) < 2 then raise exception 'Business name is required'; end if;
  if gstin_input is not null and gstin_input <> '' and upper(trim(gstin_input)) !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$' then raise exception 'Invalid GSTIN format'; end if;
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
$$;
revoke all on function public.create_business_organization_command(text, text, public.organization_kind, text, text, jsonb) from public;
grant execute on function public.create_business_organization_command(text, text, public.organization_kind, text, text, jsonb) to authenticated;

create or replace function public.publish_rfq_command(rfq_id_input uuid)
returns public.rfqs language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.rfqs;
begin
  select * into target from public.rfqs where id = rfq_id_input for update;
  if not found then raise exception 'RFQ not found'; end if;
  if not private.has_any_role(target.buyer_organization_id, array['owner','administrator','procurement_manager']::public.organization_role[]) then raise exception 'RFQ access denied'; end if;
  if target.status <> 'draft' then raise exception 'Only draft RFQs can be published'; end if;
  if target.quote_deadline is null or target.quote_deadline <= now() then raise exception 'A future quote deadline is required'; end if;
  if not exists (select 1 from public.organizations o where o.id = target.buyer_organization_id and o.status = 'verified') then raise exception 'Business verification is required'; end if;
  update public.rfqs set status = 'published' where id = rfq_id_input returning * into target;
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id)
  values (target.buyer_organization_id, (select auth.uid()), 'rfq.published', 'rfq', target.id);
  insert into public.outbox_events (aggregate_type, aggregate_id, event_type, payload)
  values ('rfq', target.id, 'rfq.published', jsonb_build_object('rfq_id', target.id, 'category_id', target.category_id));
  return target;
end;
$$;
revoke all on function public.publish_rfq_command(uuid) from public;
grant execute on function public.publish_rfq_command(uuid) to authenticated;

create or replace function public.add_product_price_tier_command(product_id_input uuid, minimum_quantity_input bigint, maximum_quantity_input bigint, unit_price_input numeric)
returns public.product_price_tiers language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.products;
declare tier public.product_price_tiers;
begin
  select * into target from public.products where id = product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(target.organization_id, array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if target.listing_status <> 'draft' then raise exception 'Price tiers can only be changed while the listing is a draft'; end if;
  if minimum_quantity_input < target.minimum_order_quantity or maximum_quantity_input < minimum_quantity_input or unit_price_input <= 0 then raise exception 'Invalid price tier'; end if;
  insert into public.product_price_tiers (product_id, minimum_quantity, maximum_quantity, unit_price)
  values (product_id_input, minimum_quantity_input, maximum_quantity_input, unit_price_input) returning * into tier;
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id)
  values (target.organization_id, (select auth.uid()), 'product.price_tier_added', 'product', target.id);
  return tier;
end;
$$;
revoke all on function public.add_product_price_tier_command(uuid, bigint, bigint, numeric) from public;
grant execute on function public.add_product_price_tier_command(uuid, bigint, bigint, numeric) to authenticated;

create or replace function private.check_quote_submission()
returns trigger language plpgsql security invoker set search_path = public, private, pg_temp as $$
declare seller_id uuid;
declare deadline timestamptz;
begin
  select q.seller_organization_id, r.quote_deadline into seller_id, deadline
  from public.rfq_quotes q join public.rfqs r on r.id = q.rfq_id where q.id = new.quote_id;
  if not exists (select 1 from public.organizations o where o.id = seller_id and o.status = 'verified') then raise exception 'Seller verification is required'; end if;
  if deadline is not null and deadline < now() then raise exception 'RFQ quote deadline has passed'; end if;
  return new;
end;
$$;
create trigger quote_submission_checked before insert on public.quote_versions
for each row execute function private.check_quote_submission();

create or replace function public.accept_quote_command(quote_id_input uuid)
returns public.orders language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target_quote public.rfq_quotes;
declare target_rfq public.rfqs;
declare accepted_version public.quote_versions;
declare created_order public.orders;
declare taxable numeric(14,2);
begin
  select * into target_quote from public.rfq_quotes where id = quote_id_input for update;
  if not found then raise exception 'Quote not found'; end if;
  select * into target_rfq from public.rfqs where id = target_quote.rfq_id for update;
  if not private.has_any_role(target_rfq.buyer_organization_id, array['owner','administrator','purchase_approver']::public.organization_role[]) then raise exception 'Quote approval access denied'; end if;
  if target_rfq.status not in ('receiving_quotes','evaluation','negotiation') or target_quote.status not in ('submitted','revised') then raise exception 'Quote cannot be accepted in its current state'; end if;
  select * into accepted_version from public.quote_versions where quote_id = quote_id_input and version = target_quote.current_version;
  if not found or accepted_version.validity_ends_at <= now() then raise exception 'Quote has expired'; end if;
  taxable := accepted_version.unit_price * accepted_version.quantity;
  if accepted_version.discount_amount > taxable then raise exception 'Discount exceeds taxable value'; end if;
  insert into public.orders (
    order_number,buyer_organization_id,seller_organization_id,rfq_id,quote_id,status,
    taxable_amount,gst_amount,freight_amount,additional_charge_amount,discount_amount,delivery_address,created_by
  ) values (
    'FEA-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.order_number_sequence')::text,8,'0'),
    target_rfq.buyer_organization_id,target_quote.seller_organization_id,target_rfq.id,target_quote.id,'awaiting_seller_confirmation',
    taxable,round((taxable-accepted_version.discount_amount)*accepted_version.gst_rate/100,2),
    accepted_version.shipping_charge,accepted_version.additional_charges,accepted_version.discount_amount,target_rfq.delivery_address,(select auth.uid())
  ) returning * into created_order;
  insert into public.order_lines (order_id,product_id,description,quantity,unit_of_measure,unit_price,gst_rate)
  values (created_order.id,target_rfq.product_id,target_rfq.title,accepted_version.quantity,target_rfq.unit_of_measure,accepted_version.unit_price,accepted_version.gst_rate);
  update public.rfq_quotes set status = 'accepted', accepted_at = now() where id = target_quote.id;
  update public.rfqs set status = 'awarded' where id = target_rfq.id;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (target_rfq.buyer_organization_id,(select auth.uid()),'quote.accepted','order',created_order.id,jsonb_build_object('quote_id',target_quote.id,'version',accepted_version.version));
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload)
  values ('order',created_order.id,'order.created',jsonb_build_object('order_id',created_order.id,'quote_id',target_quote.id));
  return created_order;
end;
$$;
revoke all on function public.accept_quote_command(uuid) from public;
grant execute on function public.accept_quote_command(uuid) to authenticated;

-- An order can only be advanced by the party responsible for that milestone.
create or replace function public.transition_order_command(order_id_input uuid, next_state public.order_status, request_id_input uuid default null)
returns public.orders language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.orders;
declare allowed boolean;
begin
  select * into target from public.orders where id = order_id_input for update;
  if not found then raise exception 'Order not found'; end if;
  if not private.assert_order_transition(target.status,next_state) then raise exception 'Invalid order transition'; end if;
  allowed := case
    when next_state in ('awaiting_payment','processing','ready_to_ship','shipped','partially_fulfilled')
      then private.has_any_role(target.seller_organization_id,array['owner','administrator','sales_manager','warehouse_operator']::public.organization_role[])
    when next_state in ('delivered','inspection','completed','disputed')
      then private.has_any_role(target.buyer_organization_id,array['owner','administrator','procurement_manager','purchase_approver']::public.organization_role[])
    when next_state = 'cancelled'
      then private.has_any_role(target.buyer_organization_id,array['owner','administrator','procurement_manager']::public.organization_role[])
    else false end;
  if not allowed then raise exception 'Order transition access denied'; end if;
  if next_state = 'payment_secured' then raise exception 'Payment secured only by verified provider events'; end if;
  if next_state = 'shipped' and not exists (select 1 from public.shipments s where s.order_id = target.id and s.status in ('dispatched','in_transit')) then raise exception 'Dispatch evidence is required'; end if;
  if next_state = 'completed' and (target.inspection_ends_at is null or target.inspection_ends_at > now()) then raise exception 'Inspection period is still open'; end if;
  return private.transition_order(order_id_input,next_state,request_id_input);
end;
$$;
revoke all on function public.transition_order_command(uuid,public.order_status,uuid) from public;
grant execute on function public.transition_order_command(uuid,public.order_status,uuid) to authenticated;

create or replace function private.assert_order_transition(current_state public.order_status, next_state public.order_status)
returns boolean language sql immutable security invoker set search_path = public, pg_temp as $$
  select (current_state,next_state) in (
    ('draft'::public.order_status,'awaiting_seller_confirmation'::public.order_status),
    ('awaiting_seller_confirmation'::public.order_status,'awaiting_payment'::public.order_status),
    ('awaiting_seller_confirmation'::public.order_status,'cancelled'::public.order_status),
    ('awaiting_payment'::public.order_status,'cancelled'::public.order_status),
    ('payment_secured'::public.order_status,'processing'::public.order_status),
    ('processing'::public.order_status,'ready_to_ship'::public.order_status),
    ('ready_to_ship'::public.order_status,'shipped'::public.order_status),
    ('shipped'::public.order_status,'delivered'::public.order_status),
    ('delivered'::public.order_status,'inspection'::public.order_status),
    ('inspection'::public.order_status,'completed'::public.order_status),
    ('delivered'::public.order_status,'disputed'::public.order_status),
    ('inspection'::public.order_status,'disputed'::public.order_status)
  );
$$;

-- Partial payment must never set the whole order to secured.
create or replace function private.apply_verified_payment_capture()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target_order public.orders;
begin
  if new.status <> 'captured' or old.status = 'captured' or new.webhook_event_id is null then return new; end if;
  select * into target_order from public.orders where id = new.order_id for update;
  if not found or target_order.status <> 'awaiting_payment' then raise exception 'Payment capture cannot be applied to this order'; end if;
  if new.amount <> target_order.grand_total then raise exception 'Full order amount is required for payment security'; end if;
  update public.orders set status = 'payment_secured' where id = target_order.id;
  insert into public.ledger_entries (transaction_id,order_id,organization_id,account_code,debit,credit,event_key)
  values (new.id,target_order.id,target_order.buyer_organization_id,'buyer_funds_secured',new.amount,0,new.webhook_event_id),
         (new.id,target_order.id,null,'platform_clearing',0,new.amount,new.webhook_event_id);
  insert into public.audit_events (organization_id,action,entity_type,entity_id,metadata)
  values (target_order.buyer_organization_id,'payment.captured','payment_transaction',new.id,jsonb_build_object('order_id',target_order.id));
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload)
  values ('payment_transaction',new.id,'payment.captured',jsonb_build_object('transaction_id',new.id,'order_id',target_order.id));
  return new;
end;
$$;

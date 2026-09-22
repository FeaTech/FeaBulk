alter table public.shipments add column request_id uuid unique;
alter table public.disputes add column request_id uuid unique;

create or replace function public.create_shipment_command(
  order_id_input uuid, shipping_mode_input text, freight_type_input text,
  carrier_input text, tracking_number_input text, estimated_delivery_input timestamptz,
  lines_input jsonb, request_id_input uuid
)
returns public.shipments language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target_order public.orders;
declare shipment public.shipments;
declare item jsonb;
declare target_line public.order_lines;
declare requested bigint;
declare already_shipped bigint;
begin
  if request_id_input is null then raise exception 'Request ID is required'; end if;
  select * into shipment from public.shipments where request_id = request_id_input;
  if found then return shipment; end if;
  select * into target_order from public.orders where id = order_id_input for update;
  if not found then raise exception 'Order not found'; end if;
  if not private.has_any_role(target_order.seller_organization_id,array['owner','administrator','sales_manager','warehouse_operator']::public.organization_role[]) then raise exception 'Fulfilment access denied'; end if;
  if target_order.status not in ('ready_to_ship','partially_fulfilled') then raise exception 'Order is not ready for shipment'; end if;
  if shipping_mode_input not in ('seller_arranged','buyer_pickup','platform_logistics') or freight_type_input not in ('parcel','carton','pallet','ltl','ftl','ocean','air') then raise exception 'Invalid shipping mode or freight type'; end if;
  if trim(coalesce(carrier_input,'')) = '' or trim(coalesce(tracking_number_input,'')) = '' then raise exception 'Carrier and tracking number are required'; end if;
  if jsonb_typeof(lines_input) <> 'array' or jsonb_array_length(lines_input) = 0 then raise exception 'At least one shipment line is required'; end if;
  insert into public.shipments (order_id,seller_organization_id,status,shipping_mode,freight_type,carrier,tracking_number,estimated_delivery_at,request_id)
  values (target_order.id,target_order.seller_organization_id,'ready',shipping_mode_input,freight_type_input,trim(carrier_input),trim(tracking_number_input),estimated_delivery_input,request_id_input)
  returning * into shipment;
  for item in select * from jsonb_array_elements(lines_input) loop
    requested := (item->>'quantity')::bigint;
    select * into target_line from public.order_lines where id = (item->>'order_line_id')::uuid and order_id = target_order.id for update;
    if not found or requested <= 0 then raise exception 'Invalid shipment line'; end if;
    select coalesce(sum(sl.quantity_shipped),0) into already_shipped
    from public.shipment_lines sl join public.shipments s on s.id = sl.shipment_id
    where sl.order_line_id = target_line.id and s.status <> 'cancelled';
    if already_shipped + requested > target_line.quantity then raise exception 'Shipment quantity exceeds remaining order quantity'; end if;
    insert into public.shipment_lines (shipment_id,order_line_id,quantity_shipped)
    values (shipment.id,target_line.id,requested);
  end loop;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,request_id)
  values (target_order.seller_organization_id,(select auth.uid()),'shipment.created','shipment',shipment.id,request_id_input);
  return shipment;
end;
$$;
revoke all on function public.create_shipment_command(uuid,text,text,text,text,timestamptz,jsonb,uuid) from public;
grant execute on function public.create_shipment_command(uuid,text,text,text,text,timestamptz,jsonb,uuid) to authenticated;

create or replace function public.dispatch_shipment_command(shipment_id_input uuid)
returns public.shipments language plpgsql security definer set search_path = public, private, pg_temp as $$
declare shipment public.shipments;
declare target_order public.orders;
declare fully_shipped boolean;
begin
  select * into shipment from public.shipments where id = shipment_id_input for update;
  if not found then raise exception 'Shipment not found'; end if;
  select * into target_order from public.orders where id = shipment.order_id for update;
  if not private.has_any_role(shipment.seller_organization_id,array['owner','administrator','sales_manager','warehouse_operator']::public.organization_role[]) then raise exception 'Fulfilment access denied'; end if;
  if shipment.status <> 'ready' then raise exception 'Shipment is not ready to dispatch'; end if;
  update public.shipments set status='dispatched',dispatched_at=now() where id=shipment.id returning * into shipment;
  select not exists (
    select 1 from public.order_lines ol
    where ol.order_id = target_order.id and ol.quantity > (
      select coalesce(sum(sl.quantity_shipped),0)
      from public.shipment_lines sl join public.shipments s on s.id=sl.shipment_id
      where sl.order_line_id=ol.id and s.status in ('dispatched','in_transit','delivered')
    )
  ) into fully_shipped;
  update public.orders set status = case when fully_shipped then 'shipped'::public.order_status else 'partially_fulfilled'::public.order_status end where id=target_order.id;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id)
  values (shipment.seller_organization_id,(select auth.uid()),'shipment.dispatched','shipment',shipment.id);
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload)
  values ('shipment',shipment.id,'shipment.dispatched',jsonb_build_object('shipment_id',shipment.id,'order_id',target_order.id));
  return shipment;
end;
$$;
revoke all on function public.dispatch_shipment_command(uuid) from public;
grant execute on function public.dispatch_shipment_command(uuid) to authenticated;

create or replace function public.confirm_shipment_delivery_command(shipment_id_input uuid)
returns public.shipments language plpgsql security definer set search_path = public, private, pg_temp as $$
declare shipment public.shipments;
declare target_order public.orders;
declare all_delivered boolean;
begin
  select * into shipment from public.shipments where id=shipment_id_input for update;
  if not found then raise exception 'Shipment not found'; end if;
  select * into target_order from public.orders where id=shipment.order_id for update;
  if not private.has_any_role(target_order.buyer_organization_id,array['owner','administrator','procurement_manager','purchase_approver']::public.organization_role[]) then raise exception 'Delivery confirmation access denied'; end if;
  if shipment.status not in ('dispatched','in_transit') then raise exception 'Shipment is not in transit'; end if;
  update public.shipments set status='delivered',delivered_at=now() where id=shipment.id returning * into shipment;
  select not exists (select 1 from public.shipments where order_id=target_order.id and status <> 'delivered') into all_delivered;
  if all_delivered then update public.orders set status='delivered',inspection_ends_at=now()+interval '2 days' where id=target_order.id; end if;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id)
  values (target_order.buyer_organization_id,(select auth.uid()),'shipment.delivery_confirmed','shipment',shipment.id);
  return shipment;
end;
$$;
revoke all on function public.confirm_shipment_delivery_command(uuid) from public;
grant execute on function public.confirm_shipment_delivery_command(uuid) to authenticated;

create or replace function public.open_dispute_command(order_id_input uuid, organization_id_input uuid, type_input text, description_input text, request_id_input uuid)
returns public.disputes language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target_order public.orders;
declare created public.disputes;
begin
  if request_id_input is null then raise exception 'Request ID is required'; end if;
  select * into created from public.disputes where request_id=request_id_input;
  if found then return created; end if;
  select * into target_order from public.orders where id=order_id_input for update;
  if not found then raise exception 'Order not found'; end if;
  if organization_id_input not in (target_order.buyer_organization_id,target_order.seller_organization_id) or not private.is_member(organization_id_input) then raise exception 'Dispute access denied'; end if;
  if target_order.status not in ('shipped','delivered','inspection') then raise exception 'Order cannot be disputed in its current state'; end if;
  if type_input not in ('missing_quantity','damaged_goods','wrong_specifications','quality_failure','late_shipment','non_delivery','invoice_or_payment','other') then raise exception 'Invalid dispute type'; end if;
  insert into public.disputes (order_id,opened_by_organization_id,type,description,request_id)
  values (target_order.id,organization_id_input,type_input,trim(description_input),request_id_input) returning * into created;
  update public.orders set status='disputed' where id=target_order.id;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,request_id)
  values (organization_id_input,(select auth.uid()),'dispute.opened','dispute',created.id,request_id_input);
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload)
  values ('dispute',created.id,'dispute.opened',jsonb_build_object('dispute_id',created.id,'order_id',target_order.id));
  return created;
end;
$$;
revoke all on function public.open_dispute_command(uuid,uuid,text,text,uuid) from public;
grant execute on function public.open_dispute_command(uuid,uuid,text,text,uuid) to authenticated;

create or replace function public.complete_order_inspection_command(order_id_input uuid)
returns public.orders language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.orders;
begin
  select * into target from public.orders where id=order_id_input for update;
  if not found then raise exception 'Order not found'; end if;
  if not private.has_any_role(target.buyer_organization_id,array['owner','administrator','procurement_manager','purchase_approver']::public.organization_role[]) then raise exception 'Inspection access denied'; end if;
  if target.status='delivered' then
    update public.orders set status='inspection' where id=target.id returning * into target;
  elsif target.status='inspection' and target.inspection_ends_at <= now() then
    update public.orders set status='completed' where id=target.id returning * into target;
  else raise exception 'Inspection cannot be completed yet';
  end if;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (target.buyer_organization_id,(select auth.uid()),'order.inspection_updated','order',target.id,jsonb_build_object('status',target.status));
  return target;
end;
$$;
revoke all on function public.complete_order_inspection_command(uuid) from public;
grant execute on function public.complete_order_inspection_command(uuid) to authenticated;

create or replace function public.create_review_command(order_id_input uuid, rating_input smallint, body_input text)
returns public.reviews language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.orders;
declare created public.reviews;
begin
  select * into target from public.orders where id=order_id_input;
  if not found or target.status <> 'completed' then raise exception 'Only completed orders can be reviewed'; end if;
  if not private.is_member(target.buyer_organization_id) then raise exception 'Review access denied'; end if;
  if rating_input not between 1 and 5 then raise exception 'Rating must be 1 to 5'; end if;
  insert into public.reviews (order_id,buyer_organization_id,seller_organization_id,rating,body,created_by)
  values (target.id,target.buyer_organization_id,target.seller_organization_id,rating_input,nullif(trim(body_input),''),(select auth.uid()))
  returning * into created;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id)
  values (target.buyer_organization_id,(select auth.uid()),'review.created','review',created.id);
  return created;
end;
$$;
revoke all on function public.create_review_command(uuid,smallint,text) from public;
grant execute on function public.create_review_command(uuid,smallint,text) to authenticated;

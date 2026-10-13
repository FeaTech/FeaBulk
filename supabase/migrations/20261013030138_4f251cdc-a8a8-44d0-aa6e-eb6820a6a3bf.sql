create or replace function public.place_direct_order_command(product_id_input uuid, buyer_organization_id_input uuid, quantity_input bigint, delivery_address_input jsonb)
returns public.orders language plpgsql security definer set search_path = public, private, pg_temp as $$
declare p public.products;
declare price numeric(14,2);
declare taxable numeric(14,2);
declare gst numeric(5,2);
declare created_order public.orders;
begin
  if (select auth.uid()) is null then raise exception 'Sign in to place an order'; end if;
  if not private.has_any_role(buyer_organization_id_input, array['owner','administrator']::public.organization_role[]) then raise exception 'You cannot order for this business'; end if;
  if not exists (select 1 from public.organizations o where o.id = buyer_organization_id_input and o.kind::text = 'buyer') then raise exception 'Only buyer accounts can place orders'; end if;
  select * into p from public.products where id = product_id_input for update;
  if not found or p.listing_status::text <> 'active' or p.moderation_status::text <> 'approved' then raise exception 'This product is not available'; end if;
  if p.organization_id = buyer_organization_id_input then raise exception 'You cannot buy your own product'; end if;
  if quantity_input is null or quantity_input < p.minimum_order_quantity then raise exception 'Minimum order is % %', p.minimum_order_quantity, p.unit_of_measure; end if;
  if quantity_input > p.available_quantity then raise exception 'Only % % available', p.available_quantity, p.unit_of_measure; end if;
  if coalesce(trim(delivery_address_input->>'address_line'),'') = '' then raise exception 'Delivery address is required'; end if;
  select t.unit_price into price from public.product_price_tiers t
    where t.product_id = p.id and quantity_input between t.minimum_quantity and t.maximum_quantity
    order by t.minimum_quantity desc limit 1;
  if price is null then
    select t.unit_price into price from public.product_price_tiers t where t.product_id = p.id and t.minimum_quantity <= quantity_input order by t.minimum_quantity desc limit 1;
  end if;
  if price is null then raise exception 'This product has no listed price'; end if;
  gst := coalesce(p.gst_rate, 18);
  taxable := price * quantity_input;
  insert into public.orders (order_number,buyer_organization_id,seller_organization_id,status,taxable_amount,gst_amount,delivery_address,created_by)
  values ('FEA-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.order_number_sequence')::text,8,'0'),
    buyer_organization_id_input,p.organization_id,'awaiting_seller_confirmation',taxable,round(taxable*gst/100,2),delivery_address_input,(select auth.uid()))
  returning * into created_order;
  insert into public.order_lines (order_id,product_id,description,seller_sku,hsn_code,quantity,unit_of_measure,unit_price,gst_rate)
  values (created_order.id,p.id,p.name,p.seller_sku,p.hsn_code,quantity_input,p.unit_of_measure,price,gst);
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (buyer_organization_id_input,(select auth.uid()),'order.placed_direct','order',created_order.id,jsonb_build_object('product_id',p.id,'quantity',quantity_input));
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload)
  values ('order',created_order.id,'order.created',jsonb_build_object('order_id',created_order.id,'product_id',p.id));
  return created_order;
end;
$$;
revoke all on function public.place_direct_order_command(uuid,uuid,bigint,jsonb) from public;
grant execute on function public.place_direct_order_command(uuid,uuid,bigint,jsonb) to authenticated;
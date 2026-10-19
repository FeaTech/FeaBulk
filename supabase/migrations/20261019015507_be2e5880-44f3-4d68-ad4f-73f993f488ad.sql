create or replace function public.create_product_sale_command(organization_id_input uuid, payload jsonb, idempotency_key_input uuid, sale_type_input text, sale_settings_input jsonb)
returns public.products language plpgsql security invoker set search_path = public, pg_temp as $$
declare p public.products;
begin
  if sale_type_input not in ('regular','auction') then raise exception 'Choose Regular sale or Auction'; end if;
  p := public.create_product_command(organization_id_input, payload, idempotency_key_input);
  if sale_type_input = 'auction' then
    if not exists (select 1 from public.auctions where product_id = p.id) then perform public.create_auction_command(p.id, sale_settings_input); end if;
  else
    if not exists (select 1 from public.product_price_tiers where product_id = p.id) then
      perform public.add_product_price_tier_command(p.id, p.minimum_order_quantity, greatest(p.available_quantity,p.minimum_order_quantity), (sale_settings_input->>'unit_price')::numeric);
    end if;
  end if;
  return p;
end;
$$;
revoke all on function public.create_product_sale_command(uuid,jsonb,uuid,text,jsonb) from public;
grant execute on function public.create_product_sale_command(uuid,jsonb,uuid,text,jsonb) to authenticated;

create or replace function private.check_price_tier_coverage()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.submitted_for_review_at is not null and old.submitted_for_review_at is null
    and not exists (select 1 from public.auctions where product_id = new.id and status = 'scheduled')
    and not exists (select 1 from public.product_price_tiers t where t.product_id = new.id and t.minimum_quantity <= new.minimum_order_quantity and t.maximum_quantity >= new.minimum_order_quantity) then
    raise exception 'A price tier must cover the minimum order quantity';
  end if;
  return new;
end;
$$;

create or replace function public.submit_product_for_review_command(product_id_input uuid)
returns public.products language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.products;
begin
  select * into target from public.products where id = product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(target.organization_id,array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if target.listing_status <> 'draft' or target.moderation_status <> 'pending' or target.submitted_for_review_at is not null then raise exception 'Product is not a draft pending review'; end if;
  if not exists (select 1 from public.product_price_tiers where product_id = target.id)
    and not exists (select 1 from public.auctions where product_id = target.id and status = 'scheduled') then raise exception 'Regular pricing or an auction is required'; end if;
  if not exists (select 1 from public.organizations where id = target.organization_id and status = 'verified') then raise exception 'Seller verification is required'; end if;
  update public.products set submitted_for_review_at = now() where id = target.id returning * into target;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id) values (target.organization_id,(select auth.uid()),'product.submitted_for_review','product',target.id);
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload) values ('product',target.id,'product.submitted_for_review',jsonb_build_object('product_id',target.id));
  return target;
end;
$$;
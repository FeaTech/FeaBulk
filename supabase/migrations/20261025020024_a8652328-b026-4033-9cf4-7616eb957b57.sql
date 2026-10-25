create or replace function public.add_product_price_tier_command(product_id_input uuid, minimum_quantity_input bigint, maximum_quantity_input bigint, unit_price_input numeric)
returns public.product_price_tiers
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare target public.products;
declare tier public.product_price_tiers;
begin
  select * into target from public.products where id = product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(target.organization_id, array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if minimum_quantity_input < target.minimum_order_quantity or maximum_quantity_input < minimum_quantity_input or unit_price_input <= 0 then raise exception 'Invalid price tier'; end if;
  insert into public.product_price_tiers (product_id, minimum_quantity, maximum_quantity, unit_price)
  values (product_id_input, minimum_quantity_input, maximum_quantity_input, unit_price_input) returning * into tier;
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id)
  values (target.organization_id, (select auth.uid()), 'product.price_tier_added', 'product', target.id);
  return tier;
end;
$$;

create or replace function public.delete_product_price_tier_command(tier_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare target public.product_price_tiers;
declare target_product public.products;
begin
  select * into target from public.product_price_tiers where id = tier_id_input for update;
  if not found then raise exception 'Price tier not found'; end if;
  select * into target_product from public.products where id = target.product_id for update;
  if not private.has_any_role(target_product.organization_id,array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if target_product.listing_status <> 'draft' or target_product.submitted_for_review_at is not null then
    if target.minimum_quantity <= target_product.minimum_order_quantity
       and target.maximum_quantity >= target_product.minimum_order_quantity
       and not exists (
         select 1 from public.product_price_tiers other
         where other.product_id = target.product_id
           and other.id <> target.id
           and other.minimum_quantity <= target_product.minimum_order_quantity
           and other.maximum_quantity >= target_product.minimum_order_quantity
       ) then
      raise exception 'A live product must keep a price tier that covers its minimum order quantity';
    end if;
  end if;
  delete from public.product_price_tiers where id = target.id;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (target_product.organization_id,(select auth.uid()),'product.price_tier_deleted','product',target_product.id,jsonb_build_object('tier_id',target.id));
end;
$$;
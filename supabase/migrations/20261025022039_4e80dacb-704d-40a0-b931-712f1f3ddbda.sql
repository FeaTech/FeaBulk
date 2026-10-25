create or replace function public.update_product_draft_command(product_id_input uuid, payload jsonb)
returns public.products
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare target public.products;
begin
  select * into target from public.products where id=product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(target.organization_id,array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  update public.products set
    name=coalesce(nullif(trim(payload->>'name'),''),name),
    description=coalesce(nullif(trim(payload->>'description'),''),description),
    slug=coalesce(nullif(trim(payload->>'slug'),''),slug::text)::citext,
    category_id=coalesce(nullif(payload->>'category_id','')::uuid,category_id),
    seller_sku=coalesce(nullif(trim(payload->>'seller_sku'),''),seller_sku::text)::citext,
    hsn_code=coalesce(nullif(trim(payload->>'hsn_code'),''),hsn_code),
    unit_of_measure=coalesce(nullif(trim(payload->>'unit_of_measure'),''),unit_of_measure),
    minimum_order_quantity=coalesce((payload->>'minimum_order_quantity')::bigint,minimum_order_quantity),
    gst_rate=coalesce((payload->>'gst_rate')::numeric,gst_rate),
    lead_time_days=coalesce((payload->>'lead_time_days')::integer,lead_time_days)
  where id=target.id returning * into target;
  insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id)
  values(target.organization_id,(select auth.uid()),'product.draft_updated','product',target.id);
  return target;
end;
$$;

create or replace function private.update_product_sale_command(product_id_input uuid, payload jsonb, sale_type_input text, sale_settings_input jsonb)
returns public.products
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare p public.products; a public.auctions; tier public.product_price_tiers;
begin
  select * into p from public.products where id=product_id_input for update;
  if not found or not private.has_any_role(p.organization_id,array['owner','administrator']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if sale_type_input is null or sale_type_input not in ('regular','auction') then raise exception 'Choose Regular sale or Auction'; end if;
  for a in select * from public.auctions where product_id=p.id and status in ('scheduled','awaiting_payment') for update loop
    if a.status='awaiting_payment' or a.bid_count>0 or exists(select 1 from public.auction_participants where auction_id=a.id) or exists(select 1 from public.auction_bids where auction_id=a.id) then raise exception 'Sale terms are locked because buyers have joined or bid'; end if;
    update public.auctions set status='cancelled' where id=a.id;
  end loop;
  p := public.update_product_draft_command(product_id_input,payload);
  if sale_type_input='auction' then
    for tier in select * from public.product_price_tiers where product_id=p.id loop perform public.delete_product_price_tier_command(tier.id); end loop;
    perform public.create_auction_command(p.id,sale_settings_input);
  else
    if coalesce((sale_settings_input->>'unit_price')::numeric,0)<=0 then raise exception 'Unit price must be greater than zero'; end if;
    for tier in select * from public.product_price_tiers where product_id=p.id loop perform public.delete_product_price_tier_command(tier.id); end loop;
    perform public.add_product_price_tier_command(p.id,p.minimum_order_quantity,greatest(p.available_quantity,p.minimum_order_quantity),(sale_settings_input->>'unit_price')::numeric);
  end if;
  insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(p.organization_id,auth.uid(),'product.sale_updated','product',p.id,jsonb_build_object('sale_type',sale_type_input));
  return p;
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
  delete from public.product_price_tiers where id = target.id;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (target_product.organization_id,(select auth.uid()),'product.price_tier_deleted','product',target_product.id,jsonb_build_object('tier_id',target.id));
end;
$$;

drop function public.add_product_image_command(uuid, text, text);
create function public.add_product_image_command(product_id_input uuid, storage_path_input text, alt_text_input text)
returns public.product_images
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare target public.products;
declare image public.product_images;
declare image_count integer;
begin
  select * into target from public.products where id = product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(target.organization_id, array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if private.product_image_folder_id(storage_path_input) is distinct from product_id_input then raise exception 'Image path does not belong to this product'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'product-images' and o.name = storage_path_input) then raise exception 'Image file has not been uploaded'; end if;
  select count(*) into image_count from public.product_images where product_id = product_id_input;
  if image_count >= 6 then raise exception 'A listing can have at most 6 images'; end if;
  insert into public.product_images (product_id, storage_path, alt_text, sort_order, created_by)
  values (product_id_input, storage_path_input, nullif(trim(coalesce(alt_text_input, '')), ''),
    coalesce((select max(sort_order) + 1 from public.product_images where product_id = product_id_input), 0),
    (select auth.uid()))
  returning * into image;
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (target.organization_id, (select auth.uid()), 'product.image_added', 'product', target.id, jsonb_build_object('image_id', image.id));
  return image;
end;
$$;

create or replace function public.delete_product_image_command(image_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare target public.product_images;
declare target_product public.products;
begin
  select * into target from public.product_images where id = image_id_input for update;
  if not found then raise exception 'Product image not found'; end if;
  select * into target_product from public.products where id = target.product_id for update;
  if not private.has_any_role(target_product.organization_id, array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  delete from public.product_images where id = target.id;
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (target_product.organization_id, (select auth.uid()), 'product.image_deleted', 'product', target_product.id, jsonb_build_object('image_id', target.id, 'storage_path', target.storage_path));
end;
$$;

create or replace function public.create_product_sale_command(organization_id_input uuid, payload jsonb, idempotency_key_input uuid, sale_type_input text, sale_settings_input jsonb)
returns public.products
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare p public.products;
begin
  if sale_type_input not in ('regular','auction') then raise exception 'Choose Regular sale or Auction'; end if;
  if not exists (select 1 from public.organizations where id = organization_id_input and status = 'verified') then raise exception 'Your business must be verified by FeaBulk before listing products'; end if;
  p := public.create_product_command(organization_id_input, payload, idempotency_key_input);
  if sale_type_input = 'auction' then
    if not exists (select 1 from public.auctions where product_id = p.id) then perform public.create_auction_command(p.id, sale_settings_input); end if;
  else
    if not exists (select 1 from public.product_price_tiers where product_id = p.id) then
      perform public.add_product_price_tier_command(p.id, p.minimum_order_quantity, greatest(p.available_quantity,p.minimum_order_quantity), (sale_settings_input->>'unit_price')::numeric);
    end if;
  end if;
  update public.products set listing_status = 'active', moderation_status = 'approved', moderated_at = now() where id = p.id returning * into p;
  return p;
end;
$$;
create or replace function public.reopen_rejected_product_command(product_id_input uuid)
returns public.products language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.products;
begin
  select * into target from public.products where id = product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(target.organization_id,array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if target.listing_status <> 'draft' or target.moderation_status <> 'rejected' then raise exception 'Only rejected drafts can be reopened'; end if;
  update public.products set moderation_status = 'pending', submitted_for_review_at = null
  where id = target.id returning * into target;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id)
  values (target.organization_id,(select auth.uid()),'product.reopened','product',target.id);
  return target;
end;
$$;
revoke all on function public.reopen_rejected_product_command(uuid) from public;
grant execute on function public.reopen_rejected_product_command(uuid) to authenticated;

create or replace function public.update_product_draft_command(product_id_input uuid, payload jsonb)
returns public.products language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.products;
begin
  select * into target from public.products where id = product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(target.organization_id,array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if target.listing_status <> 'draft' or target.moderation_status <> 'pending' or target.submitted_for_review_at is not null then raise exception 'Product terms are locked during review'; end if;
  update public.products set
    name = coalesce(nullif(trim(payload->>'name'),''),name),
    description = coalesce(nullif(trim(payload->>'description'),''),description),
    slug = coalesce(nullif(trim(payload->>'slug'),''),slug::text)::citext,
    category_id = coalesce(nullif(payload->>'category_id','')::uuid,category_id),
    seller_sku = coalesce(nullif(trim(payload->>'seller_sku'),''),seller_sku::text)::citext,
    unit_of_measure = coalesce(nullif(trim(payload->>'unit_of_measure'),''),unit_of_measure),
    minimum_order_quantity = coalesce((payload->>'minimum_order_quantity')::bigint,minimum_order_quantity),
    gst_rate = coalesce((payload->>'gst_rate')::numeric,gst_rate),
    lead_time_days = coalesce((payload->>'lead_time_days')::integer,lead_time_days)
  where id = target.id returning * into target;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id)
  values (target.organization_id,(select auth.uid()),'product.draft_updated','product',target.id);
  return target;
end;
$$;
revoke all on function public.update_product_draft_command(uuid,jsonb) from public;
grant execute on function public.update_product_draft_command(uuid,jsonb) to authenticated;

create or replace function public.delete_product_price_tier_command(tier_id_input uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.product_price_tiers;
declare target_product public.products;
begin
  select * into target from public.product_price_tiers where id = tier_id_input for update;
  if not found then raise exception 'Price tier not found'; end if;
  select * into target_product from public.products where id = target.product_id for update;
  if not private.has_any_role(target_product.organization_id,array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if target_product.listing_status <> 'draft' or target_product.submitted_for_review_at is not null then raise exception 'Price tiers are locked after submission'; end if;
  delete from public.product_price_tiers where id = target.id;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (target_product.organization_id,(select auth.uid()),'product.price_tier_deleted','product',target_product.id,jsonb_build_object('tier_id',target.id));
end;
$$;
revoke all on function public.delete_product_price_tier_command(uuid) from public;
grant execute on function public.delete_product_price_tier_command(uuid) to authenticated;

create or replace function private.check_price_tier_coverage()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.submitted_for_review_at is not null and old.submitted_for_review_at is null
    and not exists (select 1 from public.product_price_tiers t
      where t.product_id = new.id
      and t.minimum_quantity <= new.minimum_order_quantity
      and t.maximum_quantity >= new.minimum_order_quantity) then
    raise exception 'A price tier must cover the minimum order quantity';
  end if;
  return new;
end;
$$;
create trigger product_price_coverage_checked before update of submitted_for_review_at
on public.products for each row execute function private.check_price_tier_coverage();

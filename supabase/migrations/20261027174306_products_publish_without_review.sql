-- Sellers publish products directly; FeaBulk admins can unpublish a listing afterwards.

-- A seller-side submit now publishes the listing instead of queueing it for review.
create or replace function public.submit_product_for_review_command(product_id_input uuid)
returns public.products
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare target public.products;
begin
  select * into target from public.products where id = product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(target.organization_id,array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if target.listing_status <> 'draft' or target.moderation_status <> 'pending' then raise exception 'Only unpublished drafts can be published'; end if;
  if not exists (select 1 from public.product_price_tiers where product_id = target.id)
    and not exists (select 1 from public.auctions where product_id = target.id and status = 'scheduled') then raise exception 'Regular pricing or an auction is required'; end if;
  if not exists (select 1 from public.organizations where id = target.organization_id and status = 'verified') then raise exception 'Seller verification is required'; end if;
  update public.products set listing_status = 'active', moderation_status = 'approved',
    submitted_for_review_at = coalesce(submitted_for_review_at, now()), moderated_at = now()
  where id = target.id returning * into target;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id) values (target.organization_id,(select auth.uid()),'product.published','product',target.id);
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload) values ('product',target.id,'product.published',jsonb_build_object('product_id',target.id));
  return target;
end;
$$;

-- A seller fixes a listing an admin unpublished and puts it straight back on the marketplace.
create or replace function public.reopen_rejected_product_command(product_id_input uuid)
returns public.products
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare target public.products;
begin
  select * into target from public.products where id = product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(target.organization_id,array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if target.listing_status <> 'draft' or target.moderation_status <> 'rejected' then raise exception 'Only unpublished listings can be republished'; end if;
  if not exists (select 1 from public.product_price_tiers where product_id = target.id)
    and not exists (select 1 from public.auctions where product_id = target.id and status = 'scheduled') then raise exception 'Regular pricing or an auction is required'; end if;
  if not exists (select 1 from public.organizations where id = target.organization_id and status = 'verified') then raise exception 'Seller verification is required'; end if;
  update public.products set listing_status = 'active', moderation_status = 'approved', moderated_at = now()
  where id = target.id returning * into target;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id)
  values (target.organization_id,(select auth.uid()),'product.republished','product',target.id);
  return target;
end;
$$;

-- Admins publish leftover drafts, or unpublish a live listing (reject) with a note to the seller.
create or replace function public.moderate_product_command(product_id_input uuid, approve_input boolean, notes_input text)
returns public.products
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare target public.products;
begin
  if not exists (select 1 from public.operations_members where user_id = (select auth.uid()) and role in ('catalog_moderator','platform_administrator')) then raise exception 'Moderator access denied'; end if;
  if char_length(trim(coalesce(notes_input,''))) < 10 then raise exception 'Moderation notes must have at least 10 characters'; end if;
  select * into target from public.products where id = product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if approve_input and (target.listing_status <> 'draft' or target.moderation_status <> 'pending') then raise exception 'Product is not an unpublished draft'; end if;
  if not approve_input and target.listing_status not in ('draft','active') then raise exception 'Product cannot be unpublished'; end if;
  if approve_input and not exists (select 1 from public.product_price_tiers where product_id = target.id)
    and not exists (select 1 from public.auctions where product_id = target.id and status = 'scheduled') then raise exception 'Regular pricing or an auction is required'; end if;
  update public.products set
    moderation_status = case when approve_input then 'approved'::public.moderation_status else 'rejected'::public.moderation_status end,
    listing_status = case when approve_input then 'active'::public.listing_status else 'draft'::public.listing_status end,
    submitted_for_review_at = case when approve_input then coalesce(submitted_for_review_at, now()) else submitted_for_review_at end,
    moderation_notes = trim(notes_input),
    moderated_at = now()
  where id = target.id returning * into target;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (target.organization_id,(select auth.uid()),'product.moderated','product',target.id,jsonb_build_object('approved',approve_input,'notes',trim(notes_input)));
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload)
  values ('product',target.id,'product.moderated',jsonb_build_object('approved',approve_input));
  return target;
end;
$$;

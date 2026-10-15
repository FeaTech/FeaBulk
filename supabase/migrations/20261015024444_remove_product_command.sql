-- A seller can permanently delete an unsubmitted draft. Products that may already be
-- referenced by orders are archived instead, preserving transaction history while removing
-- them from both the marketplace and the seller's active catalog.
create or replace function public.remove_product_command(product_id_input uuid)
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target public.products;
begin
  select * into target from public.products where id = product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(target.organization_id, array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[])
    then raise exception 'Catalog access denied';
  end if;

  if target.listing_status = 'draft' and target.submitted_for_review_at is null then
    insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
    values (target.organization_id, (select auth.uid()), 'product.deleted', 'product', target.id,
      jsonb_build_object('name', target.name, 'seller_sku', target.seller_sku));
    delete from public.products where id = target.id;
    return 'deleted';
  end if;

  update public.products
  set listing_status = 'archived',
      submitted_for_review_at = null,
      moderation_status = case when moderation_status = 'pending' then 'rejected'::public.moderation_status else moderation_status end,
      moderation_notes = case when moderation_status = 'pending' then 'Removed by seller.' else moderation_notes end
  where id = target.id;
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (target.organization_id, (select auth.uid()), 'product.archived', 'product', target.id,
    jsonb_build_object('name', target.name, 'seller_sku', target.seller_sku));
  return 'archived';
end;
$$;

revoke all on function public.remove_product_command(uuid) from public, anon;
grant execute on function public.remove_product_command(uuid) to authenticated;

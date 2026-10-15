-- Sellers may permanently remove only their own unsubmitted drafts. Published listings and
-- anything currently under review remain part of the platform record and cannot be deleted.
create or replace function public.delete_product_draft_command(product_id_input uuid)
returns void
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
  if target.listing_status <> 'draft' or target.submitted_for_review_at is not null
    then raise exception 'Only unsubmitted product drafts can be deleted';
  end if;

  delete from public.products where id = target.id;
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (target.organization_id, (select auth.uid()), 'product.draft_deleted', 'product', target.id,
    jsonb_build_object('name', target.name, 'seller_sku', target.seller_sku));
end;
$$;

revoke all on function public.delete_product_draft_command(uuid) from public, anon;
grant execute on function public.delete_product_draft_command(uuid) to authenticated;

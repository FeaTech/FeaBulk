CREATE OR REPLACE FUNCTION public.remove_product_command(product_id_input uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare target public.products;
declare has_history boolean;
begin
  select * into target from public.products where id = product_id_input for update;
  if not found then raise exception 'Product not found'; end if;

  if not (
    private.has_any_role(target.organization_id, array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[])
    or exists (
      select 1 from public.operations_members
      where user_id = (select auth.uid()) and role = 'platform_administrator'
    )
  ) then raise exception 'Catalog access denied'; end if;

  -- Protect buyer money: an open auction with paid tokens or bids must be settled/cancelled first.
  if exists (
    select 1 from public.auctions a
    where a.product_id = target.id
      and a.status in ('scheduled','awaiting_payment')
      and (
        exists (select 1 from public.auction_bids b where b.auction_id = a.id)
        or exists (select 1 from public.auction_participants p where p.auction_id = a.id and p.token_status = 'paid')
      )
  ) then
    raise exception 'This product has an active auction with buyers. Cancel or settle the auction first.';
  end if;

  select exists (
    select 1 from public.order_lines where product_id = target.id
    union all select 1 from public.rfqs where product_id = target.id
    union all select 1 from public.inventory_movements where product_id = target.id
  ) into has_history;

  if has_history then
    update public.products
    set listing_status = 'archived', updated_at = now()
    where id = target.id;
    insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
    values (target.organization_id, (select auth.uid()), 'product.archived', 'product', target.id, jsonb_build_object('name', target.name));
    return 'archived';
  else
    insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
    values (target.organization_id, (select auth.uid()), 'product.deleted', 'product', target.id, jsonb_build_object('name', target.name));
    delete from public.products where id = target.id;
    return 'deleted';
  end if;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.remove_product_command(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.remove_product_command(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_product_command(uuid) TO service_role;
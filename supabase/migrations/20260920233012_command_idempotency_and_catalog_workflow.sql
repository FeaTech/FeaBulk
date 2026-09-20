create table public.command_requests (
  idempotency_key uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  response jsonb,
  created_at timestamptz not null default now()
);
alter table public.command_requests enable row level security;

create or replace function public.create_product_command(organization_id_input uuid, payload jsonb, idempotency_key_input uuid)
returns public.products language plpgsql security definer set search_path = public, private, pg_temp as $$
declare created_product public.products;
declare existing_response jsonb;
begin
  if (select auth.uid()) is null or not private.has_any_role(organization_id_input, array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  select response into existing_response from public.command_requests where idempotency_key = idempotency_key_input and actor_id = (select auth.uid());
  if found then return (select jsonb_populate_record(null::public.products, existing_response)); end if;
  insert into public.command_requests (idempotency_key, actor_id, action) values (idempotency_key_input, (select auth.uid()), 'product.create');
  insert into public.products (organization_id, category_id, name, slug, description, manufacturer, brand, seller_sku, hsn_code, unit_of_measure, minimum_order_quantity, quantity_increment, available_quantity, gst_rate, lead_time_days, shipping_origin)
  values (organization_id_input, nullif(payload->>'category_id','')::uuid, payload->>'name', payload->>'slug', payload->>'description', payload->>'manufacturer', payload->>'brand', payload->>'seller_sku', payload->>'hsn_code', payload->>'unit_of_measure', (payload->>'minimum_order_quantity')::bigint, coalesce((payload->>'quantity_increment')::bigint,1), coalesce((payload->>'available_quantity')::bigint,0), nullif(payload->>'gst_rate','')::numeric, (payload->>'lead_time_days')::integer, coalesce(payload->'shipping_origin','{}'::jsonb)) returning * into created_product;
  update public.command_requests set response = to_jsonb(created_product) where idempotency_key = idempotency_key_input;
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id) values (organization_id_input, (select auth.uid()), 'product.created', 'product', created_product.id);
  return created_product;
exception when unique_violation then
  select response into existing_response from public.command_requests where idempotency_key = idempotency_key_input and actor_id = (select auth.uid());
  if existing_response is not null then return (select jsonb_populate_record(null::public.products, existing_response)); end if;
  raise;
end;
$$;
revoke all on function public.create_product_command(uuid, jsonb, uuid) from public;
grant execute on function public.create_product_command(uuid, jsonb, uuid) to authenticated;

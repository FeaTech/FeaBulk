create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  request_id uuid unique,
  delta bigint not null check (delta <> 0),
  quantity_after bigint not null check (quantity_after >= 0),
  reason text not null check (char_length(reason) between 5 and 500),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_movements_product_idx on public.inventory_movements(product_id,created_at desc);
alter table public.inventory_movements enable row level security;
create policy "seller team can read inventory history" on public.inventory_movements
for select to authenticated using (exists (
  select 1 from public.products p where p.id = product_id and private.is_member(p.organization_id)
));
revoke insert,update,delete on public.inventory_movements from anon,authenticated;

create or replace function public.adjust_inventory_command(product_id_input uuid, delta_input bigint, reason_input text, request_id_input uuid)
returns public.products language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.products;
declare existing_movement public.inventory_movements;
begin
  if request_id_input is null then raise exception 'Request ID is required'; end if;
  select * into target from public.products where id = product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(target.organization_id,array['owner','administrator','sales_manager','catalog_manager','warehouse_operator']::public.organization_role[]) then
    raise exception 'Inventory access denied';
  end if;
  select * into existing_movement from public.inventory_movements where request_id = request_id_input;
  if found then
    if existing_movement.product_id <> product_id_input or existing_movement.delta <> delta_input then raise exception 'Request ID reused with different adjustment'; end if;
    return target;
  end if;
  if delta_input = 0 or char_length(trim(coalesce(reason_input,''))) < 5 then raise exception 'A nonzero adjustment and reason are required'; end if;
  if target.available_quantity + delta_input < 0 then raise exception 'Insufficient inventory'; end if;
  update public.products set available_quantity = available_quantity + delta_input where id = target.id returning * into target;
  insert into public.inventory_movements (product_id,request_id,delta,quantity_after,reason,actor_id)
  values (target.id,request_id_input,delta_input,target.available_quantity,trim(reason_input),(select auth.uid()));
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,request_id,metadata)
  values (target.organization_id,(select auth.uid()),'inventory.adjusted','product',target.id,request_id_input,jsonb_build_object('delta',delta_input,'quantity_after',target.available_quantity));
  return target;
end;
$$;
revoke all on function public.adjust_inventory_command(uuid,bigint,text,uuid) from public;
grant execute on function public.adjust_inventory_command(uuid,bigint,text,uuid) to authenticated;

create or replace function private.reserve_order_line_inventory()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare target public.products;
declare seller_id uuid;
begin
  if new.product_id is null then return new; end if;
  select seller_organization_id into seller_id from public.orders where id = new.order_id;
  select * into target from public.products where id = new.product_id for update;
  if not found or target.organization_id <> seller_id or target.listing_status <> 'active' then raise exception 'Order product is not an active seller listing'; end if;
  if new.quantity < target.minimum_order_quantity or new.quantity % target.quantity_increment <> 0 then raise exception 'Order quantity violates MOQ or increment'; end if;
  if target.available_quantity < new.quantity then raise exception 'Insufficient inventory for order'; end if;
  update public.products set available_quantity = available_quantity - new.quantity where id = target.id;
  insert into public.inventory_movements (product_id,order_id,delta,quantity_after,reason,actor_id)
  values (target.id,new.order_id,-new.quantity,target.available_quantity-new.quantity,'Reserved for accepted order',(select auth.uid()));
  return new;
end;
$$;
create trigger order_line_reserves_inventory before insert on public.order_lines
for each row execute function private.reserve_order_line_inventory();

create or replace function private.restore_cancelled_order_inventory()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare line public.order_lines;
declare available_after bigint;
begin
  if new.status <> 'cancelled' or old.status = 'cancelled' then return new; end if;
  for line in select * from public.order_lines where order_id = new.id and product_id is not null loop
    update public.products set available_quantity = available_quantity + line.quantity
    where id = line.product_id returning available_quantity into available_after;
    insert into public.inventory_movements (product_id,order_id,delta,quantity_after,reason,actor_id)
    values (line.product_id,new.id,line.quantity,available_after,'Released from cancelled order',(select auth.uid()));
  end loop;
  return new;
end;
$$;
create trigger cancelled_order_restores_inventory after update of status on public.orders
for each row execute function private.restore_cancelled_order_inventory();

create or replace function private.assert_quote_product_seller()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare listed_seller uuid;
begin
  select p.organization_id into listed_seller from public.rfqs r
  join public.products p on p.id = r.product_id where r.id = new.rfq_id;
  if listed_seller is not null and listed_seller <> new.seller_organization_id then
    raise exception 'Only the listed seller can quote for this product';
  end if;
  return new;
end;
$$;
create trigger quote_product_seller_checked before insert or update of seller_organization_id,rfq_id
on public.rfq_quotes for each row execute function private.assert_quote_product_seller();

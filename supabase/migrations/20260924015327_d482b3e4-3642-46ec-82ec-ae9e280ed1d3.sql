create or replace function public.ops_has_role(_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.operations_members where user_id = auth.uid() and role::text = any(_roles))
$$;
grant execute on function public.ops_has_role(text[]) to authenticated;

create or replace function public.get_platform_orders_command()
returns table (id uuid, order_number text, status text, grand_total numeric, buyer_name text, seller_name text, created_at timestamptz, payment_status text, shipment_status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ops_has_role(array['support_agent','payments_reviewer','dispute_manager','platform_administrator']) then
    raise exception 'Operations access required';
  end if;
  return query
  select o.id, o.order_number, o.status::text, o.grand_total, b.display_name, s.display_name, o.created_at,
    (select p.status::text from public.payment_transactions p where p.order_id = o.id order by p.created_at desc limit 1),
    (select sh.status::text from public.shipments sh where sh.order_id = o.id order by sh.created_at desc limit 1)
  from public.orders o
  join public.organizations b on b.id = o.buyer_organization_id
  join public.organizations s on s.id = o.seller_organization_id
  order by o.created_at desc limit 500;
end $$;
grant execute on function public.get_platform_orders_command() to authenticated;

create or replace function public.get_platform_payments_command()
returns table (id uuid, order_number text, provider text, provider_reference text, status text, amount numeric, reconciliation_status text, verified_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ops_has_role(array['payments_reviewer','platform_administrator']) then
    raise exception 'Payments reviewer access required';
  end if;
  return query
  select p.id, o.order_number, p.provider, p.provider_reference, p.status::text, p.amount, p.reconciliation_status, p.verified_at, p.created_at
  from public.payment_transactions p join public.orders o on o.id = p.order_id
  order by p.created_at desc limit 500;
end $$;
grant execute on function public.get_platform_payments_command() to authenticated;

create or replace function public.get_all_categories_command()
returns table (id uuid, parent_id uuid, name text, slug text, is_active boolean, product_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ops_has_role(array['platform_administrator','catalog_moderator']) then
    raise exception 'Catalog access required';
  end if;
  return query
  select c.id, c.parent_id, c.name, c.slug::text, c.is_active,
    (select count(*) from public.products pr where pr.category_id = c.id)
  from public.categories c order by c.name;
end $$;
grant execute on function public.get_all_categories_command() to authenticated;

create or replace function public.upsert_category_command(id_input uuid, name_input text, slug_input text, parent_id_input uuid, is_active_input boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare result uuid;
begin
  if not public.ops_has_role(array['platform_administrator']) then
    raise exception 'Platform administrator access required';
  end if;
  if id_input is null then
    insert into public.categories (name, slug, parent_id, is_active)
    values (trim(name_input), lower(trim(slug_input)), parent_id_input, coalesce(is_active_input, true))
    returning id into result;
  else
    update public.categories set name = trim(name_input), slug = lower(trim(slug_input)), parent_id = parent_id_input,
      is_active = coalesce(is_active_input, is_active), updated_at = now()
    where id = id_input returning id into result;
  end if;
  return result;
end $$;
grant execute on function public.upsert_category_command(uuid, text, text, uuid, boolean) to authenticated;
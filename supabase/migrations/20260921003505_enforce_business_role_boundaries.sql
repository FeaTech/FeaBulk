-- Role checks must use immutable organization membership and kind, never user metadata.
drop policy "visible rfqs can be read by seller members" on public.rfqs;
create policy "visible rfqs can be read by eligible sellers" on public.rfqs
for select to authenticated using (
  status in ('published','receiving_quotes') and
  (visibility = 'public' or (
    visibility = 'verified_sellers' and exists (
      select 1 from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = (select auth.uid())
      and o.kind in ('seller','both') and o.status = 'verified'
    )
  ))
);

create or replace function private.assert_buyer_rfq()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.organizations
    where id = new.buyer_organization_id and kind in ('buyer','both')) then
    raise exception 'RFQs require a buyer organization';
  end if;
  return new;
end;
$$;
create trigger buyer_rfq_required before insert on public.rfqs
for each row execute function private.assert_buyer_rfq();

create or replace function private.assert_seller_product()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.organizations
    where id = new.organization_id and kind in ('seller','both')) then
    raise exception 'Products require a seller organization';
  end if;
  if new.listing_status = 'active' and not exists (select 1 from public.organizations
    where id = new.organization_id and status = 'verified') then
    raise exception 'Only verified sellers can publish products';
  end if;
  return new;
end;
$$;
create trigger seller_product_required before insert or update on public.products
for each row execute function private.assert_seller_product();

create or replace function private.check_quote_submission()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare seller_id uuid;
declare buyer_id uuid;
declare deadline timestamptz;
declare rfq_state public.rfq_status;
begin
  select q.seller_organization_id, r.buyer_organization_id, r.quote_deadline, r.status
  into seller_id, buyer_id, deadline, rfq_state
  from public.rfq_quotes q join public.rfqs r on r.id = q.rfq_id where q.id = new.quote_id;
  if seller_id = buyer_id then raise exception 'A buyer cannot quote its own RFQ'; end if;
  if not exists (select 1 from public.organizations o
    where o.id = seller_id and o.kind in ('seller','both') and o.status = 'verified') then
    raise exception 'Verified seller organization is required';
  end if;
  if rfq_state not in ('published','receiving_quotes','negotiation') then
    raise exception 'RFQ does not accept quotes';
  end if;
  if deadline is not null and deadline <= now() then raise exception 'RFQ quote deadline has passed'; end if;
  return new;
end;
$$;

create or replace function private.assert_order_counterparties()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.organizations where id = new.buyer_organization_id and kind in ('buyer','both') and status = 'verified') then
    raise exception 'Verified buyer organization is required';
  end if;
  if not exists (select 1 from public.organizations where id = new.seller_organization_id and kind in ('seller','both') and status = 'verified') then
    raise exception 'Verified seller organization is required';
  end if;
  return new;
end;
$$;
create trigger order_counterparties_required before insert on public.orders
for each row execute function private.assert_order_counterparties();

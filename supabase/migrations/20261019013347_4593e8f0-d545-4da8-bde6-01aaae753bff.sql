create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  seller_organization_id uuid not null references public.organizations(id),
  lot_type text not null default 'lot' check (lot_type in ('lot','per_unit')),
  quantity bigint not null check (quantity > 0),
  start_price numeric(14,2) not null check (start_price > 0),
  bid_step numeric(14,2) not null check (bid_step > 0),
  token_amount numeric(14,2) not null check (token_amount > 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','awaiting_payment','completed','unsold','forfeited','cancelled')),
  current_price numeric(14,2),
  bid_count integer not null default 0,
  winner_organization_id uuid references public.organizations(id),
  order_id uuid references public.orders(id),
  payment_due_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index auctions_product_idx on public.auctions(product_id);
create index auctions_status_idx on public.auctions(status, ends_at);

create table public.auction_participants (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  buyer_organization_id uuid not null references public.organizations(id),
  token_amount numeric(14,2) not null,
  token_status text not null default 'pending' check (token_status in ('pending','paid','refund_due','refunded','applied','forfeited')),
  delivery_address jsonb not null,
  provider_order_id text,
  provider_payment_id text,
  paid_at timestamptz,
  refunded_at timestamptz,
  joined_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auction_id, buyer_organization_id)
);

create table public.auction_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  participant_id uuid not null references public.auction_participants(id),
  buyer_organization_id uuid not null references public.organizations(id),
  amount numeric(14,2) not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index auction_bids_auction_idx on public.auction_bids(auction_id, created_at desc);

grant select on public.auctions to anon, authenticated;
grant select on public.auction_participants to authenticated;
grant select on public.auction_bids to authenticated;
grant all on public.auctions, public.auction_participants, public.auction_bids to service_role;

alter table public.auctions enable row level security;
alter table public.auction_participants enable row level security;
alter table public.auction_bids enable row level security;

create policy "Anyone can view auctions" on public.auctions for select to anon, authenticated using (true);
create policy "Participants, seller and admins view participants" on public.auction_participants for select to authenticated using (
  private.is_member(buyer_organization_id)
  or exists (select 1 from public.auctions a where a.id = auction_id and private.is_member(a.seller_organization_id))
  or exists (select 1 from public.operations_members m where m.user_id = (select auth.uid()))
);
create policy "Bidder, seller and admins view bids" on public.auction_bids for select to authenticated using (
  private.is_member(buyer_organization_id)
  or exists (select 1 from public.auctions a where a.id = auction_id and private.is_member(a.seller_organization_id))
  or exists (select 1 from public.operations_members m where m.user_id = (select auth.uid()))
);

create trigger auctions_touch before update on public.auctions for each row execute function private.touch_updated_at();
create trigger auction_participants_touch before update on public.auction_participants for each row execute function private.touch_updated_at();

-- Rule: auctions last 1 to 7 days
create or replace function private.validate_auction() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.ends_at - new.starts_at < interval '1 day' then raise exception 'An auction must run for at least 1 day'; end if;
    if new.ends_at - new.starts_at > interval '7 days' then raise exception 'An auction cannot run for more than 7 days'; end if;
  end if;
  return new;
end $$;
create trigger auctions_validate before insert on public.auctions for each row execute function private.validate_auction();

create or replace function public.create_auction_command(product_id_input uuid, payload jsonb)
returns public.auctions language plpgsql security definer set search_path = public, private, pg_temp as $$
declare p public.products; a public.auctions; start_at timestamptz; days numeric; qty bigint; sp numeric; tok numeric;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  select * into p from public.products where id = product_id_input;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(p.organization_id, array['owner','administrator']::public.organization_role[]) then raise exception 'You cannot auction this product'; end if;
  if exists (select 1 from public.auctions where product_id = p.id and status in ('scheduled','awaiting_payment')) then raise exception 'This product already has an open auction'; end if;
  start_at := greatest(coalesce((payload->>'starts_at')::timestamptz, now()), now());
  days := coalesce((payload->>'duration_days')::numeric, 0);
  if days < 1 or days > 7 then raise exception 'Duration must be between 1 and 7 days'; end if;
  qty := (payload->>'quantity')::bigint;
  if qty is null or qty < 1 then raise exception 'Quantity is required'; end if;
  if qty > p.available_quantity then raise exception 'Only % % in stock', p.available_quantity, p.unit_of_measure; end if;
  sp := (payload->>'start_price')::numeric; tok := (payload->>'token_amount')::numeric;
  if coalesce(payload->>'lot_type','lot') = 'per_unit' then
    if tok > sp * qty then raise exception 'Token cannot be more than the starting value of the lot'; end if;
  elsif tok > sp then raise exception 'Token cannot be more than the starting price'; end if;
  insert into public.auctions (product_id, seller_organization_id, lot_type, quantity, start_price, bid_step, token_amount, starts_at, ends_at, created_by)
  values (p.id, p.organization_id, coalesce(payload->>'lot_type','lot'), qty, sp, (payload->>'bid_step')::numeric, tok, start_at, start_at + days * interval '1 day', (select auth.uid()))
  returning * into a;
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (p.organization_id, (select auth.uid()), 'auction.created', 'auction', a.id, payload);
  return a;
end $$;

create or replace function public.cancel_auction_command(auction_id_input uuid)
returns public.auctions language plpgsql security definer set search_path = public, private, pg_temp as $$
declare a public.auctions;
begin
  select * into a from public.auctions where id = auction_id_input for update;
  if not found or not private.has_any_role(a.seller_organization_id, array['owner','administrator']::public.organization_role[]) then raise exception 'Auction not found'; end if;
  if a.status <> 'scheduled' or a.bid_count > 0 then raise exception 'Auctions with bids cannot be cancelled'; end if;
  update public.auction_participants set token_status = 'refund_due' where auction_id = a.id and token_status = 'paid';
  update public.auctions set status = 'cancelled' where id = a.id returning * into a;
  return a;
end $$;

create or replace function public.join_auction_command(auction_id_input uuid, buyer_organization_id_input uuid, delivery_address_input jsonb)
returns public.auction_participants language plpgsql security definer set search_path = public, private, pg_temp as $$
declare a public.auctions; part public.auction_participants;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  if not private.has_any_role(buyer_organization_id_input, array['owner','administrator']::public.organization_role[]) then raise exception 'You cannot bid for this business'; end if;
  if not exists (select 1 from public.organizations o where o.id = buyer_organization_id_input and o.kind::text = 'buyer') then raise exception 'Only buyer accounts can join auctions'; end if;
  select * into a from public.auctions where id = auction_id_input;
  if not found or a.status <> 'scheduled' or now() >= a.ends_at then raise exception 'This auction is closed'; end if;
  if a.seller_organization_id = buyer_organization_id_input then raise exception 'You cannot join your own auction'; end if;
  if coalesce(trim(delivery_address_input->>'address_line'),'') = '' then raise exception 'Delivery address is required'; end if;
  insert into public.auction_participants (auction_id, buyer_organization_id, token_amount, delivery_address, joined_by)
  values (a.id, buyer_organization_id_input, a.token_amount, delivery_address_input, (select auth.uid()))
  on conflict (auction_id, buyer_organization_id) do update set delivery_address = excluded.delivery_address
  returning * into part;
  return part;
end $$;

create or replace function public.attach_auction_token_order_internal(participant_id_input uuid, provider_order_id_input text)
returns public.auction_participants language sql security definer set search_path = public, pg_temp as $$
  update public.auction_participants set provider_order_id = provider_order_id_input where id = participant_id_input and token_status = 'pending' returning *;
$$;

create or replace function public.mark_auction_token_paid_internal(provider_order_id_input text, provider_payment_id_input text, amount_paise_input bigint)
returns public.auction_participants language plpgsql security definer set search_path = public, pg_temp as $$
declare part public.auction_participants;
begin
  select * into part from public.auction_participants where provider_order_id = provider_order_id_input for update;
  if not found then raise exception 'Token payment not found'; end if;
  if part.token_status <> 'pending' then return part; end if;
  if amount_paise_input <> round(part.token_amount * 100) then raise exception 'Token amount mismatch'; end if;
  update public.auction_participants set token_status = 'paid', provider_payment_id = provider_payment_id_input, paid_at = now() where id = part.id returning * into part;
  return part;
end $$;

create or replace function public.mark_auction_token_refunded_internal(participant_id_input uuid)
returns public.auction_participants language sql security definer set search_path = public, pg_temp as $$
  update public.auction_participants set token_status = 'refunded', refunded_at = now() where id = participant_id_input and token_status = 'refund_due' returning *;
$$;

create or replace function public.place_bid_command(auction_id_input uuid, buyer_organization_id_input uuid, amount_input numeric)
returns public.auctions language plpgsql security definer set search_path = public, private, pg_temp as $$
declare a public.auctions; part public.auction_participants; minimum numeric;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  if not private.has_any_role(buyer_organization_id_input, array['owner','administrator']::public.organization_role[]) then raise exception 'You cannot bid for this business'; end if;
  select * into a from public.auctions where id = auction_id_input for update;
  if not found or a.status <> 'scheduled' then raise exception 'This auction is closed'; end if;
  if now() < a.starts_at then raise exception 'This auction has not started yet'; end if;
  if now() >= a.ends_at then raise exception 'This auction has ended'; end if;
  if not exists (select 1 from public.products p where p.id = a.product_id and p.listing_status::text = 'active' and p.moderation_status::text = 'approved') then raise exception 'This auction is not live yet'; end if;
  select * into part from public.auction_participants where auction_id = a.id and buyer_organization_id = buyer_organization_id_input;
  if not found or part.token_status <> 'paid' then raise exception 'Pay the token amount to bid'; end if;
  minimum := case when a.current_price is null then a.start_price else a.current_price + a.bid_step end;
  if amount_input is null or amount_input < minimum then raise exception 'Your bid must be at least ₹%', minimum; end if;
  insert into public.auction_bids (auction_id, participant_id, buyer_organization_id, amount, created_by)
  values (a.id, part.id, buyer_organization_id_input, amount_input, (select auth.uid()));
  update public.auctions set current_price = amount_input, bid_count = bid_count + 1, winner_organization_id = buyer_organization_id_input,
    ends_at = case when ends_at - now() < interval '2 minutes' then now() + interval '2 minutes' else ends_at end
  where id = a.id returning * into a;
  return a;
end $$;

-- Public bid history with anonymised bidders
create or replace function public.get_auction_bids(auction_id_input uuid)
returns table (amount numeric, created_at timestamptz, bidder_label text, is_mine boolean)
language sql stable security definer set search_path = public, private, pg_temp as $$
  with numbered as (
    select b.*, dense_rank() over (order by p.created_at, p.id) as n
    from public.auction_bids b join public.auction_participants p on p.id = b.participant_id
    where b.auction_id = auction_id_input
  )
  select amount, created_at, 'Bidder ' || n, coalesce(private.is_member(buyer_organization_id), false)
  from numbered order by created_at desc limit 50;
$$;

create or replace function public.settle_auction_command(auction_id_input uuid)
returns public.auctions language plpgsql security definer set search_path = public, private, pg_temp as $$
declare a public.auctions; p public.products; win public.auction_participants; taxable numeric; gst numeric; o public.orders; ostatus text;
begin
  select * into a from public.auctions where id = auction_id_input for update;
  if not found then raise exception 'Auction not found'; end if;
  if a.status = 'scheduled' and now() >= a.ends_at then
    if a.bid_count = 0 then
      update public.auction_participants set token_status = 'refund_due' where auction_id = a.id and token_status = 'paid';
      update public.auctions set status = 'unsold' where id = a.id returning * into a;
      return a;
    end if;
    select * into p from public.products where id = a.product_id;
    select * into win from public.auction_participants where auction_id = a.id and buyer_organization_id = a.winner_organization_id;
    taxable := case when a.lot_type = 'per_unit' then a.current_price * a.quantity else a.current_price end;
    gst := coalesce(p.gst_rate, 18);
    insert into public.orders (order_number, buyer_organization_id, seller_organization_id, status, taxable_amount, gst_amount, discount_amount, delivery_address, created_by)
    values ('FEA-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.order_number_sequence')::text,8,'0'),
      a.winner_organization_id, a.seller_organization_id, 'awaiting_payment', taxable, round(taxable*gst/100,2), win.token_amount,
      win.delivery_address || jsonb_build_object('auction_id', a.id), win.joined_by)
    returning * into o;
    insert into public.order_lines (order_id, product_id, description, seller_sku, hsn_code, quantity, unit_of_measure, unit_price, gst_rate)
    values (o.id, p.id, p.name || ' (auction)', p.seller_sku, p.hsn_code, a.quantity, p.unit_of_measure, round(taxable / a.quantity, 2), gst);
    update public.auction_participants set token_status = 'applied' where id = win.id;
    update public.auction_participants set token_status = 'refund_due' where auction_id = a.id and id <> win.id and token_status = 'paid';
    update public.auctions set status = 'awaiting_payment', order_id = o.id, payment_due_at = now() + interval '48 hours' where id = a.id returning * into a;
    insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
    values (a.seller_organization_id, (select auth.uid()), 'auction.settled', 'auction', a.id, jsonb_build_object('order_id', o.id, 'price', a.current_price));
    insert into public.outbox_events (aggregate_type, aggregate_id, event_type, payload)
    values ('order', o.id, 'order.created', jsonb_build_object('order_id', o.id, 'auction_id', a.id));
  elsif a.status = 'awaiting_payment' then
    select status::text into ostatus from public.orders where id = a.order_id;
    if ostatus not in ('awaiting_payment','cancelled') then
      update public.auctions set status = 'completed' where id = a.id returning * into a;
    elsif now() > a.payment_due_at or ostatus = 'cancelled' then
      if ostatus = 'awaiting_payment' then update public.orders set status = 'cancelled' where id = a.order_id; end if;
      update public.auction_participants set token_status = 'forfeited' where auction_id = a.id and buyer_organization_id = a.winner_organization_id;
      update public.auctions set status = 'forfeited' where id = a.id returning * into a;
    end if;
  end if;
  return a;
end $$;

create or replace function public.settle_due_auctions() returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n integer := 0;
begin
  for r in select id from public.auctions where (status = 'scheduled' and ends_at <= now()) or status = 'awaiting_payment' loop
    perform public.settle_auction_command(r.id); n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.create_auction_command(uuid,jsonb), public.cancel_auction_command(uuid), public.join_auction_command(uuid,uuid,jsonb),
  public.place_bid_command(uuid,uuid,numeric), public.get_auction_bids(uuid), public.settle_auction_command(uuid), public.settle_due_auctions(),
  public.attach_auction_token_order_internal(uuid,text), public.mark_auction_token_paid_internal(text,text,bigint), public.mark_auction_token_refunded_internal(uuid) from public, anon, authenticated;
grant execute on function public.create_auction_command(uuid,jsonb), public.cancel_auction_command(uuid), public.join_auction_command(uuid,uuid,jsonb),
  public.place_bid_command(uuid,uuid,numeric), public.settle_auction_command(uuid) to authenticated;
grant execute on function public.get_auction_bids(uuid) to anon, authenticated;
grant execute on function public.settle_due_auctions(), public.attach_auction_token_order_internal(uuid,text), public.mark_auction_token_paid_internal(text,text,bigint),
  public.mark_auction_token_refunded_internal(uuid), public.settle_auction_command(uuid) to service_role;

alter publication supabase_realtime add table public.auctions;
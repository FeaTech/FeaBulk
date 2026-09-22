-- Transaction workflow core. All commands originate in trusted Edge Functions.

create type public.rfq_status as enum ('draft', 'published', 'receiving_quotes', 'evaluation', 'negotiation', 'awarded', 'converted', 'closed', 'cancelled');
create type public.quote_status as enum ('draft', 'submitted', 'revised', 'accepted', 'rejected', 'expired', 'withdrawn');
create type public.order_status as enum ('draft', 'awaiting_seller_confirmation', 'awaiting_payment', 'payment_secured', 'processing', 'ready_to_ship', 'shipped', 'delivered', 'inspection', 'completed', 'cancelled', 'partially_fulfilled', 'returned', 'disputed');
create type public.payment_status as enum ('initiated', 'pending', 'authorized', 'captured', 'failed', 'partially_refunded', 'refunded', 'cancelled');
create type public.payout_status as enum ('held', 'eligible', 'released', 'failed', 'reversed');
create type public.shipment_status as enum ('draft', 'ready', 'dispatched', 'in_transit', 'delivered', 'exception', 'cancelled');
create type public.dispute_status as enum ('opened', 'evidence_collection', 'seller_response', 'fea_review', 'resolution_proposed', 'accepted', 'escalated', 'resolved');
create type public.document_type as enum ('purchase_order', 'proforma_invoice', 'tax_invoice', 'credit_note', 'debit_note', 'delivery_challan', 'packing_list', 'shipment_document', 'other');

create table public.rfqs (
  id uuid primary key default gen_random_uuid(),
  buyer_organization_id uuid not null references public.organizations(id) on delete restrict,
  category_id uuid references public.categories(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  title text not null check (char_length(title) between 8 and 180),
  specifications jsonb not null default '{}'::jsonb,
  required_quantity bigint not null check (required_quantity > 0),
  unit_of_measure text not null,
  target_unit_price numeric(14,2) check (target_unit_price >= 0),
  delivery_address jsonb not null,
  delivery_pin_code char(6) not null check (delivery_pin_code ~ '^[0-9]{6}$'),
  required_delivery_date date,
  shipping_responsibility text not null check (shipping_responsibility in ('seller', 'buyer', 'platform', 'negotiable')),
  quality_requirements text,
  required_certifications jsonb not null default '[]'::jsonb,
  customization_requirements text,
  private_label_required boolean not null default false,
  payment_term_preferences jsonb not null default '[]'::jsonb,
  quote_deadline timestamptz,
  visibility text not null default 'invited' check (visibility in ('private', 'invited', 'verified_sellers', 'public')),
  status public.rfq_status not null default 'draft',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (product_id is not null or category_id is not null),
  check (quote_deadline is null or quote_deadline > created_at)
);
create index rfqs_buyer_status_idx on public.rfqs(buyer_organization_id, status, created_at desc);
create index rfqs_public_idx on public.rfqs(category_id, created_at desc) where status in ('published', 'receiving_quotes') and visibility in ('verified_sellers', 'public');

create table public.rfq_supplier_invites (
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  seller_organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_at timestamptz not null default now(),
  viewed_at timestamptz,
  primary key (rfq_id, seller_organization_id)
);

create table public.rfq_quotes (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete restrict,
  seller_organization_id uuid not null references public.organizations(id) on delete restrict,
  status public.quote_status not null default 'draft',
  current_version integer not null default 0 check (current_version >= 0),
  accepted_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rfq_id, seller_organization_id)
);
create index rfq_quotes_rfq_status_idx on public.rfq_quotes(rfq_id, status, created_at desc);
create index rfq_quotes_seller_status_idx on public.rfq_quotes(seller_organization_id, status, created_at desc);

create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.rfq_quotes(id) on delete cascade,
  version integer not null check (version > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  quantity bigint not null check (quantity > 0),
  gst_rate numeric(5,2) not null check (gst_rate between 0 and 100),
  shipping_charge numeric(14,2) not null default 0 check (shipping_charge >= 0),
  additional_charges numeric(14,2) not null default 0 check (additional_charges >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  lead_time_days integer not null check (lead_time_days >= 0),
  validity_ends_at timestamptz not null,
  payment_terms jsonb not null default '{}'::jsonb,
  technical_compliance jsonb not null default '{}'::jsonb,
  deviations jsonb not null default '[]'::jsonb,
  seller_notes text,
  submitted_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (quote_id, version),
  check (validity_ends_at > created_at)
);
create index quote_versions_quote_version_idx on public.quote_versions(quote_id, version desc);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  buyer_organization_id uuid not null references public.organizations(id) on delete restrict,
  seller_organization_id uuid not null references public.organizations(id) on delete restrict,
  rfq_id uuid references public.rfqs(id) on delete restrict,
  quote_id uuid unique references public.rfq_quotes(id) on delete restrict,
  status public.order_status not null default 'draft',
  currency char(3) not null default 'INR' check (currency = 'INR'),
  taxable_amount numeric(14,2) not null default 0 check (taxable_amount >= 0),
  gst_amount numeric(14,2) not null default 0 check (gst_amount >= 0),
  freight_amount numeric(14,2) not null default 0 check (freight_amount >= 0),
  additional_charge_amount numeric(14,2) not null default 0 check (additional_charge_amount >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  grand_total numeric(14,2) generated always as (taxable_amount + gst_amount + freight_amount + additional_charge_amount - discount_amount) stored,
  delivery_address jsonb not null,
  inspection_ends_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_organization_id <> seller_organization_id)
);
create index orders_buyer_status_idx on public.orders(buyer_organization_id, status, created_at desc);
create index orders_seller_status_idx on public.orders(seller_organization_id, status, created_at desc);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  description text not null,
  seller_sku text,
  hsn_code text,
  quantity bigint not null check (quantity > 0),
  unit_of_measure text not null,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  gst_rate numeric(5,2) not null check (gst_rate between 0 and 100),
  line_total numeric(14,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

create table public.commercial_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  type public.document_type not null,
  document_number text,
  version integer not null default 1 check (version > 0),
  storage_path text not null unique,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users(id) on delete set null,
  supersedes_id uuid references public.commercial_documents(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  unique (order_id, type, version)
);
create index commercial_documents_order_idx on public.commercial_documents(order_id, generated_at desc);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  idempotency_key uuid not null unique,
  provider text not null,
  provider_reference text unique,
  status public.payment_status not null default 'initiated',
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  reconciliation_status text not null default 'pending' check (reconciliation_status in ('pending', 'matched', 'exception')),
  verified_at timestamptz,
  webhook_event_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_transactions_order_status_idx on public.payment_transactions(order_id, status, created_at desc);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.payment_transactions(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  account_code text not null check (char_length(account_code) between 3 and 80),
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  event_key text not null,
  posted_at timestamptz not null default now(),
  check ((debit = 0) <> (credit = 0))
);
create index ledger_entries_order_idx on public.ledger_entries(order_id, posted_at desc);
create index ledger_entries_transaction_idx on public.ledger_entries(transaction_id, posted_at desc);
create unique index ledger_entries_event_account_idx on public.ledger_entries(transaction_id, account_code, event_key) where transaction_id is not null;

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  seller_organization_id uuid not null references public.organizations(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_transaction_id uuid references public.payment_transactions(id) on delete restrict,
  status public.payout_status not null default 'held',
  amount numeric(14,2) not null check (amount >= 0),
  provider_reference text unique,
  eligible_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  seller_organization_id uuid not null references public.organizations(id) on delete restrict,
  status public.shipment_status not null default 'draft',
  shipping_mode text not null check (shipping_mode in ('seller_arranged', 'buyer_pickup', 'platform_logistics')),
  freight_type text not null check (freight_type in ('parcel', 'carton', 'pallet', 'ltl', 'ftl', 'ocean', 'air')),
  carrier text,
  tracking_number text,
  dispatched_at timestamptz,
  estimated_delivery_at timestamptz,
  delivered_at timestamptz,
  proof_of_dispatch_path text,
  proof_of_delivery_path text,
  tracking_events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (carrier, tracking_number)
);
create index shipments_order_status_idx on public.shipments(order_id, status, created_at desc);

create table public.shipment_lines (
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  order_line_id uuid not null references public.order_lines(id) on delete restrict,
  quantity_shipped bigint not null check (quantity_shipped > 0),
  quantity_damaged bigint not null default 0 check (quantity_damaged >= 0 and quantity_damaged <= quantity_shipped),
  quantity_missing bigint not null default 0 check (quantity_missing >= 0 and quantity_missing <= quantity_shipped),
  primary key (shipment_id, order_line_id)
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  opened_by_organization_id uuid not null references public.organizations(id) on delete restrict,
  type text not null check (type in ('missing_quantity', 'damaged_goods', 'wrong_specifications', 'quality_failure', 'late_shipment', 'non_delivery', 'invoice_or_payment', 'other')),
  status public.dispute_status not null default 'opened',
  description text not null check (char_length(description) between 20 and 12000),
  resolution jsonb,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);
create index disputes_order_status_idx on public.disputes(order_id, status, opened_at desc);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  payload jsonb not null,
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  failed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index outbox_events_ready_idx on public.outbox_events(available_at) where processed_at is null and failed_at is null;

create or replace function private.assert_order_transition(current_state public.order_status, next_state public.order_status)
returns boolean language sql immutable security invoker as $$
  select (current_state, next_state) in (
    ('draft'::public.order_status, 'awaiting_seller_confirmation'::public.order_status),
    ('awaiting_seller_confirmation'::public.order_status, 'awaiting_payment'::public.order_status),
    ('awaiting_seller_confirmation'::public.order_status, 'cancelled'::public.order_status),
    ('awaiting_payment'::public.order_status, 'payment_secured'::public.order_status),
    ('awaiting_payment'::public.order_status, 'cancelled'::public.order_status),
    ('payment_secured'::public.order_status, 'processing'::public.order_status),
    ('processing'::public.order_status, 'ready_to_ship'::public.order_status),
    ('ready_to_ship'::public.order_status, 'shipped'::public.order_status),
    ('shipped'::public.order_status, 'delivered'::public.order_status),
    ('delivered'::public.order_status, 'inspection'::public.order_status),
    ('inspection'::public.order_status, 'completed'::public.order_status),
    ('processing'::public.order_status, 'partially_fulfilled'::public.order_status),
    ('partially_fulfilled'::public.order_status, 'shipped'::public.order_status),
    ('delivered'::public.order_status, 'disputed'::public.order_status),
    ('inspection'::public.order_status, 'disputed'::public.order_status),
    ('disputed'::public.order_status, 'completed'::public.order_status),
    ('disputed'::public.order_status, 'returned'::public.order_status),
    ('disputed'::public.order_status, 'cancelled'::public.order_status)
  );
$$;

create or replace function private.apply_verified_payment_capture()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target_order public.orders;
begin
  if new.status <> 'captured' or old.status = 'captured' or new.webhook_event_id is null then return new; end if;
  select * into target_order from public.orders where id = new.order_id for update;
  if not found or target_order.status <> 'awaiting_payment' then raise exception 'Payment capture cannot be applied to this order'; end if;
  if new.amount > target_order.grand_total then raise exception 'Captured amount exceeds order total'; end if;
  update public.orders set status = 'payment_secured' where id = target_order.id;
  insert into public.ledger_entries (transaction_id, order_id, organization_id, account_code, debit, credit, event_key)
  values
    (new.id, target_order.id, target_order.buyer_organization_id, 'buyer_funds_secured', new.amount, 0, new.webhook_event_id),
    (new.id, target_order.id, null, 'platform_clearing', 0, new.amount, new.webhook_event_id);
  insert into public.audit_events (organization_id, action, entity_type, entity_id, metadata)
  values (target_order.buyer_organization_id, 'payment.captured', 'payment_transaction', new.id, jsonb_build_object('order_id', target_order.id, 'provider_reference', new.provider_reference));
  insert into public.outbox_events (aggregate_type, aggregate_id, event_type, payload)
  values ('payment_transaction', new.id, 'payment.captured', jsonb_build_object('transaction_id', new.id, 'order_id', target_order.id));
  return new;
end;
$$;
create trigger payment_capture_applied after update of status on public.payment_transactions
  for each row execute function private.apply_verified_payment_capture();

create or replace function private.transition_order(order_id_input uuid, next_state public.order_status, request_id_input uuid default null)
returns public.orders language plpgsql security definer set search_path = public, pg_temp as $$
declare locked_order public.orders;
declare previous_state public.order_status;
begin
  select * into locked_order from public.orders where id = order_id_input for update;
  if not found then raise exception 'Order not found'; end if;
  if not private.is_member(locked_order.buyer_organization_id) and not private.is_member(locked_order.seller_organization_id) then raise exception 'Order access denied'; end if;
  if not private.assert_order_transition(locked_order.status, next_state) then raise exception 'Invalid order transition from % to %', locked_order.status, next_state; end if;
  previous_state := locked_order.status;
  update public.orders set status = next_state where id = order_id_input returning * into locked_order;
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, request_id, metadata)
  values (locked_order.buyer_organization_id, (select auth.uid()), 'order.transitioned', 'order', locked_order.id, request_id_input, jsonb_build_object('from', previous_state, 'to', next_state));
  insert into public.outbox_events (aggregate_type, aggregate_id, event_type, payload)
  values ('order', locked_order.id, 'order.transitioned', jsonb_build_object('order_id', locked_order.id, 'state', next_state));
  return locked_order;
end;
$$;
revoke all on function private.transition_order(uuid, public.order_status, uuid) from public;
grant execute on function private.transition_order(uuid, public.order_status, uuid) to authenticated, service_role;

-- Public API wrapper: authorization remains in the private command and callers
-- cannot mutate order rows directly through the Data API.
create or replace function public.transition_order_command(order_id_input uuid, next_state public.order_status, request_id_input uuid default null)
returns public.orders language sql security definer set search_path = public, private, pg_temp as $$
  select * from private.transition_order(order_id_input, next_state, request_id_input);
$$;
revoke all on function public.transition_order_command(uuid, public.order_status, uuid) from public;
grant execute on function public.transition_order_command(uuid, public.order_status, uuid) to authenticated;

create or replace function public.create_rfq_command(buyer_organization_id_input uuid, payload jsonb, request_id_input uuid default null)
returns public.rfqs language plpgsql security definer set search_path = public, private, pg_temp as $$
declare created_rfq public.rfqs;
begin
  if not private.has_any_role(buyer_organization_id_input, array['owner', 'administrator', 'procurement_manager']::public.organization_role[]) then raise exception 'RFQ creation access denied'; end if;
  insert into public.rfqs (
    buyer_organization_id, category_id, product_id, title, specifications, required_quantity, unit_of_measure, target_unit_price,
    delivery_address, delivery_pin_code, required_delivery_date, shipping_responsibility, quality_requirements, required_certifications,
    customization_requirements, private_label_required, payment_term_preferences, quote_deadline, visibility, status, created_by
  ) values (
    buyer_organization_id_input, nullif(payload->>'category_id', '')::uuid, nullif(payload->>'product_id', '')::uuid,
    payload->>'title', coalesce(payload->'specifications', '{}'::jsonb), (payload->>'required_quantity')::bigint, payload->>'unit_of_measure',
    nullif(payload->>'target_unit_price', '')::numeric, payload->'delivery_address', payload->>'delivery_pin_code',
    nullif(payload->>'required_delivery_date', '')::date, payload->>'shipping_responsibility', payload->>'quality_requirements',
    coalesce(payload->'required_certifications', '[]'::jsonb), payload->>'customization_requirements', coalesce((payload->>'private_label_required')::boolean, false),
    coalesce(payload->'payment_term_preferences', '[]'::jsonb), nullif(payload->>'quote_deadline', '')::timestamptz,
    coalesce(payload->>'visibility', 'invited'), 'draft', (select auth.uid())
  ) returning * into created_rfq;
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, request_id)
  values (buyer_organization_id_input, (select auth.uid()), 'rfq.created', 'rfq', created_rfq.id, request_id_input);
  return created_rfq;
end;
$$;

create or replace function public.submit_quote_version_command(rfq_id_input uuid, seller_organization_id_input uuid, payload jsonb, request_id_input uuid default null)
returns public.rfq_quotes language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target_rfq public.rfqs;
declare target_quote public.rfq_quotes;
declare next_version integer;
begin
  if not private.has_any_role(seller_organization_id_input, array['owner', 'administrator', 'sales_manager', 'sales_representative']::public.organization_role[]) then raise exception 'Quote submission access denied'; end if;
  select * into target_rfq from public.rfqs where id = rfq_id_input for share;
  if not found or target_rfq.status not in ('published', 'receiving_quotes', 'negotiation') then raise exception 'RFQ does not accept quotes'; end if;
  if target_rfq.visibility in ('private', 'invited') and not exists (select 1 from public.rfq_supplier_invites i where i.rfq_id = target_rfq.id and i.seller_organization_id = seller_organization_id_input) then raise exception 'Seller was not invited to this RFQ'; end if;
  insert into public.rfq_quotes (rfq_id, seller_organization_id, status, created_by)
  values (rfq_id_input, seller_organization_id_input, 'draft', (select auth.uid()))
  on conflict (rfq_id, seller_organization_id) do nothing;
  select * into target_quote from public.rfq_quotes where rfq_id = rfq_id_input and seller_organization_id = seller_organization_id_input for update;
  next_version := target_quote.current_version + 1;
  insert into public.quote_versions (
    quote_id, version, unit_price, quantity, gst_rate, shipping_charge, additional_charges, discount_amount,
    lead_time_days, validity_ends_at, payment_terms, technical_compliance, deviations, seller_notes, submitted_at, created_by
  ) values (
    target_quote.id, next_version, (payload->>'unit_price')::numeric, (payload->>'quantity')::bigint, (payload->>'gst_rate')::numeric,
    coalesce((payload->>'shipping_charge')::numeric, 0), coalesce((payload->>'additional_charges')::numeric, 0), coalesce((payload->>'discount_amount')::numeric, 0),
    (payload->>'lead_time_days')::integer, (payload->>'validity_ends_at')::timestamptz, coalesce(payload->'payment_terms', '{}'::jsonb),
    coalesce(payload->'technical_compliance', '{}'::jsonb), coalesce(payload->'deviations', '[]'::jsonb), payload->>'seller_notes', now(), (select auth.uid())
  );
  update public.rfq_quotes set current_version = next_version, status = case when target_quote.current_version = 0 then 'submitted' else 'revised' end
  where id = target_quote.id returning * into target_quote;
  update public.rfqs set status = 'receiving_quotes' where id = rfq_id_input and status = 'published';
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, request_id, metadata)
  values (seller_organization_id_input, (select auth.uid()), 'quote.submitted', 'quote', target_quote.id, request_id_input, jsonb_build_object('version', next_version));
  insert into public.outbox_events (aggregate_type, aggregate_id, event_type, payload)
  values ('quote', target_quote.id, 'quote.submitted', jsonb_build_object('quote_id', target_quote.id, 'rfq_id', rfq_id_input, 'version', next_version));
  return target_quote;
end;
$$;
revoke all on function public.create_rfq_command(uuid, jsonb, uuid), public.submit_quote_version_command(uuid, uuid, jsonb, uuid) from public;
grant execute on function public.create_rfq_command(uuid, jsonb, uuid), public.submit_quote_version_command(uuid, uuid, jsonb, uuid) to authenticated;

create trigger rfqs_updated_at before update on public.rfqs for each row execute function private.touch_updated_at();
create trigger rfq_quotes_updated_at before update on public.rfq_quotes for each row execute function private.touch_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function private.touch_updated_at();
create trigger payment_transactions_updated_at before update on public.payment_transactions for each row execute function private.touch_updated_at();
create trigger payouts_updated_at before update on public.payouts for each row execute function private.touch_updated_at();
create trigger shipments_updated_at before update on public.shipments for each row execute function private.touch_updated_at();
create trigger disputes_updated_at before update on public.disputes for each row execute function private.touch_updated_at();

alter table public.rfqs enable row level security;
alter table public.rfq_supplier_invites enable row level security;
alter table public.rfq_quotes enable row level security;
alter table public.quote_versions enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.commercial_documents enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payouts enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_lines enable row level security;
alter table public.disputes enable row level security;
alter table public.outbox_events enable row level security;

create policy "buyer can read own rfqs" on public.rfqs for select to authenticated using (private.is_member(buyer_organization_id));
create policy "visible rfqs can be read by seller members" on public.rfqs for select to authenticated using (visibility in ('verified_sellers', 'public') and status in ('published', 'receiving_quotes'));
create policy "sellers can read their invitations" on public.rfq_supplier_invites for select to authenticated using (private.is_member(seller_organization_id));
create policy "buyer can read invitations" on public.rfq_supplier_invites for select to authenticated using (exists (select 1 from public.rfqs r where r.id = rfq_id and private.is_member(r.buyer_organization_id)));
create policy "rfq counterparties can read quotes" on public.rfq_quotes for select to authenticated using (private.is_member(seller_organization_id) or exists (select 1 from public.rfqs r where r.id = rfq_id and private.is_member(r.buyer_organization_id)));
create policy "quote counterparties can read versions" on public.quote_versions for select to authenticated using (exists (select 1 from public.rfq_quotes q join public.rfqs r on r.id = q.rfq_id where q.id = quote_id and (private.is_member(q.seller_organization_id) or private.is_member(r.buyer_organization_id))));
create policy "order counterparties can read orders" on public.orders for select to authenticated using (private.is_member(buyer_organization_id) or private.is_member(seller_organization_id));
create policy "order counterparties can read lines" on public.order_lines for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (private.is_member(o.buyer_organization_id) or private.is_member(o.seller_organization_id))));
create policy "organization can read commercial documents" on public.commercial_documents for select to authenticated using (private.is_member(organization_id));
create policy "order counterparties can read payments" on public.payment_transactions for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (private.is_member(o.buyer_organization_id) or private.is_member(o.seller_organization_id))));
create policy "organization can read ledger entries" on public.ledger_entries for select to authenticated using (organization_id is not null and private.is_member(organization_id));
create policy "seller can read payouts" on public.payouts for select to authenticated using (private.is_member(seller_organization_id));
create policy "order counterparties can read shipments" on public.shipments for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (private.is_member(o.buyer_organization_id) or private.is_member(o.seller_organization_id))));
create policy "order counterparties can read shipment lines" on public.shipment_lines for select to authenticated using (exists (select 1 from public.shipments s join public.orders o on o.id = s.order_id where s.id = shipment_id and (private.is_member(o.buyer_organization_id) or private.is_member(o.seller_organization_id))));
create policy "order counterparties can read disputes" on public.disputes for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (private.is_member(o.buyer_organization_id) or private.is_member(o.seller_organization_id))));

revoke insert, update, delete on public.rfqs, public.rfq_supplier_invites, public.rfq_quotes, public.quote_versions, public.orders, public.order_lines, public.commercial_documents, public.payment_transactions, public.ledger_entries, public.payouts, public.shipments, public.shipment_lines, public.disputes, public.outbox_events from anon, authenticated;

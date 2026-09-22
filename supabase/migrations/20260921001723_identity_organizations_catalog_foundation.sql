-- FEA Bulk foundation: identity, tenant isolation, verification, and catalog.
-- This migration deliberately creates no public Storage bucket. Sensitive-document
-- storage is provisioned with the scan pipeline in the verification slice.

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create type public.organization_role as enum (
  'owner', 'administrator', 'procurement_manager', 'purchase_approver',
  'accountant', 'sales_manager', 'sales_representative', 'catalog_manager',
  'inventory_manager', 'warehouse_operator', 'viewer'
);
create type public.organization_kind as enum ('buyer', 'seller', 'both', 'platform');
create type public.verification_status as enum ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'resubmission_required', 'expired');
create type public.listing_status as enum ('draft', 'active', 'archived');
create type public.moderation_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone_e164 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check (char_length(legal_name) between 2 and 200),
  display_name text not null check (char_length(display_name) between 2 and 120),
  kind public.organization_kind not null,
  gstin citext,
  status text not null default 'pending_verification' check (status in ('pending_verification', 'verified', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gstin)
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_organization_idx on public.organization_members(user_id, organization_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 160),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id uuid,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index audit_events_organization_occurred_idx on public.audit_events(organization_id, occurred_at desc);

create table public.verification_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  status public.verification_status not null default 'draft',
  business_type text,
  pan_last4 char(4),
  cin_or_llpin text,
  udyam_registration text,
  registered_address jsonb,
  operating_address jsonb,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  verified_until timestamptz,
  reviewer_notes text,
  risk_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pan_last4 is null or pan_last4 ~ '^[A-Z0-9]{4}$')
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 100),
  slug citext not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  category_id uuid references public.categories(id) on delete restrict,
  name text not null check (char_length(name) between 3 and 180),
  slug citext not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null check (char_length(description) between 20 and 12000),
  manufacturer text,
  brand text,
  seller_sku citext not null,
  hsn_code text,
  country_of_origin text default 'India',
  specifications jsonb not null default '{}'::jsonb,
  unit_of_measure text not null,
  minimum_order_quantity bigint not null check (minimum_order_quantity > 0),
  quantity_increment bigint not null default 1 check (quantity_increment > 0),
  units_per_carton integer check (units_per_carton > 0),
  available_quantity bigint not null default 0 check (available_quantity >= 0),
  custom_quote_threshold bigint check (custom_quote_threshold > 0),
  gst_rate numeric(5,2) check (gst_rate between 0 and 100),
  lead_time_days integer not null check (lead_time_days >= 0),
  production_capacity jsonb,
  shipping_origin jsonb not null default '{}'::jsonb,
  shipping_methods text[] not null default '{}',
  certifications jsonb not null default '[]'::jsonb,
  sample_available boolean not null default false,
  sample_price numeric(14,2) check (sample_price >= 0),
  customization_available boolean not null default false,
  private_label_available boolean not null default false,
  warranty_terms text,
  return_eligible boolean not null default false,
  listing_status public.listing_status not null default 'draft',
  moderation_status public.moderation_status not null default 'pending',
  search_document tsvector generated always as (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(seller_sku::text, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, seller_sku),
  check ((sample_available and sample_price is not null) or not sample_available)
);
create index products_public_search_idx on public.products using gin(search_document);
create index products_public_browse_idx on public.products(category_id, created_at desc) where listing_status = 'active' and moderation_status = 'approved';
create index products_organization_idx on public.products(organization_id, updated_at desc);

create table public.product_price_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  minimum_quantity bigint not null check (minimum_quantity > 0),
  maximum_quantity bigint not null check (maximum_quantity >= minimum_quantity),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  exclude using gist (product_id with =, int8range(minimum_quantity, maximum_quantity + 1, '[)') with &&)
);
create index product_price_tiers_product_idx on public.product_price_tiers(product_id, minimum_quantity);

create or replace function private.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, full_name, phone_e164)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(new.phone), ''));
  return new;
end;
$$;
revoke all on function private.create_profile_for_user() from public;
create trigger auth_user_profile_created after insert on auth.users
  for each row execute function private.create_profile_for_user();

create or replace function private.is_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_any_role(target_organization_id uuid, allowed_roles public.organization_role[])
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id
      and m.user_id = (select auth.uid())
      and m.role = any(allowed_roles)
  );
$$;

create or replace function private.create_organization(legal_name_input text, display_name_input text, kind_input public.organization_kind)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare organization_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if kind_input = 'platform' then raise exception 'Platform organizations can only be created by operations'; end if;
  insert into public.organizations (legal_name, display_name, kind)
  values (trim(legal_name_input), trim(display_name_input), kind_input)
  returning id into organization_id;
  insert into public.organization_members (organization_id, user_id, role)
  values (organization_id, (select auth.uid()), 'owner');
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id)
  values (organization_id, (select auth.uid()), 'organization.created', 'organization', organization_id);
  return organization_id;
end;
$$;

revoke all on function private.is_member(uuid) from public;
revoke all on function private.has_any_role(uuid, public.organization_role[]) from public;
revoke all on function private.create_organization(text, text, public.organization_kind) from public;
grant execute on function private.is_member(uuid), private.has_any_role(uuid, public.organization_role[]) to authenticated;
grant execute on function private.create_organization(text, text, public.organization_kind) to authenticated;

create trigger profiles_updated_at before update on public.profiles for each row execute function private.touch_updated_at();
create trigger organizations_updated_at before update on public.organizations for each row execute function private.touch_updated_at();
create trigger organization_members_updated_at before update on public.organization_members for each row execute function private.touch_updated_at();
create trigger verification_cases_updated_at before update on public.verification_cases for each row execute function private.touch_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function private.touch_updated_at();
create trigger products_updated_at before update on public.products for each row execute function private.touch_updated_at();
create trigger product_price_tiers_updated_at before update on public.product_price_tiers for each row execute function private.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.audit_events enable row level security;
alter table public.verification_cases enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_price_tiers enable row level security;

create policy "profile owner can read" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profile owner can update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "organization members can read organization" on public.organizations for select to authenticated using (private.is_member(id));
create policy "owners and admins can update organization" on public.organizations for update to authenticated using (private.has_any_role(id, array['owner', 'administrator']::public.organization_role[])) with check (private.has_any_role(id, array['owner', 'administrator']::public.organization_role[]));
create policy "members can read fellow members" on public.organization_members for select to authenticated using (private.is_member(organization_id));
create policy "owners and admins can add members" on public.organization_members for insert to authenticated with check (private.has_any_role(organization_id, array['owner', 'administrator']::public.organization_role[]) and (role <> 'owner' or private.has_any_role(organization_id, array['owner']::public.organization_role[])));
create policy "owners can alter membership" on public.organization_members for update to authenticated using (private.has_any_role(organization_id, array['owner']::public.organization_role[])) with check (private.has_any_role(organization_id, array['owner']::public.organization_role[]));
create policy "owners can remove members" on public.organization_members for delete to authenticated using (private.has_any_role(organization_id, array['owner']::public.organization_role[]));
create policy "members can read their verification case" on public.verification_cases for select to authenticated using (private.is_member(organization_id));
create policy "active categories are public" on public.categories for select using (is_active);
create policy "published products are public" on public.products for select using (listing_status = 'active' and moderation_status = 'approved');
create policy "organization members can read their products" on public.products for select to authenticated using (private.is_member(organization_id));
create policy "public price tiers follow public products" on public.product_price_tiers for select using (exists (select 1 from public.products p where p.id = product_id and p.listing_status = 'active' and p.moderation_status = 'approved'));
create policy "seller team can read price tiers" on public.product_price_tiers for select to authenticated using (exists (select 1 from public.products p where p.id = product_id and private.is_member(p.organization_id)));
-- Verification and catalog writes are deliberately command-only. Edge Functions
-- validate their input and role, then use narrowly scoped database RPCs. Broad
-- table policies would allow a seller to set moderation fields or a reviewer note.

revoke insert, update, delete on public.audit_events from anon, authenticated;
revoke insert, update, delete on public.products, public.product_price_tiers from anon;

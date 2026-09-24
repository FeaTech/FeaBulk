-- Development fixture. These are synthetic, non-orderable listings.
-- Re-run safely: the organization ID and product slugs identify this fixture.
begin;

do $$
begin
  if exists (
    select 1 from public.organizations
    where id = '62c99d53-8c64-40a7-8171-d65edc4c0801'::uuid
      and legal_name <> '[TEST] FeaBulk Demo Supplier'
  ) then
    raise exception 'Demo organization ID is already in use';
  end if;
end;
$$;

insert into public.organizations (id, legal_name, display_name, kind, status)
values (
  '62c99d53-8c64-40a7-8171-d65edc4c0801',
  '[TEST] FeaBulk Demo Supplier',
  '[TEST] FeaBulk Demo Supplier — no real orders',
  'seller', 'verified'
)
on conflict (id) do nothing;

insert into public.verification_cases
  (organization_id, status, reviewed_at, reviewer_notes, verified_until)
values (
  '62c99d53-8c64-40a7-8171-d65edc4c0801', 'approved', now(),
  'Synthetic development fixture. No actual business verification was performed.',
  now() + interval '1 year'
)
on conflict (organization_id) do nothing;

with samples (slug, name, sku, category_slug, description, unit, moq, lead_days) as (
  values
    ('test-feabulk-corrugated-carton', '[TEST] Corrugated shipping carton, 5-ply',
     'TEST-CARTON-5PLY', 'packaging-materials',
     'Synthetic sample listing for catalog testing only. Dimensions and prices are illustrative; no physical stock or real seller is available.',
     'cartons', 100::bigint, 7),
    ('test-feabulk-stainless-bolts', '[TEST] Stainless steel hex bolts, M8 x 30 mm',
     'TEST-BOLT-M8', 'industrial-manufacturing',
     'Synthetic sample listing for catalog testing only. Specifications and prices are illustrative; no physical stock or real seller is available.',
     'pieces', 500::bigint, 10),
    ('test-feabulk-cotton-tote-bag', '[TEST] Reusable cotton tote bag',
     'TEST-TOTE-COTTON', 'textiles-apparel',
     'Synthetic sample listing for catalog testing only. Material and prices are illustrative; no physical stock or real seller is available.',
     'bags', 100::bigint, 14),
    ('test-feabulk-a4-copy-paper', '[TEST] A4 copier paper, 80 GSM',
     'TEST-PAPER-A4', 'office-business-supplies',
     'Synthetic sample listing for catalog testing only. Paper grade and prices are illustrative; no physical stock or real seller is available.',
     'reams', 50::bigint, 5),
    ('test-feabulk-copper-wire', '[TEST] Copper building wire, 2.5 sq mm',
     'TEST-WIRE-2-5', 'electrical-electronics',
     'Synthetic sample listing for catalog testing only. Wire specification and prices are illustrative; no physical stock or real seller is available.',
     'rolls', 10::bigint, 9)
)
insert into public.products
  (organization_id, category_id, name, slug, seller_sku, description,
   unit_of_measure, minimum_order_quantity, available_quantity, lead_time_days,
   specifications)
select '62c99d53-8c64-40a7-8171-d65edc4c0801'::uuid,
       c.id, s.name, s.slug, s.sku, s.description,
       s.unit, s.moq, 0, s.lead_days,
       jsonb_build_object('fixture', 'demo_catalog_v1', 'orderable', false)
from samples s
join public.categories c on c.slug = s.category_slug and c.is_active
on conflict (slug) do nothing;

with sample_tiers (slug, minimum_quantity, maximum_quantity, unit_price) as (
  values
    ('test-feabulk-corrugated-carton', 100::bigint, 499::bigint, 32.00::numeric),
    ('test-feabulk-corrugated-carton', 500::bigint, 999999::bigint, 28.00::numeric),
    ('test-feabulk-stainless-bolts', 500::bigint, 1999::bigint, 5.50::numeric),
    ('test-feabulk-stainless-bolts', 2000::bigint, 999999::bigint, 4.70::numeric),
    ('test-feabulk-cotton-tote-bag', 100::bigint, 499::bigint, 72.00::numeric),
    ('test-feabulk-cotton-tote-bag', 500::bigint, 999999::bigint, 62.00::numeric),
    ('test-feabulk-a4-copy-paper', 50::bigint, 199::bigint, 245.00::numeric),
    ('test-feabulk-a4-copy-paper', 200::bigint, 999999::bigint, 228.00::numeric),
    ('test-feabulk-copper-wire', 10::bigint, 49::bigint, 3150.00::numeric),
    ('test-feabulk-copper-wire', 50::bigint, 999999::bigint, 2980.00::numeric)
)
insert into public.product_price_tiers
  (product_id, minimum_quantity, maximum_quantity, unit_price)
select p.id, t.minimum_quantity, t.maximum_quantity, t.unit_price
from sample_tiers t
join public.products p on p.slug = t.slug
  and p.organization_id = '62c99d53-8c64-40a7-8171-d65edc4c0801'
where not exists (
  select 1 from public.product_price_tiers existing
  where existing.product_id = p.id
    and existing.minimum_quantity = t.minimum_quantity
    and existing.maximum_quantity = t.maximum_quantity
);

update public.products
set submitted_for_review_at = now()
where organization_id = '62c99d53-8c64-40a7-8171-d65edc4c0801'
  and slug::text like 'test-feabulk-%'
  and submitted_for_review_at is null;

update public.products
set listing_status = 'active', moderation_status = 'approved',
    moderation_notes = 'Synthetic development fixture; not an actual supplier listing.',
    moderated_at = now()
where organization_id = '62c99d53-8c64-40a7-8171-d65edc4c0801'
  and slug::text like 'test-feabulk-%'
  and listing_status = 'draft';

insert into public.audit_events
  (organization_id, action, entity_type, entity_id, metadata)
select p.organization_id, 'product.demo_seeded', 'product', p.id,
       jsonb_build_object('fixture', 'demo_catalog_v1', 'not_for_sale', true)
from public.products p
where p.organization_id = '62c99d53-8c64-40a7-8171-d65edc4c0801'
  and p.slug::text like 'test-feabulk-%'
  and not exists (
    select 1 from public.audit_events a
    where a.entity_id = p.id and a.action = 'product.demo_seeded'
  );

commit;

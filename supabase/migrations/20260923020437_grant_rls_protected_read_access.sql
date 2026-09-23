-- RLS policies decide which rows are visible, but the Data API roles also need
-- table-level SELECT privileges before those policies can run.
grant select on table
  public.profiles,
  public.organizations,
  public.organization_members,
  public.verification_cases,
  public.categories,
  public.products,
  public.product_price_tiers,
  public.rfqs,
  public.rfq_supplier_invites,
  public.rfq_quotes,
  public.quote_versions,
  public.orders,
  public.order_lines,
  public.commercial_documents,
  public.payment_transactions,
  public.payment_provider_events,
  public.ledger_entries,
  public.payouts,
  public.shipments,
  public.shipment_lines,
  public.disputes,
  public.conversations,
  public.messages,
  public.message_reads,
  public.notifications,
  public.notification_preferences,
  public.supplier_metrics,
  public.reviews,
  public.operations_members,
  public.organization_invitations,
  public.inventory_movements,
  public.operational_incidents
to authenticated;

-- Marketplace discovery is intentionally public; the existing RLS policies
-- still restrict these tables to approved and active records.
grant select on table
  public.categories,
  public.products,
  public.product_price_tiers,
  public.supplier_metrics,
  public.reviews,
  public.supplier_directory
to anon;

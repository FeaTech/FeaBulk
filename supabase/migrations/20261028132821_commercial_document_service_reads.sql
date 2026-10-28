-- The commercial-document edge function reads the order snapshot with the service role,
-- which had lost SELECT on these tables, so every generation failed with
-- "permission denied for table orders".
grant select on public.orders, public.order_lines, public.organizations,
  public.verification_cases, public.commercial_documents to service_role;

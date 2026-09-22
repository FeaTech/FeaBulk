create index orders_operational_stall_idx on public.orders(status,updated_at)
where status in ('awaiting_seller_confirmation','awaiting_payment','inspection');
create index payment_transactions_operational_idx on public.payment_transactions(reconciliation_status,status,created_at)
where reconciliation_status='exception' or status in ('initiated','pending','failed');
create index payouts_operational_idx on public.payouts(status,eligible_at)
where status in ('eligible','failed');
create index shipments_operational_idx on public.shipments(status,estimated_delivery_at)
where status in ('dispatched','in_transit','exception');
create index commercial_document_jobs_operational_idx on public.commercial_document_jobs(status,created_at)
where status in ('reserved','failed');
create index disputes_operational_idx on public.disputes(status,opened_at)
where status<>'resolved';
create index verification_cases_operational_idx on public.verification_cases(status,submitted_at)
where status in ('submitted','under_review');
create index operational_incidents_acknowledged_by_idx on public.operational_incidents(acknowledged_by)
where acknowledged_by is not null;

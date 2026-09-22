create index payment_transactions_initiated_by_idx
on public.payment_transactions(initiated_by,created_at desc)
where initiated_by is not null;

create index payment_provider_events_reference_idx
on public.payment_provider_events(provider,provider_reference,received_at desc);

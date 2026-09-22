alter table public.payment_transactions
  add column initiated_by uuid references auth.users(id) on delete set null,
  add column provider_payment_reference text,
  add column amount_refunded numeric(14,2) not null default 0 check (amount_refunded >= 0 and amount_refunded <= amount);

create unique index payment_transactions_provider_payment_reference_idx
on public.payment_transactions(provider_payment_reference)
where provider_payment_reference is not null;

create table public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  provider_reference text not null,
  payment_transaction_id uuid references public.payment_transactions(id) on delete restrict,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  processing_status text not null default 'received' check (processing_status in ('received','processed','ignored','failed')),
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider,event_id)
);

create index payment_provider_events_transaction_idx
on public.payment_provider_events(payment_transaction_id,received_at desc);

alter table public.payment_provider_events enable row level security;
revoke all on public.payment_provider_events from anon, authenticated;
grant select on public.payment_provider_events to authenticated;

create policy "order counterparties can read payment event history"
on public.payment_provider_events for select to authenticated using (
  exists (
    select 1 from public.payment_transactions payment
    join public.orders target_order on target_order.id=payment.order_id
    where payment.id=payment_transaction_id
      and (private.is_member(target_order.buyer_organization_id) or private.is_member(target_order.seller_organization_id))
  )
);

create or replace function public.initiate_payment_attempt_command(order_id_input uuid,idempotency_key_input uuid)
returns public.payment_transactions language plpgsql security definer set search_path=public,private,pg_temp as $$
declare target_order public.orders;
declare existing public.payment_transactions;
declare created public.payment_transactions;
begin
  if (select auth.uid()) is null or idempotency_key_input is null then raise exception 'Authentication and idempotency key are required'; end if;
  select * into existing from public.payment_transactions where idempotency_key=idempotency_key_input;
  if found then
    if existing.initiated_by <> (select auth.uid()) or existing.order_id <> order_id_input then raise exception 'Idempotency key belongs to another payment attempt'; end if;
    return existing;
  end if;
  select * into target_order from public.orders where id=order_id_input for update;
  if not found then raise exception 'Order not found'; end if;
  if target_order.status <> 'awaiting_payment' then raise exception 'Order is not awaiting payment'; end if;
  if not private.has_any_role(target_order.buyer_organization_id,array['owner','administrator','purchase_approver','accountant']::public.organization_role[]) then
    raise exception 'Payment access denied';
  end if;
  if exists (
    select 1 from public.payment_transactions
    where order_id=target_order.id and status in ('initiated','pending','authorized','captured','partially_refunded','refunded')
  ) then raise exception 'An active payment attempt already exists for this order'; end if;
  insert into public.payment_transactions(order_id,idempotency_key,provider,status,amount,currency,initiated_by)
  values(target_order.id,idempotency_key_input,'razorpay','initiated',target_order.grand_total,'INR',(select auth.uid()))
  returning * into created;
  insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id,request_id)
  values(target_order.buyer_organization_id,(select auth.uid()),'payment.initiated','payment_transaction',created.id,idempotency_key_input);
  return created;
end;
$$;
revoke all on function public.initiate_payment_attempt_command(uuid,uuid) from public;
grant execute on function public.initiate_payment_attempt_command(uuid,uuid) to authenticated;

create or replace function public.attach_payment_provider_reference_internal(transaction_id_input uuid,provider_reference_input text)
returns public.payment_transactions language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.payment_transactions;
begin
  if trim(coalesce(provider_reference_input,'')) !~ '^order_[A-Za-z0-9]+$' then raise exception 'Invalid Razorpay order reference'; end if;
  select * into target from public.payment_transactions where id=transaction_id_input for update;
  if not found or target.provider <> 'razorpay' then raise exception 'Payment attempt not found'; end if;
  if target.provider_reference is not null and target.provider_reference <> provider_reference_input then raise exception 'Payment provider reference is already assigned'; end if;
  update public.payment_transactions
  set provider_reference=provider_reference_input,status=case when status='initiated' then 'pending'::public.payment_status else status end
  where id=target.id returning * into target;
  return target;
end;
$$;
revoke all on function public.attach_payment_provider_reference_internal(uuid,text) from public;
grant execute on function public.attach_payment_provider_reference_internal(uuid,text) to service_role;

create or replace function public.fail_payment_attempt_internal(transaction_id_input uuid,failure_reason_input text)
returns public.payment_transactions language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.payment_transactions;
begin
  update public.payment_transactions set status='failed',reconciliation_status='exception'
  where id=transaction_id_input and status in ('initiated','pending') returning * into target;
  if found then
    insert into public.audit_events(action,entity_type,entity_id,metadata)
    values('payment.initiation_failed','payment_transaction',target.id,jsonb_build_object('reason',left(coalesce(failure_reason_input,'Provider request failed'),500)));
  end if;
  return target;
end;
$$;
revoke all on function public.fail_payment_attempt_internal(uuid,text) from public;
grant execute on function public.fail_payment_attempt_internal(uuid,text) to service_role;

create or replace function public.apply_razorpay_payment_event_internal(
  event_id_input text,event_type_input text,provider_reference_input text,payment_reference_input text,
  amount_paise_input bigint,amount_refunded_paise_input bigint,currency_input text,payload_sha256_input text
)
returns public.payment_transactions language plpgsql security definer set search_path=public,pg_temp as $$
declare event_record_id uuid;
declare target public.payment_transactions;
declare expected_paise bigint;
declare refunded_amount numeric(14,2);
declare ignored boolean := false;
begin
  if trim(coalesce(event_id_input,''))='' or trim(coalesce(provider_reference_input,''))='' or trim(coalesce(payment_reference_input,''))='' then
    raise exception 'Provider event identifiers are required';
  end if;
  if event_type_input not in ('payment.authorized','payment.captured','payment.failed','payment.refunded') then raise exception 'Unsupported Razorpay event type'; end if;
  if currency_input <> 'INR' or amount_paise_input <= 0 or coalesce(amount_refunded_paise_input,0) < 0 then raise exception 'Invalid payment amount or currency'; end if;
  insert into public.payment_provider_events(provider,event_id,event_type,provider_reference,payload_sha256)
  values('razorpay',event_id_input,event_type_input,provider_reference_input,payload_sha256_input)
  on conflict(provider,event_id) do nothing returning id into event_record_id;
  if event_record_id is null then
    select payment.* into target
    from public.payment_provider_events provider_event
    join public.payment_transactions payment on payment.id=provider_event.payment_transaction_id
    where provider_event.provider='razorpay' and provider_event.event_id=event_id_input;
    if not found then raise exception 'Duplicate provider event is still being processed'; end if;
    return target;
  end if;
  select * into target from public.payment_transactions where provider='razorpay' and provider_reference=provider_reference_input for update;
  if not found then raise exception 'Unknown Razorpay order reference'; end if;
  expected_paise := round(target.amount*100)::bigint;
  if amount_paise_input <> expected_paise then raise exception 'Provider payment amount does not match the order'; end if;
  if target.provider_payment_reference is not null and target.provider_payment_reference <> payment_reference_input then raise exception 'Provider payment reference mismatch'; end if;
  if event_type_input='payment.authorized' then
    if target.status in ('captured','partially_refunded','refunded') then ignored := true;
    else update public.payment_transactions set status='authorized',provider_payment_reference=payment_reference_input,verified_at=now(),webhook_event_id=event_id_input where id=target.id returning * into target;
    end if;
  elsif event_type_input='payment.captured' then
    if target.status in ('partially_refunded','refunded') then ignored := true;
    else update public.payment_transactions set status='captured',provider_payment_reference=payment_reference_input,reconciliation_status='matched',verified_at=now(),webhook_event_id=event_id_input where id=target.id returning * into target;
    end if;
  elsif event_type_input='payment.failed' then
    if target.status in ('captured','partially_refunded','refunded') then ignored := true;
    else update public.payment_transactions set status='failed',provider_payment_reference=payment_reference_input,reconciliation_status='matched',verified_at=now(),webhook_event_id=event_id_input where id=target.id returning * into target;
    end if;
  else
    refunded_amount := least(target.amount,amount_refunded_paise_input::numeric/100);
    if target.status not in ('captured','partially_refunded','refunded') then raise exception 'Only captured payments can be refunded'; end if;
    update public.payment_transactions set
      status=case when refunded_amount>=amount then 'refunded'::public.payment_status else 'partially_refunded'::public.payment_status end,
      amount_refunded=refunded_amount,provider_payment_reference=payment_reference_input,reconciliation_status='matched',verified_at=now(),webhook_event_id=event_id_input
    where id=target.id returning * into target;
  end if;
  update public.payment_provider_events set payment_transaction_id=target.id,
    processing_status=case when ignored then 'ignored' else 'processed' end,processed_at=now()
  where id=event_record_id;
  insert into public.audit_events(organization_id,action,entity_type,entity_id,metadata)
  select target_order.buyer_organization_id,'payment.provider_event','payment_transaction',target.id,
    jsonb_build_object('provider','razorpay','event_type',event_type_input,'event_id',event_id_input,'ignored',ignored)
  from public.orders target_order where target_order.id=target.order_id;
  return target;
end;
$$;
revoke all on function public.apply_razorpay_payment_event_internal(text,text,text,text,bigint,bigint,text,text) from public;
grant execute on function public.apply_razorpay_payment_event_internal(text,text,text,text,bigint,bigint,text,text) to service_role;

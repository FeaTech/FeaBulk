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
  select * into existing from public.payment_transactions
  where order_id=target_order.id and status in ('initiated','pending','authorized')
  order by created_at desc limit 1;
  if found then return existing; end if;
  if exists (
    select 1 from public.payment_transactions
    where order_id=target_order.id and status in ('captured','partially_refunded','refunded')
  ) then raise exception 'This order is already paid'; end if;
  insert into public.payment_transactions(order_id,idempotency_key,provider,status,amount,currency,initiated_by)
  values(target_order.id,idempotency_key_input,'razorpay','initiated',target_order.grand_total,'INR',(select auth.uid()))
  returning * into created;
  insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id,request_id)
  values(target_order.buyer_organization_id,(select auth.uid()),'payment.initiated','payment_transaction',created.id,idempotency_key_input);
  return created;
end;
$$;

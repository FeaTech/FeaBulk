create or replace function public.transition_order_command(order_id_input uuid, next_state public.order_status, request_id_input uuid default null)
returns public.orders language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.orders;
declare allowed boolean;
begin
  select * into target from public.orders where id = order_id_input for update;
  if not found then raise exception 'Order not found'; end if;
  if not private.assert_order_transition(target.status,next_state) then raise exception 'Invalid order transition'; end if;
  allowed := case
    when next_state in ('awaiting_payment','processing','ready_to_ship','shipped','partially_fulfilled')
      then private.has_any_role(target.seller_organization_id,array['owner','administrator','sales_manager','warehouse_operator']::public.organization_role[])
    when next_state in ('delivered','inspection','completed','disputed')
      then private.has_any_role(target.buyer_organization_id,array['owner','administrator','procurement_manager','purchase_approver']::public.organization_role[])
    when next_state = 'cancelled'
      then private.has_any_role(target.buyer_organization_id,array['owner','administrator','procurement_manager']::public.organization_role[])
    else false end;
  if not allowed then raise exception 'Order transition access denied'; end if;
  if next_state = 'payment_secured' then raise exception 'Payment secured only by verified provider events'; end if;
  if next_state = 'cancelled' and exists (
    select 1 from public.payment_transactions where order_id=target.id and status in ('initiated','pending','authorized')
  ) then raise exception 'An active payment attempt must finish or fail before cancellation'; end if;
  if next_state = 'shipped' and not exists (select 1 from public.shipments s where s.order_id = target.id and s.status in ('dispatched','in_transit')) then raise exception 'Dispatch evidence is required'; end if;
  if next_state = 'completed' and (target.inspection_ends_at is null or target.inspection_ends_at > now()) then raise exception 'Inspection period is still open'; end if;
  return private.transition_order(order_id_input,next_state,request_id_input);
end;
$$;

do $$
declare definition text;
begin
  select pg_get_functiondef('public.apply_razorpay_payment_event_internal(text,text,text,text,bigint,bigint,text,text)'::regprocedure) into definition;
  definition := replace(definition,
    $find$if target.status in ('captured','partially_refunded','refunded') then ignored := true;$find$,
    $replace$if target.status in ('failed','cancelled','captured','partially_refunded','refunded') then ignored := true;$replace$);
  if position($check$if target.status in ('failed','cancelled','captured','partially_refunded','refunded') then ignored := true;$check$ in definition)=0 then
    raise exception 'Could not harden out-of-order payment authorization handling';
  end if;
  execute definition;
end;
$$;

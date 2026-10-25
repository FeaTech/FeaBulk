create or replace function public.pay_auction_token_test_command(participant_id_input uuid)
 returns auction_participants
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
declare target public.auction_participants;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  select * into target from public.auction_participants where id = participant_id_input for update;
  if not found then raise exception 'Participation not found'; end if;
  if not private.has_any_role(target.buyer_organization_id, array['owner','administrator','procurement_manager','purchase_approver']::public.organization_role[]) then raise exception 'You cannot pay for this business'; end if;
  if target.token_status <> 'pending' then raise exception 'This token is already paid or not payable'; end if;
  update public.auction_participants set token_status = 'paid', paid_at = now(), provider_payment_id = 'TEST-' || gen_random_uuid()::text where id = target.id returning * into target;
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (target.buyer_organization_id, (select auth.uid()), 'auction.token_test_paid', 'auction_participant', target.id, jsonb_build_object('auction_id', target.auction_id));
  return target;
end;
$function$;

create or replace function public.pay_order_test_command(order_id_input uuid)
 returns orders
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
declare target public.orders;
declare payment public.payment_transactions;
declare test_ref text := 'TEST-' || gen_random_uuid()::text;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  select * into target from public.orders where id = order_id_input for update;
  if not found then raise exception 'Order not found'; end if;
  if not private.has_any_role(target.buyer_organization_id, array['owner','administrator','procurement_manager','purchase_approver']::public.organization_role[]) then raise exception 'You cannot pay for this business'; end if;
  if target.status <> 'awaiting_payment' then raise exception 'This order is not awaiting payment'; end if;
  insert into public.payment_transactions (order_id, idempotency_key, provider, provider_reference, status, amount, currency, reconciliation_status, initiated_by, webhook_event_id)
  values (target.id, gen_random_uuid(), 'test', test_ref, 'initiated', target.grand_total, target.currency, 'matched', (select auth.uid()), test_ref)
  returning * into payment;
  update public.payment_transactions set status = 'captured', verified_at = now(), provider_payment_reference = test_ref where id = payment.id returning * into payment;
  select * into target from public.orders where id = order_id_input;
  return target;
end;
$function$;

revoke execute on function public.pay_auction_token_test_command(uuid) from anon, public;
revoke execute on function public.pay_order_test_command(uuid) from anon, public;
grant execute on function public.pay_auction_token_test_command(uuid) to authenticated;
grant execute on function public.pay_order_test_command(uuid) to authenticated;
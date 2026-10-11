-- In "select distinct ..., 'in_app', ..." the literal is resolved as text before the
-- insert can coerce it, so every notification insert of that shape failed with
-- "column channel is of type notification_channel but expression is of type text"
-- and rolled back the command that raised it: submitting a product or a
-- verification case, quoting, accepting a quote, order transitions, dispatching a
-- shipment, disputes and sending a trade message. The document notification was
-- fixed the same way in 20260922010421; this casts the remaining ones.

create or replace function private.notify_outbox_recipients()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target_organization uuid;
declare second_organization uuid;
declare role_needed public.operations_role;
begin
  case new.event_type
    when 'quote.submitted' then
      select buyer_organization_id into target_organization from public.rfqs where id = (new.payload->>'rfq_id')::uuid;
    when 'order.created' then
      select seller_organization_id into target_organization from public.orders where id = (new.payload->>'order_id')::uuid;
    when 'order.transitioned' then
      select buyer_organization_id, seller_organization_id into target_organization, second_organization
      from public.orders where id = (new.payload->>'order_id')::uuid;
    when 'verification.reviewed' then
      target_organization := (new.payload->>'organization_id')::uuid;
    when 'product.moderated' then
      select organization_id into target_organization from public.products where id = new.aggregate_id;
    when 'verification.submitted' then role_needed := 'verification_reviewer';
    when 'product.submitted_for_review' then role_needed := 'catalog_moderator';
    else return new;
  end case;
  if target_organization is not null then
    insert into public.notifications (user_id, channel, template_key, payload, critical)
    select distinct m.user_id, 'in_app'::public.notification_channel, new.event_type,
      new.payload || jsonb_build_object('event_id',new.id), true
    from public.organization_members m
    where m.organization_id in (target_organization, second_organization);
  end if;
  if role_needed is not null then
    insert into public.notifications (user_id, channel, template_key, payload, critical)
    select distinct m.user_id, 'in_app'::public.notification_channel, new.event_type,
      new.payload || jsonb_build_object('event_id',new.id), true
    from public.operations_members m
    where m.role in (role_needed,'platform_administrator');
  end if;
  return new;
end;
$$;

create or replace function private.notify_trade_event()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare buyer_id uuid;
declare seller_id uuid;
declare target_order uuid;
begin
  if new.event_type = 'shipment.dispatched' then
    target_order := (new.payload->>'order_id')::uuid;
    select buyer_organization_id into buyer_id from public.orders where id=target_order;
  elsif new.event_type in ('dispute.opened','dispute.resolved') then
    target_order := (new.payload->>'order_id')::uuid;
    select buyer_organization_id,seller_organization_id into buyer_id,seller_id from public.orders where id=target_order;
  else return new;
  end if;
  insert into public.notifications (user_id,channel,template_key,payload,critical)
  select distinct m.user_id,'in_app'::public.notification_channel,new.event_type,new.payload||jsonb_build_object('event_id',new.id),true
  from public.organization_members m where m.organization_id in (buyer_id,seller_id);
  if new.event_type='dispute.opened' then
    insert into public.notifications (user_id,channel,template_key,payload,critical)
    select distinct user_id,'in_app'::public.notification_channel,new.event_type,new.payload||jsonb_build_object('event_id',new.id),true
    from public.operations_members where role in ('dispute_manager','platform_administrator');
  end if;
  return new;
end;
$$;

create or replace function public.send_trade_message_command(conversation_id_input uuid, sender_organization_id_input uuid, body_input text, request_id_input uuid)
returns public.messages language plpgsql security definer set search_path = public, private, pg_temp as $$
declare thread public.conversations;
declare sent public.messages;
declare recipient_organization_id uuid;
begin
  if request_id_input is null then raise exception 'Request ID is required'; end if;
  select * into thread from public.conversations where id = conversation_id_input;
  if not found then raise exception 'Conversation not found'; end if;
  if sender_organization_id_input not in (thread.buyer_organization_id,thread.seller_organization_id)
    or not private.is_member(sender_organization_id_input) then raise exception 'Message access denied'; end if;
  if char_length(trim(coalesce(body_input,''))) not between 1 and 8000 then raise exception 'Message must be 1 to 8000 characters'; end if;
  select * into sent from public.messages where request_id = request_id_input;
  if found then
    if sent.conversation_id <> conversation_id_input or sent.sender_organization_id <> sender_organization_id_input or sent.body <> trim(body_input) then
      raise exception 'Request ID reused with different message';
    end if;
    return sent;
  end if;
  insert into public.messages (conversation_id,sender_id,sender_organization_id,body,visibility,request_id)
  values (conversation_id_input,(select auth.uid()),sender_organization_id_input,trim(body_input),'counterparty',request_id_input)
  returning * into sent;
  recipient_organization_id := case when sender_organization_id_input = thread.buyer_organization_id then thread.seller_organization_id else thread.buyer_organization_id end;
  insert into public.notifications (user_id,channel,template_key,payload,critical)
  select distinct user_id,'in_app'::public.notification_channel,'message.received',
    jsonb_build_object('conversation_id',conversation_id_input,'message_id',sent.id),false
  from public.organization_members where organization_id = recipient_organization_id;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,request_id)
  values (sender_organization_id_input,(select auth.uid()),'message.sent','message',sent.id,request_id_input);
  return sent;
end;
$$;

-- Same class of error in quote submission: the CASE yields text, which cannot be
-- assigned to the quote_status column, so no seller could ever submit a quote.
CREATE OR REPLACE FUNCTION public.submit_quote_version_command(rfq_id_input uuid, seller_organization_id_input uuid, payload jsonb, request_id_input uuid DEFAULT NULL::uuid)
 RETURNS rfq_quotes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare target_rfq public.rfqs;
declare target_quote public.rfq_quotes;
declare next_version integer;
begin
  if not private.has_any_role(seller_organization_id_input, array['owner', 'administrator', 'sales_manager', 'sales_representative']::public.organization_role[]) then raise exception 'Quote submission access denied'; end if;
  select * into target_rfq from public.rfqs where id = rfq_id_input for share;
  if not found or target_rfq.status not in ('published', 'receiving_quotes', 'negotiation') then raise exception 'RFQ does not accept quotes'; end if;
  if target_rfq.visibility in ('private', 'invited') and not exists (select 1 from public.rfq_supplier_invites i where i.rfq_id = target_rfq.id and i.seller_organization_id = seller_organization_id_input) then raise exception 'Seller was not invited to this RFQ'; end if;
  insert into public.rfq_quotes (rfq_id, seller_organization_id, status, created_by)
  values (rfq_id_input, seller_organization_id_input, 'draft', (select auth.uid()))
  on conflict (rfq_id, seller_organization_id) do nothing;
  select * into target_quote from public.rfq_quotes where rfq_id = rfq_id_input and seller_organization_id = seller_organization_id_input for update;
  next_version := target_quote.current_version + 1;
  insert into public.quote_versions (
    quote_id, version, unit_price, quantity, gst_rate, shipping_charge, additional_charges, discount_amount,
    lead_time_days, validity_ends_at, payment_terms, technical_compliance, deviations, seller_notes, submitted_at, created_by
  ) values (
    target_quote.id, next_version, (payload->>'unit_price')::numeric, (payload->>'quantity')::bigint, (payload->>'gst_rate')::numeric,
    coalesce((payload->>'shipping_charge')::numeric, 0), coalesce((payload->>'additional_charges')::numeric, 0), coalesce((payload->>'discount_amount')::numeric, 0),
    (payload->>'lead_time_days')::integer, (payload->>'validity_ends_at')::timestamptz, coalesce(payload->'payment_terms', '{}'::jsonb),
    coalesce(payload->'technical_compliance', '{}'::jsonb), coalesce(payload->'deviations', '[]'::jsonb), payload->>'seller_notes', now(), (select auth.uid())
  );
  update public.rfq_quotes set current_version = next_version, status = case when target_quote.current_version = 0 then 'submitted'::public.quote_status else 'revised'::public.quote_status end
  where id = target_quote.id returning * into target_quote;
  update public.rfqs set status = 'receiving_quotes' where id = rfq_id_input and status = 'published';
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, request_id, metadata)
  values (seller_organization_id_input, (select auth.uid()), 'quote.submitted', 'quote', target_quote.id, request_id_input, jsonb_build_object('version', next_version));
  insert into public.outbox_events (aggregate_type, aggregate_id, event_type, payload)
  values ('quote', target_quote.id, 'quote.submitted', jsonb_build_object('quote_id', target_quote.id, 'rfq_id', rfq_id_input, 'version', next_version));
  return target_quote;
end;
$function$

;

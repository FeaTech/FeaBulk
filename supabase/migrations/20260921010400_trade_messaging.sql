alter table public.messages add column request_id uuid unique;
create unique index conversations_one_quote_thread on public.conversations(quote_id) where context = 'quote';
create unique index conversations_one_order_thread on public.conversations(order_id) where context = 'order';

drop policy "conversation counterparties can read messages" on public.messages;
create policy "conversation counterparties read permitted messages" on public.messages
for select to authenticated using (exists (
  select 1 from public.conversations c where c.id = conversation_id and (
    (visibility = 'counterparty' and (private.is_member(c.buyer_organization_id) or private.is_member(c.seller_organization_id)))
    or (visibility = 'buyer_only' and private.is_member(c.buyer_organization_id))
    or (visibility = 'seller_only' and private.is_member(c.seller_organization_id))
  )
));

create or replace function public.get_or_create_trade_conversation_command(context_input public.conversation_context, reference_id_input uuid)
returns public.conversations language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.conversations;
declare buyer_id uuid;
declare seller_id uuid;
begin
  if context_input = 'quote' then
    select r.buyer_organization_id,q.seller_organization_id into buyer_id,seller_id
    from public.rfq_quotes q join public.rfqs r on r.id = q.rfq_id
    where q.id = reference_id_input for update of q;
  elsif context_input = 'order' then
    select o.buyer_organization_id,o.seller_organization_id into buyer_id,seller_id
    from public.orders o where o.id = reference_id_input for update;
  else
    raise exception 'Unsupported conversation context';
  end if;
  if buyer_id is null or seller_id is null then raise exception 'Trade record not found'; end if;
  if not private.is_member(buyer_id) and not private.is_member(seller_id) then raise exception 'Conversation access denied'; end if;
  if context_input = 'quote' then
    select * into target from public.conversations where context = 'quote' and quote_id = reference_id_input;
  else
    select * into target from public.conversations where context = 'order' and order_id = reference_id_input;
  end if;
  if found then return target; end if;
  insert into public.conversations (context,buyer_organization_id,seller_organization_id,quote_id,order_id)
  values (context_input,buyer_id,seller_id,
    case when context_input = 'quote' then reference_id_input else null end,
    case when context_input = 'order' then reference_id_input else null end)
  returning * into target;
  return target;
end;
$$;
revoke all on function public.get_or_create_trade_conversation_command(public.conversation_context,uuid) from public;
grant execute on function public.get_or_create_trade_conversation_command(public.conversation_context,uuid) to authenticated;

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
  select distinct user_id,'in_app','message.received',
    jsonb_build_object('conversation_id',conversation_id_input,'message_id',sent.id),false
  from public.organization_members where organization_id = recipient_organization_id;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,request_id)
  values (sender_organization_id_input,(select auth.uid()),'message.sent','message',sent.id,request_id_input);
  return sent;
end;
$$;
revoke all on function public.send_trade_message_command(uuid,uuid,text,uuid) from public;
grant execute on function public.send_trade_message_command(uuid,uuid,text,uuid) to authenticated;

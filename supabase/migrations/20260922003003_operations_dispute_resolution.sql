create policy "dispute operations can read all disputes" on public.disputes
for select to authenticated using (exists (
  select 1 from public.operations_members where user_id=(select auth.uid())
  and role in ('dispute_manager','platform_administrator')
));

create or replace function public.resolve_dispute_command(dispute_id_input uuid, outcome_input text, notes_input text)
returns public.disputes language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.disputes;
declare next_order_state public.order_status;
begin
  if not exists (select 1 from public.operations_members where user_id=(select auth.uid()) and role in ('dispute_manager','platform_administrator')) then raise exception 'Dispute manager access denied'; end if;
  if outcome_input not in ('buyer_return','seller_release','cancel_order') then raise exception 'Invalid dispute outcome'; end if;
  if char_length(trim(coalesce(notes_input,''))) < 20 then raise exception 'Resolution notes must have at least 20 characters'; end if;
  select * into target from public.disputes where id=dispute_id_input for update;
  if not found or target.status='resolved' then raise exception 'Dispute is not open'; end if;
  next_order_state := case outcome_input when 'buyer_return' then 'returned'::public.order_status when 'seller_release' then 'completed'::public.order_status else 'cancelled'::public.order_status end;
  update public.disputes set status='resolved',resolved_at=now(),
    resolution=jsonb_build_object('outcome',outcome_input,'notes',trim(notes_input),'resolved_by',(select auth.uid()))
  where id=target.id returning * into target;
  update public.orders set status=next_order_state where id=target.order_id and status='disputed';
  insert into public.audit_events (actor_id,action,entity_type,entity_id,metadata)
  values ((select auth.uid()),'dispute.resolved','dispute',target.id,jsonb_build_object('outcome',outcome_input));
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload)
  values ('dispute',target.id,'dispute.resolved',jsonb_build_object('dispute_id',target.id,'order_id',target.order_id,'outcome',outcome_input));
  return target;
end;
$$;
revoke all on function public.resolve_dispute_command(uuid,text,text) from public;
grant execute on function public.resolve_dispute_command(uuid,text,text) to authenticated;

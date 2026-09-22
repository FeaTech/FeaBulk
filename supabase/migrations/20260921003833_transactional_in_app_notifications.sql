-- Important workflow events create durable in-app notifications in the same transaction.
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
    select distinct m.user_id, 'in_app', new.event_type,
      new.payload || jsonb_build_object('event_id',new.id), true
    from public.organization_members m
    where m.organization_id in (target_organization, second_organization);
  end if;
  if role_needed is not null then
    insert into public.notifications (user_id, channel, template_key, payload, critical)
    select distinct m.user_id, 'in_app', new.event_type,
      new.payload || jsonb_build_object('event_id',new.id), true
    from public.operations_members m
    where m.role in (role_needed,'platform_administrator');
  end if;
  return new;
end;
$$;
create trigger outbox_in_app_notification after insert on public.outbox_events
for each row execute function private.notify_outbox_recipients();

create or replace function public.mark_notification_read_command(notification_id_input uuid)
returns public.notifications language plpgsql security definer set search_path = public, pg_temp as $$
declare target public.notifications;
begin
  update public.notifications set read_at = coalesce(read_at,now())
  where id = notification_id_input and user_id = (select auth.uid())
  returning * into target;
  if not found then raise exception 'Notification not found'; end if;
  return target;
end;
$$;
revoke all on function public.mark_notification_read_command(uuid) from public;
grant execute on function public.mark_notification_read_command(uuid) to authenticated;

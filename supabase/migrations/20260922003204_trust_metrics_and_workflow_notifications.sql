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
  select distinct m.user_id,'in_app',new.event_type,new.payload||jsonb_build_object('event_id',new.id),true
  from public.organization_members m where m.organization_id in (buyer_id,seller_id);
  if new.event_type='dispute.opened' then
    insert into public.notifications (user_id,channel,template_key,payload,critical)
    select distinct user_id,'in_app',new.event_type,new.payload||jsonb_build_object('event_id',new.id),true
    from public.operations_members where role in ('dispute_manager','platform_administrator');
  end if;
  return new;
end;
$$;
create trigger trade_event_notification after insert on public.outbox_events
for each row execute function private.notify_trade_event();

create or replace function private.refresh_supplier_rating()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.supplier_metrics (organization_id,rating,completed_transaction_value,verified_since,order_completion_rate,dispute_rate,calculated_at)
  select
    new.seller_organization_id,
    coalesce((select round(avg(r.rating)::numeric,2) from public.reviews r where r.seller_organization_id=new.seller_organization_id),0),
    coalesce((select sum(o.grand_total) from public.orders o where o.seller_organization_id=new.seller_organization_id and o.status='completed'),0),
    (select created_at from public.organizations where id=new.seller_organization_id and status='verified'),
    coalesce((select round(100.0*count(*) filter (where status='completed')/nullif(count(*),0),2) from public.orders where seller_organization_id=new.seller_organization_id),0),
    coalesce((select round(100.0*count(*) filter (where status='disputed')/nullif(count(*),0),2) from public.orders where seller_organization_id=new.seller_organization_id),0),
    now()
  on conflict (organization_id) do update set
    rating=excluded.rating,completed_transaction_value=excluded.completed_transaction_value,
    verified_since=excluded.verified_since,order_completion_rate=excluded.order_completion_rate,
    dispute_rate=excluded.dispute_rate,calculated_at=excluded.calculated_at;
  return new;
end;
$$;
create trigger review_refreshes_supplier_rating after insert on public.reviews
for each row execute function private.refresh_supplier_rating();

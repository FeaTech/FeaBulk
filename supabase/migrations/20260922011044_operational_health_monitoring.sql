create extension if not exists pg_cron with schema pg_catalog;

create table public.operational_incidents (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  category text not null check (category in ('order_stalled','payment_exception','payout_exception','shipment_exception','outbox_exception','document_exception','dispute_sla','verification_sla')),
  severity text not null check (severity in ('low','medium','high','critical')),
  entity_type text not null,
  entity_id uuid not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledgement_notes text,
  resolved_at timestamptz,
  last_scan_token uuid not null
);
create index operational_incidents_status_severity_idx on public.operational_incidents(status,severity,last_detected_at desc);
alter table public.operational_incidents enable row level security;
create policy "operations can read operational incidents" on public.operational_incidents
for select to authenticated using (exists(select 1 from public.operations_members where user_id=(select auth.uid())));
revoke insert,update,delete on public.operational_incidents from anon,authenticated;

create or replace function private.upsert_operational_incident(
  scan_token_input uuid, category_input text, severity_input text,
  entity_type_input text, entity_id_input uuid, summary_input text, details_input jsonb
)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare previous_status text;
declare incident_id uuid;
begin
  select status into previous_status from public.operational_incidents where fingerprint=category_input||':'||entity_id_input::text;
  insert into public.operational_incidents(fingerprint,category,severity,entity_type,entity_id,summary,details,status,last_scan_token)
  values(category_input||':'||entity_id_input::text,category_input,severity_input,entity_type_input,entity_id_input,summary_input,coalesce(details_input,'{}'::jsonb),'open',scan_token_input)
  on conflict(fingerprint) do update set
    severity=excluded.severity,summary=excluded.summary,details=excluded.details,last_detected_at=now(),last_scan_token=excluded.last_scan_token,
    status=case when public.operational_incidents.status='resolved' then 'open' else public.operational_incidents.status end,
    resolved_at=case when public.operational_incidents.status='resolved' then null else public.operational_incidents.resolved_at end
  returning id into incident_id;
  if previous_status is null or previous_status='resolved' then
    insert into public.notifications(user_id,channel,template_key,payload,critical)
    select distinct om.user_id,'in_app'::public.notification_channel,'operations.incident_opened',
      jsonb_build_object('incident_id',incident_id,'category',category_input,'severity',severity_input,'summary',summary_input),severity_input in ('high','critical')
    from public.operations_members om
    where om.role in ('support_agent','payments_reviewer','platform_administrator');
  end if;
end;
$$;
revoke all on function private.upsert_operational_incident(uuid,text,text,text,uuid,text,jsonb) from public;

create or replace function private.scan_operational_health()
returns integer language plpgsql security definer set search_path=public,private,pg_temp as $$
declare scan_token uuid := gen_random_uuid();
declare item record;
declare detected integer := 0;
begin
  for item in
    select id,status,created_at from public.orders
    where (status='awaiting_seller_confirmation' and created_at<now()-interval '24 hours')
       or (status='awaiting_payment' and updated_at<now()-interval '2 hours')
       or (status='inspection' and inspection_ends_at<now()-interval '1 hour')
  loop
    perform private.upsert_operational_incident(scan_token,'order_stalled','medium','order',item.id,'Order is stalled in '||replace(item.status::text,'_',' '),jsonb_build_object('status',item.status,'created_at',item.created_at));
    detected := detected+1;
  end loop;
  for item in
    select id,status,reconciliation_status,order_id,created_at from public.payment_transactions
    where reconciliation_status='exception' or status='failed' or (status in ('initiated','pending') and created_at<now()-interval '30 minutes')
  loop
    perform private.upsert_operational_incident(scan_token,'payment_exception',case when item.reconciliation_status='exception' then 'critical' else 'high' end,'payment_transaction',item.id,'Payment requires review',jsonb_build_object('order_id',item.order_id,'status',item.status,'reconciliation_status',item.reconciliation_status));
    detected := detected+1;
  end loop;
  for item in
    select id,status,order_id,eligible_at from public.payouts
    where status='failed' or (status='eligible' and eligible_at<now()-interval '24 hours')
  loop
    perform private.upsert_operational_incident(scan_token,'payout_exception',case when item.status='failed' then 'critical' else 'high' end,'payout',item.id,'Seller payout requires review',jsonb_build_object('order_id',item.order_id,'status',item.status,'eligible_at',item.eligible_at));
    detected := detected+1;
  end loop;
  for item in
    select id,status,order_id,estimated_delivery_at from public.shipments
    where status='exception' or (status in ('dispatched','in_transit') and estimated_delivery_at<now()-interval '1 day')
  loop
    perform private.upsert_operational_incident(scan_token,'shipment_exception','high','shipment',item.id,'Shipment requires intervention',jsonb_build_object('order_id',item.order_id,'status',item.status,'estimated_delivery_at',item.estimated_delivery_at));
    detected := detected+1;
  end loop;
  for item in
    select id,event_type,attempts,failed_at,last_error,created_at from public.outbox_events
    where failed_at is not null or attempts>=5 or (processed_at is null and available_at<now()-interval '15 minutes')
  loop
    perform private.upsert_operational_incident(scan_token,'outbox_exception',case when item.failed_at is not null or item.attempts>=5 then 'critical' else 'medium' end,'outbox_event',item.id,'Event delivery is delayed or failed',jsonb_build_object('event_type',item.event_type,'attempts',item.attempts,'last_error',item.last_error,'created_at',item.created_at));
    detected := detected+1;
  end loop;
  for item in
    select id,document_type,status,failure_code,created_at from public.commercial_document_jobs
    where status='failed' or (status='reserved' and created_at<now()-interval '15 minutes')
  loop
    perform private.upsert_operational_incident(scan_token,'document_exception',case when item.status='failed' then 'high' else 'medium' end,'commercial_document_job',item.id,'Commercial document generation requires review',jsonb_build_object('document_type',item.document_type,'status',item.status,'failure_code',item.failure_code));
    detected := detected+1;
  end loop;
  for item in select id,order_id,status,opened_at from public.disputes where status<>'resolved' and opened_at<now()-interval '72 hours'
  loop
    perform private.upsert_operational_incident(scan_token,'dispute_sla','high','dispute',item.id,'Dispute has exceeded the 72 hour response target',jsonb_build_object('order_id',item.order_id,'status',item.status,'opened_at',item.opened_at));
    detected := detected+1;
  end loop;
  for item in select id,organization_id,status,submitted_at from public.verification_cases where status in ('submitted','under_review') and submitted_at<now()-interval '48 hours'
  loop
    perform private.upsert_operational_incident(scan_token,'verification_sla','medium','verification_case',item.id,'Business verification has exceeded the 48 hour response target',jsonb_build_object('organization_id',item.organization_id,'status',item.status,'submitted_at',item.submitted_at));
    detected := detected+1;
  end loop;
  update public.operational_incidents set status='resolved',resolved_at=now()
  where status in ('open','acknowledged') and last_scan_token<>scan_token;
  return detected;
end;
$$;
revoke all on function private.scan_operational_health() from public;

create or replace function public.get_operations_health_command()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.operations_members where user_id=(select auth.uid())) then raise exception 'Operations access denied'; end if;
  return jsonb_build_object(
    'summary',jsonb_build_object(
      'open',count(*) filter(where status='open'),
      'acknowledged',count(*) filter(where status='acknowledged'),
      'critical',count(*) filter(where status<>'resolved' and severity='critical'),
      'high',count(*) filter(where status<>'resolved' and severity='high')
    ),
    'incidents',coalesce(jsonb_agg(to_jsonb(i) order by case severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,last_detected_at desc) filter(where status<>'resolved'),'[]'::jsonb)
  ) from (select * from public.operational_incidents where status<>'resolved' order by last_detected_at desc limit 100) i;
end;
$$;
revoke all on function public.get_operations_health_command() from public;
grant execute on function public.get_operations_health_command() to authenticated;

create or replace function public.acknowledge_operational_incident_command(incident_id_input uuid,notes_input text)
returns public.operational_incidents language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.operational_incidents;
begin
  if not exists(select 1 from public.operations_members where user_id=(select auth.uid()) and role in ('support_agent','payments_reviewer','platform_administrator')) then raise exception 'Incident response access denied'; end if;
  if char_length(trim(coalesce(notes_input,'')))<10 then raise exception 'Acknowledgement notes must have at least 10 characters'; end if;
  update public.operational_incidents set status='acknowledged',acknowledged_at=now(),acknowledged_by=(select auth.uid()),acknowledgement_notes=trim(notes_input)
  where id=incident_id_input and status='open' returning * into target;
  if not found then raise exception 'Open incident not found'; end if;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,metadata)
  values((select auth.uid()),'operational_incident.acknowledged','operational_incident',target.id,jsonb_build_object('notes',trim(notes_input)));
  return target;
end;
$$;
revoke all on function public.acknowledge_operational_incident_command(uuid,text) from public;
grant execute on function public.acknowledge_operational_incident_command(uuid,text) to authenticated;

create or replace function public.run_operational_health_scan_command()
returns integer language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if not exists(select 1 from public.operations_members where user_id=(select auth.uid()) and role='platform_administrator') then raise exception 'Platform administrator access denied'; end if;
  return private.scan_operational_health();
end;
$$;
revoke all on function public.run_operational_health_scan_command() from public;
grant execute on function public.run_operational_health_scan_command() to authenticated;

select private.scan_operational_health();
select cron.unschedule(jobid) from cron.job where jobname='fea-operational-health-scan';
select cron.schedule('fea-operational-health-scan','*/5 * * * *','select private.scan_operational_health()');

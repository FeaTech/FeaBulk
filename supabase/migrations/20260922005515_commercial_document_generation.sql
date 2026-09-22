-- Authenticated, auditable generation of immutable commercial documents.

create table public.commercial_document_sequences (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  document_type public.document_type not null,
  fiscal_year char(4) not null check (fiscal_year ~ '^[0-9]{4}$'),
  last_number bigint not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, document_type, fiscal_year)
);

create table public.commercial_document_jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  document_type public.document_type not null,
  document_number text not null,
  version integer not null check (version > 0),
  storage_path text not null unique,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'reserved' check (status in ('reserved','generated','failed')),
  failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (order_id, document_type, version)
);
create index commercial_document_jobs_order_idx on public.commercial_document_jobs(order_id, created_at desc);

alter table public.products add constraint products_hsn_code_format check (hsn_code is null or hsn_code ~ '^[0-9]{4,8}$');

create or replace function private.copy_product_tax_details_to_order_line()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.product_id is not null then
    new.seller_sku := coalesce(new.seller_sku,(select p.seller_sku::text from public.products p where p.id=new.product_id));
    new.hsn_code := coalesce(new.hsn_code,(select p.hsn_code from public.products p where p.id=new.product_id));
  end if;
  return new;
end;
$$;
create trigger order_line_product_tax_details before insert on public.order_lines
for each row execute function private.copy_product_tax_details_to_order_line();

create or replace function public.update_product_draft_command(product_id_input uuid, payload jsonb)
returns public.products language plpgsql security definer set search_path=public,private,pg_temp as $$
declare target public.products;
begin
  select * into target from public.products where id=product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(target.organization_id,array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if target.listing_status <> 'draft' or target.moderation_status <> 'pending' or target.submitted_for_review_at is not null then raise exception 'Product terms are locked during review'; end if;
  update public.products set
    name=coalesce(nullif(trim(payload->>'name'),''),name),
    description=coalesce(nullif(trim(payload->>'description'),''),description),
    slug=coalesce(nullif(trim(payload->>'slug'),''),slug::text)::citext,
    category_id=coalesce(nullif(payload->>'category_id','')::uuid,category_id),
    seller_sku=coalesce(nullif(trim(payload->>'seller_sku'),''),seller_sku::text)::citext,
    hsn_code=coalesce(nullif(trim(payload->>'hsn_code'),''),hsn_code),
    unit_of_measure=coalesce(nullif(trim(payload->>'unit_of_measure'),''),unit_of_measure),
    minimum_order_quantity=coalesce((payload->>'minimum_order_quantity')::bigint,minimum_order_quantity),
    gst_rate=coalesce((payload->>'gst_rate')::numeric,gst_rate),
    lead_time_days=coalesce((payload->>'lead_time_days')::integer,lead_time_days)
  where id=target.id returning * into target;
  insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id)
  values(target.organization_id,(select auth.uid()),'product.draft_updated','product',target.id);
  return target;
end;
$$;

alter table public.commercial_document_sequences enable row level security;
alter table public.commercial_document_jobs enable row level security;
revoke all on public.commercial_document_sequences, public.commercial_document_jobs from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('commercial-documents', 'commercial-documents', false, 2097152, array['text/html'])
on conflict (id) do update set public=false, file_size_limit=2097152, allowed_mime_types=array['text/html'];

drop policy if exists "order counterparties can download commercial documents" on storage.objects;
create policy "order counterparties can download commercial documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'commercial-documents'
  and exists (
    select 1
    from public.commercial_documents d
    join public.orders o on o.id = d.order_id
    where d.storage_path = name
      and (private.is_member(o.buyer_organization_id) or private.is_member(o.seller_organization_id))
  )
);

drop policy if exists "organization can read commercial documents" on public.commercial_documents;
create policy "order counterparties can read commercial documents"
on public.commercial_documents for select to authenticated
using (
  private.is_member(organization_id)
  or exists (
    select 1 from public.orders o
    where o.id=order_id and (private.is_member(o.buyer_organization_id) or private.is_member(o.seller_organization_id))
  )
);

create or replace function public.set_order_line_tax_details_command(
  order_line_id_input uuid, hsn_code_input text
)
returns public.order_lines language plpgsql security definer set search_path=public,private,pg_temp as $$
declare target_line public.order_lines;
declare target_order public.orders;
begin
  select * into target_line from public.order_lines where id=order_line_id_input for update;
  if not found then raise exception 'Order line not found'; end if;
  select * into target_order from public.orders where id=target_line.order_id;
  if not private.has_any_role(target_order.seller_organization_id,array['owner','administrator','sales_manager','accountant']::public.organization_role[]) then
    raise exception 'Tax document access denied';
  end if;
  if target_order.status in ('completed','cancelled','returned') then raise exception 'Tax details are locked for this order'; end if;
  if trim(coalesce(hsn_code_input,'')) !~ '^[0-9]{4,8}$' then raise exception 'HSN code must contain 4 to 8 digits'; end if;
  if exists (select 1 from public.commercial_documents where order_id=target_order.id and type='tax_invoice') then
    raise exception 'Tax details are locked after tax invoice generation';
  end if;
  update public.order_lines set hsn_code=trim(hsn_code_input) where id=target_line.id returning * into target_line;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (target_order.seller_organization_id,(select auth.uid()),'order_line.tax_details_updated','order_line',target_line.id,jsonb_build_object('order_id',target_order.id));
  return target_line;
end;
$$;
revoke all on function public.set_order_line_tax_details_command(uuid,text) from public;
grant execute on function public.set_order_line_tax_details_command(uuid,text) to authenticated;

create or replace function public.reserve_commercial_document_internal(
  actor_id_input uuid, organization_id_input uuid, order_id_input uuid,
  document_type_input public.document_type, request_id_input uuid
)
returns public.commercial_document_jobs language plpgsql security definer set search_path=public,pg_temp as $$
declare target_order public.orders;
declare target_org public.organizations;
declare buyer_org public.organizations;
declare target_job public.commercial_document_jobs;
declare allowed boolean := false;
declare next_version integer;
declare next_number bigint;
declare fiscal_year text;
declare type_prefix text;
begin
  if actor_id_input is null or request_id_input is null then raise exception 'Actor and request ID are required'; end if;
  select * into target_job from public.commercial_document_jobs where request_id=request_id_input;
  if found then
    if target_job.requested_by <> actor_id_input then raise exception 'Request ID belongs to another user'; end if;
    return target_job;
  end if;
  select * into target_order from public.orders where id=order_id_input;
  if not found then raise exception 'Order not found'; end if;
  select * into target_org from public.organizations where id=organization_id_input;
  if not found then raise exception 'Organization not found'; end if;
  if target_order.status in ('draft','cancelled') then raise exception 'Documents cannot be issued for this order state'; end if;
  if document_type_input='purchase_order' and organization_id_input=target_order.buyer_organization_id then
    select exists(select 1 from public.organization_members where organization_id=organization_id_input and user_id=actor_id_input and role in ('owner','administrator','procurement_manager','purchase_approver')) into allowed;
  elsif document_type_input in ('proforma_invoice','tax_invoice','delivery_challan','packing_list') and organization_id_input=target_order.seller_organization_id then
    select exists(select 1 from public.organization_members where organization_id=organization_id_input and user_id=actor_id_input and role in ('owner','administrator','sales_manager','accountant','warehouse_operator')) into allowed;
  end if;
  if not allowed then raise exception 'Document generation access denied'; end if;
  if document_type_input='tax_invoice' then
    if target_order.status not in ('payment_secured','processing','ready_to_ship','partially_fulfilled','shipped','delivered','inspection','completed','disputed') then
      raise exception 'A tax invoice can only be issued after payment is secured';
    end if;
    if target_org.status <> 'verified' or target_org.gstin is null then raise exception 'A verified seller GSTIN is required for a tax invoice'; end if;
    select * into buyer_org from public.organizations where id=target_order.buyer_organization_id;
    if buyer_org.gstin is null then raise exception 'The buyer GSTIN is required for a B2B tax invoice'; end if;
    if exists(select 1 from public.order_lines where order_id=target_order.id and coalesce(hsn_code,'') !~ '^[0-9]{4,8}$') then
      raise exception 'Every order line needs a valid HSN code before tax invoice generation';
    end if;
  end if;
  if document_type_input in ('delivery_challan','packing_list') and target_order.status not in ('processing','ready_to_ship','partially_fulfilled','shipped','delivered','inspection','completed','disputed') then
    raise exception 'Fulfilment documents require an order in processing or later';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(order_id_input::text||':'||document_type_input::text,0));
  select coalesce(max(version),0)+1 into next_version from public.commercial_document_jobs where order_id=order_id_input and document_type=document_type_input;
  fiscal_year := case when extract(month from current_date)>=4
    then to_char(current_date,'YY')||to_char(current_date+interval '1 year','YY')
    else to_char(current_date-interval '1 year','YY')||to_char(current_date,'YY') end;
  insert into public.commercial_document_sequences(organization_id,document_type,fiscal_year,last_number)
  values (organization_id_input,document_type_input,fiscal_year,1)
  on conflict on constraint commercial_document_sequences_pkey do update set last_number=public.commercial_document_sequences.last_number+1,updated_at=now()
  returning last_number into next_number;
  type_prefix := case document_type_input when 'purchase_order' then 'PO' when 'proforma_invoice' then 'PI' when 'tax_invoice' then 'TI' when 'delivery_challan' then 'DC' when 'packing_list' then 'PL' else 'DOC' end;
  insert into public.commercial_document_jobs(request_id,organization_id,order_id,document_type,document_number,version,storage_path,requested_by)
  values (request_id_input,organization_id_input,order_id_input,document_type_input,type_prefix||'/'||fiscal_year||'/'||lpad(next_number::text,6,'0'),next_version,
    organization_id_input::text||'/'||order_id_input::text||'/'||document_type_input::text||'/'||request_id_input::text||'.html',actor_id_input)
  returning * into target_job;
  return target_job;
end;
$$;
revoke all on function public.reserve_commercial_document_internal(uuid,uuid,uuid,public.document_type,uuid) from public;
grant execute on function public.reserve_commercial_document_internal(uuid,uuid,uuid,public.document_type,uuid) to service_role;

create or replace function public.finalize_commercial_document_internal(
  job_id_input uuid, content_sha256_input text, metadata_input jsonb
)
returns public.commercial_documents language plpgsql security definer set search_path=public,pg_temp as $$
declare target_job public.commercial_document_jobs;
declare created_document public.commercial_documents;
declare previous_id uuid;
declare other_organization_id uuid;
begin
  if content_sha256_input !~ '^[a-f0-9]{64}$' then raise exception 'Invalid content hash'; end if;
  select * into target_job from public.commercial_document_jobs where id=job_id_input for update;
  if not found then raise exception 'Document job not found'; end if;
  select * into created_document from public.commercial_documents where storage_path=target_job.storage_path;
  if found then return created_document; end if;
  if target_job.status='failed' then raise exception 'Failed document jobs cannot be finalized'; end if;
  select id into previous_id from public.commercial_documents where order_id=target_job.order_id and type=target_job.document_type order by version desc limit 1;
  insert into public.commercial_documents(organization_id,order_id,type,document_number,version,storage_path,content_sha256,generated_by,supersedes_id,metadata)
  values (target_job.organization_id,target_job.order_id,target_job.document_type,target_job.document_number,target_job.version,target_job.storage_path,content_sha256_input,target_job.requested_by,previous_id,coalesce(metadata_input,'{}'::jsonb))
  returning * into created_document;
  update public.commercial_document_jobs set status='generated',completed_at=now() where id=target_job.id;
  select case when o.buyer_organization_id=target_job.organization_id then o.seller_organization_id else o.buyer_organization_id end
  into other_organization_id from public.orders o where o.id=target_job.order_id;
  insert into public.notifications(user_id,channel,template_key,payload,critical)
  select distinct m.user_id,'in_app'::public.notification_channel,'commercial_document.generated',jsonb_build_object('order_id',target_job.order_id,'document_id',created_document.id,'type',target_job.document_type,'document_number',target_job.document_number),false
  from public.organization_members m where m.organization_id=other_organization_id;
  insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id,request_id,metadata)
  values(target_job.organization_id,target_job.requested_by,'commercial_document.generated','commercial_document',created_document.id,target_job.request_id,jsonb_build_object('order_id',target_job.order_id,'type',target_job.document_type,'version',target_job.version,'sha256',content_sha256_input));
  return created_document;
end;
$$;
revoke all on function public.finalize_commercial_document_internal(uuid,text,jsonb) from public;
grant execute on function public.finalize_commercial_document_internal(uuid,text,jsonb) to service_role;

create or replace function public.fail_commercial_document_internal(job_id_input uuid, failure_code_input text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.commercial_document_jobs set status='failed',failure_code=left(coalesce(failure_code_input,'generation_failed'),120),completed_at=now()
  where id=job_id_input and status='reserved';
end;
$$;
revoke all on function public.fail_commercial_document_internal(uuid,text) from public;
grant execute on function public.fail_commercial_document_internal(uuid,text) to service_role;

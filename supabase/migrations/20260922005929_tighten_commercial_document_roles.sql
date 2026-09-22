create or replace function private.enforce_commercial_document_job_permissions()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target_order public.orders;
declare allowed boolean := false;
begin
  select * into target_order from public.orders where id=new.order_id;
  if not found then raise exception 'Order not found'; end if;
  if new.document_type='purchase_order' and new.organization_id=target_order.buyer_organization_id then
    select exists(select 1 from public.organization_members where organization_id=new.organization_id and user_id=new.requested_by and role in ('owner','administrator','procurement_manager','purchase_approver')) into allowed;
  elsif new.document_type in ('proforma_invoice','tax_invoice') and new.organization_id=target_order.seller_organization_id then
    select exists(select 1 from public.organization_members where organization_id=new.organization_id and user_id=new.requested_by and role in ('owner','administrator','sales_manager','accountant')) into allowed;
  elsif new.document_type in ('delivery_challan','packing_list') and new.organization_id=target_order.seller_organization_id then
    select exists(select 1 from public.organization_members where organization_id=new.organization_id and user_id=new.requested_by and role in ('owner','administrator','sales_manager','warehouse_operator')) into allowed;
  end if;
  if not allowed then raise exception 'Document generation access denied'; end if;
  return new;
end;
$$;
revoke all on function private.enforce_commercial_document_job_permissions() from public;
create trigger commercial_document_job_permission_check
before insert on public.commercial_document_jobs
for each row execute function private.enforce_commercial_document_job_permissions();

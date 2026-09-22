alter table public.products add column moderation_notes text;
alter table public.products add column moderated_at timestamptz;

create or replace function public.moderate_product_command(product_id_input uuid, approve_input boolean, notes_input text)
returns public.products language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.products;
begin
  if not exists (select 1 from public.operations_members where user_id = (select auth.uid()) and role in ('catalog_moderator','platform_administrator')) then raise exception 'Moderator access denied'; end if;
  if char_length(trim(coalesce(notes_input,''))) < 10 then raise exception 'Moderation notes must have at least 10 characters'; end if;
  select * into target from public.products where id = product_id_input for update;
  if not found or target.listing_status <> 'draft' or target.moderation_status <> 'pending' or target.submitted_for_review_at is null then raise exception 'Product is not pending moderation'; end if;
  if not exists (select 1 from public.product_price_tiers where product_id = target.id) then raise exception 'Product has no price tiers'; end if;
  update public.products set
    moderation_status = case when approve_input then 'approved'::public.moderation_status else 'rejected'::public.moderation_status end,
    listing_status = case when approve_input then 'active'::public.listing_status else 'draft'::public.listing_status end,
    moderation_notes = trim(notes_input),
    moderated_at = now()
  where id = target.id returning * into target;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (target.organization_id,(select auth.uid()),'product.moderated','product',target.id,jsonb_build_object('approved',approve_input,'notes',trim(notes_input)));
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload)
  values ('product',target.id,'product.moderated',jsonb_build_object('approved',approve_input));
  return target;
end;
$$;

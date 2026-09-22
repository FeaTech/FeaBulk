-- Organization owners may edit descriptive fields, never verification state.
revoke update on public.organizations from authenticated;
grant update (legal_name, display_name, gstin) on public.organizations to authenticated;
alter table public.products add column submitted_for_review_at timestamptz;

create policy "reviewers can read verification cases" on public.verification_cases
for select to authenticated using (exists (
  select 1 from public.operations_members m where m.user_id = (select auth.uid())
  and m.role in ('verification_reviewer', 'platform_administrator')
));
create policy "moderators can read product drafts" on public.products
for select to authenticated using (exists (
  select 1 from public.operations_members m where m.user_id = (select auth.uid())
  and m.role in ('catalog_moderator', 'platform_administrator')
));

create or replace function public.submit_verification_case_command(organization_id_input uuid)
returns public.verification_cases language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.verification_cases;
begin
  if not private.has_any_role(organization_id_input, array['owner','administrator']::public.organization_role[]) then raise exception 'Verification access denied'; end if;
  select * into target from public.verification_cases where organization_id = organization_id_input for update;
  if not found or target.status not in ('draft','rejected','resubmission_required') then raise exception 'Verification case cannot be submitted'; end if;
  if target.registered_address is null or coalesce(target.registered_address->>'address_line','') = '' then raise exception 'Registered address is required'; end if;
  update public.verification_cases set status = 'submitted', submitted_at = now(), reviewer_notes = null
  where id = target.id returning * into target;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id)
  values (organization_id_input,(select auth.uid()),'verification.submitted','verification_case',target.id);
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload)
  values ('verification_case',target.id,'verification.submitted',jsonb_build_object('organization_id',organization_id_input));
  return target;
end;
$$;
revoke all on function public.submit_verification_case_command(uuid) from public;
grant execute on function public.submit_verification_case_command(uuid) to authenticated;

create or replace function public.review_verification_case_command(case_id_input uuid, approve_input boolean, notes_input text)
returns public.verification_cases language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.verification_cases;
begin
  if not exists (select 1 from public.operations_members where user_id = (select auth.uid()) and role in ('verification_reviewer','platform_administrator')) then raise exception 'Reviewer access denied'; end if;
  if char_length(trim(coalesce(notes_input,''))) < 10 then raise exception 'Review notes must have at least 10 characters'; end if;
  select * into target from public.verification_cases where id = case_id_input for update;
  if not found or target.status not in ('submitted','under_review') then raise exception 'Verification case is not ready for review'; end if;
  update public.verification_cases set status = case when approve_input then 'approved'::public.verification_status else 'rejected'::public.verification_status end,
    reviewed_at = now(), reviewer_notes = trim(notes_input), verified_until = case when approve_input then now() + interval '1 year' else null end
  where id = target.id returning * into target;
  update public.organizations set status = case when approve_input then 'verified' else 'pending_verification' end where id = target.organization_id;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (target.organization_id,(select auth.uid()),'verification.reviewed','verification_case',target.id,jsonb_build_object('approved',approve_input));
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload)
  values ('verification_case',target.id,'verification.reviewed',jsonb_build_object('organization_id',target.organization_id,'approved',approve_input));
  return target;
end;
$$;
revoke all on function public.review_verification_case_command(uuid,boolean,text) from public;
grant execute on function public.review_verification_case_command(uuid,boolean,text) to authenticated;

create or replace function public.submit_product_for_review_command(product_id_input uuid)
returns public.products language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.products;
begin
  select * into target from public.products where id = product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(target.organization_id,array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if target.listing_status <> 'draft' or target.moderation_status <> 'pending' or target.submitted_for_review_at is not null then raise exception 'Product is not a draft pending review'; end if;
  if not exists (select 1 from public.product_price_tiers where product_id = target.id) then raise exception 'At least one price tier is required'; end if;
  if not exists (select 1 from public.organizations where id = target.organization_id and status = 'verified') then raise exception 'Seller verification is required'; end if;
  update public.products set submitted_for_review_at = now() where id = target.id returning * into target;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id)
  values (target.organization_id,(select auth.uid()),'product.submitted_for_review','product',target.id);
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload)
  values ('product',target.id,'product.submitted_for_review',jsonb_build_object('product_id',target.id));
  return target;
end;
$$;
revoke all on function public.submit_product_for_review_command(uuid) from public;
grant execute on function public.submit_product_for_review_command(uuid) to authenticated;

create or replace function public.moderate_product_command(product_id_input uuid, approve_input boolean, notes_input text)
returns public.products language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.products;
begin
  if not exists (select 1 from public.operations_members where user_id = (select auth.uid()) and role in ('catalog_moderator','platform_administrator')) then raise exception 'Moderator access denied'; end if;
  if char_length(trim(coalesce(notes_input,''))) < 10 then raise exception 'Moderation notes must have at least 10 characters'; end if;
  select * into target from public.products where id = product_id_input for update;
  if not found or target.listing_status <> 'draft' or target.moderation_status <> 'pending' or target.submitted_for_review_at is null then raise exception 'Product is not pending moderation'; end if;
  if not exists (select 1 from public.product_price_tiers where product_id = target.id) then raise exception 'Product has no price tiers'; end if;
  update public.products set moderation_status = case when approve_input then 'approved'::public.moderation_status else 'rejected'::public.moderation_status end,
    listing_status = case when approve_input then 'active'::public.listing_status else 'draft'::public.listing_status end
  where id = target.id returning * into target;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (target.organization_id,(select auth.uid()),'product.moderated','product',target.id,jsonb_build_object('approved',approve_input,'notes',trim(notes_input)));
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload)
  values ('product',target.id,'product.moderated',jsonb_build_object('approved',approve_input));
  return target;
end;
$$;
revoke all on function public.moderate_product_command(uuid,boolean,text) from public;
grant execute on function public.moderate_product_command(uuid,boolean,text) to authenticated;

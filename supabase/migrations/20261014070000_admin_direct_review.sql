-- The admin could only approve or reject a business after the owner pressed "Submit for
-- verification", and a product after the seller pressed "Submit for review". Sellers who
-- never pressed those buttons left the admin with nothing to act on. These commands now
-- also accept a business or product that has not been submitted yet. Every other rule
-- stays: a product still needs a price tier that includes its minimum order quantity
-- (check_price_tier_coverage) and a verified seller (assert_seller_product) to go live.

create or replace function public.review_verification_case_command(case_id_input uuid, approve_input boolean, notes_input text)
returns public.verification_cases language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.verification_cases; final_notes text;
begin
  if not exists (select 1 from public.operations_members where user_id = (select auth.uid()) and role in ('verification_reviewer','platform_administrator')) then raise exception 'Reviewer access denied'; end if;
  final_notes := nullif(trim(coalesce(notes_input,'')), '');
  if final_notes is null then
    final_notes := case when approve_input then 'Approved by FeaBulk Admin' else 'Rejected by FeaBulk Admin' end;
  end if;
  select * into target from public.verification_cases where id = case_id_input for update;
  if not found or target.status not in ('draft','submitted','under_review','resubmission_required') then raise exception 'Verification case is not ready for review'; end if;
  update public.verification_cases set status = case when approve_input then 'approved'::public.verification_status else 'rejected'::public.verification_status end,
    submitted_at = coalesce(submitted_at, now()),
    reviewed_at = now(), reviewer_notes = final_notes, verified_until = case when approve_input then now() + interval '1 year' else null end
  where id = target.id returning * into target;
  update public.organizations set status = case when approve_input then 'verified' else 'pending_verification' end where id = target.organization_id;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (target.organization_id,(select auth.uid()),'verification.reviewed','verification_case',target.id,jsonb_build_object('approved',approve_input));
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload)
  values ('verification_case',target.id,'verification.reviewed',jsonb_build_object('organization_id',target.organization_id,'approved',approve_input));
  return target;
end;
$$;

create or replace function public.moderate_product_command(product_id_input uuid, approve_input boolean, notes_input text)
returns public.products language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.products;
begin
  if not exists (select 1 from public.operations_members where user_id = (select auth.uid()) and role in ('catalog_moderator','platform_administrator')) then raise exception 'Moderator access denied'; end if;
  if char_length(trim(coalesce(notes_input,''))) < 10 then raise exception 'Moderation notes must have at least 10 characters'; end if;
  select * into target from public.products where id = product_id_input for update;
  if not found or target.listing_status <> 'draft' or target.moderation_status <> 'pending' then raise exception 'Product is not pending moderation'; end if;
  if approve_input and not exists (select 1 from public.product_price_tiers where product_id = target.id) then raise exception 'Product has no price tiers'; end if;
  update public.products set
    moderation_status = case when approve_input then 'approved'::public.moderation_status else 'rejected'::public.moderation_status end,
    listing_status = case when approve_input then 'active'::public.listing_status else 'draft'::public.listing_status end,
    -- Approving an unsent draft counts as its submission, which runs the price tier check.
    submitted_for_review_at = case when approve_input then coalesce(submitted_for_review_at, now()) else submitted_for_review_at end,
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

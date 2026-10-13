CREATE OR REPLACE FUNCTION public.review_verification_case_command(case_id_input uuid, approve_input boolean, notes_input text)
 RETURNS verification_cases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare target public.verification_cases; final_notes text;
begin
  if not exists (select 1 from public.operations_members where user_id = (select auth.uid()) and role in ('verification_reviewer','platform_administrator')) then raise exception 'Reviewer access denied'; end if;
  final_notes := nullif(trim(coalesce(notes_input,'')), '');
  if final_notes is null then
    final_notes := case when approve_input then 'Approved by FeaBulk Admin' else 'Rejected by FeaBulk Admin' end;
  end if;
  select * into target from public.verification_cases where id = case_id_input for update;
  if not found or target.status not in ('submitted','under_review') then raise exception 'Verification case is not ready for review'; end if;
  update public.verification_cases set status = case when approve_input then 'approved'::public.verification_status else 'rejected'::public.verification_status end,
    reviewed_at = now(), reviewer_notes = final_notes, verified_until = case when approve_input then now() + interval '1 year' else null end
  where id = target.id returning * into target;
  update public.organizations set status = case when approve_input then 'verified' else 'pending_verification' end where id = target.organization_id;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (target.organization_id,(select auth.uid()),'verification.reviewed','verification_case',target.id,jsonb_build_object('approved',approve_input));
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload)
  values ('verification_case',target.id,'verification.reviewed',jsonb_build_object('organization_id',target.organization_id,'approved',approve_input));
  return target;
end;
$function$;
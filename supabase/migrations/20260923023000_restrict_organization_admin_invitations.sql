-- Organization membership and FEA operations access are separate permission
-- systems. Business users may invite scoped teammates, but owner and
-- administrator assignments must be performed through a trusted backend flow.
alter table public.organization_invitations
  drop constraint if exists organization_invitations_role_check;

alter table public.organization_invitations
  add constraint organization_invitations_role_check
  check (role not in ('owner', 'administrator'));

create or replace function public.create_organization_invitation_command(
  organization_id_input uuid,
  email_input text,
  role_input public.organization_role
)
returns public.organization_invitations
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare created public.organization_invitations;
begin
  if not private.has_any_role(organization_id_input,array['owner','administrator']::public.organization_role[]) then
    raise exception 'Team management access denied';
  end if;
  if role_input in ('owner','administrator') or trim(coalesce(email_input,'')) !~* '^[^ @]+@[^ @]+\.[^ @]+$' then
    raise exception 'Valid email and an allowed business role are required';
  end if;
  insert into public.organization_invitations (organization_id,email,role,invited_by)
  values (organization_id_input,lower(trim(email_input))::citext,role_input,(select auth.uid()))
  returning * into created;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id,metadata)
  values (organization_id_input,(select auth.uid()),'team.invited','organization_invitation',created.id,jsonb_build_object('role',role_input));
  return created;
end;
$$;

revoke all on function public.create_organization_invitation_command(uuid,text,public.organization_role) from public;
grant execute on function public.create_organization_invitation_command(uuid,text,public.organization_role) to authenticated;

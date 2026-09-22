create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email citext not null,
  role public.organization_role not null check (role <> 'owner'),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check ((accepted_by is null) = (accepted_at is null))
);
create index organization_invitations_org_idx on public.organization_invitations(organization_id,created_at desc);
alter table public.organization_invitations enable row level security;
create policy "owners and admins read invitations" on public.organization_invitations
for select to authenticated using (private.has_any_role(organization_id,array['owner','administrator']::public.organization_role[]));
revoke insert,update,delete on public.organization_invitations from anon,authenticated;
revoke insert,update,delete on public.organization_members from authenticated;

create or replace function public.create_organization_invitation_command(organization_id_input uuid, email_input text, role_input public.organization_role)
returns public.organization_invitations language plpgsql security definer set search_path = public, private, pg_temp as $$
declare created public.organization_invitations;
begin
  if not private.has_any_role(organization_id_input,array['owner','administrator']::public.organization_role[]) then raise exception 'Team management access denied'; end if;
  if role_input = 'owner' or trim(coalesce(email_input,'')) !~* '^[^ @]+@[^ @]+\.[^ @]+$' then raise exception 'Valid email and non-owner role are required'; end if;
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

create or replace function public.accept_organization_invitation_command(token_input uuid)
returns public.organization_members language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.organization_invitations;
declare account_email citext;
declare account_confirmed timestamptz;
declare membership public.organization_members;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into target from public.organization_invitations where token = token_input for update;
  if not found or target.accepted_at is not null or target.expires_at <= now() then raise exception 'Invitation is invalid or expired'; end if;
  select email::citext,email_confirmed_at into account_email,account_confirmed from auth.users where id = (select auth.uid());
  if account_confirmed is null or account_email <> target.email then raise exception 'Sign in with the confirmed invited email'; end if;
  if exists (select 1 from public.organization_members where organization_id = target.organization_id and user_id = (select auth.uid())) then raise exception 'Already a team member'; end if;
  insert into public.organization_members (organization_id,user_id,role)
  values (target.organization_id,(select auth.uid()),target.role) returning * into membership;
  update public.organization_invitations set accepted_at = now(), accepted_by = (select auth.uid()) where id = target.id;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id)
  values (target.organization_id,(select auth.uid()),'team.invitation_accepted','organization_member',(select auth.uid()));
  return membership;
end;
$$;
revoke all on function public.accept_organization_invitation_command(uuid) from public;
grant execute on function public.accept_organization_invitation_command(uuid) to authenticated;

create or replace function public.list_team_members_command(organization_id_input uuid)
returns table(user_id uuid,email text,role public.organization_role,joined_at timestamptz)
language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_member(organization_id_input) then raise exception 'Team access denied'; end if;
  return query select m.user_id,u.email::text,m.role,m.created_at
  from public.organization_members m join auth.users u on u.id = m.user_id
  where m.organization_id = organization_id_input order by m.created_at;
end;
$$;
revoke all on function public.list_team_members_command(uuid) from public;
grant execute on function public.list_team_members_command(uuid) to authenticated;

create or replace function private.prevent_last_owner_removal()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner' or new.organization_id <> old.organization_id) then
    perform 1 from public.organizations where id = old.organization_id for update;
    if (select count(*) from public.organization_members where organization_id = old.organization_id and role = 'owner') <= 1 then
      raise exception 'An organization must retain an owner';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger organization_retains_owner before update or delete on public.organization_members
for each row execute function private.prevent_last_owner_removal();

create or replace function public.remove_team_member_command(organization_id_input uuid, user_id_input uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not private.has_any_role(organization_id_input,array['owner']::public.organization_role[]) then raise exception 'Only an owner can remove team members'; end if;
  if user_id_input = (select auth.uid()) then raise exception 'Owners cannot remove themselves'; end if;
  delete from public.organization_members where organization_id = organization_id_input and user_id = user_id_input;
  if not found then raise exception 'Team member not found'; end if;
  insert into public.audit_events (organization_id,actor_id,action,entity_type,entity_id)
  values (organization_id_input,(select auth.uid()),'team.member_removed','organization_member',user_id_input);
end;
$$;
revoke all on function public.remove_team_member_command(uuid,uuid) from public;
grant execute on function public.remove_team_member_command(uuid,uuid) to authenticated;

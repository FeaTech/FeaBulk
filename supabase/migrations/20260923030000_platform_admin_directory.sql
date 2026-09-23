-- Platform administrators need a complete account and organization directory,
-- but auth.users must never be exposed through a client-readable table.
create or replace function public.get_platform_accounts_command()
returns table (
  user_id uuid,
  email text,
  full_name text,
  email_confirmed boolean,
  account_created_at timestamptz,
  last_sign_in_at timestamptz,
  organization_count bigint,
  organization_names text,
  operations_roles text[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.operations_members
    where user_id = (select auth.uid()) and role = 'platform_administrator'
  ) then
    raise exception 'Platform administrator access required';
  end if;

  return query
  select
    u.id,
    u.email::text,
    p.full_name,
    u.email_confirmed_at is not null,
    u.created_at,
    u.last_sign_in_at,
    count(distinct m.organization_id),
    coalesce(string_agg(distinct o.display_name, ', ' order by o.display_name), ''),
    coalesce(array_agg(distinct op.role::text) filter (where op.role is not null), array[]::text[])
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.organization_members m on m.user_id = u.id
  left join public.organizations o on o.id = m.organization_id
  left join public.operations_members op on op.user_id = u.id
  group by u.id, u.email, p.full_name, u.email_confirmed_at, u.created_at, u.last_sign_in_at
  order by u.created_at desc;
end;
$$;

create or replace function public.get_platform_organizations_command()
returns table (
  organization_id uuid,
  legal_name text,
  display_name text,
  kind text,
  status text,
  gstin text,
  member_count bigint,
  verification_status text,
  organization_created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.operations_members
    where user_id = (select auth.uid()) and role = 'platform_administrator'
  ) then
    raise exception 'Platform administrator access required';
  end if;

  return query
  select
    o.id,
    o.legal_name,
    o.display_name,
    o.kind::text,
    o.status,
    o.gstin::text,
    count(distinct m.user_id),
    coalesce(v.status::text, 'not_started'),
    o.created_at
  from public.organizations o
  left join public.organization_members m on m.organization_id = o.id
  left join public.verification_cases v on v.organization_id = o.id
  group by o.id, o.legal_name, o.display_name, o.kind, o.status, o.gstin, v.status, o.created_at
  order by o.created_at desc;
end;
$$;

revoke all on function public.get_platform_accounts_command() from public;
revoke all on function public.get_platform_organizations_command() from public;
grant execute on function public.get_platform_accounts_command() to authenticated;
grant execute on function public.get_platform_organizations_command() to authenticated;

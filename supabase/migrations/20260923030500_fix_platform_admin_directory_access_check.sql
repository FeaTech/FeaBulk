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
    select 1 from public.operations_members om
    where om.user_id = (select auth.uid()) and om.role = 'platform_administrator'
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

revoke all on function public.get_platform_accounts_command() from public;
grant execute on function public.get_platform_accounts_command() to authenticated;

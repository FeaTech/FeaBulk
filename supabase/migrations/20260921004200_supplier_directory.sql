-- Public directory exposes only approved seller names and IDs, not tax details.
create view public.supplier_directory with (security_barrier = true) as
select id, display_name, created_at
from public.organizations
where kind in ('seller','both') and status = 'verified';
revoke all on public.supplier_directory from public;
grant select on public.supplier_directory to anon, authenticated;

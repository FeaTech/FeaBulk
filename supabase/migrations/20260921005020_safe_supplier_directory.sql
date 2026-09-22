drop view public.supplier_directory;
create table public.supplier_directory (
  id uuid primary key references public.organizations(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null
);
alter table public.supplier_directory enable row level security;
create policy "anyone can browse approved suppliers" on public.supplier_directory
for select using (true);
revoke insert, update, delete on public.supplier_directory from anon, authenticated;
grant select on public.supplier_directory to anon, authenticated;

create or replace function private.sync_supplier_directory()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.kind in ('seller','both') and new.status = 'verified' then
    insert into public.supplier_directory (id,display_name,created_at)
    values (new.id,new.display_name,new.created_at)
    on conflict (id) do update set display_name = excluded.display_name;
  else
    delete from public.supplier_directory where id = new.id;
  end if;
  return new;
end;
$$;
create trigger supplier_directory_synced after insert or update of kind,status,display_name
on public.organizations for each row execute function private.sync_supplier_directory();

insert into public.supplier_directory (id,display_name,created_at)
select id,display_name,created_at from public.organizations
where kind in ('seller','both') and status = 'verified';

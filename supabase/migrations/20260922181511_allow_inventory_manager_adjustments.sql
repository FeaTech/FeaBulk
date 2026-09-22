do $$
declare definition text;
begin
  select pg_get_functiondef('public.adjust_inventory_command(uuid,bigint,text,uuid)'::regprocedure) into definition;
  definition := replace(definition,
    $find$array['owner','administrator','sales_manager','catalog_manager','warehouse_operator']::public.organization_role[]$find$,
    $replace$array['owner','administrator','sales_manager','catalog_manager','inventory_manager','warehouse_operator']::public.organization_role[]$replace$);
  if position('inventory_manager' in definition)=0 then raise exception 'Could not add inventory manager permission'; end if;
  execute definition;
end;
$$;

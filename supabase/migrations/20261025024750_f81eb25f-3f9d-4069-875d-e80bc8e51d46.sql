CREATE OR REPLACE FUNCTION private.can_manage_product_images(product_id_input uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.products p
    where p.id = product_id_input
      and private.has_any_role(p.organization_id, array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[])
  );
$function$;
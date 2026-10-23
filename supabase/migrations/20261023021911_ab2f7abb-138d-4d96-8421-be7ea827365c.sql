alter function public.update_product_sale_command(uuid,jsonb,text,jsonb) set schema private;
create function public.update_product_sale_command(product_id_input uuid,payload jsonb,sale_type_input text,sale_settings_input jsonb) returns public.products language sql security invoker set search_path=public,pg_temp as $$ select private.update_product_sale_command(product_id_input,payload,sale_type_input,sale_settings_input) $$;
revoke all on function public.update_product_sale_command(uuid,jsonb,text,jsonb) from public,anon;
grant execute on function public.update_product_sale_command(uuid,jsonb,text,jsonb) to authenticated;
revoke all on function private.update_product_sale_command(uuid,jsonb,text,jsonb) from public,anon;
grant execute on function private.update_product_sale_command(uuid,jsonb,text,jsonb) to authenticated;
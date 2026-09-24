revoke execute on function public.ops_has_role(text[]) from public, anon;
revoke execute on function public.get_platform_orders_command() from public, anon;
revoke execute on function public.get_platform_payments_command() from public, anon;
revoke execute on function public.get_all_categories_command() from public, anon;
revoke execute on function public.upsert_category_command(uuid, text, text, uuid, boolean) from public, anon;
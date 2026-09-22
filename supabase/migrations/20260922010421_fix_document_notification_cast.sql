do $$
declare definition text;
begin
  select pg_get_functiondef('public.finalize_commercial_document_internal(uuid,text,jsonb)'::regprocedure) into definition;
  definition := replace(definition,
    $find$select distinct m.user_id,'in_app','commercial_document.generated'$find$,
    $replace$select distinct m.user_id,'in_app'::public.notification_channel,'commercial_document.generated'$replace$);
  if position($find$'in_app'::public.notification_channel$find$ in definition)=0 then
    raise exception 'Could not patch commercial document notification channel';
  end if;
  execute definition;
end;
$$;

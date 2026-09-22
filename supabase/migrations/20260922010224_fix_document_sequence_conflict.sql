do $$
declare definition text;
begin
  select pg_get_functiondef('public.reserve_commercial_document_internal(uuid,uuid,uuid,public.document_type,uuid)'::regprocedure) into definition;
  definition := replace(definition,
    'on conflict (organization_id,document_type,fiscal_year) do update',
    'on conflict on constraint commercial_document_sequences_pkey do update');
  if position('on conflict on constraint commercial_document_sequences_pkey' in definition)=0 then
    raise exception 'Could not patch commercial document sequence conflict target';
  end if;
  execute definition;
end;
$$;

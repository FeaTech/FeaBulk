-- Stream new trade messages to open conversations. Realtime checks the existing
-- SELECT policy on public.messages for every subscriber, so only the conversation's
-- counterparties receive a row and visibility rules keep applying.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- Moderators could read draft products and their images but not their price tiers,
-- so a listing under review showed no prices. Mirrors "moderators can read product drafts".
create policy "moderators can read price tiers" on public.product_price_tiers
for select to authenticated using (exists (
  select 1 from public.operations_members m where m.user_id = (select auth.uid())
  and m.role in ('catalog_moderator', 'platform_administrator')
));

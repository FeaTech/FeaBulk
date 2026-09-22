create or replace function private.lock_submitted_product_price_tiers()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare target_product_id uuid;
begin
  target_product_id := case when tg_op = 'DELETE' then old.product_id else new.product_id end;
  if exists (select 1 from public.products where id = target_product_id and submitted_for_review_at is not null) then
    raise exception 'Price tiers are locked after moderation submission';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger submitted_product_price_tiers_locked before insert or update or delete
on public.product_price_tiers for each row execute function private.lock_submitted_product_price_tiers();

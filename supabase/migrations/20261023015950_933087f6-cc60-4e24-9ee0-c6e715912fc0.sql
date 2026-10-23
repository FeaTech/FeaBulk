create or replace function public.auction_bid_deadline(starts_at_input timestamptz, ends_at_input timestamptz, now_input timestamptz) returns timestamptz language sql immutable set search_path=public,pg_temp as $$ select least(starts_at_input + interval '7 days', case when ends_at_input-now_input < interval '2 minutes' then now_input+interval '2 minutes' else ends_at_input end) $$;
create or replace function private.validate_auction() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin
 if new.ends_at-new.starts_at < interval '1 day' or new.ends_at-new.starts_at > interval '7 days' then raise exception 'Auctions must run between 1 and 7 days'; end if; return new; end $$;
drop trigger if exists auctions_validate on public.auctions;
create trigger auctions_validate before insert or update of starts_at,ends_at on public.auctions for each row execute function private.validate_auction();
do $$ declare definition text; begin
 select pg_get_functiondef('public.place_bid_command(uuid,uuid,numeric)'::regprocedure) into definition;
 definition := replace(definition, 'case when ends_at - now() < interval ''2 minutes'' then now() + interval ''2 minutes'' else ends_at end', 'public.auction_bid_deadline(starts_at, ends_at, now())');
 execute definition;
 select pg_get_functiondef('public.join_auction_command(uuid,uuid,jsonb)'::regprocedure) into definition;
 definition := replace(definition, 'where id = auction_id_input;', 'where id = auction_id_input for update;'); execute definition;
 select pg_get_functiondef('public.create_auction_command(uuid,jsonb)'::regprocedure) into definition;
 definition := replace(definition, 'where id = product_id_input;', 'where id = product_id_input for update;'); execute definition;
end $$;
create or replace function public.update_product_sale_command(product_id_input uuid,payload jsonb,sale_type_input text,sale_settings_input jsonb) returns public.products language plpgsql security definer set search_path=public,private,pg_temp as $$
declare p public.products; a public.auctions; tier public.product_price_tiers; begin
 select * into p from public.products where id=product_id_input for update;
 if not found or not private.has_any_role(p.organization_id,array['owner','administrator']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
 if p.listing_status <> 'draft' or p.moderation_status <> 'pending' or p.submitted_for_review_at is not null then raise exception 'Reopen the listing for review before changing sale terms'; end if;
 if sale_type_input is null or sale_type_input not in ('regular','auction') then raise exception 'Choose Regular sale or Auction'; end if;
 for a in select * from public.auctions where product_id=p.id and status in ('scheduled','awaiting_payment') for update loop
 if a.status='awaiting_payment' or a.bid_count>0 or exists(select 1 from public.auction_participants where auction_id=a.id) or exists(select 1 from public.auction_bids where auction_id=a.id) then raise exception 'Sale terms are locked because buyers have joined or bid'; end if;
 update public.auctions set status='cancelled' where id=a.id;
 end loop;
 p := public.update_product_draft_command(product_id_input,payload);
 if sale_type_input='auction' then
 for tier in select * from public.product_price_tiers where product_id=p.id loop perform public.delete_product_price_tier_command(tier.id); end loop;
 perform public.create_auction_command(p.id,sale_settings_input);
 else
 if coalesce((sale_settings_input->>'unit_price')::numeric,0)<=0 then raise exception 'Unit price must be greater than zero'; end if;
 for tier in select * from public.product_price_tiers where product_id=p.id loop perform public.delete_product_price_tier_command(tier.id); end loop;
 perform public.add_product_price_tier_command(p.id,p.minimum_order_quantity,greatest(p.available_quantity,p.minimum_order_quantity),(sale_settings_input->>'unit_price')::numeric);
 end if;
 insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id,metadata) values(p.organization_id,auth.uid(),'product.sale_updated','product',p.id,jsonb_build_object('sale_type',sale_type_input)); return p;
end $$;
revoke all on function public.update_product_sale_command(uuid,jsonb,text,jsonb) from public,anon;
grant execute on function public.update_product_sale_command(uuid,jsonb,text,jsonb) to authenticated;
revoke all on function public.auction_bid_deadline(timestamptz,timestamptz,timestamptz) from public;
grant execute on function public.auction_bid_deadline(timestamptz,timestamptz,timestamptz) to authenticated,service_role;
-- Product images. Files live in the public "product-images" Storage bucket under
-- "<product id>/<file name>"; this table is the ordered list a listing shows.
-- Like price tiers, images are command-only and locked once a listing is
-- submitted for moderation, so approved listings cannot change what buyers see.

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  alt_text text check (alt_text is null or char_length(alt_text) <= 200),
  sort_order smallint not null default 0 check (sort_order >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images(product_id, sort_order, created_at);

alter table public.product_images enable row level security;
create policy "public images follow public products" on public.product_images
for select using (exists (
  select 1 from public.products p
  where p.id = product_id and p.listing_status = 'active' and p.moderation_status = 'approved'
));
create policy "seller team can read product images" on public.product_images
for select to authenticated using (exists (
  select 1 from public.products p where p.id = product_id and private.is_member(p.organization_id)
));
create policy "moderators can read product images" on public.product_images
for select to authenticated using (exists (
  select 1 from public.operations_members m where m.user_id = (select auth.uid())
  and m.role in ('catalog_moderator', 'platform_administrator')
));
revoke insert, update, delete on public.product_images from anon, authenticated;
grant select on public.product_images to anon, authenticated;

-- True when the caller may add or remove image files for this product: a catalog
-- role in the owning organization, and the listing is still an unsubmitted draft.
create or replace function private.can_manage_product_images(product_id_input uuid)
returns boolean language sql stable security definer set search_path = public, private, pg_temp as $$
  select exists (
    select 1 from public.products p
    where p.id = product_id_input
      and p.listing_status = 'draft'
      and p.submitted_for_review_at is null
      and private.has_any_role(p.organization_id, array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[])
  );
$$;
revoke all on function private.can_manage_product_images(uuid) from public;
grant execute on function private.can_manage_product_images(uuid) to authenticated;

-- Storage object names are caller supplied, so the folder is only cast to a
-- product ID after it has been checked to look like one.
create or replace function private.product_image_folder_id(object_name text)
returns uuid language sql immutable set search_path = pg_temp as $$
  select case
    when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and object_name ~ '^[^/]+/[^/]+$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;
revoke all on function private.product_image_folder_id(text) from public;
grant execute on function private.product_image_folder_id(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- The bucket is public, so reads by URL need no policy. Sellers only get the
-- policies needed to upload to, and clean up, their own draft listings.
drop policy if exists "catalog team can upload draft product images" on storage.objects;
create policy "catalog team can upload draft product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and private.can_manage_product_images(private.product_image_folder_id(name))
);
drop policy if exists "catalog team can see draft product image files" on storage.objects;
create policy "catalog team can see draft product image files"
on storage.objects for select to authenticated
using (
  bucket_id = 'product-images'
  and private.can_manage_product_images(private.product_image_folder_id(name))
);
drop policy if exists "catalog team can delete draft product image files" on storage.objects;
create policy "catalog team can delete draft product image files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and private.can_manage_product_images(private.product_image_folder_id(name))
);

create or replace function public.add_product_image_command(product_id_input uuid, storage_path_input text, alt_text_input text default null)
returns public.product_images language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.products;
declare image public.product_images;
declare image_count integer;
begin
  select * into target from public.products where id = product_id_input for update;
  if not found then raise exception 'Product not found'; end if;
  if not private.has_any_role(target.organization_id, array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if target.listing_status <> 'draft' or target.submitted_for_review_at is not null then raise exception 'Images are locked after submission'; end if;
  if private.product_image_folder_id(storage_path_input) is distinct from product_id_input then raise exception 'Image path does not belong to this product'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'product-images' and o.name = storage_path_input) then raise exception 'Image file has not been uploaded'; end if;
  select count(*) into image_count from public.product_images where product_id = product_id_input;
  if image_count >= 6 then raise exception 'A listing can have at most 6 images'; end if;
  insert into public.product_images (product_id, storage_path, alt_text, sort_order, created_by)
  values (product_id_input, storage_path_input, nullif(trim(coalesce(alt_text_input, '')), ''),
    coalesce((select max(sort_order) + 1 from public.product_images where product_id = product_id_input), 0),
    (select auth.uid()))
  returning * into image;
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (target.organization_id, (select auth.uid()), 'product.image_added', 'product', target.id, jsonb_build_object('image_id', image.id));
  return image;
end;
$$;
revoke all on function public.add_product_image_command(uuid, text, text) from public, anon;
grant execute on function public.add_product_image_command(uuid, text, text) to authenticated;

-- Removes the listing's reference. The caller deletes the file through Storage,
-- because Storage owns the object rows and the underlying file.
create or replace function public.delete_product_image_command(image_id_input uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target public.product_images;
declare target_product public.products;
begin
  select * into target from public.product_images where id = image_id_input for update;
  if not found then raise exception 'Product image not found'; end if;
  select * into target_product from public.products where id = target.product_id for update;
  if not private.has_any_role(target_product.organization_id, array['owner','administrator','sales_manager','catalog_manager']::public.organization_role[]) then raise exception 'Catalog access denied'; end if;
  if target_product.listing_status <> 'draft' or target_product.submitted_for_review_at is not null then raise exception 'Images are locked after submission'; end if;
  delete from public.product_images where id = target.id;
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (target_product.organization_id, (select auth.uid()), 'product.image_deleted', 'product', target_product.id, jsonb_build_object('image_id', target.id, 'storage_path', target.storage_path));
end;
$$;
revoke all on function public.delete_product_image_command(uuid) from public, anon;
grant execute on function public.delete_product_image_command(uuid) to authenticated;

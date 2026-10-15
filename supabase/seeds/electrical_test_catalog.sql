-- Test catalog: 10 approved products in "Electrical and electronics", sold by the
-- "FeaBulk Supplier" demo organization (62c99d53-...), each with photos and bulk tiers.
-- Photos are free Unsplash images (https://unsplash.com/license) linked by URL, which
-- product_images accepts alongside Storage keys.
-- Safe to re-run: products are matched by slug and existing ones are left untouched.
-- Remove later with:
--   delete from public.products where seller_sku like 'TEST-EL-%';
begin;

do $$
declare
  seller_id constant uuid := '62c99d53-8c64-40a7-8171-d65edc4c0801';
  category uuid;
  item jsonb;
  new_id uuid;
  tier jsonb;
  photo text;
  photo_order smallint;
  items constant jsonb := $items$[
    {"slug":"test-ceiling-fan-1200mm-white","name":"High Speed Ceiling Fan 1200 mm, 3 Blades, White","sku":"TEST-EL-FAN-1200","unit":"pieces","moq":10,"stock":600,"lead":4,"gst":18,"hsn":"8414","brand":"AirMax",
     "description":"3-blade high speed ceiling fan with a 1200 mm sweep, copper winding motor and double ball bearings. 2-year motor warranty. Each fan is packed in its own carton with a down rod and canopy.\n\nSample listing for testing the FeaBulk marketplace.",
     "specs":{"sweep":"1200 mm","blades":"3","speed":"380 RPM","power":"75 W","colour":"White"},"warranty":"2 years on motor",
     "tiers":[[10,49,1290],[50,199,1215],[200,2000,1149]],
     "photos":["1576503963299-fcd31822b523","1609519479841-5fd3b2884e17"]},
    {"slug":"test-decorative-wooden-ceiling-fan","name":"Decorative Wooden Finish Ceiling Fan, 5 Blades","sku":"TEST-EL-FAN-WOOD","unit":"pieces","moq":5,"stock":120,"lead":7,"gst":18,"hsn":"8414","brand":"AirMax",
     "description":"Premium 5-blade decorative ceiling fan with a wooden finish for hotels, villas and showrooms. Low-noise motor with a remote control.\n\nSample listing for testing the FeaBulk marketplace.",
     "specs":{"sweep":"1320 mm","blades":"5","finish":"Walnut wood","remote":true},"warranty":"3 years on motor",
     "tiers":[[5,24,4850],[25,250,4590]],
     "photos":["1758118680010-8dedc15a9542"]},
    {"slug":"test-led-bulb-9w-b22","name":"LED Bulb 9 W, B22 Base, Cool Day Light (Pack of 10)","sku":"TEST-EL-LED-9W","unit":"packs","moq":20,"stock":3000,"lead":2,"gst":12,"hsn":"8539","brand":"Brightlite",
     "description":"Energy-saving 9 W LED bulbs with a B22 base and 900 lumen cool day light. Sold in packs of 10 for retail and project supply.\n\nSample listing for testing the FeaBulk marketplace.",
     "specs":{"wattage":"9 W","base":"B22","lumens":"900 lm","colour_temperature":"6500 K","pack_size":"10 bulbs"},"warranty":"1 year replacement",
     "tiers":[[20,199,610],[200,999,575],[1000,10000,540]],
     "photos":["1532007271951-c487760934ae","1590845947698-8924d7409b56"]},
    {"slug":"test-modular-switch-6a","name":"Modular One-Way Switch 6 A, White (Box of 20)","sku":"TEST-EL-SW-6A","unit":"boxes","moq":10,"stock":800,"lead":3,"gst":18,"hsn":"8536","brand":"Switchwell",
     "description":"ISI-marked one-way modular switches, 6 A, in a white polycarbonate finish. Box of 20 for electrical contractors and dealers.\n\nSample listing for testing the FeaBulk marketplace.",
     "specs":{"rating":"6 A, 240 V","type":"One-way","material":"Polycarbonate","pieces_per_box":"20"},
     "tiers":[[10,99,950],[100,1000,880]],
     "photos":["1556217994-22de7face210","1520254695104-2765bc239df7"]},
    {"slug":"test-pvc-house-wire-1-5-sqmm","name":"PVC Insulated House Wire 1.5 sq mm, 90 m Coil","sku":"TEST-EL-WIRE-15","unit":"coils","moq":10,"stock":450,"lead":3,"gst":18,"hsn":"8544","brand":"Copperline",
     "description":"Flame-retardant PVC insulated copper house wire, 1.5 sq mm, in 90 m coils. Available in red, black, yellow, green and blue.\n\nSample listing for testing the FeaBulk marketplace.",
     "specs":{"conductor":"Electrolytic copper","size":"1.5 sq mm","length":"90 m","colours":["Red","Black","Yellow","Green","Blue"]},
     "tiers":[[10,49,1690],[50,500,1590]],
     "photos":["1761507320645-b11a00bfcc34","1601955431290-3c57f6871bef"]},
    {"slug":"test-extension-board-4-socket","name":"Extension Board, 4 Sockets with Surge Protection","sku":"TEST-EL-EXT-4","unit":"pieces","moq":25,"stock":1200,"lead":3,"gst":18,"hsn":"8536","brand":"Switchwell",
     "description":"4-socket extension board with a master switch, surge protection and a 2 m heavy-duty cord. Universal sockets for Indian and international plugs.\n\nSample listing for testing the FeaBulk marketplace.",
     "specs":{"sockets":"4 universal","cord_length":"2 m","surge_protection":true,"rating":"10 A"},"warranty":"1 year",
     "tiers":[[25,99,349],[100,999,319],[1000,10000,295]],
     "photos":["1650501386688-41f6d0251875","1781331534854-c75885f01c01"]},
    {"slug":"test-led-tube-light-20w","name":"LED Batten Tube Light 20 W, 4 ft","sku":"TEST-EL-TUBE-20","unit":"pieces","moq":20,"stock":900,"lead":3,"gst":12,"hsn":"9405","brand":"Brightlite",
     "description":"Slim 4 ft LED batten with 20 W output and 2000 lumens. Aluminium body, quick mounting clips, ideal for offices, schools and warehouses.\n\nSample listing for testing the FeaBulk marketplace.",
     "specs":{"wattage":"20 W","length":"4 ft","lumens":"2000 lm","body":"Aluminium"},"warranty":"2 years",
     "tiers":[[20,199,265],[200,2000,239]],
     "photos":["1623900578828-b4fb9c01c1e7"]},
    {"slug":"test-mcb-distribution-board-8-way","name":"MCB Distribution Board, 8 Way, Double Door","sku":"TEST-EL-DB-8W","unit":"pieces","moq":5,"stock":150,"lead":5,"gst":18,"hsn":"8537","brand":"Safeguard",
     "description":"8-way double door distribution board in powder-coated CRCA steel, ready for MCB and RCCB fitting. For homes, shops and small offices.\n\nSample listing for testing the FeaBulk marketplace.",
     "specs":{"ways":"8","doors":"Double","material":"CRCA steel, powder coated","mounting":"Flush"},
     "tiers":[[5,49,1450],[50,500,1320]],
     "photos":["1773952136583-5175e906267c","1566417110090-6b15a06ec800"]},
    {"slug":"test-table-fan-400mm","name":"Table Fan 400 mm with Oscillation","sku":"TEST-EL-TFAN-400","unit":"pieces","moq":10,"stock":0,"lead":6,"gst":18,"hsn":"8414","brand":"AirMax",
     "description":"400 mm table fan with 3-speed control, 90-degree oscillation and a tilt-adjustable head. Currently out of stock; listed to test how unavailable products appear.\n\nSample listing for testing the FeaBulk marketplace.",
     "specs":{"sweep":"400 mm","speeds":"3","oscillation":"90 degrees"},
     "tiers":[[10,99,1590]],
     "photos":["1565151443833-29bf2ba5dd8d","1568392816241-44d223d4d490"]},
    {"slug":"test-digital-multimeter","name":"Digital Multimeter with Auto Range","sku":"TEST-EL-DMM","unit":"pieces","moq":5,"stock":260,"lead":4,"gst":18,"hsn":"9030","brand":"Measura",
     "description":"Auto-ranging digital multimeter for AC/DC voltage, current, resistance, continuity and capacitance. Backlit display and protective holster included.\n\nSample listing for testing the FeaBulk marketplace.",
     "specs":{"display":"6000 count, backlit","ranges":"Auto","safety":"CAT III 600 V"},"warranty":"1 year",
     "tiers":[[5,49,1180],[50,500,1060]],
     "photos":["1758295746012-41650245a9bb","1619345371662-fccc15cc4814"]}
  ]$items$::jsonb;
begin
  if not exists (select 1 from public.organizations where id = seller_id and kind = 'seller' and status = 'verified') then
    raise exception 'The FeaBulk Supplier demo organization is missing or not a verified seller';
  end if;
  select id into category from public.categories where slug = 'electrical-electronics';
  if category is null then raise exception 'Category electrical-electronics not found'; end if;

  for item in select * from jsonb_array_elements(items) loop
    continue when exists (select 1 from public.products where slug = item->>'slug');
    insert into public.products (
      organization_id, category_id, name, slug, description, brand, seller_sku, hsn_code,
      unit_of_measure, minimum_order_quantity, available_quantity, gst_rate, lead_time_days,
      specifications, warranty_terms, country_of_origin, shipping_origin
    ) values (
      seller_id, category, item->>'name', item->>'slug', item->>'description', item->>'brand',
      item->>'sku', item->>'hsn', item->>'unit', (item->>'moq')::bigint, (item->>'stock')::bigint,
      (item->>'gst')::numeric, (item->>'lead')::int, item->'specs', item->>'warranty', 'India',
      '{"city":"Hyderabad","state":"Telangana"}'::jsonb
    ) returning id into new_id;

    for tier in select * from jsonb_array_elements(item->'tiers') loop
      insert into public.product_price_tiers (product_id, minimum_quantity, maximum_quantity, unit_price)
      values (new_id, (tier->>0)::bigint, (tier->>1)::bigint, (tier->>2)::numeric);
    end loop;

    photo_order := 0;
    for photo in select * from jsonb_array_elements_text(item->'photos') loop
      insert into public.product_images (product_id, storage_path, alt_text, sort_order)
      values (new_id, 'https://images.unsplash.com/photo-' || photo || '?w=1200&q=80&auto=format&fit=crop',
        item->>'name', photo_order);
      photo_order := photo_order + 1;
    end loop;

    -- Publishing runs the usual checks: a price tier must cover the minimum order and the
    -- seller must be verified.
    update public.products
      set listing_status = 'active', moderation_status = 'approved',
          submitted_for_review_at = now(), moderated_at = now(),
          moderation_notes = 'Test data approved for marketplace testing.'
      where id = new_id;
  end loop;
end;
$$;

commit;

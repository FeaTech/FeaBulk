insert into public.categories (name, slug) values
  ('Industrial and manufacturing', 'industrial-manufacturing'),
  ('Packaging and materials', 'packaging-materials'),
  ('Food and ingredients', 'food-ingredients'),
  ('Office and business supplies', 'office-business-supplies'),
  ('Construction materials', 'construction-materials'),
  ('Textiles and apparel', 'textiles-apparel'),
  ('Chemicals and raw materials', 'chemicals-raw-materials'),
  ('Electrical and electronics', 'electrical-electronics'),
  ('Agriculture and farm supplies', 'agriculture-farm-supplies')
on conflict (slug) do nothing;

import assert from "node:assert/strict";
import { test } from "node:test";
import { applyCatalogView, EMPTY_FILTERS, formatPriceRange, priceRange } from "./catalog-view.ts";

const product = (
  name: string,
  tiers: number[],
  extra: Partial<{
    category_id: string;
    organization_id: string;
    moq: number;
    created_at: string;
    photos: number;
  }> = {},
) => ({
  name,
  category_id: extra.category_id ?? "cat-a",
  organization_id: extra.organization_id ?? "seller-1",
  minimum_order_quantity: extra.moq ?? 10,
  created_at: extra.created_at ?? "2026-10-01T00:00:00Z",
  product_price_tiers: tiers.map((unit_price) => ({ unit_price })),
  images: Array.from({ length: extra.photos ?? 1 }),
});

const bolts = product("Bolts", [5.5, 4.7], { created_at: "2026-10-03T00:00:00Z", moq: 500 });
const wire = product("Wire", [2980], {
  category_id: "cat-b",
  organization_id: "seller-2",
  moq: 10,
});
const bags = product("Bags", [62, 55], { created_at: "2026-10-02T00:00:00Z", photos: 0, moq: 100 });
const quoted = product("Custom part", [], { created_at: "2026-10-04T00:00:00Z" });
const all = [bolts, wire, bags, quoted];

test("reports the price range across tiers", () => {
  assert.deepEqual(priceRange(bolts.product_price_tiers), { min: 4.7, max: 5.5 });
  assert.equal(priceRange([]), null);
  assert.equal(formatPriceRange({ min: 4.7, max: 5.5 }), "₹4.7 – ₹5.5");
  assert.equal(formatPriceRange({ min: 2980, max: 2980 }), "₹2,980");
});

test("filters by category, supplier, minimum order and photos", () => {
  const names = (filters: Partial<typeof EMPTY_FILTERS>) =>
    applyCatalogView(all, { ...EMPTY_FILTERS, ...filters }).map((item) => item.name);
  assert.deepEqual(names({ categoryId: "cat-b" }), ["Wire"]);
  assert.deepEqual(names({ supplierIds: ["seller-2"] }), ["Wire"]);
  assert.deepEqual(names({ maxMoq: 100 }).sort(), ["Bags", "Custom part", "Wire"]);
  assert.equal(names({ withPhotos: true }).includes("Bags"), false);
});

test("a price filter keeps products with any tier in range and drops unpriced ones", () => {
  const names = applyCatalogView(all, { ...EMPTY_FILTERS, minPrice: 5, maxPrice: 60 }).map(
    (item) => item.name,
  );
  assert.deepEqual(names.sort(), ["Bags", "Bolts"]);
});

test("sorts by price, minimum order, name and newest", () => {
  const order = (sort: (typeof EMPTY_FILTERS)["sort"]) =>
    applyCatalogView(all, { ...EMPTY_FILTERS, sort }).map((item) => item.name);
  assert.deepEqual(order("price_low"), ["Bolts", "Bags", "Wire", "Custom part"]);
  assert.deepEqual(order("price_high"), ["Wire", "Bags", "Bolts", "Custom part"]);
  assert.deepEqual(order("moq_low"), ["Wire", "Custom part", "Bags", "Bolts"]);
  assert.deepEqual(order("name"), ["Bags", "Bolts", "Custom part", "Wire"]);
  assert.deepEqual(order("newest"), ["Custom part", "Bolts", "Bags", "Wire"]);
});

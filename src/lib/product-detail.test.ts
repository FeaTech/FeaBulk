import assert from "node:assert/strict";
import { test } from "node:test";
import {
  customSpecifications,
  productSpecifications,
  ratingSummary,
  shippingOrigin,
  yearsSince,
} from "./product-detail.ts";

const base = {
  unit_of_measure: "pieces",
  minimum_order_quantity: 500,
  available_quantity: 12000,
  lead_time_days: 7,
  gst_rate: 18,
  hsn_code: "7318",
  seller_sku: "BOLT-M8",
};

test("lists core trade facts and leaves out empty ones", () => {
  const rows = productSpecifications({ ...base, brand: "Havells", country_of_origin: "India" });
  assert.deepEqual(rows.slice(0, 3), [
    ["Brand", "Havells"],
    ["Country of origin", "India"],
    ["Sold in", "pieces"],
  ]);
  assert.ok(rows.some(([label, value]) => label === "Minimum order" && value === "500 pieces"));
  assert.ok(rows.some(([label, value]) => label === "Dispatch time" && value === "7 days"));
  assert.equal(
    rows.some(([label]) => label === "Manufacturer"),
    false,
  );
  assert.equal(
    rows.some(([label]) => label === "Samples"),
    false,
  );
});

test("adds optional extras only when the seller provided them", () => {
  const rows = productSpecifications({
    ...base,
    gst_rate: null,
    quantity_increment: 100,
    sample_available: true,
    sample_price: 250,
    warranty_terms: "2 years",
  });
  const labels = rows.map(([label]) => label);
  assert.equal(labels.includes("GST rate"), false);
  assert.ok(
    rows.some(([label, value]) => label === "Order in multiples of" && value === "100 pieces"),
  );
  assert.ok(rows.some(([label, value]) => label === "Samples" && value === "Available at ₹250"));
  assert.ok(rows.some(([label, value]) => label === "Warranty" && value === "2 years"));
});

test("reads seller-entered specifications safely", () => {
  assert.deepEqual(
    customSpecifications({
      blade_length: "1400 mm",
      colours: ["Gold", "Ivory"],
      remote: true,
      nested: { a: 1 },
      empty: "",
      description: "skip me",
    }),
    [
      ["Blade Length", "1400 mm"],
      ["Colours", "Gold, Ivory"],
      ["Remote", "Yes"],
    ],
  );
  assert.deepEqual(customSpecifications(null), []);
  assert.deepEqual(customSpecifications(["a"]), []);
});

test("formats the shipping origin", () => {
  assert.equal(shippingOrigin({ city: "Hyderabad", state: "Telangana" }), "Hyderabad, Telangana");
  assert.equal(shippingOrigin({ pin_code: "500001" }), null);
  assert.equal(shippingOrigin({}), null);
});

test("summarises ratings into an average and a star breakdown", () => {
  const summary = ratingSummary([{ rating: 5 }, { rating: 5 }, { rating: 4 }, { rating: 1 }]);
  assert.equal(summary.total, 4);
  assert.equal(summary.average, 3.8);
  assert.deepEqual(summary.counts, [2, 1, 0, 0, 1]);
  assert.deepEqual(ratingSummary([]), { average: 0, total: 0, counts: [0, 0, 0, 0, 0] });
});

test("counts whole years on the platform", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  assert.equal(yearsSince("2023-05-01T00:00:00Z", now), 3);
  assert.equal(yearsSince("2023-11-01T00:00:00Z", now), 2);
  assert.equal(yearsSince("2026-09-24T00:00:00Z", now), 0);
});

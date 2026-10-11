import assert from "node:assert/strict";
import { test } from "node:test";
import { estimatePrice, type PriceTier } from "./pricing.ts";

const tiers: PriceTier[] = [
  { minimum_quantity: 2000, maximum_quantity: 9999, unit_price: 4.7 },
  { minimum_quantity: 500, maximum_quantity: 1999, unit_price: 5.5 },
];

test("prices a quantity from the tier that contains it", () => {
  const estimate = estimatePrice(tiers, 600, { minimumOrderQuantity: 500, gstRate: 18 });
  assert.equal(estimate.status, "priced");
  if (estimate.status !== "priced") return;
  assert.equal(estimate.unitPrice, 5.5);
  assert.equal(estimate.subtotal, 3300);
  assert.equal(estimate.gstAmount, 594);
  assert.equal(estimate.total, 3894);
  assert.deepEqual(estimate.nextTier, { minimumQuantity: 2000, unitPrice: 4.7 });
});

test("tier boundaries are inclusive", () => {
  const lower = estimatePrice(tiers, 1999);
  const upper = estimatePrice(tiers, 2000);
  assert.equal(lower.status === "priced" && lower.unitPrice, 5.5);
  assert.equal(upper.status === "priced" && upper.unitPrice, 4.7);
  assert.equal(upper.status === "priced" && upper.nextTier, null);
});

test("leaves GST out when the rate is unknown", () => {
  const estimate = estimatePrice(tiers, 2000, { gstRate: null });
  assert.equal(estimate.status, "priced");
  if (estimate.status !== "priced") return;
  assert.equal(estimate.gstAmount, 0);
  assert.equal(estimate.total, 9400);
});

test("keeps totals exact for fractional unit prices", () => {
  const estimate = estimatePrice(
    [{ minimum_quantity: 1, maximum_quantity: 10, unit_price: 0.1 }],
    3,
  );
  assert.equal(estimate.status === "priced" && estimate.subtotal, 0.3);
});

test("rejects quantities below the minimum order", () => {
  assert.deepEqual(estimatePrice(tiers, 100, { minimumOrderQuantity: 500 }), {
    status: "below_minimum",
    minimumQuantity: 500,
  });
  assert.deepEqual(estimatePrice(tiers, 100), { status: "below_minimum", minimumQuantity: 500 });
});

test("asks for a quote when no tier covers the quantity", () => {
  assert.deepEqual(estimatePrice(tiers, 10000), {
    status: "quote_required",
    reason: "outside_tiers",
  });
  assert.deepEqual(estimatePrice([], 10), { status: "quote_required", reason: "no_tiers" });
});

test("rejects quantities that are not positive whole numbers", () => {
  for (const quantity of [0, -5, 1.5, Number.NaN])
    assert.deepEqual(estimatePrice(tiers, quantity), { status: "invalid" });
});

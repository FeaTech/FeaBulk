import assert from "node:assert/strict";
import { test } from "node:test";
import { listingStage, submissionBlockers, tierCoversMinimumOrder } from "./listing.ts";

const draft = {
  listing_status: "draft",
  moderation_status: "pending",
  submitted_for_review_at: null,
  minimum_order_quantity: 9,
  product_price_tiers: [{ minimum_quantity: 30, maximum_quantity: 800 }],
};

test("reports each stage from draft to live", () => {
  assert.equal(listingStage(draft), "draft");
  assert.equal(
    listingStage({ ...draft, submitted_for_review_at: "2026-10-13T10:00:00Z" }),
    "in_review",
  );
  assert.equal(listingStage({ ...draft, moderation_status: "rejected" }), "rejected");
  assert.equal(
    listingStage({ ...draft, listing_status: "active", moderation_status: "approved" }),
    "live",
  );
  assert.equal(listingStage({ ...draft, listing_status: "paused" }), "inactive");
});

test("a tier must include the minimum order quantity", () => {
  assert.equal(tierCoversMinimumOrder(draft), false);
  assert.equal(
    tierCoversMinimumOrder({
      ...draft,
      product_price_tiers: [{ minimum_quantity: 9, maximum_quantity: 29 }],
    }),
    true,
  );
  assert.equal(tierCoversMinimumOrder({ ...draft, product_price_tiers: [] }), false);
  assert.equal(
    tierCoversMinimumOrder({
      ...draft,
      product_price_tiers: [{ minimum_quantity: "9", maximum_quantity: "9" }],
    }),
    true,
  );
});

test("lists what blocks submission, and nothing once the draft is ready", () => {
  assert.equal(submissionBlockers({ ...draft, product_price_tiers: [] }, true).length, 1);
  assert.match(submissionBlockers(draft, true)[0] ?? "", /starts at 9/);
  assert.equal(submissionBlockers(draft, false).length, 2);
  assert.deepEqual(
    submissionBlockers(
      { ...draft, product_price_tiers: [{ minimum_quantity: 9, maximum_quantity: 800 }] },
      true,
    ),
    [],
  );
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { auctionPhase, isValidDuration, minimumNextBid, winnerBalance } from "./auction-rules.ts";

describe("auction rules", () => {
  it("first bid must reach the starting price", () => {
    assert.equal(minimumNextBid({ current_price: null, start_price: 50000, bid_step: 500 }), 50000);
  });
  it("next bid must beat the highest bid by the bid step", () => {
    assert.equal(minimumNextBid({ current_price: 52000, start_price: 50000, bid_step: 500 }), 52500);
  });
  it("auctions run between 1 and 7 days", () => {
    assert.equal(isValidDuration(7), true);
    assert.equal(isValidDuration(8), false);
    assert.equal(isValidDuration(0.5), false);
  });
  it("token is deducted from the winner's full payment", () => {
    // ₹1,00,000 lot + 18% GST − ₹5,000 token
    assert.equal(winnerBalance("lot", 100000, 500, 18, 5000), 113000);
  });
  it("per-unit bids are multiplied by quantity", () => {
    assert.equal(winnerBalance("per_unit", 20, 1000, 0, 1000), 19000);
  });
  it("auction is live only between start and end", () => {
    const a = { status: "scheduled", starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-01-03T00:00:00Z" };
    assert.equal(auctionPhase(a, Date.parse("2026-01-02T00:00:00Z")), "live");
    assert.equal(auctionPhase(a, Date.parse("2026-01-04T00:00:00Z")), "ended");
  });
});

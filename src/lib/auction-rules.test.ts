import { describe, expect, it } from "vitest";
import { auctionPhase, isValidDuration, minimumNextBid, winnerBalance } from "./auction-rules";

describe("auction rules", () => {
  it("first bid must reach the starting price", () => {
    expect(minimumNextBid({ current_price: null, start_price: 50000, bid_step: 500 })).toBe(50000);
  });
  it("next bid must beat the highest bid by the bid step", () => {
    expect(minimumNextBid({ current_price: 52000, start_price: 50000, bid_step: 500 })).toBe(52500);
  });
  it("auctions run between 1 and 7 days", () => {
    expect(isValidDuration(7)).toBe(true);
    expect(isValidDuration(8)).toBe(false);
    expect(isValidDuration(0.5)).toBe(false);
  });
  it("token is deducted from the winner's full payment", () => {
    // ₹1,00,000 lot + 18% GST − ₹5,000 token
    expect(winnerBalance("lot", 100000, 500, 18, 5000)).toBe(113000);
  });
  it("per-unit bids are multiplied by quantity", () => {
    expect(winnerBalance("per_unit", 20, 1000, 0, 1000)).toBe(19000);
  });
  it("auction is live only between start and end", () => {
    const a = { status: "scheduled", starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-01-03T00:00:00Z" };
    expect(auctionPhase(a, Date.parse("2026-01-02T00:00:00Z"))).toBe("live");
    expect(auctionPhase(a, Date.parse("2026-01-04T00:00:00Z"))).toBe("ended");
  });
});

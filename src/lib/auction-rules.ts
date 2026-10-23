export type LotType = "lot" | "per_unit";

export const AUCTION_MIN_DAYS = 1;
export const AUCTION_MAX_DAYS = 7;
export const WINNER_PAYMENT_HOURS = 48;

export function auctionBidDeadline(startsAt: string, endsAt: string, now: number): number {
  const end = Date.parse(endsAt);
  return Math.min(Date.parse(startsAt) + AUCTION_MAX_DAYS * 86_400_000,
    end - now < 120_000 ? now + 120_000 : end);
}

export function canEditAuctionTerms(a: { status: string; bid_count: number }, participantCount: number): boolean {
  return a.status === "scheduled" && a.bid_count === 0 && participantCount === 0;
}

/** The lowest bid the next bidder may place. */
export function minimumNextBid(a: { current_price: number | string | null; start_price: number | string; bid_step: number | string }): number {
  return a.current_price === null ? Number(a.start_price) : Number(a.current_price) + Number(a.bid_step);
}

export function isValidDuration(days: number): boolean {
  return Number.isFinite(days) && days >= AUCTION_MIN_DAYS && days <= AUCTION_MAX_DAYS;
}

/** Value of the winning bid before GST: a lot bid is the total, a per-unit bid is multiplied by quantity. */
export function auctionTaxable(lotType: LotType, price: number, quantity: number): number {
  return lotType === "per_unit" ? price * quantity : price;
}

/** What the winner still owes after the token is deducted. */
export function winnerBalance(lotType: LotType, price: number, quantity: number, gstRate: number, token: number): number {
  const taxable = auctionTaxable(lotType, price, quantity);
  const gst = Math.round(taxable * gstRate) / 100;
  return Math.round((taxable + gst - token) * 100) / 100;
}

export type AuctionPhase = "upcoming" | "live" | "ended" | "awaiting_payment" | "completed" | "unsold" | "forfeited" | "cancelled";

export function auctionPhase(a: { status: string; starts_at: string; ends_at: string }, now = Date.now()): AuctionPhase {
  if (a.status !== "scheduled") return a.status as AuctionPhase;
  if (now < Date.parse(a.starts_at)) return "upcoming";
  if (now >= Date.parse(a.ends_at)) return "ended";
  return "live";
}

export const PHASE_LABELS: Record<AuctionPhase, string> = {
  upcoming: "Starts soon", live: "Live", ended: "Ended · picking winner", awaiting_payment: "Won · awaiting payment",
  completed: "Sold", unsold: "Ended · no bids", forfeited: "Winner did not pay", cancelled: "Cancelled",
};

export const TOKEN_LABELS: Record<string, string> = {
  pending: "Token not paid", paid: "Token paid", refund_due: "Refund due", refunded: "Refunded",
  applied: "Deducted from your order", forfeited: "Forfeited",
};

export function timeLeft(endsAt: string, now = Date.now()): string {
  const ms = Date.parse(endsAt) - now;
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86_400_000), h = Math.floor(ms / 3_600_000) % 24, m = Math.floor(ms / 60_000) % 60, s = Math.floor(ms / 1000) % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}

export const inr = (n: number | string) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LotType } from "./auction-rules";

// Auction tables are newer than the generated types.
const db = supabase as unknown as SupabaseClient;

export type Auction = {
  id: string; product_id: string; seller_organization_id: string; lot_type: LotType; quantity: number;
  start_price: number; bid_step: number; token_amount: number; starts_at: string; ends_at: string;
  status: string; current_price: number | null; bid_count: number; winner_organization_id: string | null;
  order_id: string | null; payment_due_at: string | null; created_at: string;
  products?: { name: string; slug: string; unit_of_measure: string; gst_rate: number | null } | null;
};
export type Participant = {
  id: string; auction_id: string; buyer_organization_id: string; token_amount: number; token_status: string;
  paid_at: string | null; refunded_at: string | null; created_at: string;
  auctions?: Auction | null; organizations?: { display_name: string } | null;
};
export type PublicBid = { amount: number; created_at: string; bidder_label: string; is_mine: boolean };

const AUCTION_COLS = "*, products(name,slug,unit_of_measure,gst_rate)";

async function unwrap<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export async function getOpenAuctionForProduct(productId: string): Promise<Auction | null> {
  const rows = await unwrap<Auction[]>(db.from("auctions").select(AUCTION_COLS).eq("product_id", productId).order("created_at", { ascending: false }).limit(1));
  return rows[0] ?? null;
}
export async function getAuctionsForProducts(productIds: string[]): Promise<Auction[]> {
  if (productIds.length === 0) return [];
  return unwrap<Auction[]>(db.from("auctions").select(AUCTION_COLS).in("product_id", productIds).order("created_at", { ascending: false }));
}
export async function getLiveAuctionProductIds(): Promise<Set<string>> {
  const rows = await unwrap<{ product_id: string }[]>(db.from("auctions").select("product_id").eq("status", "scheduled").gt("ends_at", new Date().toISOString()));
  return new Set(rows.map((r) => r.product_id));
}
export async function getAllAuctions(): Promise<Auction[]> {
  return unwrap<Auction[]>(db.from("auctions").select(AUCTION_COLS).order("created_at", { ascending: false }).limit(200));
}
export async function getAuctionBids(auctionId: string): Promise<PublicBid[]> {
  return unwrap<PublicBid[]>(db.rpc("get_auction_bids", { auction_id_input: auctionId }));
}
export async function getMyParticipation(auctionId: string, orgId: string): Promise<Participant | null> {
  return unwrap<Participant | null>(db.from("auction_participants").select("*").eq("auction_id", auctionId).eq("buyer_organization_id", orgId).maybeSingle());
}
export async function getBuyerParticipations(orgId: string): Promise<Participant[]> {
  return unwrap<Participant[]>(db.from("auction_participants").select(`*, auctions(${AUCTION_COLS})`).eq("buyer_organization_id", orgId).order("created_at", { ascending: false }));
}
export async function getAllParticipants(): Promise<Participant[]> {
  return unwrap<Participant[]>(db.from("auction_participants").select("*, organizations(display_name), auctions(id, products(name))").order("created_at", { ascending: false }).limit(500));
}

export async function createAuction(productId: string, payload: { lot_type: LotType; quantity: number; start_price: number; bid_step: number; token_amount: number; duration_days: number; starts_at?: string }) {
  return unwrap<Auction>(db.rpc("create_auction_command", { product_id_input: productId, payload }));
}
export async function cancelAuction(id: string) {
  return unwrap<Auction>(db.rpc("cancel_auction_command", { auction_id_input: id }));
}
export async function joinAuction(auctionId: string, orgId: string, addressLine: string, pinCode: string) {
  return unwrap<Participant>(db.rpc("join_auction_command", { auction_id_input: auctionId, buyer_organization_id_input: orgId, delivery_address_input: { address_line: addressLine, pin_code: pinCode } }));
}
export async function placeBid(auctionId: string, orgId: string, amount: number) {
  return unwrap<Auction>(db.rpc("place_bid_command", { auction_id_input: auctionId, buyer_organization_id_input: orgId, amount_input: amount }));
}
export async function settleAuction(id: string) {
  return unwrap<Auction>(db.rpc("settle_auction_command", { auction_id_input: id }));
}

async function paymentCommand<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("payment-command", { body });
  if (error) {
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      const d = await ctx.json().catch(() => null) as { message?: string; error?: string } | null;
      throw new Error(d?.message ?? (d?.error === "payment_provider_not_configured" ? "Online payments are not set up yet. Please contact FeaBulk." : d?.error) ?? error.message);
    }
    throw error;
  }
  return data as T;
}
export const refundToken = (participantId: string) => paymentCommand<{ accepted: boolean }>({ action: "refund_token", participant_id: participantId });

type RzpResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RzpCtor = new (o: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (f: { error?: { description?: string } }) => void) => void };
let script: Promise<void> | null = null;
function loadCheckout() {
  const w = window as unknown as { Razorpay?: RzpCtor };
  if (w.Razorpay) return Promise.resolve();
  script ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => { script = null; reject(new Error("Payment checkout failed to load.")); };
    document.head.appendChild(s);
  });
  return script;
}

/** Opens Razorpay for the participation token and confirms it server-side. */
export async function payAuctionToken(participantId: string): Promise<void> {
  const checkout = await paymentCommand<{ provider_order_id: string; key_id: string; amount_paise: number; currency: string }>({ action: "initiate_token", participant_id: participantId });
  await loadCheckout();
  const Rzp = (window as unknown as { Razorpay: RzpCtor }).Razorpay;
  const result = await new Promise<RzpResult>((resolve, reject) => {
    const instance = new Rzp({
      key: checkout.key_id, amount: checkout.amount_paise, currency: checkout.currency, name: "FeaBulk",
      description: "Auction participation token", order_id: checkout.provider_order_id,
      handler: resolve, modal: { ondismiss: () => reject(new Error("Payment cancelled.")) }, theme: { color: "#F87908" },
    });
    instance.on("payment.failed", (f) => reject(new Error(f.error?.description ?? "Payment failed.")));
    instance.open();
  });
  await paymentCommand({ action: "confirm_token", provider_order_id: result.razorpay_order_id, provider_payment_id: result.razorpay_payment_id, signature: result.razorpay_signature });
}

/** Test only: marks the token as paid without a real payment (recorded with a TEST reference). */
export async function payAuctionTokenTest(participantId: string): Promise<void> {
  await unwrap(db.rpc("pay_auction_token_test_command", { participant_id_input: participantId }));
}

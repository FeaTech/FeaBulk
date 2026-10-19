import { useEffect, useState, type FormEvent } from "react";
import { Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelAuction, createAuction, getOpenAuctionForProduct, getAuctionBids, type Auction, type PublicBid } from "@/lib/auctions";
import { AUCTION_MAX_DAYS, PHASE_LABELS, auctionPhase, inr, timeLeft, type LotType } from "@/lib/auction-rules";

const field = "w-full rounded-md border border-input bg-card px-3 py-2 font-normal";

/** Seller's auction setup and live view for one product. */
export function SellerAuctionControls({ productId, unit, available }: { productId: string; unit: string; available: number }) {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<PublicBid[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lotType, setLotType] = useState<LotType>("lot");

  const load = async () => {
    const a = await getOpenAuctionForProduct(productId).catch(() => null);
    setAuction(a);
    if (a) setBids(await getAuctionBids(a.id).catch(() => []));
  };
  useEffect(() => { void load(); }, [productId]);

  const active = auction && ["scheduled", "awaiting_payment"].includes(auction.status);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const startsAt = String(f.get("starts_at") || "");
    setBusy(true); setError("");
    try {
      await createAuction(productId, {
        lot_type: lotType, quantity: Number(f.get("quantity")), start_price: Number(f.get("start_price")),
        bid_step: Number(f.get("bid_step")), token_amount: Number(f.get("token_amount")), duration_days: Number(f.get("duration_days")),
        ...(startsAt ? { starts_at: new Date(startsAt).toISOString() } : {}),
      });
      setOpen(false); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create auction."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-4 rounded-md border border-border p-4">
      <h4 className="flex items-center gap-2 font-bold"><Gavel className="size-4" /> Sell by auction</h4>
      {active && auction ? (
        <div className="mt-2 grid gap-1 text-sm">
          <p><b>{PHASE_LABELS[auctionPhase(auction)]}</b> · {auction.lot_type === "lot" ? "Whole lot" : "Per unit"} · {Number(auction.quantity).toLocaleString("en-IN")} {unit} · token {inr(auction.token_amount)}</p>
          <p>Highest bid: <b>{auction.current_price === null ? "none yet" : inr(auction.current_price)}</b> · {auction.bid_count} bids · {auction.status === "scheduled" ? `ends in ${timeLeft(auction.ends_at)}` : "winner is paying"}</p>
          {bids.slice(0, 5).map((b, i) => <p key={i} className="text-xs text-muted-foreground">{b.bidder_label}: {inr(b.amount)} · {new Date(b.created_at).toLocaleString("en-IN")}</p>)}
          {auction.status === "scheduled" && auction.bid_count === 0 && <Button type="button" variant="outline" size="sm" className="mt-2 w-fit" disabled={busy} onClick={() => void cancelAuction(auction.id).then(load).catch((e) => setError(e.message))}>Cancel auction</Button>}
          <p className="text-xs text-muted-foreground">The auction goes live once this product is approved by FeaBulk. You must sell to the winner at the final price.</p>
        </div>
      ) : open ? (
        <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
          {auction && <p className="text-xs text-muted-foreground sm:col-span-2">Last auction: {PHASE_LABELS[auctionPhase(auction)]}.</p>}
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">What buyers bid on
            <select value={lotType} onChange={(e) => setLotType(e.target.value as LotType)} className={field}>
              <option value="lot">Whole lot — one price for the full quantity</option>
              <option value="per_unit">Price per {unit} — for the full quantity</option>
            </select></label>
          <label className="grid gap-1 text-sm font-semibold">Quantity ({unit}, max {available.toLocaleString("en-IN")})<input name="quantity" type="number" required min={1} max={available} className={field} /></label>
          <label className="grid gap-1 text-sm font-semibold">Starting price (₹{lotType === "lot" ? " for the lot" : ` per ${unit}`})<input name="start_price" type="number" required min={1} step="0.01" className={field} /></label>
          <label className="grid gap-1 text-sm font-semibold">Minimum bid increase (₹)<input name="bid_step" type="number" required min={1} step="0.01" className={field} /></label>
          <label className="grid gap-1 text-sm font-semibold">Token amount to join (₹)<input name="token_amount" type="number" required min={1} step="0.01" className={field} /></label>
          <label className="grid gap-1 text-sm font-semibold">Duration (days, 1–{AUCTION_MAX_DAYS})<input name="duration_days" type="number" required min={1} max={AUCTION_MAX_DAYS} defaultValue={7} className={field} /></label>
          <label className="grid gap-1 text-sm font-semibold">Start time (optional, default now)<input name="starts_at" type="datetime-local" className={field} /></label>
          {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2"><Button variant="workspace" disabled={busy}>{busy ? "Saving…" : "Start auction"}</Button><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button></div>
        </form>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          {auction && <span className="text-muted-foreground">Last auction: {PHASE_LABELS[auctionPhase(auction)]}{auction.current_price ? ` at ${inr(auction.current_price)}` : ""}.</span>}
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>Set up an auction</Button>
        </div>
      )}
      {error && !open && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

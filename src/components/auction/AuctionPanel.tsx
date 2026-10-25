import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Gavel } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getIdentity, getOrganizations, type Organization } from "@/lib/marketplace";
import {
  getAuctionBids, getMyParticipation, getOpenAuctionForProduct, joinAuction, payAuctionToken, payAuctionTokenTest, placeBid, settleAuction,
  type Auction, type Participant, type PublicBid,
} from "@/lib/auctions";
import { PHASE_LABELS, TOKEN_LABELS, auctionPhase, inr, minimumNextBid, timeLeft, winnerBalance } from "@/lib/auction-rules";

const field = "w-full rounded-md border border-input bg-card px-3 py-2 font-normal";

export function AuctionPanel({ productId, slug }: { productId: string; slug: string }) {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<PublicBid[]>([]);
  const [buyer, setBuyer] = useState<Organization | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [me, setMe] = useState<Participant | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [bid, setBid] = useState("");
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    let a = await getOpenAuctionForProduct(productId);
    if (a && a.status === "scheduled" && Date.parse(a.ends_at) <= Date.now() && signedIn) a = await settleAuction(a.id).catch(() => a);
    setAuction(a);
    if (a) setBids(await getAuctionBids(a.id).catch(() => []));
  }, [productId, signedIn]);

  useEffect(() => {
    void (async () => {
      const user = await getIdentity().catch(() => null);
      setSignedIn(Boolean(user));
      if (user) setBuyer((await getOrganizations().catch(() => [])).find((o) => o.kind === "buyer") ?? null);
    })();
  }, []);
  useEffect(() => { if (signedIn !== null) void refresh(); }, [refresh, signedIn]);
  useEffect(() => {
    if (auction && buyer) void getMyParticipation(auction.id, buyer.id).then(setMe).catch(() => setMe(null));
  }, [auction?.id, buyer]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!auction) return;
    const channel = supabase.channel(`auction-${auction.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${auction.id}` }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [auction?.id, refresh]);

  if (!auction || ["cancelled"].includes(auction.status)) return null;
  const phase = auctionPhase(auction, now);
  const unit = auction.products?.unit_of_measure ?? "units";
  const lotLabel = auction.lot_type === "lot" ? `Whole lot of ${Number(auction.quantity).toLocaleString("en-IN")} ${unit}` : `${Number(auction.quantity).toLocaleString("en-IN")} ${unit}, bid per ${unit}`;
  const next = minimumNextBid(auction);
  const iAmWinning = buyer && auction.winner_organization_id === buyer.id;

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true); setMessage(null);
    try { await fn(); setMessage({ kind: "ok", text: ok }); await refresh(); if (auction && buyer) setMe(await getMyParticipation(auction.id, buyer.id)); }
    catch (e) { setMessage({ kind: "error", text: e instanceof Error ? e.message : "Something went wrong." }); }
    finally { setBusy(false); }
  }
  const testPay = useRef(false);
  const join = (e: FormEvent) => { e.preventDefault(); if (!buyer || !auction) return; const useTest = testPay.current; testPay.current = false; void act(async () => { const p = await joinAuction(auction.id, buyer.id, address, pin); setMe(p); if (useTest) await payAuctionTokenTest(p.id); else await payAuctionToken(p.id); }, useTest ? "Test token paid (no charge). You can bid now." : "Token paid. You can bid now."); };
  const submitBid = (e: FormEvent) => { e.preventDefault(); if (!buyer || !auction) return; void act(() => placeBid(auction.id, buyer.id, Number(bid)), "Bid placed."); setBid(""); };

  return (
    <section id="auction" className="mt-6 grid gap-4 rounded-lg border-2 border-primary/40 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Gavel className="size-5 text-primary" /> Auction</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${phase === "live" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{PHASE_LABELS[phase]}</span>
      </div>
      <p className="text-sm text-muted-foreground">{lotLabel}. Join by paying a {inr(auction.token_amount)} token — refunded if you don't win, deducted from your payment if you do.</p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{auction.current_price === null ? "Starting price" : "Highest bid"}</p><p className="text-lg font-bold">{inr(auction.current_price ?? auction.start_price)}</p></div>
        <div className="rounded-md bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{phase === "upcoming" ? "Starts in" : "Time left"}</p><p className="text-lg font-bold tabular-nums">{timeLeft(phase === "upcoming" ? auction.starts_at : auction.ends_at, now)}</p></div>
        <div className="rounded-md bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Bids</p><p className="text-lg font-bold">{auction.bid_count}</p></div>
      </div>

      {phase === "live" || phase === "upcoming" ? (
        signedIn === false ? <Button asChild variant="workspace" className="h-11"><Link to="/auth" search={{ redirect: `/products/${slug}` }}>Sign in to join the auction</Link></Button>
        : !buyer ? <p className="text-sm">Only buyer accounts can join auctions.</p>
        : buyer.id === auction.seller_organization_id ? null
        : me?.token_status === "paid" ? (
          phase === "live" ? (
            <form onSubmit={submitBid} className="grid gap-2">
              {iAmWinning && <p className="text-sm font-semibold text-workspace-success">You're the highest bidder.</p>}
              <label className="grid gap-1 text-sm font-semibold">Your bid {auction.lot_type === "per_unit" ? `per ${unit}` : "for the lot"} — minimum {inr(next)}
                <input type="number" required min={next} step="0.01" value={bid} onChange={(e) => setBid(e.target.value)} placeholder={String(next)} className={field} /></label>
              <Button variant="workspace" className="h-11" disabled={busy}>{busy ? "Placing bid…" : "Place bid"}</Button>
              <p className="text-xs text-muted-foreground">Bids are binding. The highest bid when time runs out wins and must pay within 48 hours, or the token is forfeited.</p>
            </form>
          ) : <p className="text-sm">Token paid. Bidding opens when the auction starts.</p>
        ) : (
          <form onSubmit={join} className="grid gap-2">
            <label className="grid gap-1 text-sm font-semibold">Delivery address (used if you win)<textarea required minLength={10} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className={field} /></label>
            <label className="grid gap-1 text-sm font-semibold">PIN code<input required pattern="[1-9][0-9]{5}" value={pin} onChange={(e) => setPin(e.target.value)} className={field} /></label>
            <Button variant="workspace" className="h-11" disabled={busy} onClick={() => { testPay.current = false; }}>{busy ? "Opening payment…" : `Join auction — pay ${inr(auction.token_amount)} token`}</Button>
            <Button type="submit" variant="outline" className="h-11" disabled={busy} onClick={() => { testPay.current = true; }}>Join with test payment (no charge)</Button>
          </form>
        )
      ) : (
        <div className="rounded-md bg-muted/60 p-3 text-sm">
          {auction.current_price !== null ? <>Final price <b>{inr(auction.current_price)}</b>{iAmWinning ? <> — you won! Balance to pay: <b>{inr(winnerBalance(auction.lot_type, Number(auction.current_price), Number(auction.quantity), Number(auction.products?.gst_rate ?? 18), Number(auction.token_amount)))}</b> incl. GST, from your <Link to="/buyer" className="underline">Orders</Link>.</> : "."}</> : "No bids were placed."}
          {me && !iAmWinning && <p className="mt-1">Your token: {TOKEN_LABELS[me.token_status] ?? me.token_status}</p>}
        </div>
      )}
      {message && <p role="alert" className={`rounded-md p-3 text-sm ${message.kind === "error" ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>{message.text}</p>}
      {bids.length > 0 && (
        <details className="text-sm"><summary className="cursor-pointer font-semibold">Bid history</summary>
          <ul className="mt-2 grid gap-1">{bids.map((b, i) => <li key={i} className="flex justify-between border-b py-1"><span>{b.bidder_label}{b.is_mine ? " (you)" : ""}</span><span className="font-semibold">{inr(b.amount)}</span><span className="text-muted-foreground">{new Date(b.created_at).toLocaleString("en-IN")}</span></li>)}</ul>
        </details>
      )}
    </section>
  );
}

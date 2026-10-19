import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getBuyerParticipations, type Participant } from "@/lib/auctions";
import { PHASE_LABELS, TOKEN_LABELS, auctionPhase, inr, timeLeft, winnerBalance } from "@/lib/auction-rules";

export function BuyerAuctions({ organizationId }: { organizationId: string }) {
  const [rows, setRows] = useState<Participant[]>([]);
  useEffect(() => { void getBuyerParticipations(organizationId).then(setRows).catch(() => setRows([])); }, [organizationId]);
  if (rows.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-xl font-black">Auctions ({rows.length})</h2>
      <div className="mt-4 grid gap-3">
        {rows.map((p) => {
          const a = p.auctions; if (!a) return null;
          const phase = auctionPhase(a);
          const winning = a.winner_organization_id === organizationId;
          return (
            <article key={p.id} className="rounded-md border border-border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {a.products ? <Link to="/products/$slug" params={{ slug: a.products.slug }} className="font-bold underline-offset-2 hover:underline">{a.products.name}</Link> : <b>Auction</b>}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">{PHASE_LABELS[phase]}</span>
              </div>
              <p className="mt-1">Highest bid {a.current_price === null ? "—" : inr(a.current_price)} · {winning ? <b className="text-workspace-success">{phase === "live" ? "You're winning" : "You won"}</b> : a.bid_count > 0 ? "Outbid" : "No bids yet"} · {phase === "live" ? `${timeLeft(a.ends_at)} left` : ""}</p>
              <p className="text-muted-foreground">Token {inr(p.token_amount)} · {TOKEN_LABELS[p.token_status] ?? p.token_status}</p>
              {winning && a.status === "awaiting_payment" && a.current_price !== null && (
                <p className="mt-1">Balance to pay: <b>{inr(winnerBalance(a.lot_type, Number(a.current_price), Number(a.quantity), Number(a.products?.gst_rate ?? 18), Number(a.token_amount)))}</b> incl. GST — pay it in Orders below before {a.payment_due_at ? new Date(a.payment_due_at).toLocaleString("en-IN") : "the deadline"}.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAllAuctions, getAllParticipants, refundToken, type Auction, type Participant } from "@/lib/auctions";
import { PHASE_LABELS, TOKEN_LABELS, auctionPhase, inr } from "@/lib/auction-rules";

export function AdminAuctionsPanel() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [parts, setParts] = useState<Participant[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => Promise.all([getAllAuctions(), getAllParticipants()]).then(([a, p]) => { setAuctions(a); setParts(p); }).catch((e) => setMsg(e.message));
  useEffect(() => { void load(); }, []);

  const sum = (s: string) => parts.filter((p) => p.token_status === s).reduce((t, p) => t + Number(p.token_amount), 0);
  const refundDue = parts.filter((p) => p.token_status === "refund_due");

  async function refund(id: string) {
    setBusy(id); setMsg("");
    try { await refundToken(id); await load(); setMsg("Refund sent."); } catch (e) { setMsg(e instanceof Error ? e.message : "Refund failed."); } finally { setBusy(null); }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-4">
        {[["Live auctions", String(auctions.filter((a) => auctionPhase(a) === "live").length)], ["Tokens held", inr(sum("paid"))], ["Refunds due", inr(sum("refund_due"))], ["Forfeited tokens", inr(sum("forfeited"))]].map(([l, v]) => (
          <div key={l} className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p></div>
        ))}
      </div>
      {msg && <p role="alert" className="rounded-md bg-muted p-3 text-sm">{msg}</p>}
      <section>
        <h3 className="font-bold">Token refunds due ({refundDue.length})</h3>
        {refundDue.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nothing to refund.</p> : (
          <div className="mt-2 grid gap-2">{refundDue.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card p-3 text-sm">
              <span>{p.organizations?.display_name ?? "Buyer"} · {(p.auctions as unknown as { products?: { name: string } } | null)?.products?.name ?? "Auction"} · {inr(p.token_amount)}</span>
              <Button size="sm" variant="workspace" disabled={busy === p.id} onClick={() => void refund(p.id)}>{busy === p.id ? "Refunding…" : "Refund token"}</Button>
            </div>))}</div>
        )}
      </section>
      <section>
        <h3 className="font-bold">All auctions ({auctions.length})</h3>
        <div className="mt-2 overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2">Product</th><th className="p-2">Status</th><th className="p-2">Highest bid</th><th className="p-2">Bids</th><th className="p-2">Token</th><th className="p-2">Ends</th></tr></thead>
          <tbody>{auctions.map((a) => (
            <tr key={a.id} className="border-t"><td className="p-2">{a.products?.name}</td><td className="p-2">{PHASE_LABELS[auctionPhase(a)]}</td><td className="p-2">{a.current_price === null ? "—" : inr(a.current_price)}</td><td className="p-2">{a.bid_count}</td><td className="p-2">{inr(a.token_amount)}</td><td className="p-2">{new Date(a.ends_at).toLocaleString("en-IN")}</td></tr>
          ))}</tbody>
        </table></div>
      </section>
    </div>
  );
}

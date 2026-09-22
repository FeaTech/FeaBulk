import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  acknowledgeOperationalIncident, getDisputeQueue, getIdentity, getModerationQueue, getOperationsAccess, getOperationsHealth, getVerificationQueue,
  moderateProduct, resolveDispute, reviewVerification, type Dispute, type OperationsHealth, type Product, type VerificationCase,
} from "@/lib/marketplace";

export const Route = createFileRoute("/operations")({ component: Operations });

function Operations() {
  const [access, setAccess] = useState<boolean | null>(null);
  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [health, setHealth] = useState<OperationsHealth>({ summary: { open: 0, acknowledged: 0, critical: 0, high: 0 }, incidents: [] });
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const user = await getIdentity();
    if (!user || !await getOperationsAccess(user.id)) { setAccess(false); return; }
    const [nextCases, nextProducts, nextDisputes, nextHealth] = await Promise.all([getVerificationQueue(), getModerationQueue(), getDisputeQueue(), getOperationsHealth()]);
    setCases(nextCases); setProducts(nextProducts); setDisputes(nextDisputes); setHealth(nextHealth); setAccess(true);
  }, []);
  useEffect(() => { void load().catch(err => { setError(message(err)); setAccess(false); }); }, [load]);
  async function decide(action: () => Promise<unknown>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); await load(); setNotice("Decision saved with an audit record."); }
    catch (err) { setError(message(err)); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#F7F8FA] px-5 py-8 text-[#17233A]"><div className="mx-auto max-w-5xl">
    <a href="/app" className="text-sm font-bold text-[#102B52]">← Back to workspace</a>
    <p className="mt-8 text-xs font-black uppercase tracking-wider text-[#F87908]">FEA operations</p>
    <h1 className="mt-2 text-3xl font-black text-[#102B52]">Review queues</h1>
    {error && <p role="alert" className="mt-5 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-5 border border-green-300 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {access === null ? <p className="mt-8">Checking access…</p> : !access ? <p className="mt-8 border bg-white p-6">Operations access is required.</p> : <>
      <section className="mt-8"><h2 className="text-xl font-black">Platform health</h2><div className="mt-3 grid gap-3 sm:grid-cols-4"><Metric label="Open" value={health.summary.open} /><Metric label="Acknowledged" value={health.summary.acknowledged} /><Metric label="Critical" value={health.summary.critical} urgent={health.summary.critical > 0} /><Metric label="High" value={health.summary.high} urgent={health.summary.high > 0} /></div>
        {health.incidents.length === 0 ? <p className="mt-3 border bg-white p-5 text-sm">No active operational incidents.</p> : <div className="mt-3 grid gap-3">{health.incidents.map(item => <article key={item.id} className={`border bg-white p-5 ${item.severity === "critical" ? "border-red-500" : item.severity === "high" ? "border-orange-400" : ""}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-[#526178]">{item.severity} · {item.category.replaceAll("_", " ")}</p><h3 className="mt-1 font-bold">{item.summary}</h3><p className="mt-1 text-xs text-[#526178]">{item.entity_type} {item.entity_id} · last detected {new Date(item.last_detected_at).toLocaleString()}</p></div><span className="border px-2 py-1 text-xs font-bold uppercase">{item.status}</span></div><pre className="mt-3 overflow-auto bg-[#F7F8FA] p-3 text-xs">{JSON.stringify(item.details, null, 2)}</pre>{item.status === "open" && <><DecisionInput id={`incident-${item.id}`} notes={notes} setNotes={setNotes} /><button disabled={busy} className="button mt-3" onClick={() => void decide(() => acknowledgeOperationalIncident(item.id, notes[`incident-${item.id}`] ?? ""))}>Acknowledge incident</button></>}</article>)}</div>}
      </section>
      <section className="mt-8"><h2 className="text-xl font-black">Business verification ({cases.length})</h2>
        {cases.length === 0 && <p className="mt-3 border bg-white p-5 text-sm">No cases awaiting review.</p>}
        <div className="mt-3 grid gap-3">{cases.map(item => <article key={item.id} className="border bg-white p-5">
          <h3 className="font-bold">Organization {item.organization_id}</h3>
          <p className="mt-1 text-sm text-[#526178]">{item.business_type ?? "Business type unavailable"} · submitted {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : "unknown"}</p>
          <pre className="mt-3 overflow-auto bg-[#F7F8FA] p-3 text-xs">{JSON.stringify(item.registered_address, null, 2)}</pre>
          <DecisionInput id={item.id} notes={notes} setNotes={setNotes} />
          <div className="mt-3 flex gap-2"><button disabled={busy} className="button" onClick={() => void decide(() => reviewVerification(item.id, true, notes[item.id] ?? ""))}>Approve</button><button disabled={busy} className="button-secondary" onClick={() => void decide(() => reviewVerification(item.id, false, notes[item.id] ?? ""))}>Reject</button></div>
        </article>)}</div>
      </section>
      <section className="mt-10"><h2 className="text-xl font-black">Product moderation ({products.length})</h2>
        {products.length === 0 && <p className="mt-3 border bg-white p-5 text-sm">No listings awaiting moderation.</p>}
        <div className="mt-3 grid gap-3">{products.map(item => <article key={item.id} className="border bg-white p-5">
          <h3 className="font-bold">{item.name}</h3><p className="mt-1 text-sm text-[#526178]">SKU {item.seller_sku} · MOQ {item.minimum_order_quantity} · stock {item.available_quantity}</p>
          <DecisionInput id={item.id} notes={notes} setNotes={setNotes} />
          <div className="mt-3 flex gap-2"><button disabled={busy} className="button" onClick={() => void decide(() => moderateProduct(item.id, true, notes[item.id] ?? ""))}>Approve listing</button><button disabled={busy} className="button-secondary" onClick={() => void decide(() => moderateProduct(item.id, false, notes[item.id] ?? ""))}>Reject listing</button></div>
        </article>)}</div>
      </section>
      <section className="mt-10"><h2 className="text-xl font-black">Disputes ({disputes.length})</h2>
        {disputes.length === 0 && <p className="mt-3 border bg-white p-5 text-sm">No open disputes.</p>}
        <div className="mt-3 grid gap-3">{disputes.map(item => <article key={item.id} className="border bg-white p-5">
          <h3 className="font-bold">{item.type.replaceAll("_", " ")} · order {item.order_id}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm">{item.description}</p>
          <label className="mt-3 grid gap-1 text-sm font-semibold">Outcome<select className="border border-[#C9D3DF] p-2" value={outcomes[item.id] ?? "seller_release"} onChange={event => setOutcomes(current => ({ ...current, [item.id]: event.target.value }))}><option value="seller_release">Release to seller / complete</option><option value="buyer_return">Return required</option><option value="cancel_order">Cancel order</option></select></label>
          <DecisionInput id={item.id} notes={notes} setNotes={setNotes} minLength={20} />
          <button disabled={busy} className="button mt-3" onClick={() => void decide(() => resolveDispute(item.id, outcomes[item.id] ?? "seller_release", notes[item.id] ?? ""))}>Resolve dispute</button>
        </article>)}</div>
      </section>
    </>}
  </div></main>;
}
function DecisionInput({ id, notes, setNotes, minLength = 10 }: { id: string; notes: Record<string, string>; setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>; minLength?: number }) {
  return <label className="mt-3 grid gap-1 text-sm font-semibold">Decision notes (at least {minLength} characters)<textarea required className="border border-[#C9D3DF] p-2" minLength={minLength} value={notes[id] ?? ""} onChange={event => setNotes(current => ({ ...current, [id]: event.target.value }))} /></label>;
}
function Metric({ label, value, urgent = false }: { label: string; value: number; urgent?: boolean }) {
  return <div className={`border bg-white p-4 ${urgent ? "border-red-400" : ""}`}><p className="text-2xl font-black">{value}</p><p className="text-xs font-bold uppercase tracking-wider text-[#526178]">{label}</p></div>;
}
function message(error: unknown) { return error instanceof Error ? error.message : "Request failed."; }

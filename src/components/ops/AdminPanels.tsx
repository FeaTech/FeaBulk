import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getAdminCategories,
  getPlatformOrders,
  getPlatformPayments,
  saveCategory,
  type AdminCategory,
  type PlatformOrder,
  type PlatformPayment,
} from "@/lib/marketplace";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);
const label = (s: string | null) => (s ? s.replaceAll("_", " ") : "—");
const errText = (e: unknown) => (e instanceof Error ? e.message : "Request failed.");

function useLoad<T>(fn: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    try {
      setData(await fn());
      setError("");
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, error, loading, reload };
}

function Card({ label: l, value, urgent }: { label: string; value: ReactNode; urgent?: boolean }) {
  return (
    <div className={`border bg-white p-4 ${urgent ? "border-red-400" : ""}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wider text-[#526178]">{l}</p>
    </div>
  );
}
function Alert({ children }: { children: ReactNode }) {
  return <p role="alert" className="mt-3 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{children}</p>;
}
const th = "px-3 py-2 text-left text-xs font-black uppercase tracking-wider text-[#526178]";
const td = "px-3 py-2 text-sm";

const STALLED = ["awaiting_seller_confirmation", "awaiting_payment", "disputed", "inspection"];
const CLOSED = ["completed", "cancelled", "returned"];

export function OrdersPanel() {
  const { data: orders, error, loading } = useLoad<PlatformOrder[]>(getPlatformOrders, []);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const stats = useMemo(() => {
    const live = orders.filter((o) => o.status !== "cancelled");
    return {
      gmv: live.reduce((s, o) => s + Number(o.grand_total || 0), 0),
      active: orders.filter((o) => !CLOSED.includes(o.status)).length,
      transit: orders.filter((o) => o.status === "shipped" || o.shipment_status === "in_transit").length,
      attention: orders.filter((o) => STALLED.includes(o.status)).length,
    };
  }, [orders]);
  const statuses = useMemo(() => Array.from(new Set(orders.map((o) => o.status))), [orders]);
  const rows = orders.filter(
    (o) =>
      (filter === "all" || o.status === filter) &&
      (!q || `${o.order_number} ${o.buyer_name} ${o.seller_name}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <section className="mt-8">
      <h2 className="text-xl font-black">Order oversight</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Card label="Total order value (GMV)" value={inr(stats.gmv)} />
        <Card label="Active orders" value={stats.active} />
        <Card label="In transit" value={stats.transit} />
        <Card label="Needs attention" value={stats.attention} urgent={stats.attention > 0} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <input className="border border-[#C9D3DF] bg-white p-2 text-sm" placeholder="Search order, buyer, seller" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="border border-[#C9D3DF] bg-white p-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
      </div>
      {error && <Alert>{error}</Alert>}
      {loading ? <p className="mt-3 text-sm">Loading orders…</p> : rows.length === 0 ? (
        <p className="mt-3 border bg-white p-5 text-sm">No orders match.</p>
      ) : (
        <div className="mt-3 overflow-x-auto border bg-white">
          <table className="w-full">
            <thead className="border-b bg-[#F7F8FA]"><tr>
              <th className={th}>Order</th><th className={th}>Buyer</th><th className={th}>Seller</th><th className={th}>Status</th><th className={th}>Payment</th><th className={th}>Shipment</th><th className={th}>Value</th><th className={th}>Placed</th>
            </tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className={`border-b last:border-0 ${STALLED.includes(o.status) ? "bg-orange-50" : ""}`}>
                  <td className={`${td} font-bold`}>{o.order_number}</td>
                  <td className={td}>{o.buyer_name}</td>
                  <td className={td}>{o.seller_name}</td>
                  <td className={`${td} capitalize`}>{label(o.status)}</td>
                  <td className={`${td} capitalize`}>{label(o.payment_status)}</td>
                  <td className={`${td} capitalize`}>{label(o.shipment_status)}</td>
                  <td className={td}>{inr(o.grand_total)}</td>
                  <td className={td}>{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function PaymentsPanel() {
  const { data: payments, error, loading } = useLoad<PlatformPayment[]>(getPlatformPayments, []);
  const [filter, setFilter] = useState("all");
  const stats = useMemo(() => ({
    captured: payments.filter((p) => p.status === "captured").reduce((s, p) => s + Number(p.amount), 0),
    pending: payments.filter((p) => ["initiated", "pending", "authorized"].includes(p.status)).length,
    failed: payments.filter((p) => p.status === "failed").length,
    exceptions: payments.filter((p) => p.reconciliation_status === "exception").length,
  }), [payments]);
  const rows = payments.filter((p) =>
    filter === "all" ? true : filter === "exception" ? p.reconciliation_status === "exception" : p.status === filter,
  );
  return (
    <section className="mt-8">
      <h2 className="text-xl font-black">Payments & escrow</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Card label="Captured" value={inr(stats.captured)} />
        <Card label="Pending" value={stats.pending} />
        <Card label="Failed" value={stats.failed} urgent={stats.failed > 0} />
        <Card label="Reconciliation exceptions" value={stats.exceptions} urgent={stats.exceptions > 0} />
      </div>
      <select className="mt-4 border border-[#C9D3DF] bg-white p-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="all">All payments</option>
        {["initiated", "pending", "authorized", "captured", "failed", "partially_refunded", "refunded", "cancelled"].map((s) => (
          <option key={s} value={s}>{label(s)}</option>
        ))}
        <option value="exception">Reconciliation exceptions</option>
      </select>
      {error && <Alert>{error}</Alert>}
      {loading ? <p className="mt-3 text-sm">Loading payments…</p> : rows.length === 0 ? (
        <p className="mt-3 border bg-white p-5 text-sm">No payments match.</p>
      ) : (
        <div className="mt-3 overflow-x-auto border bg-white">
          <table className="w-full">
            <thead className="border-b bg-[#F7F8FA]"><tr>
              <th className={th}>Order</th><th className={th}>Provider</th><th className={th}>Reference</th><th className={th}>Status</th><th className={th}>Reconciliation</th><th className={th}>Amount</th><th className={th}>Created</th>
            </tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={`border-b last:border-0 ${p.status === "failed" || p.reconciliation_status === "exception" ? "bg-red-50" : ""}`}>
                  <td className={`${td} font-bold`}>{p.order_number}</td>
                  <td className={`${td} capitalize`}>{p.provider}</td>
                  <td className={`${td} font-mono text-xs`}>{p.provider_reference ?? "—"}</td>
                  <td className={`${td} capitalize`}>{label(p.status)}</td>
                  <td className={`${td} capitalize`}>{p.reconciliation_status}</td>
                  <td className={td}>{inr(p.amount)}</td>
                  <td className={td}>{new Date(p.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function CategoriesPanel({ canEdit }: { canEdit: boolean }) {
  const { data: cats, error, loading, reload } = useLoad<AdminCategory[]>(getAdminCategories, []);
  const [form, setForm] = useState({ id: null as string | null, name: "", slug: "", parent_id: "", is_active: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const names = new Map(cats.map((c) => [c.id, c.name]));

  async function submit(payload: typeof form) {
    setBusy(true); setErr(""); setMsg("");
    try {
      await saveCategory({ ...payload, parent_id: payload.parent_id || null, slug: payload.slug || slugify(payload.name) });
      setMsg(payload.id ? "Category updated." : "Category added.");
      setForm({ id: null, name: "", slug: "", parent_id: "", is_active: true });
      await reload();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-xl font-black">Categories ({cats.length})</h2>
      {canEdit && (
        <form
          className="mt-3 grid gap-3 border bg-white p-4 sm:grid-cols-5"
          onSubmit={(e) => { e.preventDefault(); void submit(form); }}
        >
          <input required minLength={2} className="border border-[#C9D3DF] p-2 text-sm" placeholder="Name" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.id ? f.slug : slugify(e.target.value) }))} />
          <input required className="border border-[#C9D3DF] p-2 text-sm" placeholder="slug" value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          <select className="border border-[#C9D3DF] p-2 text-sm" value={form.parent_id} onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}>
            <option value="">No parent</option>
            {cats.filter((c) => c.id !== form.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} /> Visible
          </label>
          <div className="flex gap-2">
            <button disabled={busy} className="button">{form.id ? "Save" : "Add category"}</button>
            {form.id && <button type="button" className="border px-3 text-sm font-bold" onClick={() => setForm({ id: null, name: "", slug: "", parent_id: "", is_active: true })}>Cancel</button>}
          </div>
        </form>
      )}
      {msg && <p role="status" className="mt-3 border border-green-300 bg-green-50 p-3 text-sm text-green-800">{msg}</p>}
      {(error || err) && <Alert>{error || err}</Alert>}
      {loading ? <p className="mt-3 text-sm">Loading categories…</p> : (
        <div className="mt-3 overflow-x-auto border bg-white">
          <table className="w-full">
            <thead className="border-b bg-[#F7F8FA]"><tr>
              <th className={th}>Name</th><th className={th}>Slug</th><th className={th}>Parent</th><th className={th}>Products</th><th className={th}>Visible</th>{canEdit && <th className={th}></th>}
            </tr></thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className={`${td} font-bold`}>{c.name}</td>
                  <td className={`${td} font-mono text-xs`}>{c.slug}</td>
                  <td className={td}>{c.parent_id ? names.get(c.parent_id) ?? "—" : "—"}</td>
                  <td className={td}>{c.product_count}</td>
                  <td className={td}>{c.is_active ? "Yes" : "Hidden"}</td>
                  {canEdit && (
                    <td className={`${td} whitespace-nowrap`}>
                      <button className="mr-3 font-bold text-[#102B52] underline" onClick={() => setForm({ id: c.id, name: c.name, slug: c.slug, parent_id: c.parent_id ?? "", is_active: c.is_active })}>Edit</button>
                      <button disabled={busy} className="font-bold text-[#F87908] underline" onClick={() => void submit({ id: c.id, name: c.name, slug: c.slug, parent_id: c.parent_id ?? "", is_active: !c.is_active })}>
                        {c.is_active ? "Hide" : "Show"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

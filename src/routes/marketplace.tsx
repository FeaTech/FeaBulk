import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { getCategories, getSupplierDirectory, searchPublishedProducts, type Category, type MarketplaceProduct } from "@/lib/marketplace";

export const Route = createFileRoute("/marketplace")({
  head: () => ({ meta: [
    { title: "Wholesale Marketplace | FEA Bulk" },
    { name: "description", content: "Find approved wholesale products and verified suppliers on FEA Bulk." },
    { property: "og:title", content: "Wholesale Marketplace | FEA Bulk" },
    { property: "og:description", content: "Find approved wholesale products and verified suppliers on FEA Bulk." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Marketplace,
});

function Marketplace() {
  const [term, setTerm] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; display_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function search(nextTerm: string, nextCategory: string) {
    setLoading(true); setError("");
    try { setProducts(await searchPublishedProducts(nextTerm, nextCategory)); }
    catch (err) { setError(err instanceof Error ? err.message : "Search failed."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    const initialTerm = new URLSearchParams(window.location.search).get("q") ?? "";
    setTerm(initialTerm);
    void Promise.all([getCategories(), getSupplierDirectory(), searchPublishedProducts(initialTerm, "")])
      .then(([nextCategories, nextSuppliers, nextProducts]) => {
        setCategories(nextCategories); setSuppliers(nextSuppliers); setProducts(nextProducts); setLoading(false);
      }).catch(err => { setError(err instanceof Error ? err.message : "Marketplace failed to load."); setLoading(false); });
  }, []);
  function submit(event: FormEvent) { event.preventDefault(); void search(term, categoryId); }
  return <main className="min-h-screen bg-[#F7F8FA] text-[#17233A]">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><a href="/" className="text-xl font-black text-[#102B52]">FEA<span className="text-[#F87908]">Bulk</span></a><div className="flex gap-4 text-sm font-bold"><a href="/app">Workspace</a><a href="/auth">Sign in</a></div></div></header>
    <div className="mx-auto max-w-6xl px-5 py-10"><p className="text-xs font-black uppercase tracking-wider text-[#F87908]">Verified marketplace</p><h1 className="mt-2 text-3xl font-black text-[#102B52]">Find wholesale products and suppliers</h1>
      <form className="mt-6 flex flex-wrap gap-3" onSubmit={submit}><input aria-label="Search products" className="min-w-60 flex-1 border border-[#C9D3DF] bg-white px-4 py-3" value={term} onChange={event => setTerm(event.target.value)} placeholder="Search products or SKU" /><select aria-label="Category" className="border border-[#C9D3DF] bg-white px-4 py-3" value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="">All categories</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="button">Search</button></form>
      {error && <p role="alert" className="mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_250px]"><section><h2 className="text-xl font-black">Products {loading ? "" : `(${products.length})`}</h2>{loading ? <p className="mt-4">Loading products…</p> : products.length === 0 ? <p className="mt-4 border bg-white p-6 text-sm">No approved products match this search.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{products.map(item => { const price = item.product_price_tiers.reduce<number | null>((lowest, tier) => lowest === null ? Number(tier.unit_price) : Math.min(lowest, Number(tier.unit_price)), null); return <article key={item.id} className="border bg-white p-5"><h3 className="text-lg font-extrabold text-[#102B52]">{item.name}</h3><p className="mt-1 text-sm text-[#526178]">{item.supplier_name ?? "Verified supplier"}</p><p className="mt-3 line-clamp-3 text-sm">{item.description}</p><p className="mt-4 text-sm font-bold">MOQ {item.minimum_order_quantity} · {item.available_quantity} available</p><p className="mt-1 text-sm">{price === null ? "Price by quotation" : `From ₹${price.toLocaleString("en-IN")} per unit`}</p><a href="/app" className="mt-4 inline-block text-sm font-extrabold text-[#D96806]">Create a buyer RFQ →</a></article>; })}</div>}</section>
        <aside><h2 className="text-xl font-black">Verified suppliers</h2>{suppliers.length === 0 ? <p className="mt-4 border bg-white p-5 text-sm">No suppliers are verified yet.</p> : <ul className="mt-4 grid gap-2">{suppliers.map(item => <li key={item.id} className="border bg-white p-3 text-sm font-semibold">{item.display_name}</li>)}</ul>}</aside></div>
    </div>
  </main>;
}

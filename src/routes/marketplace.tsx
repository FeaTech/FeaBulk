import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ProductPicture } from "@/components/marketplace/PublicShell";
import { SupplierRating } from "@/components/marketplace/SupplierRating";
import { getCategories, getSupplierDirectory, getSupplierRatings, searchPublishedProducts, type Category, type MarketplaceProduct, type SupplierRating as Rating } from "@/lib/marketplace";

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
  const [ratings, setRatings] = useState<Map<string, Rating>>(new Map());
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
        void getSupplierRatings(nextSuppliers.map(item => item.id)).then(setRatings).catch(() => undefined);
      }).catch(err => { setError(err instanceof Error ? err.message : "Marketplace failed to load."); setLoading(false); });
  }, []);
  function submit(event: FormEvent) { event.preventDefault(); void search(term, categoryId); }
  return <main className="min-h-screen bg-[#F7F8FA] text-[#17233A]">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><a href="/" className="text-xl font-black text-[#102B52]">FEA<span className="text-[#F87908]">Bulk</span></a><div className="flex gap-4 text-sm font-bold"><a href="/app">Workspace</a><a href="/auth">Sign in</a></div></div></header>
    <div className="mx-auto max-w-6xl px-5 py-10"><p className="text-xs font-black uppercase tracking-wider text-[#F87908]">Verified marketplace</p><h1 className="mt-2 text-3xl font-black text-[#102B52]">Find wholesale products and suppliers</h1>
      <form className="mt-6 flex flex-wrap gap-3" onSubmit={submit}><input aria-label="Search products" className="min-w-60 flex-1 border border-[#C9D3DF] bg-white px-4 py-3" value={term} onChange={event => setTerm(event.target.value)} placeholder="Search products or SKU" /><select aria-label="Category" className="border border-[#C9D3DF] bg-white px-4 py-3" value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="">All categories</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="button">Search</button></form>
      {error && <p role="alert" className="mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_250px]"><section><h2 className="text-xl font-black">Products {loading ? "" : `(${products.length})`}</h2>{loading ? <p className="mt-4">Loading products…</p> : products.length === 0 ? <p className="mt-4 border bg-white p-6 text-sm">No approved products match this search.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{products.map(item => { const price = item.product_price_tiers.reduce<number | null>((lowest, tier) => lowest === null ? Number(tier.unit_price) : Math.min(lowest, Number(tier.unit_price)), null); return <article key={item.id} className="border bg-white p-5"><ProductPicture product={item} className="mb-4 h-28 w-full text-4xl" /><h3 className="text-lg font-extrabold text-[#102B52]"><a className="hover:text-[#F87908]" href={`/products/${item.slug}`}>{item.name}</a></h3><p className="mt-1 text-sm text-[#526178]"><a className="hover:text-[#F87908]" href={`/suppliers/${item.organization_id}`}>{item.supplier_name ?? "Verified supplier"}</a></p><p className="mt-3 line-clamp-3 text-sm">{item.description}</p><p className="mt-4 text-sm font-bold">MOQ {item.minimum_order_quantity} · {item.available_quantity} available</p><p className="mt-1 text-sm">{price === null ? "Price by quotation" : `From ₹${price.toLocaleString("en-IN")} per unit`}</p><a href={`/products/${item.slug}`} className="mt-4 inline-block text-sm font-extrabold text-[#D96806]">View product →</a></article>; })}</div>}</section>
        <aside><h2 className="text-xl font-black">Verified suppliers</h2>{suppliers.length === 0 ? <p className="mt-4 border bg-white p-5 text-sm">No suppliers are verified yet.</p> : <ul className="mt-4 grid gap-2">{suppliers.map(item => <li key={item.id} className="border bg-white text-sm font-semibold"><a className="block p-3 hover:text-[#F87908]" href={`/suppliers/${item.id}`}>{item.display_name}<span className="mt-1 block"><SupplierRating rating={ratings.get(item.id)} /></span></a></li>)}</ul>}{categories.length > 0 && <><h2 className="mt-8 text-xl font-black">Categories</h2><ul className="mt-4 grid gap-2">{categories.map(item => <li key={item.id} className="border bg-white text-sm font-semibold"><a className="block p-3 hover:text-[#F87908]" href={`/categories/${item.slug}`}>{item.name}</a></li>)}</ul></>}</aside></div>
    </div>
  </main>;
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { ProductCard, PublicShell } from "@/components/marketplace/PublicShell";
import { Button } from "@/components/ui/button";
import { SupplierRating } from "@/components/marketplace/SupplierRating";
import { getCategories, getSupplierDirectory, getSupplierRatings, searchPublishedProducts, type Category, type MarketplaceProduct, type SupplierRating as Rating } from "@/lib/marketplace";

export const Route = createFileRoute("/marketplace")({
  validateSearch: (search: Record<string, unknown>) => ({ q: typeof search.q === "string" ? search.q : "" }),
  head: () => ({ meta: [
    { title: "Wholesale Marketplace | FEA Bulk" },
    { name: "description", content: "Find approved wholesale products and verified suppliers on FEA Bulk." },
    { property: "og:title", content: "Wholesale Marketplace | FEA Bulk" },
    { property: "og:description", content: "Find approved wholesale products and verified suppliers on FEA Bulk." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: Marketplace,
});
function Marketplace() {
  const { q } = Route.useSearch();
  const requestId = useRef(0);
  const [term, setTerm] = useState(q);
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; display_name: string }>>([]);
  const [ratings, setRatings] = useState<Map<string, Rating>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function search(nextTerm: string, nextCategory: string) {
    const id = ++requestId.current; setLoading(true); setError("");
    try { const result = await searchPublishedProducts(nextTerm, nextCategory); if (id === requestId.current) setProducts(result); }
    catch (err) { if (id === requestId.current) setError(err instanceof Error ? err.message : "Search failed."); }
    finally { if (id === requestId.current) setLoading(false); }
  }
  useEffect(() => { setTerm(q); void search(q, ""); setCategoryId(""); return () => { requestId.current++; }; }, [q]);
  useEffect(() => {
    let active = true;
    void getCategories().then(items => { if (active) setCategories(items); }).catch(() => undefined);
    void getSupplierDirectory().then(items => {
      if (!active) return; setSuppliers(items);
      void getSupplierRatings(items.map(item => item.id)).then(items => { if (active) setRatings(items); }).catch(() => undefined);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  function submit(event: FormEvent) { event.preventDefault(); void search(term, categoryId); }
  return <PublicShell>
    <p className="text-xs font-semibold uppercase tracking-wider text-workspace-warning">Verified marketplace</p>
    <h1 className="mt-3 text-3xl font-bold text-workspace-brand sm:text-4xl">Wholesale marketplace</h1>
    <form className="mt-7 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]" onSubmit={submit}>
      <div className="flex min-w-0 items-center gap-3 rounded-md border bg-card px-4"><Search className="size-5 shrink-0 text-muted-foreground" /><input aria-label="Search products" className="w-full bg-transparent py-3 text-sm" value={term} onChange={e => setTerm(e.target.value)} placeholder="Search products or SKU" /></div>
      <select aria-label="Category" className="w-full border bg-card px-4 py-3 text-sm sm:max-w-60" value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">All categories</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <Button variant="workspace" type="submit" className="h-12"><Search />Search</Button>
    </form>
    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <div className="mt-10 grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_230px]">
      <section className="min-w-0"><h2 className="text-xl font-semibold">Products {loading ? "" : `(${products.length})`}</h2>{loading ? <p role="status" className="mt-5 text-muted-foreground">Loading products…</p> : products.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">No approved products match this search.</p> : <div className="mt-5 grid gap-5 sm:grid-cols-2">{products.map(item => <ProductCard key={item.id} product={item} />)}</div>}</section>
      <aside className="min-w-0 border-t pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"><h2 className="text-lg font-semibold">Verified suppliers</h2>{suppliers.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No suppliers are verified yet.</p> : <ul className="mt-4 divide-y">{suppliers.map(item => <li key={item.id}><Link className="block py-4 text-sm font-semibold hover:text-workspace-warning" to="/suppliers/$slug" params={{ slug: item.id }}>{item.display_name}<span className="mt-1 block"><SupplierRating rating={ratings.get(item.id)} /></span></Link></li>)}</ul>}{categories.length > 0 && <><h2 className="mt-8 text-lg font-semibold">Categories</h2><ul className="mt-3 space-y-3">{categories.map(item => <li key={item.id}><Link className="text-sm text-muted-foreground hover:text-workspace-warning" to="/categories/$slug" params={{ slug: item.slug }}>{item.name}</Link></li>)}</ul></>}</aside>
    </div>
  </PublicShell>;
}

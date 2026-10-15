import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Search, ShieldCheck } from "lucide-react";
import { ProductCard, PublicShell } from "@/components/marketplace/PublicShell";
import { Button } from "@/components/ui/button";
import { searchPublishedProducts, type MarketplaceProduct } from "@/lib/marketplace";
import warehouse from "@/assets/warehouse.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "FEA Bulk | Buy Wholesale from Verified Suppliers" },
    { name: "description", content: "Buy wholesale products directly from verified suppliers. Explore volume pricing and manage your orders with FEA Bulk." },
    { property: "og:title", content: "FEA Bulk | Buy Wholesale from Verified Suppliers" },
    { property: "og:description", content: "Buy wholesale products directly from verified suppliers with transparent bulk pricing." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { property: "og:image", content: warehouse.url },
    { name: "twitter:image", content: warehouse.url },
  ], links: [{ rel: "preload", as: "image", href: warehouse.url }] }),
  component: Index,
});
function Index() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void searchPublishedProducts("", "", 50).then(items => { if (active) setProducts(items.slice(0, 8)); })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  function search(event: FormEvent) { event.preventDefault(); void router.navigate({ to: "/marketplace", search: { q: term } }); }
  return <PublicShell fullWidth>
    <section className="relative isolate overflow-hidden bg-workspace-nav text-workspace-nav-foreground">
      <img src={warehouse.url} alt="Pallets and wholesale stock in a distribution warehouse" fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      <div className="public-hero-shade absolute inset-0 -z-10" />
      <div className="public-container py-12 sm:py-16">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-workspace-action">Verified wholesale marketplace</p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">FEA Bulk</h1>
        <p className="mt-4 max-w-xl text-2xl font-semibold leading-snug sm:text-3xl">Bulk buying. Trusted businesses.</p>
        <p className="mt-5 max-w-xl leading-7 text-workspace-nav-foreground/80">Buy directly from verified suppliers, with transparent minimum quantities and pricing that rewards volume.</p>
        <form onSubmit={search} className="mt-7 grid max-w-2xl gap-2 rounded-md bg-card p-2 text-foreground sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-3 px-3"><Search className="size-5 shrink-0 text-muted-foreground" /><input aria-label="Search products" value={term} onChange={e => setTerm(e.target.value)} className="w-full bg-transparent py-3 text-sm outline-none" placeholder="Search products or SKU" /></div>
          <Button type="submit" variant="workspace" className="h-12 px-5">Search marketplace<ArrowRight /></Button>
        </form>
        <p className="mt-5 flex items-center gap-2 text-sm text-workspace-nav-foreground/80"><ShieldCheck className="size-4 shrink-0 text-workspace-action" />Verified suppliers · Direct orders · FeaBulk payments</p>
      </div>
    </section>
    <section id="marketplace" className="public-container py-10 sm:py-14">
      <div className="grid gap-4 sm:flex sm:items-end sm:justify-between"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-workspace-warning">Wholesale catalog</p><h2 className="mt-2 text-3xl font-bold text-workspace-brand">Explore products</h2></div><Button asChild variant="ghost"><Link to="/marketplace">View all products<ArrowRight /></Link></Button></div>
      {loading ? <p role="status" className="mt-8 text-muted-foreground">Loading products…</p> : error ? <p role="alert" className="mt-8 text-destructive">Products could not be loaded right now.</p> : products.length === 0 ? <p className="mt-8 text-muted-foreground">No approved products are listed yet.</p> : <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{products.map(product => <ProductCard key={product.id} product={product} />)}</div>}
    </section>
    <footer className="border-t bg-card"><div className="public-container grid gap-3 py-7 text-sm text-muted-foreground sm:flex sm:justify-between"><p><span className="font-semibold text-workspace-brand">FEA Bulk</span> · Verified wholesale trade</p><Link to="/marketplace">Marketplace</Link></div></footer>
  </PublicShell>;
}

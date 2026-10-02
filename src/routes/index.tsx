import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { searchPublishedProducts, type MarketplaceProduct } from "@/lib/marketplace";

type IconProps = { size?: number; className?: string };
function Icon({ size = 20, className, children }: IconProps & { children: ReactNode }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}
const ArrowRight = (props: IconProps) => <Icon {...props}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Icon>;
const Menu = (props: IconProps) => <Icon {...props}><path d="M4 6h16M4 12h16M4 18h16" /></Icon>;
const Search = (props: IconProps) => <Icon {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>;
const ShieldCheck = (props: IconProps) => <Icon {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></Icon>;
const X = (props: IconProps) => <Icon {...props}><path d="M18 6 6 18M6 6l12 12" /></Icon>;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FEA Bulk | Verified B2B Wholesale Trade" },
      { name: "description", content: "Source products, compare quotes and trade with verified businesses on FEA Bulk." },
      { property: "og:title", content: "FEA Bulk | Verified B2B Wholesale Trade" },
      { property: "og:description", content: "Source products, compare quotes and trade with verified businesses on FEA Bulk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(false);

  useEffect(() => {
    let active = true;
    void searchPublishedProducts("", "", 8)
      .then((items) => { if (active) setProducts(items); })
      .catch(() => { if (active) setProductsError(true); })
      .finally(() => { if (active) setProductsLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#FDFCF8] text-[#17233A]">
      <header className="border-b border-[#DDE5EE] bg-white">
        <div className="mx-auto flex h-20 max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <a className="flex items-center gap-3" href="#top" aria-label="FEA Bulk home">
            <span className="grid h-9 w-9 place-items-center bg-[#102B52] text-lg font-black text-[#F87908]">F</span>
            <span className="text-[22px] font-extrabold tracking-[-0.04em] text-[#102B52]">FEA<span className="text-[#F87908]">Bulk</span></span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#405069] lg:flex" aria-label="Main navigation">
            <a className="hover:text-[#F87908]" href="#marketplace">Marketplace</a>
          </nav>
          <div className="hidden items-center gap-4 lg:flex">
            <a className="text-sm font-bold text-[#102B52] hover:text-[#F87908]" href="/auth">Sign in</a>
            <a className="bg-[#F87908] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#d96806]" href="/auth">Create business account</a>
          </div>
          <button className="grid h-10 w-10 place-items-center border border-[#DDE5EE] text-[#102B52] lg:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Toggle navigation">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && <nav className="border-t border-[#DDE5EE] bg-white px-5 py-4 lg:hidden" aria-label="Mobile navigation">
          <div className="mx-auto grid max-w-[1240px] gap-1 text-sm font-bold text-[#102B52]">
            <a className="py-3" href="#marketplace" onClick={() => setMenuOpen(false)}>Marketplace</a>
          </div>
        </nav>}
      </header>

      <section id="top" className="relative border-b border-[#DDE5EE] bg-[#EAF2FB]">
        <div className="absolute inset-y-0 right-0 hidden w-[43%] bg-[#102B52] lg:block" />
        <div className="relative mx-auto grid max-w-[1240px] gap-10 px-5 py-16 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="mb-5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#F87908]"><span className="h-px w-8 bg-[#F87908]" /> India&apos;s verified B2B trade network</p>
            <h1 className="max-w-xl text-4xl font-black leading-[1.06] tracking-[-0.045em] text-[#102B52] sm:text-5xl lg:text-6xl">Trade in bulk with businesses you can trust.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#526178] sm:text-lg">Find approved products, compare structured quotes and create a recorded wholesale order.</p>
            <form className="mt-9 flex max-w-2xl flex-col gap-2 bg-white p-2 shadow-[0_12px_30px_rgba(16,43,82,.12)] sm:flex-row" action="/marketplace">
              <label className="sr-only" htmlFor="search">Search products, suppliers or categories</label>
              <div className="flex min-w-0 flex-1 items-center gap-3 px-3"><Search className="shrink-0 text-[#697488]" size={20} /><input id="search" name="q" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-[#8A95A8]" placeholder="Search products or SKU" /></div>
              <button className="flex items-center justify-center gap-2 bg-[#F87908] px-6 py-3 text-sm font-extrabold text-white hover:bg-[#d96806]" type="submit">Search marketplace <ArrowRight size={16} /></button>
            </form>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#526178]"><span className="font-semibold text-[#102B52]">Popular:</span><a href="/marketplace?q=industrial" className="hover:text-[#F87908]">Industrial supplies</a><a href="/marketplace?q=packaging" className="hover:text-[#F87908]">Packaging</a><a href="/marketplace?q=food" className="hover:text-[#F87908]">Food ingredients</a></div>
          </div>
          <div className="relative flex min-h-[330px] items-end bg-[#102B52] p-6 sm:p-9 lg:min-h-[430px]">
            <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(135deg, transparent 0 62%, rgba(248,121,8,.68) 62% 63%, transparent 63%), linear-gradient(45deg, transparent 0 76%, rgba(255,255,255,.13) 76% 77%, transparent 77%)" }} />
            <div className="relative max-w-sm text-white"><p className="text-xs font-bold uppercase tracking-[.17em] text-[#F9A453]">Commercial records</p><p className="mt-4 text-3xl font-extrabold leading-tight">From requirement to accepted order, decisions stay visible.</p><div className="mt-8 flex items-center gap-3 border-t border-white/20 pt-5 text-sm"><ShieldCheck className="text-[#F87908]" /><span>Verification, quote versions and order history in one workspace.</span></div></div>
          </div>
        </div>
      </section>

      <section id="marketplace" className="mx-auto max-w-[1240px] px-5 py-18 lg:px-8 lg:py-24">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#F87908]">Approved listings</p><h2 className="mt-3 text-3xl font-black tracking-[-.035em] text-[#102B52] sm:text-4xl">Explore wholesale products</h2><p className="mt-3 text-[#526178]">Browse live products from verified suppliers.</p></div><a href="/marketplace" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#102B52] hover:text-[#F87908]">View all products <ArrowRight size={17} /></a></div>
        {productsLoading ? (
          <p className="mt-10 text-sm text-[#526178]" role="status">Loading products…</p>
        ) : productsError ? (
          <div className="mt-10 border border-[#DDE5EE] bg-white p-8"><p className="font-semibold text-[#102B52]">Products could not be loaded right now.</p><a href="/marketplace" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#D96806]">Open marketplace <ArrowRight size={16} /></a></div>
        ) : products.length === 0 ? (
          <div className="mt-10 border border-[#DDE5EE] bg-white p-8"><p className="font-semibold text-[#102B52]">No approved products are listed yet.</p><p className="mt-2 text-sm text-[#526178]">New listings will appear here after review.</p><a href="/marketplace" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#D96806]">Browse marketplace <ArrowRight size={16} /></a></div>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => {
              const startingPrice = product.product_price_tiers.reduce<number | null>((lowest, tier) => lowest === null ? Number(tier.unit_price) : Math.min(lowest, Number(tier.unit_price)), null);
              return <article key={product.id} className="flex h-full flex-col border border-[#DDE5EE] bg-white p-5 transition hover:border-[#102B52] hover:shadow-[0_8px_20px_rgba(16,43,82,.08)]">
                <div className="mb-5 flex h-28 items-center justify-center bg-[#EAF2FB] text-4xl font-black text-[#102B52]" aria-hidden="true">{product.name.charAt(0).toUpperCase()}</div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#D96806]">{product.supplier_name ?? "Verified supplier"}</p>
                <h3 className="mt-2 text-lg font-extrabold leading-snug text-[#102B52]">{product.name}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#697488]">{product.description}</p>
                <div className="mt-auto pt-5"><p className="text-lg font-black text-[#102B52]">{startingPrice === null ? "Price by quotation" : `From ₹${startingPrice.toLocaleString("en-IN")}/unit`}</p><p className="mt-1 text-xs text-[#526178]">MOQ {product.minimum_order_quantity} · {product.available_quantity} available</p><a href="/app" className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-[#D96806]">Create buyer RFQ <ArrowRight size={16} /></a></div>
              </article>;
            })}
          </div>
        )}
      </section>

      <section id="how-it-works" className="bg-[#102B52] py-18 text-white lg:py-24">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-8"><div className="max-w-xl"><p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#F9A453]">A governed purchase journey</p><h2 className="mt-3 text-3xl font-black tracking-[-.035em] sm:text-4xl">From a requirement to an accepted order.</h2></div><div className="mt-12 grid gap-0 md:grid-cols-4">{[
          ["01", "Post a requirement", "Create an RFQ with quantities, specifications and delivery needs."],
          ["02", "Compare quotes", "Review normalized commercial terms and supplier information."],
          ["03", "Confirm the order", "Accept a formal quote and create a purchase order."],
          ["04", "Confirm with the seller", "The seller reviews the accepted order before payment arrangements."],
        ].map(([number, title, text]) => <div className="border-t border-white/20 py-6 md:border-l md:border-t-0 md:px-6 md:first:pl-0" key={number}><span className="text-sm font-black text-[#F87908]">{number}</span><h3 className="mt-5 text-xl font-extrabold">{title}</h3><p className="mt-3 text-sm leading-6 text-[#C5D4E8]">{text}</p></div>)}</div></div>
      </section>

      <section id="protection" className="bg-[#EAF2FB] py-18 lg:py-24"><div className="mx-auto grid max-w-[1240px] gap-10 px-5 lg:grid-cols-[.9fr_1.1fr] lg:px-8"><div><p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#F87908]">Commercial records</p><h2 className="mt-3 text-3xl font-black tracking-[-.035em] text-[#102B52] sm:text-4xl">Make every quote decision with a clear record.</h2><p className="mt-5 max-w-md leading-7 text-[#526178]">FEA Bulk records business verification, quote versions and order decisions as the marketplace grows.</p><a href="/app" className="mt-8 inline-flex items-center gap-2 bg-[#102B52] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#0A2142]">Open buyer workspace <ArrowRight size={16} /></a></div><div className="grid gap-3 sm:grid-cols-2">{[[<ClipboardCheck />, "Structured quote comparison", "Compare price, tax, freight and lead time."],[<FileCheck2 />, "Business verification", "Operations review submitted business details."],[<Truck />, "Order status", "See order acceptance and confirmation in one place."],[<ShieldCheck />, "Access controls", "Buyer and seller actions use separate permissions."]].map(([icon, title, text]) => <div className="bg-white p-6" key={String(title)}><span className="text-[#F87908]">{icon}</span><h3 className="mt-8 font-extrabold text-[#102B52]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#697488]">{text}</p></div>)}</div></div></section>

      <section id="sell" className="mx-auto max-w-[1240px] px-5 py-18 lg:px-8 lg:py-24"><div className="grid gap-10 border border-[#DDE5EE] bg-white p-7 lg:grid-cols-[1.15fr_.85fr] lg:p-12"><div><p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#F87908]">For verified suppliers</p><h2 className="mt-3 text-3xl font-black tracking-[-.035em] text-[#102B52] sm:text-4xl">Sell with better commercial control.</h2><p className="mt-5 max-w-xl leading-7 text-[#526178]">Prepare listings, respond to qualified RFQs, issue structured quotes and view accepted orders.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{["Set MOQ and price tiers", "Respond to RFQs", "Submit listings for review", "Confirm accepted orders"].map(item => <p className="flex items-center gap-3 text-sm font-bold text-[#405069]" key={item}><span className="grid h-5 w-5 place-items-center bg-[#EAF2FB] text-[#102B52]"><Check size={14} /></span>{item}</p>)}</div></div><div id="workspace" className="bg-[#102B52] p-7 text-white"><p className="text-sm font-bold text-[#F9A453]">Business workspace</p><p className="mt-3 text-2xl font-extrabold leading-tight">Set up your organization and choose how you trade.</p><p className="mt-4 text-sm leading-6 text-[#C5D4E8]">Create a buyer or seller business account. An additional role requires a separate business workspace.</p><a href="/auth" className="mt-7 flex w-full items-center justify-center gap-2 bg-[#F87908] px-4 py-3 text-sm font-extrabold text-white hover:bg-[#d96806]">Create business account <ArrowRight size={16} /></a></div></div></section>

      <footer className="border-t border-[#DDE5EE] bg-white"><div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-5 px-5 py-8 text-sm text-[#697488] sm:flex-row lg:px-8"><p><span className="font-extrabold text-[#102B52]">FEA<span className="text-[#F87908]">Bulk</span></span> · Wholesale marketplace in development.</p><div className="flex gap-5"><a href="/marketplace" className="hover:text-[#F87908]">Marketplace</a><a href="/auth" className="hover:text-[#F87908]">Sign in</a></div></div></footer>
    </main>
  );
}

function TrustItem({ icon, value, text }: { icon: ReactNode; value: string; text: string }) {
  return <div className="flex gap-4 py-6 sm:px-6 sm:first:pl-0"><span className="text-[#F87908]">{icon}</span><div><p className="font-extrabold text-[#102B52]">{value}</p><p className="mt-1 text-sm leading-5 text-[#697488]">{text}</p></div></div>;
}

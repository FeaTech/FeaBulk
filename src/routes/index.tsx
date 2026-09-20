import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

type IconProps = { size?: number; className?: string };
function Icon({ size = 20, className, children }: IconProps & { children: ReactNode }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}
const ArrowRight = (props: IconProps) => <Icon {...props}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Icon>;
const Check = (props: IconProps) => <Icon {...props}><path d="m5 12 4 4L19 6" /></Icon>;
const ClipboardCheck = (props: IconProps) => <Icon {...props}><rect x="5" y="4" width="14" height="17" rx="1" /><path d="M9 4V2h6v2M9 13l2 2 4-4" /></Icon>;
const FileCheck2 = (props: IconProps) => <Icon {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 15l2 2 4-4" /></Icon>;
const Menu = (props: IconProps) => <Icon {...props}><path d="M4 6h16M4 12h16M4 18h16" /></Icon>;
const PackageCheck = (props: IconProps) => <Icon {...props}><path d="m16 16 2 2 4-4" /><path d="M21 8v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8l9-5zM3 8l9 5 9-5M12 13v9" /></Icon>;
const Search = (props: IconProps) => <Icon {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>;
const ShieldCheck = (props: IconProps) => <Icon {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></Icon>;
const Truck = (props: IconProps) => <Icon {...props}><path d="M10 17h4V5H2v12h3M14 9h4l4 4v4h-3M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0M16 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0" /></Icon>;
const X = (props: IconProps) => <Icon {...props}><path d="M18 6 6 18M6 6l12 12" /></Icon>;

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [menuOpen, setMenuOpen] = useState(false);

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
            <a className="hover:text-[#F87908]" href="#how-it-works">How it works</a>
            <a className="hover:text-[#F87908]" href="#protection">Buyer protection</a>
            <a className="hover:text-[#F87908]" href="#sell">Sell on FEA Bulk</a>
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
            <a className="py-3" href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
            <a className="py-3" href="#protection" onClick={() => setMenuOpen(false)}>Buyer protection</a>
            <a className="py-3" href="#sell" onClick={() => setMenuOpen(false)}>Sell on FEA Bulk</a>
          </div>
        </nav>}
      </header>

      <section id="top" className="relative border-b border-[#DDE5EE] bg-[#EAF2FB]">
        <div className="absolute inset-y-0 right-0 hidden w-[43%] bg-[#102B52] lg:block" />
        <div className="relative mx-auto grid max-w-[1240px] gap-10 px-5 py-16 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="mb-5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#F87908]"><span className="h-px w-8 bg-[#F87908]" /> India&apos;s verified B2B trade network</p>
            <h1 className="max-w-xl text-4xl font-black leading-[1.06] tracking-[-0.045em] text-[#102B52] sm:text-5xl lg:text-6xl">Trade in bulk with businesses you can trust.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#526178] sm:text-lg">Source products, compare commercial terms and manage every stage of a wholesale transaction in one governed workspace.</p>
            <form className="mt-9 flex max-w-2xl flex-col gap-2 bg-white p-2 shadow-[0_12px_30px_rgba(16,43,82,.12)] sm:flex-row" action="#marketplace">
              <label className="sr-only" htmlFor="search">Search products, suppliers or categories</label>
              <div className="flex min-w-0 flex-1 items-center gap-3 px-3"><Search className="shrink-0 text-[#697488]" size={20} /><input id="search" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-[#8A95A8]" placeholder="Search products, suppliers or categories" /></div>
              <button className="flex items-center justify-center gap-2 bg-[#F87908] px-6 py-3 text-sm font-extrabold text-white hover:bg-[#d96806]" type="submit">Search marketplace <ArrowRight size={16} /></button>
            </form>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#526178]"><span className="font-semibold text-[#102B52]">Popular:</span><a href="#marketplace" className="hover:text-[#F87908]">Industrial supplies</a><a href="#marketplace" className="hover:text-[#F87908]">Packaging</a><a href="#marketplace" className="hover:text-[#F87908]">Food ingredients</a></div>
          </div>
          <div className="relative flex min-h-[330px] items-end bg-[#102B52] p-6 sm:p-9 lg:min-h-[430px]">
            <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(135deg, transparent 0 62%, rgba(248,121,8,.68) 62% 63%, transparent 63%), linear-gradient(45deg, transparent 0 76%, rgba(255,255,255,.13) 76% 77%, transparent 77%)" }} />
            <div className="relative max-w-sm text-white"><p className="text-xs font-bold uppercase tracking-[.17em] text-[#F9A453]">Built for commercial certainty</p><p className="mt-4 text-3xl font-extrabold leading-tight">From requirement to delivery, every milestone stays visible.</p><div className="mt-8 flex items-center gap-3 border-t border-white/20 pt-5 text-sm"><ShieldCheck className="text-[#F87908]" /><span>Verification, documents and transaction history in one record.</span></div></div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#DDE5EE] bg-white">
        <div className="mx-auto grid max-w-[1240px] divide-y divide-[#DDE5EE] px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:px-8">
          <TrustItem icon={<ShieldCheck />} value="Verified businesses" text="Business verification and documented trade history" />
          <TrustItem icon={<FileCheck2 />} value="Clear commercial terms" text="Structured quotes, purchase orders and invoices" />
          <TrustItem icon={<PackageCheck />} value="Transaction visibility" text="Payment, fulfilment and delivery milestones" />
        </div>
      </section>

      <section id="marketplace" className="mx-auto max-w-[1240px] px-5 py-18 lg:px-8 lg:py-24">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#F87908]">Source with confidence</p><h2 className="mt-3 text-3xl font-black tracking-[-.035em] text-[#102B52] sm:text-4xl">Find what your business needs</h2></div><a href="#workspace" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#102B52] hover:text-[#F87908]">View marketplace <ArrowRight size={17} /></a></div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Industrial & manufacturing", "Components, tools, consumables"],
            ["Packaging & materials", "Films, cartons, labels, containers"],
            ["Food & ingredients", "Bulk ingredients and food supply"],
            ["Office & business supply", "Operational supplies for teams"],
          ].map(([title, description], index) => <a href="#workspace" className="group border border-[#DDE5EE] bg-white p-6 transition hover:border-[#102B52] hover:shadow-[0_8px_20px_rgba(16,43,82,.08)]" key={title}><span className="mb-10 grid h-10 w-10 place-items-center bg-[#EAF2FB] text-sm font-black text-[#102B52]">0{index + 1}</span><h3 className="text-lg font-extrabold text-[#102B52]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#697488]">{description}</p><span className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-[#F87908]">Explore <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span></a>)}
        </div>
      </section>

      <section id="how-it-works" className="bg-[#102B52] py-18 text-white lg:py-24">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-8"><div className="max-w-xl"><p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#F9A453]">A governed transaction journey</p><h2 className="mt-3 text-3xl font-black tracking-[-.035em] sm:text-4xl">From a requirement to a completed order.</h2></div><div className="mt-12 grid gap-0 md:grid-cols-4">{[
          ["01", "Post a requirement", "Create an RFQ with quantities, specifications and delivery needs."],
          ["02", "Compare quotes", "Review normalized commercial terms and supplier information."],
          ["03", "Confirm the order", "Accept a formal quote and create a purchase order."],
          ["04", "Track fulfilment", "Follow payment, dispatch, delivery and inspection milestones."],
        ].map(([number, title, text]) => <div className="border-t border-white/20 py-6 md:border-l md:border-t-0 md:px-6 md:first:pl-0" key={number}><span className="text-sm font-black text-[#F87908]">{number}</span><h3 className="mt-5 text-xl font-extrabold">{title}</h3><p className="mt-3 text-sm leading-6 text-[#C5D4E8]">{text}</p></div>)}</div></div>
      </section>

      <section id="protection" className="bg-[#EAF2FB] py-18 lg:py-24"><div className="mx-auto grid max-w-[1240px] gap-10 px-5 lg:grid-cols-[.9fr_1.1fr] lg:px-8"><div><p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#F87908]">Buyer protection</p><h2 className="mt-3 text-3xl font-black tracking-[-.035em] text-[#102B52] sm:text-4xl">Make every commercial decision with a clear record.</h2><p className="mt-5 max-w-md leading-7 text-[#526178]">FEA Bulk is designed to keep verification, quote versions, documents and delivery evidence connected to the transaction.</p><a href="#workspace" className="mt-8 inline-flex items-center gap-2 bg-[#102B52] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#0A2142]">Learn about buyer protection <ArrowRight size={16} /></a></div><div className="grid gap-3 sm:grid-cols-2">{[[<ClipboardCheck />, "Structured quote comparison", "Review price, taxes, shipping and delivery promises side by side."],[<FileCheck2 />, "Commercial documents", "Keep purchase orders, invoices and shipment files connected."],[<Truck />, "Fulfilment milestones", "See dispatch evidence, tracking and inspection status in context."],[<ShieldCheck />, "Dispute support", "Open a documented case when a transaction needs review."]].map(([icon, title, text]) => <div className="bg-white p-6" key={String(title)}><span className="text-[#F87908]">{icon}</span><h3 className="mt-8 font-extrabold text-[#102B52]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#697488]">{text}</p></div>)}</div></div></section>

      <section id="sell" className="mx-auto max-w-[1240px] px-5 py-18 lg:px-8 lg:py-24"><div className="grid gap-10 border border-[#DDE5EE] bg-white p-7 lg:grid-cols-[1.15fr_.85fr] lg:p-12"><div><p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#F87908]">For verified suppliers</p><h2 className="mt-3 text-3xl font-black tracking-[-.035em] text-[#102B52] sm:text-4xl">Sell with better commercial control.</h2><p className="mt-5 max-w-xl leading-7 text-[#526178]">Publish wholesale-ready listings, respond to qualified RFQs, issue structured quotes and keep your order pipeline in view.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{["Set MOQ and price tiers", "Respond to RFQs", "Manage commercial documents", "Track order fulfilment"].map(item => <p className="flex items-center gap-3 text-sm font-bold text-[#405069]" key={item}><span className="grid h-5 w-5 place-items-center bg-[#EAF2FB] text-[#102B52]"><Check size={14} /></span>{item}</p>)}</div></div><div id="workspace" className="bg-[#102B52] p-7 text-white"><p className="text-sm font-bold text-[#F9A453]">Business workspace</p><p className="mt-3 text-2xl font-extrabold leading-tight">Set up your organization and choose how you trade.</p><p className="mt-4 text-sm leading-6 text-[#C5D4E8]">A business account supports buyer, seller or both workspaces under one organization.</p><a href="#top" className="mt-7 flex w-full items-center justify-center gap-2 bg-[#F87908] px-4 py-3 text-sm font-extrabold text-white hover:bg-[#d96806]">Create business account <ArrowRight size={16} /></a></div></div></section>

      <footer className="border-t border-[#DDE5EE] bg-white"><div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-5 px-5 py-8 text-sm text-[#697488] sm:flex-row lg:px-8"><p><span className="font-extrabold text-[#102B52]">FEA<span className="text-[#F87908]">Bulk</span></span> · Built for serious wholesale trade.</p><div className="flex gap-5"><a href="#top" className="hover:text-[#F87908]">Privacy</a><a href="#top" className="hover:text-[#F87908]">Terms</a><a href="#top" className="hover:text-[#F87908]">Help centre</a></div></div></footer>
    </main>
  );
}

function TrustItem({ icon, value, text }: { icon: ReactNode; value: string; text: string }) {
  return <div className="flex gap-4 py-6 sm:px-6 sm:first:pl-0"><span className="text-[#F87908]">{icon}</span><div><p className="font-extrabold text-[#102B52]">{value}</p><p className="mt-1 text-sm leading-5 text-[#697488]">{text}</p></div></div>;
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app")({ component: Workspace });

type WorkspaceKind = "buyer" | "seller" | "operations";

const content: Record<WorkspaceKind, { eyebrow: string; title: string; description: string; primary: string; stats: Array<[string, string]>; sections: Array<[string, string, string]> }> = {
  buyer: {
    eyebrow: "Buyer workspace",
    title: "Procurement, with every commercial detail connected.",
    description: "Create requirements, evaluate versioned quotes and keep purchase orders, payments and delivery milestones in one record.",
    primary: "Create RFQ",
    stats: [["Open RFQs", "—"], ["Quotes to evaluate", "—"], ["Pending approvals", "—"], ["Active orders", "—"]],
    sections: [["RFQs", "Start with a detailed requirement and invite verified suppliers.", "Open RFQs"], ["Orders", "Review commercial documents, payment status and delivery commitments.", "View orders"], ["Supplier network", "Keep verified suppliers and completed trade history close to your team.", "Browse suppliers"]],
  },
  seller: {
    eyebrow: "Seller workspace",
    title: "Run your wholesale operation from quote to payout.",
    description: "Manage verified catalog listings, respond to suitable RFQs, fulfil orders and follow payout eligibility.",
    primary: "Add product",
    stats: [["RFQ opportunities", "—"], ["Quotes awaiting decision", "—"], ["Orders to fulfil", "—"], ["Payouts on hold", "—"]],
    sections: [["Catalog", "Set MOQ, inventory, lead time and non-overlapping price tiers for each listing.", "Manage catalog"], ["Quotes", "Send structured commercial terms. Every submitted version remains in the record.", "View quotes"], ["Fulfilment", "Prepare dispatch evidence, tracking details and delivery documents.", "Open fulfilment"]],
  },
  operations: {
    eyebrow: "FEA operations",
    title: "Govern the marketplace with controlled decisions.",
    description: "Review verification, moderation, transaction exceptions and disputes through permission-controlled queues.",
    primary: "Review verification queue",
    stats: [["Verification reviews", "—"], ["Listings pending moderation", "—"], ["Payment exceptions", "—"], ["Open disputes", "—"]],
    sections: [["Verification", "Review business evidence, expiry dates and risk flags with a complete audit trail.", "Open verification queue"], ["Transaction monitoring", "Investigate failed payments, payout holds and unusual trade activity.", "Open monitoring"], ["Disputes", "Collect evidence, set response deadlines and record a controlled resolution.", "Open disputes"]],
  },
};

function Workspace() {
  const [kind, setKind] = useState<WorkspaceKind>("buyer");
  const [menuOpen, setMenuOpen] = useState(false);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<WorkspaceKind[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadAccess() {
      const client = supabase as any;
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) { if (active) { setAvailableWorkspaces([]); setLoadingAccess(false); } return; }
      const [{ data: organizations }, { data: operationsRoles }] = await Promise.all([
        client.from("organizations").select("kind"),
        client.from("operations_members").select("role").eq("user_id", auth.user.id),
      ]);
      if (!active) return;
      const kinds = new Set<string>((organizations ?? []).map((organization: { kind: string }) => organization.kind));
      const workspaces: WorkspaceKind[] = [];
      if (kinds.has("buyer") || kinds.has("both")) workspaces.push("buyer");
      if (kinds.has("seller") || kinds.has("both")) workspaces.push("seller");
      if ((operationsRoles ?? []).length > 0) workspaces.push("operations");
      setAvailableWorkspaces(workspaces);
      setKind(workspaces[0] ?? "buyer");
      setLoadingAccess(false);
    }
    void loadAccess();
    return () => { active = false; };
  }, []);
  const view = content[kind];

  return <main className="min-h-screen bg-[#F7F8FA] text-[#17233A]">
    <header className="border-b border-[#DDE5EE] bg-white"><div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 lg:px-8"><a href="/" className="text-xl font-black tracking-[-.04em] text-[#102B52]">FEA<span className="text-[#F87908]">Bulk</span></a><div className="flex items-center gap-3"><button className="border border-[#DDE5EE] px-3 py-2 text-sm font-bold text-[#102B52]" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>Switch workspace</button><a href="/" className="hidden text-sm font-bold text-[#526178] sm:block">Back to marketplace</a><span className="grid h-9 w-9 place-items-center bg-[#102B52] text-sm font-bold text-white">U</span></div></div></header>
    <div className="mx-auto flex max-w-[1440px]">
      <aside className="hidden w-64 shrink-0 border-r border-[#DDE5EE] bg-white px-4 py-7 lg:block"><p className="px-3 text-[11px] font-black uppercase tracking-[.15em] text-[#8A95A8]">Workspace</p><nav className="mt-4 grid gap-1">{availableWorkspaces.map(item => <button key={item} onClick={() => setKind(item)} className={`flex items-center justify-between px-3 py-3 text-left text-sm font-bold ${kind === item ? "bg-[#EAF2FB] text-[#102B52]" : "text-[#526178] hover:bg-[#F7F8FA]"}`}><span className="capitalize">{item === "operations" ? "FEA operations" : item}</span>{kind === item && <span className="h-2 w-2 bg-[#F87908]" />}</button>)}</nav><div className="mt-8 border-t border-[#DDE5EE] pt-6"><p className="px-3 text-[11px] font-black uppercase tracking-[.15em] text-[#8A95A8]">Account</p><a className="mt-3 block px-3 py-2 text-sm font-semibold text-[#526178]" href="#settings">Organization settings</a><a className="block px-3 py-2 text-sm font-semibold text-[#526178]" href="#help">Help centre</a></div></aside>
      <section className="min-w-0 flex-1 px-5 py-8 lg:px-10 lg:py-10">{menuOpen && <div className="mb-6 grid border border-[#DDE5EE] bg-white p-2 lg:hidden">{availableWorkspaces.map(item => <button key={item} onClick={() => { setKind(item); setMenuOpen(false); }} className="px-3 py-3 text-left text-sm font-bold capitalize text-[#102B52]">{item === "operations" ? "FEA operations" : item}</button>)}</div>}{loadingAccess ? <p className="text-sm font-semibold text-[#697488]">Loading your organization access…</p> : availableWorkspaces.length === 0 ? <section className="border border-[#DDE5EE] bg-white p-8"><h1 className="text-2xl font-black text-[#102B52]">No workspace is available yet.</h1><p className="mt-3 text-[#697488]">Complete your account verification or contact FEA Bulk support if you believe this is incorrect.</p></section> : <><p className="text-xs font-black uppercase tracking-[.15em] text-[#F87908]">{view.eyebrow}</p><div className="mt-3 flex flex-col justify-between gap-5 xl:flex-row xl:items-end"><div><h1 className="max-w-3xl text-3xl font-black tracking-[-.04em] text-[#102B52] sm:text-4xl">{view.title}</h1><p className="mt-3 max-w-2xl leading-7 text-[#697488]">{view.description}</p></div><button className="bg-[#F87908] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#d96806]">{view.primary}</button></div><div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{view.stats.map(([label, value]) => <div key={label} className="border border-[#DDE5EE] bg-white p-5"><p className="text-2xl font-black text-[#102B52]">{value}</p><p className="mt-2 text-sm font-semibold text-[#697488]">{label}</p></div>)}</div><div className="mt-8 grid gap-5 xl:grid-cols-3">{view.sections.map(([title, description, action]) => <ActionCard key={title} title={title} description={description} action={action} />)}</div></>}</section>
    </div>
  </main>;
}

function ActionCard({ title, description, action }: { title: string; description: string; action: string }) {
  return <article className="border border-[#DDE5EE] bg-white p-6"><span className="grid h-9 w-9 place-items-center bg-[#EAF2FB] text-sm font-black text-[#102B52]">→</span><h2 className="mt-8 text-lg font-extrabold text-[#102B52]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#697488]">{description}</p><button className="mt-7 text-sm font-extrabold text-[#F87908]">{action} →</button></article>;
}

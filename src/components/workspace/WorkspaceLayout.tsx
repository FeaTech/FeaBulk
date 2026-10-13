import type { ReactNode } from "react";
import { ArrowUpRight, Bell, Building2, FileText, LayoutDashboard, LogOut, Package, Plus, ShoppingBag, Store, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export type WorkspaceView = "overview" | "rfqs" | "suppliers" | "orders" | "catalog" | "opportunities" | "quotes" | "team";
const titles: Record<WorkspaceView, string> = {
  overview: "Overview", rfqs: "Quote requests", suppliers: "Suppliers", orders: "Orders & deliveries",
  catalog: "Products & stock", opportunities: "Buyer requests", quotes: "My quotes", team: "Team",
};
const icons = { overview: LayoutDashboard, rfqs: FileText, suppliers: Store, orders: Truck, catalog: Package, opportunities: ShoppingBag, quotes: FileText, team: Users };

export function WorkspaceLayout({ role, view, setView, signedIn, hasOrganization, organizationName, unread, showNotifications, onNotifications, onSignOut, children }: {
  role: "buyer" | "seller"; view: WorkspaceView; setView: (view: WorkspaceView) => void;
  signedIn: boolean; hasOrganization: boolean; organizationName?: string | undefined; unread: number; showNotifications: boolean;
  onNotifications: () => void; onSignOut: () => void; children: ReactNode;
}) {
  const sections: WorkspaceView[] = role === "buyer" ? ["overview", "suppliers", "orders", "team"] : ["overview", "catalog", "orders", "team"];
  const label = role === "buyer" ? "Buyer" : "Seller";
  return <div className="business-workspace flex min-h-screen bg-workspace-canvas text-foreground">
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-workspace-nav text-workspace-nav-foreground lg:flex">
      <a href="/" className="px-6 py-7 text-2xl font-black">FEA<span className="text-workspace-action">Bulk</span></a>
      <div className="mx-5 mb-7 border-b border-workspace-nav-foreground/15 pb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-workspace-action">{label} workspace</p>
        <p className="mt-2 text-sm font-semibold">{organizationName ?? (role === "buyer" ? "Purchasing" : "Sales & fulfilment")}</p>
      </div>
      {signedIn && hasOrganization && <nav aria-label={`${label} sections`} className="space-y-1 px-3">
        {sections.map(key => { const Icon = icons[key]; return <Button key={key} variant="workspaceNav" data-active={view === key} aria-current={view === key ? "page" : undefined} className="h-11 w-full gap-3 px-3" onClick={() => setView(key)}><Icon />{titles[key]}</Button>; })}
      </nav>}
      <div className="mt-auto border-t border-workspace-nav-foreground/15 p-5">
        <Button asChild variant="workspaceNav" className="w-full"><a href="/marketplace"><Store />Marketplace<ArrowUpRight className="ml-auto" /></a></Button>
        {signedIn && <Button variant="workspaceNav" className="mt-2 w-full" onClick={onSignOut}><LogOut />Sign out</Button>}
      </div>
    </aside>
    <main className="min-w-0 flex-1">
      <header className="border-b bg-card px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">FeaBulk · {label}</p><h1 className="mt-1 text-xl font-bold text-workspace-brand">{titles[view]}</h1></div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="hidden sm:inline-flex"><a href="/marketplace"><Store />Marketplace</a></Button>
            {signedIn && <><Button variant="outline" size="icon" title="Notifications" aria-label={`Notifications (${unread} unread)`} aria-expanded={showNotifications} onClick={onNotifications} className="relative"><Bell />{unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-workspace-action px-1 text-[10px] font-bold text-workspace-action-foreground">{unread}</span>}</Button><Button variant="ghost" size="icon" title="Sign out" aria-label="Sign out" className="lg:hidden" onClick={onSignOut}><LogOut /></Button></>}
          </div>
        </div>
        {signedIn && hasOrganization && <div className="mx-auto mt-4 max-w-7xl lg:hidden"><select aria-label={`${label} section`} className="w-full border bg-background px-3 py-2 text-sm" value={view} onChange={e => { const next = sections.find(key => key === e.target.value); if (next) setView(next); }}>{sections.map(key => <option key={key} value={key}>{titles[key]}</option>)}</select></div>}
      </header>
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">{children}</div>
    </main>
  </div>;
}

export function BusinessIdentity({ name, status, children }: { name: string; status?: string | undefined; children: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-6">
    <div className="flex min-w-0 items-center gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-card text-workspace-brand"><Building2 className="size-5" /></div><div className="min-w-0"><h2 className="text-lg font-bold text-workspace-brand">{name}</h2>{status && <p className={`mt-1 inline-flex items-center gap-1.5 text-xs font-semibold ${status === "verified" ? "text-workspace-success" : "text-workspace-warning"}`}><span className="size-1.5 rounded-full bg-current" />{status === "verified" ? "Verified business" : status.replaceAll("_", " ")}</p>}</div></div>
    <div className="flex max-w-full flex-wrap items-center gap-2">{children}</div>
  </div>;
}

export function AddBusinessButton({ onClick }: { onClick: () => void }) {
  return <Button variant="outline" onClick={onClick}><Plus />Add business</Button>;
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminAuctionsPanel } from "@/components/auction/AdminAuctionsPanel";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  acknowledgeOperationalIncident,
  getCategories,
  getDisputeQueue,
  getIdentity,
  getModerationQueue,
  getProductImages,
  getOperationsHealth,
  getOperationsRoles,
  getPlatformAccounts,
  getPlatformOrganizations,
  getSupplierDirectory,
  getUnsubmittedProductDrafts,
  getVerificationQueue,
  moderateProduct,
  resolveDispute,
  signOut,
  reviewVerification,
  type Category,
  type Dispute,
  type OperationsHealth,
  type OperationsRole,
  type PlatformAccount,
  type PlatformOrganization,
  type Product,
  type ProductImage,
  type VerificationCase,
} from "@/lib/marketplace";
import { FieldLabel } from "@/components/InfoTip";
import { CategoriesPanel, OrdersPanel, PaymentsPanel } from "@/components/ops/AdminPanels";
import { ProductReviewDetails } from "@/components/ops/ProductReview";
import { submissionBlockers } from "@/lib/listing";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "FeaBulk Admin | FEA Bulk" },
      {
        name: "description",
        content: "Review FEA Bulk verification, catalog, disputes and platform operations.",
      },
      { property: "og:title", content: "FeaBulk Admin | FEA Bulk" },
      {
        property: "og:description",
        content: "Review FEA Bulk verification, catalog, disputes and platform operations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Operations,
});
type OperationsView =
  | "overview"
  | "verification"
  | "catalog"
  | "disputes"
  | "health"
  | "accounts"
  | "orders"
  | "payments"
  | "categories"
  | "auctions";

function Operations() {
  const [access, setAccess] = useState<boolean | null>(null);
  const [roles, setRoles] = useState<OperationsRole[]>([]);
  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productImages, setProductImages] = useState<Map<string, ProductImage[]>>(new Map());
  const [drafts, setDrafts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sellerNames, setSellerNames] = useState<Map<string, string>>(new Map());
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [health, setHealth] = useState<OperationsHealth>({
    summary: { open: 0, acknowledged: 0, critical: 0, high: 0 },
    incidents: [],
  });
  const [view, setView] = useState<OperationsView>("overview");
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const hasRole = useCallback(
    (...allowed: OperationsRole[]) => roles.some((role) => allowed.includes(role)),
    [roles],
  );
  const platformAdmin = hasRole("platform_administrator");
  const canVerify = hasRole("verification_reviewer", "platform_administrator");
  const canModerate = hasRole("catalog_moderator", "platform_administrator");
  const canResolveDisputes = hasRole("dispute_manager", "platform_administrator");
  const canViewHealth = hasRole("support_agent", "payments_reviewer", "platform_administrator");
  const canViewOrders = hasRole(
    "support_agent",
    "payments_reviewer",
    "dispute_manager",
    "platform_administrator",
  );
  const canViewPayments = hasRole("payments_reviewer", "platform_administrator");
  const organizationNames = useMemo(
    () => new Map(organizations.map((item) => [item.organization_id, item.display_name])),
    [organizations],
  );
  const organizationKinds = useMemo(
    () => new Map(organizations.map((item) => [item.organization_id, item.kind])),
    [organizations],
  );
  const verifiedOrganizations = useMemo(
    () =>
      new Set(
        organizations.filter((item) => item.status === "verified").map((item) => item.organization_id),
      ),
    [organizations],
  );

  const load = useCallback(async () => {
    const user = await getIdentity();
    if (!user) {
      setAccess(false);
      return;
    }
    const nextRoles = await getOperationsRoles(user.id);
    if (nextRoles.length === 0) {
      setRoles([]);
      setAccess(false);
      return;
    }
    const isPlatformAdmin = nextRoles.includes("platform_administrator");
    const canLoad = (allowed: OperationsRole[]) => nextRoles.some((role) => allowed.includes(role));
    const [nextCases, nextProducts, nextDisputes, nextHealth, nextAccounts, nextOrganizations] =
      await Promise.all([
        canLoad(["verification_reviewer", "platform_administrator"])
          ? getVerificationQueue()
          : Promise.resolve([]),
        canLoad(["catalog_moderator", "platform_administrator"])
          ? getModerationQueue()
          : Promise.resolve([]),
        canLoad(["dispute_manager", "platform_administrator"])
          ? getDisputeQueue()
          : Promise.resolve([]),
        canLoad(["support_agent", "payments_reviewer", "platform_administrator"])
          ? getOperationsHealth()
          : Promise.resolve({
              summary: { open: 0, acknowledged: 0, critical: 0, high: 0 },
              incidents: [],
            }),
        isPlatformAdmin ? getPlatformAccounts() : Promise.resolve([]),
        isPlatformAdmin ? getPlatformOrganizations() : Promise.resolve([]),
      ]);
    setRoles(nextRoles);
    setCases(nextCases);
    setProducts(nextProducts);
    // Supporting detail for the review cards; a failure here must not hide the queue itself.
    const canModerateCatalog = canLoad(["catalog_moderator", "platform_administrator"]);
    const [nextDrafts, nextCategories, nextSuppliers] = canModerateCatalog
      ? await Promise.all([
          getUnsubmittedProductDrafts().catch(() => []),
          getCategories().catch(() => []),
          getSupplierDirectory().catch(() => []),
        ])
      : [[], [], []];
    setDrafts(nextDrafts);
    setCategories(nextCategories);
    setSellerNames(
      new Map([
        ...nextSuppliers.map((item): [string, string] => [item.id, item.display_name]),
        ...nextOrganizations.map((item): [string, string] => [
          item.organization_id,
          item.display_name,
        ]),
      ]),
    );
    void getProductImages([...nextProducts, ...nextDrafts].map((item) => item.id))
      .then(setProductImages).catch(() => undefined);
    setDisputes(nextDisputes);
    setHealth(nextHealth);
    setAccounts(nextAccounts);
    setOrganizations(nextOrganizations);
    setAccess(true);
  }, []);

  useEffect(() => {
    void load().catch((err) => {
      setError(message(err));
      setAccess(false);
    });
  }, [load]);
  async function decide(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await load();
      setNotice("Decision saved with an audit record.");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<OperationsView, [string, string]> = {
    overview: ["Overview", "Everything waiting on FeaBulk, at a glance."],
    verification: ["Business verification", "Approve or reject businesses applying to trade."],
    catalog: ["Listings", "Look over live products and unpublish any that break the rules."],
    disputes: ["Disputes", "Settle problems between buyers and sellers."],
    health: ["Platform health", "Issues detected automatically across orders and payments."],
    orders: ["Orders", "Every order on the marketplace."],
    payments: ["Payments", "Every payment attempt and its status."],
    categories: ["Categories", "Organise how products are grouped."],
    auctions: ["Auctions", "Live and ended auctions, participation tokens and refunds."],
    accounts: ["Users & businesses", "Everyone with an account and the businesses they run."],
  };
  const attention =
    (canVerify ? cases.length : 0) +
    (canModerate ? products.length + drafts.length : 0) +
    (canResolveDisputes ? disputes.length : 0) +
    (canViewHealth ? health.summary.open : 0);

  return (
    <div className="flex min-h-screen bg-workspace-canvas text-foreground">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-workspace-nav text-border md:flex">
        <Link to="/" aria-label="FEA Bulk home" className="px-6 py-6 text-xl font-bold text-workspace-nav-foreground">
          FEA<span className="text-workspace-action">Bulk</span>
          <span className="ml-2 rounded bg-workspace-action/15 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-workspace-action">
            Admin
          </span>
        </Link>
        {access && (
          <nav className="flex-1 overflow-y-auto px-3" aria-label="Admin sections">
            <NavGroup label="Monitor">
              <OpsTab active={view === "overview"} onClick={() => setView("overview")}>Overview</OpsTab>
              {canViewHealth && (
                <OpsTab active={view === "health"} count={health.summary.open} urgent={health.summary.critical > 0} onClick={() => setView("health")}>Platform health</OpsTab>
              )}
            </NavGroup>
            <NavGroup label="Review queues">
              {canVerify && (
                <OpsTab active={view === "verification"} count={cases.length} onClick={() => setView("verification")}>Verification</OpsTab>
              )}
              {canModerate && (
                <OpsTab active={view === "catalog"} count={drafts.length} onClick={() => setView("catalog")}>Listings</OpsTab>
              )}
              {canResolveDisputes && (
                <OpsTab active={view === "disputes"} count={disputes.length} urgent={disputes.length > 0} onClick={() => setView("disputes")}>Disputes</OpsTab>
              )}
            </NavGroup>
            <NavGroup label="Marketplace">
              {canViewOrders && <OpsTab active={view === "orders"} onClick={() => setView("orders")}>Orders</OpsTab>}
              {canViewPayments && <OpsTab active={view === "payments"} onClick={() => setView("payments")}>Payments</OpsTab>}
              {platformAdmin && <OpsTab active={view === "auctions"} onClick={() => setView("auctions")}>Auctions</OpsTab>}
              {canModerate && <OpsTab active={view === "categories"} onClick={() => setView("categories")}>Categories</OpsTab>}
              {platformAdmin && <OpsTab active={view === "accounts"} onClick={() => setView("accounts")}>Users & businesses</OpsTab>}
            </NavGroup>
          </nav>
        )}
        <div className="mt-auto border-t border-workspace-nav-foreground/10 px-6 py-5 text-xs">
          <a href="/marketplace" className="font-bold text-workspace-nav-foreground hover:text-workspace-action">View marketplace →</a>
          {platformAdmin && <p className="mt-2 text-workspace-nav-muted">Signed in as FeaBulk Admin</p>}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 border-b border-border bg-card/90 backdrop-blur">
          <div className="grid min-w-0 gap-3 px-5 py-4 sm:flex sm:items-center sm:justify-between lg:px-10">
            <div>
              <h1 className="text-2xl font-bold text-workspace-brand">{titles[view][0]}</h1>
              <p className="text-sm text-muted-foreground">{titles[view][1]}</p>
            </div>
            <div className="flex items-center gap-2">
            {access && (
              <select
                aria-label="Admin section"
                className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold md:hidden"
                value={view}
                onChange={(event) => setView(event.target.value as OperationsView)}
              >
                {(Object.keys(titles) as OperationsView[]).map((key) => (
                  <option key={key} value={key}>{titles[key][0]}</option>
                ))}
              </select>
            )}
            {access && (
              // The admin console had no way to sign out, unlike the buyer and seller screens.
              <button
                type="button"
                className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-workspace-brand hover:border-workspace-brand"
                onClick={() =>
                  void signOut()
                    .then(() => window.location.assign("/auth"))
                    .catch((err) => setError(message(err)))
                }
              >
                Sign out
              </button>
            )}
            </div>
          </div>
        </header>
        <div className="px-6 py-8 lg:px-10">
        {error && (
          <p role="alert" className="mb-5 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-5 rounded-md border border-workspace-success/30 bg-workspace-success-soft p-3 text-sm text-workspace-success">
            {notice}
          </p>
        )}
        {access === null ? (
          <p>Checking access…</p>
        ) : !access ? (
          <div className="mx-auto mt-10 max-w-md rounded-lg border bg-card p-8 text-center">
            <h2 className="text-xl font-bold text-workspace-brand">Admin access required</h2>
            <p className="mt-2 text-sm text-muted-foreground">Sign in with a FeaBulk Admin account to open this page.</p>
            <a href="/auth" className="button mt-5 inline-block">Sign in</a>
          </div>
        ) : (
          <>
            {view === "orders" && canViewOrders && <OrdersPanel />}
            {view === "payments" && canViewPayments && <PaymentsPanel />}
            {view === "categories" && canModerate && <CategoriesPanel canEdit={platformAdmin} />}
            {view === "auctions" && platformAdmin && <AdminAuctionsPanel />}

            {view === "overview" && (
              <section>
                <div className="rounded-lg bg-workspace-nav p-6 text-workspace-nav-foreground">
                  <p className="text-xs font-bold uppercase tracking-wider text-workspace-action">Today</p>
                  <p className="mt-2 text-3xl font-bold">
                    {attention === 0 ? "All caught up" : `${attention} item${attention === 1 ? "" : "s"} need attention`}
                  </p>
                  <p className="mt-1 text-sm text-border">Pick a card below to start working through the queue.</p>
                </div>
                <h2 className="mt-8 text-xs font-bold uppercase tracking-wider text-muted-foreground">Review queues</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {canVerify && <Metric label="Businesses to verify" value={cases.length} onClick={() => setView("verification")} />}
                  {canModerate && <Metric label="Live listings" value={products.length} onClick={() => setView("catalog")} />}
                  {canResolveDisputes && <Metric label="Open disputes" value={disputes.length} urgent={disputes.length > 0} onClick={() => setView("disputes")} />}
                  {canViewHealth && <Metric label="Open incidents" value={health.summary.open} urgent={health.summary.critical > 0} onClick={() => setView("health")} />}
                </div>
                {platformAdmin && (
                  <>
                    <h2 className="mt-8 text-xs font-bold uppercase tracking-wider text-muted-foreground">Community</h2>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <Metric label="User accounts" value={accounts.length} onClick={() => setView("accounts")} />
                      <Metric label="Businesses" value={organizations.length} onClick={() => setView("accounts")} />
                      <Metric label="Buyers" value={organizations.filter((o) => o.kind === "buyer").length} onClick={() => setView("accounts")} />
                      <Metric label="Sellers" value={organizations.filter((o) => o.kind === "seller").length} onClick={() => setView("accounts")} />
                    </div>
                  </>
                )}
              </section>
            )}

            {view === "health" && canViewHealth && (
              <section>
                <h2 className="sr-only">Platform health</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <Metric label="Open" value={health.summary.open} />
                  <Metric label="Acknowledged" value={health.summary.acknowledged} />
                  <Metric
                    label="Critical"
                    value={health.summary.critical}
                    urgent={health.summary.critical > 0}
                  />
                  <Metric
                    label="High"
                    value={health.summary.high}
                    urgent={health.summary.high > 0}
                  />
                </div>
                {health.incidents.length === 0 ? (
                  <Empty>No active operational incidents.</Empty>
                ) : (
                  <div className="mt-3 grid gap-3">
                    {health.incidents.map((item) => (
                      <article
                        key={item.id}
                        className={`border bg-card p-5 ${item.severity === "critical" ? "border-destructive" : item.severity === "high" ? "border-workspace-warning" : ""}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              {item.severity} · {item.category.replaceAll("_", " ")}
                            </p>
                            <h3 className="mt-1 font-bold">{item.summary}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.entity_type} {item.entity_id} · last detected{" "}
                              {new Date(item.last_detected_at).toLocaleString()}
                            </p>
                          </div>
                          <span className="border px-2 py-1 text-xs font-bold uppercase">
                            {item.status}
                          </span>
                        </div>
                        <pre className="mt-3 overflow-auto bg-workspace-canvas p-3 text-xs">
                          {JSON.stringify(item.details, null, 2)}
                        </pre>
                        {item.status === "open" && (
                          <>
                            <DecisionInput
                              id={`incident-${item.id}`}
                              notes={notes}
                              setNotes={setNotes}
                            />
                            <button
                              disabled={busy}
                              className="button mt-3"
                              onClick={() =>
                                void decide(() =>
                                  acknowledgeOperationalIncident(
                                    item.id,
                                    notes[`incident-${item.id}`] ?? "",
                                  ),
                                )
                              }
                            >
                              Acknowledge incident
                            </button>
                          </>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {view === "verification" && canVerify && (
              <section>
                <h2 className="sr-only">Business verification ({cases.length})</h2>
                {cases.length === 0 && <Empty>No cases awaiting review.</Empty>}
                <div className="mt-3 grid gap-3">
                  {cases.map((item) => (
                    <article key={item.id} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                      <h3 className="font-bold">
                        {organizationNames.get(item.organization_id) ??
                          `Organization ${item.organization_id}`}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {organizationKinds.get(item.organization_id) === "seller"
                          ? "Seller"
                          : organizationKinds.get(item.organization_id) === "buyer"
                            ? "Buyer"
                            : "Business"}{" "}
                        · {item.business_type ?? "Business type unavailable"} ·{" "}
                        {item.submitted_at
                          ? `submitted ${new Date(item.submitted_at).toLocaleString()}`
                          : "not submitted by the business yet"}
                      </p>
                      {item.status === "draft" && (
                        <p className="mt-2 border-l-2 border-workspace-action pl-3 text-sm">
                          The owner has not pressed Submit for verification. You can still approve
                          or reject this business now.
                        </p>
                      )}
                      <pre className="mt-3 overflow-auto bg-workspace-canvas p-3 text-xs">
                        {JSON.stringify(item.registered_address, null, 2)}
                      </pre>
                      <DecisionInput optional id={item.id} notes={notes} setNotes={setNotes} />
                      <div className="mt-3 flex gap-2">
                        <button
                          disabled={busy}
                          className="button"
                          onClick={() =>
                            void decide(() =>
                              reviewVerification(item.id, true, notes[item.id] ?? ""),
                            )
                          }
                        >
                          Approve
                        </button>
                        <button
                          disabled={busy}
                          className="button-secondary"
                          onClick={() =>
                            void decide(() =>
                              reviewVerification(item.id, false, notes[item.id] ?? ""),
                            )
                          }
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {view === "catalog" && canModerate && (
              <section>
                <h2 className="text-lg font-bold">Live listings ({products.length})</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sellers publish products directly. Unpublish a listing to take it off the
                  marketplace; your note is shown to the seller.
                </p>
                {products.length === 0 && <Empty>No live listings.</Empty>}
                <div className="mt-3 grid gap-3">
                  {products.map((item) => (
                    <article key={item.id} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                      <ProductReviewDetails
                        product={item}
                        images={productImages.get(item.id) ?? []}
                        sellerName={sellerNames.get(item.organization_id ?? "") ?? "Unknown seller"}
                        categoryName={
                          categories.find((category) => category.id === item.category_id)?.name ??
                          "Not set"
                        }
                      />
                      <DecisionInput id={item.id} notes={notes} setNotes={setNotes} />
                      <div className="mt-3 flex gap-2">
                        <button
                          disabled={busy}
                          className="button-secondary"
                          onClick={() =>
                            void decide(() => moderateProduct(item.id, false, notes[item.id] ?? ""))
                          }
                        >
                          Unpublish listing
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {drafts.length > 0 && (
                  <div className="mt-8">
                    <h2 className="text-lg font-bold">
                      Unpublished drafts ({drafts.length})
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Drafts saved before products went live on save. Publishing one puts it on
                      the marketplace straight away.
                    </p>
                    <div className="mt-3 grid gap-3">
                      {drafts.map((item) => {
                        const sellerVerified = verifiedOrganizations.has(item.organization_id ?? "");
                        const blockers = submissionBlockers(item, sellerVerified).map((blocker) =>
                          blocker.replace(
                            "Your business must be verified by FeaBulk before products can be submitted.",
                            "The seller's business is not verified yet. Approve the business under Verification first.",
                          ),
                        );
                        return (
                          <details
                            key={item.id}
                            open
                            className="rounded-lg border border-border bg-card p-5 shadow-sm"
                          >
                            <summary className="cursor-pointer font-bold">
                              {item.name}
                              <span className="ml-2 font-normal text-muted-foreground">
                                · {sellerNames.get(item.organization_id ?? "") ?? "Unknown seller"}{" "}
                                · saved {new Date(item.created_at).toLocaleDateString("en-IN")}
                              </span>
                            </summary>
                            <p className="mt-3 border-l-2 border-workspace-action pl-3 text-sm">
                              {blockers.length > 0
                                ? `Cannot be published yet: ${blockers.join(" ")} You can still reject it with a note telling the seller what to fix.`
                                : "Ready to publish."}
                            </p>
                            <div className="mt-3">
                              <ProductReviewDetails
                                product={item}
                                images={productImages.get(item.id) ?? []}
                                sellerName={
                                  sellerNames.get(item.organization_id ?? "") ?? "Unknown seller"
                                }
                                categoryName={
                                  categories.find((category) => category.id === item.category_id)
                                    ?.name ?? "Not set"
                                }
                              />
                            </div>
                            <DecisionInput id={item.id} notes={notes} setNotes={setNotes} />
                            <div className="mt-3 flex gap-2">
                              <button
                                disabled={busy || blockers.length > 0}
                                title={blockers.length > 0 ? blockers.join(" ") : undefined}
                                className="button"
                                onClick={() =>
                                  void decide(() => moderateProduct(item.id, true, notes[item.id] ?? ""))
                                }
                              >
                                Publish listing
                              </button>
                              <button
                                disabled={busy}
                                className="button-secondary"
                                onClick={() =>
                                  void decide(() => moderateProduct(item.id, false, notes[item.id] ?? ""))
                                }
                              >
                                Reject listing
                              </button>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {view === "disputes" && canResolveDisputes && (
              <section>
                <h2 className="sr-only">Disputes ({disputes.length})</h2>
                {disputes.length === 0 && <Empty>No open disputes.</Empty>}
                <div className="mt-3 grid gap-3">
                  {disputes.map((item) => (
                    <article key={item.id} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                      <h3 className="font-bold">
                        {item.type.replaceAll("_", " ")} · order {item.order_id}
                      </h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{item.description}</p>
                      <label className="mt-3 grid gap-1 text-sm font-semibold">
                        <FieldLabel
                          label="Outcome"
                          hint="How the dispute ends: complete the order for the seller, require a return, or cancel the order."
                        />
                        <select
                          className="border border-border p-2"
                          value={outcomes[item.id] ?? "seller_release"}
                          onChange={(event) =>
                            setOutcomes((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="seller_release">Release to seller / complete</option>
                          <option value="buyer_return">Return required</option>
                          <option value="cancel_order">Cancel order</option>
                        </select>
                      </label>
                      <DecisionInput
                        id={item.id}
                        notes={notes}
                        setNotes={setNotes}
                        minLength={20}
                      />
                      <button
                        disabled={busy}
                        className="button mt-3"
                        onClick={() =>
                          void decide(() =>
                            resolveDispute(
                              item.id,
                              outcomes[item.id] ?? "seller_release",
                              notes[item.id] ?? "",
                            ),
                          )
                        }
                      >
                        Resolve dispute
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {view === "accounts" && platformAdmin && (
              <section>
                <div className="grid gap-8 xl:grid-cols-2">
                  <div>
                    <h2 className="text-xl font-bold">User accounts ({accounts.length})</h2>
                    <div className="mt-3 grid gap-3">
                      {accounts.map((item) => (
                        <article key={item.user_id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-bold">{item.full_name || item.email}</h3>
                              <p className="text-sm text-muted-foreground">{item.email}</p>
                            </div>
                            <Status>
                              {item.email_confirmed ? "Email confirmed" : "Email pending"}
                            </Status>
                          </div>
                          <p className="mt-3 text-sm">
                            {item.organization_count} business workspace
                            {item.organization_count === 1 ? "" : "s"}
                            {item.organization_names ? ` · ${item.organization_names}` : ""}
                          </p>
                          {item.operations_roles.length > 0 && (
                            <p className="mt-2 text-xs font-bold uppercase text-workspace-action">
                              {item.operations_roles
                                .map((role) => role.replaceAll("_", " "))
                                .join(" · ")}
                            </p>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground">
                            Last sign-in:{" "}
                            {item.last_sign_in_at
                              ? new Date(item.last_sign_in_at).toLocaleString()
                              : "Never"}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Organizations ({organizations.length})</h2>
                    <div className="mt-3 grid gap-3">
                      {organizations.map((item) => (
                        <article key={item.organization_id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-bold">{item.display_name}</h3>
                              <p className="text-sm text-muted-foreground">{item.legal_name}</p>
                            </div>
                            <Status>
                              {item.kind} · {item.status.replaceAll("_", " ")}
                            </Status>
                          </div>
                          <p className="mt-3 text-sm">
                            Verification: {item.verification_status.replaceAll("_", " ")} ·{" "}
                            {item.member_count} team member{item.member_count === 1 ? "" : "s"}
                          </p>
                          {item.gstin && (
                            <p className="mt-2 text-xs text-muted-foreground">GSTIN {item.gstin}</p>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
        </div>
      </main>
    </div>
  );
}

function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-workspace-nav-muted">{label}</p>
      <div className="grid gap-0.5">{children}</div>
    </div>
  );
}
function OpsTab({
  active,
  onClick,
  children,
  count,
  urgent = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
  urgent?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors ${active ? "bg-card/10 text-workspace-nav-foreground border-l-2 border-workspace-action" : "hover:bg-card/5 hover:text-workspace-nav-foreground"}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <span>{children}</span>
      {count !== undefined && count > 0 && (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold text-workspace-nav-foreground ${urgent ? "bg-destructive/100" : "bg-workspace-action"}`}>{count}</span>
      )}
    </button>
  );
}
function DecisionInput({
  id,
  notes,
  setNotes,
  minLength = 10,
  optional = false,
}: {
  id: string;
  notes: Record<string, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  minLength?: number;
  optional?: boolean;
}) {
  return (
    <label className="mt-3 grid gap-1 text-sm font-semibold">
      <FieldLabel
        label="Decision notes"
        hint="Why you approved or rejected this. The business sees these notes, so say what they need to fix."
      >
        Decision notes{optional ? " (optional)" : ` (at least ${minLength} characters)`}
      </FieldLabel>
      <textarea
        required={!optional}
        className="border border-border p-2"
        minLength={optional ? undefined : minLength}
        value={notes[id] ?? ""}
        onChange={(event) => setNotes((current) => ({ ...current, [id]: event.target.value }))}
      />
    </label>
  );
}
function Metric({
  label,
  value,
  urgent = false,
  onClick,
}: {
  label: string;
  value: number;
  urgent?: boolean;
  onClick?: () => void;
}) {
  const cls = `group rounded-lg border bg-card p-5 text-left shadow-sm transition ${urgent ? "border-destructive/30" : "border-border"} ${onClick ? "hover:-translate-y-0.5 hover:shadow-md" : ""}`;
  const content = (
    <>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${urgent ? "text-destructive" : "text-workspace-brand"}`}>{value}</p>
      {onClick && <p className="mt-3 text-xs font-bold text-workspace-warning opacity-0 transition group-hover:opacity-100">Open →</p>}
    </>
  );
  return onClick ? (
    <button className={cls} onClick={onClick}>{content}</button>
  ) : (
    <div className={cls}>{content}</div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">{children}</p>;
}
function Status({ children }: { children: ReactNode }) {
  return (
    <span className="border bg-workspace-canvas px-2 py-1 text-xs font-bold capitalize">{children}</span>
  );
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

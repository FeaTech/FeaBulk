import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  acknowledgeOperationalIncident,
  getDisputeQueue,
  getIdentity,
  getModerationQueue,
  getOperationsHealth,
  getOperationsRoles,
  getPlatformAccounts,
  getPlatformOrganizations,
  getVerificationQueue,
  moderateProduct,
  resolveDispute,
  reviewVerification,
  type Dispute,
  type OperationsHealth,
  type OperationsRole,
  type PlatformAccount,
  type PlatformOrganization,
  type Product,
  type VerificationCase,
} from "@/lib/marketplace";

export const Route = createFileRoute("/operations")({
  head: () => ({ meta: [
    { title: "Operations Console | FEA Bulk" },
    { name: "description", content: "Review FEA Bulk verification, catalog, disputes and platform operations." },
    { property: "og:title", content: "Operations Console | FEA Bulk" },
    { property: "og:description", content: "Review FEA Bulk verification, catalog, disputes and platform operations." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Operations,
});
type OperationsView = "overview" | "verification" | "catalog" | "disputes" | "health" | "accounts";

function Operations() {
  const [access, setAccess] = useState<boolean | null>(null);
  const [roles, setRoles] = useState<OperationsRole[]>([]);
  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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
  const organizationNames = useMemo(
    () => new Map(organizations.map((item) => [item.organization_id, item.display_name])),
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

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-[#17233A]">
      <header className="border-b border-[#DDE5EE] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <a href="/" className="text-xl font-black text-[#102B52]">
            FEA<span className="text-[#F87908]">Bulk</span>
          </a>
          <a href="/app" className="text-sm font-bold text-[#102B52]">
            Business workspace
          </a>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8">
        <p className="text-xs font-black uppercase tracking-wider text-[#F87908]">FEA operations</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-[#102B52]">Platform control centre</h1>
            <p className="mt-2 text-sm text-[#526178]">
              Review businesses, listings, disputes and operational health from live platform
              records.
            </p>
          </div>
          {roles.length > 0 && (
            <p className="text-xs font-bold uppercase tracking-wider text-[#526178]">
              {roles.map((role) => role.replaceAll("_", " ")).join(" · ")}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-5 border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mt-5 border border-green-300 bg-green-50 p-3 text-sm text-green-800"
          >
            {notice}
          </p>
        )}
        {access === null ? (
          <p className="mt-8">Checking access…</p>
        ) : !access ? (
          <p className="mt-8 border bg-white p-6">FEA operations access is required.</p>
        ) : (
          <>
            <nav
              className="mt-7 flex flex-wrap gap-2 border-b pb-3"
              aria-label="Operations sections"
            >
              <OpsTab active={view === "overview"} onClick={() => setView("overview")}>
                Overview
              </OpsTab>
              {canVerify && (
                <OpsTab active={view === "verification"} onClick={() => setView("verification")}>
                  Verification ({cases.length})
                </OpsTab>
              )}
              {canModerate && (
                <OpsTab active={view === "catalog"} onClick={() => setView("catalog")}>
                  Catalog review ({products.length})
                </OpsTab>
              )}
              {canResolveDisputes && (
                <OpsTab active={view === "disputes"} onClick={() => setView("disputes")}>
                  Disputes ({disputes.length})
                </OpsTab>
              )}
              {canViewHealth && (
                <OpsTab active={view === "health"} onClick={() => setView("health")}>
                  Platform health
                </OpsTab>
              )}
              {platformAdmin && (
                <OpsTab active={view === "accounts"} onClick={() => setView("accounts")}>
                  Accounts
                </OpsTab>
              )}
            </nav>

            {view === "overview" && (
              <section className="mt-6">
                <h2 className="text-xl font-black">Operations overview</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {canVerify && (
                    <Metric
                      label="Verification queue"
                      value={cases.length}
                      onClick={() => setView("verification")}
                    />
                  )}
                  {canModerate && (
                    <Metric
                      label="Catalog queue"
                      value={products.length}
                      onClick={() => setView("catalog")}
                    />
                  )}
                  {canResolveDisputes && (
                    <Metric
                      label="Open disputes"
                      value={disputes.length}
                      urgent={disputes.length > 0}
                      onClick={() => setView("disputes")}
                    />
                  )}
                  {canViewHealth && (
                    <Metric
                      label="Open incidents"
                      value={health.summary.open}
                      urgent={health.summary.critical > 0}
                      onClick={() => setView("health")}
                    />
                  )}
                  {platformAdmin && (
                    <Metric
                      label="User accounts"
                      value={accounts.length}
                      onClick={() => setView("accounts")}
                    />
                  )}
                  {platformAdmin && (
                    <Metric
                      label="Organizations"
                      value={organizations.length}
                      onClick={() => setView("accounts")}
                    />
                  )}
                </div>
              </section>
            )}

            {view === "health" && canViewHealth && (
              <section className="mt-8">
                <h2 className="text-xl font-black">Platform health</h2>
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
                        className={`border bg-white p-5 ${item.severity === "critical" ? "border-red-500" : item.severity === "high" ? "border-orange-400" : ""}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-wider text-[#526178]">
                              {item.severity} · {item.category.replaceAll("_", " ")}
                            </p>
                            <h3 className="mt-1 font-bold">{item.summary}</h3>
                            <p className="mt-1 text-xs text-[#526178]">
                              {item.entity_type} {item.entity_id} · last detected{" "}
                              {new Date(item.last_detected_at).toLocaleString()}
                            </p>
                          </div>
                          <span className="border px-2 py-1 text-xs font-bold uppercase">
                            {item.status}
                          </span>
                        </div>
                        <pre className="mt-3 overflow-auto bg-[#F7F8FA] p-3 text-xs">
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
              <section className="mt-8">
                <h2 className="text-xl font-black">Business verification ({cases.length})</h2>
                {cases.length === 0 && <Empty>No cases awaiting review.</Empty>}
                <div className="mt-3 grid gap-3">
                  {cases.map((item) => (
                    <article key={item.id} className="border bg-white p-5">
                      <h3 className="font-bold">
                        {organizationNames.get(item.organization_id) ??
                          `Organization ${item.organization_id}`}
                      </h3>
                      <p className="mt-1 text-sm text-[#526178]">
                        {item.business_type ?? "Business type unavailable"} · submitted{" "}
                        {item.submitted_at
                          ? new Date(item.submitted_at).toLocaleString()
                          : "unknown"}
                      </p>
                      <pre className="mt-3 overflow-auto bg-[#F7F8FA] p-3 text-xs">
                        {JSON.stringify(item.registered_address, null, 2)}
                      </pre>
                      <DecisionInput id={item.id} notes={notes} setNotes={setNotes} />
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
              <section className="mt-8">
                <h2 className="text-xl font-black">Product moderation ({products.length})</h2>
                {products.length === 0 && <Empty>No listings awaiting moderation.</Empty>}
                <div className="mt-3 grid gap-3">
                  {products.map((item) => (
                    <article key={item.id} className="border bg-white p-5">
                      <h3 className="font-bold">{item.name}</h3>
                      <p className="mt-1 text-sm text-[#526178]">
                        SKU {item.seller_sku} · MOQ {item.minimum_order_quantity} · stock{" "}
                        {item.available_quantity}
                      </p>
                      <DecisionInput id={item.id} notes={notes} setNotes={setNotes} />
                      <div className="mt-3 flex gap-2">
                        <button
                          disabled={busy}
                          className="button"
                          onClick={() =>
                            void decide(() => moderateProduct(item.id, true, notes[item.id] ?? ""))
                          }
                        >
                          Approve listing
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
                    </article>
                  ))}
                </div>
              </section>
            )}

            {view === "disputes" && canResolveDisputes && (
              <section className="mt-8">
                <h2 className="text-xl font-black">Disputes ({disputes.length})</h2>
                {disputes.length === 0 && <Empty>No open disputes.</Empty>}
                <div className="mt-3 grid gap-3">
                  {disputes.map((item) => (
                    <article key={item.id} className="border bg-white p-5">
                      <h3 className="font-bold">
                        {item.type.replaceAll("_", " ")} · order {item.order_id}
                      </h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{item.description}</p>
                      <label className="mt-3 grid gap-1 text-sm font-semibold">
                        Outcome
                        <select
                          className="border border-[#C9D3DF] p-2"
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
              <section className="mt-8">
                <div className="grid gap-8 xl:grid-cols-2">
                  <div>
                    <h2 className="text-xl font-black">User accounts ({accounts.length})</h2>
                    <div className="mt-3 grid gap-3">
                      {accounts.map((item) => (
                        <article key={item.user_id} className="border bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-bold">{item.full_name || item.email}</h3>
                              <p className="text-sm text-[#526178]">{item.email}</p>
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
                            <p className="mt-2 text-xs font-bold uppercase text-[#F87908]">
                              {item.operations_roles
                                .map((role) => role.replaceAll("_", " "))
                                .join(" · ")}
                            </p>
                          )}
                          <p className="mt-2 text-xs text-[#697488]">
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
                    <h2 className="text-xl font-black">Organizations ({organizations.length})</h2>
                    <div className="mt-3 grid gap-3">
                      {organizations.map((item) => (
                        <article key={item.organization_id} className="border bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-bold">{item.display_name}</h3>
                              <p className="text-sm text-[#526178]">{item.legal_name}</p>
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
                            <p className="mt-2 text-xs text-[#697488]">GSTIN {item.gstin}</p>
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
  );
}

function OpsTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`px-4 py-2 text-sm font-bold ${active ? "bg-[#102B52] text-white" : "border bg-white text-[#102B52]"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function DecisionInput({
  id,
  notes,
  setNotes,
  minLength = 10,
}: {
  id: string;
  notes: Record<string, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  minLength?: number;
}) {
  return (
    <label className="mt-3 grid gap-1 text-sm font-semibold">
      Decision notes (at least {minLength} characters)
      <textarea
        required
        className="border border-[#C9D3DF] p-2"
        minLength={minLength}
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
  const content = (
    <>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wider text-[#526178]">{label}</p>
    </>
  );
  return onClick ? (
    <button
      className={`border bg-white p-4 text-left ${urgent ? "border-red-400" : ""}`}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <div className={`border bg-white p-4 ${urgent ? "border-red-400" : ""}`}>{content}</div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-3 border bg-white p-5 text-sm">{children}</p>;
}
function Status({ children }: { children: ReactNode }) {
  return (
    <span className="border bg-[#F7F8FA] px-2 py-1 text-xs font-bold capitalize">{children}</span>
  );
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

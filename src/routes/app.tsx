import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  acceptOrganizationInvitation, acceptQuote, addPriceTier, adjustInventory, completeOrderInspection,
  confirmOrderPayment, confirmShipmentDelivery, createOrganization, createOrganizationInvitation, createProduct, createReview,
  createRfq, createShipment, deletePriceTier, dispatchShipment,
  generateCommercialDocument, getBuyerRfqs, getCategories, getCommercialDocumentUrl, getIdentity, getMessages, getNotifications, getOperationsAccess, getOrders, getPaymentAvailability,
  getOrCreateConversation, getOrganizationInvitations, getOrganizations, getProducts, getQuotesForRfq,
  getSellerQuotes, getSellerRfqs, getTeamMembers, getVerificationCase, initiateOrderPayment, publishRfq,
  markNotificationRead, openDispute, removeTeamMember, reopenRejectedProduct, sendMessage, signOut,
  setOrderLineHsn, submitProductForReview, submitQuote, submitVerification, transitionOrder, updateProductDraft,
  type Category, type CommercialDocument, type Notification, type Order, type Organization, type OrganizationInvitation,
  type Product, type Quote, type Rfq, type TeamMember, type TeamRole, type TradeConversation, type TradeMessage, type VerificationCase,
} from "@/lib/marketplace";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app")({ component: Workspace });
type View = "rfqs" | "orders" | "catalog" | "opportunities" | "team";
type FormValues = Record<string, FormDataEntryValue>;
const formValues = (event: FormEvent<HTMLFormElement>): FormValues => Object.fromEntries(new FormData(event.currentTarget));
const errorText = (error: unknown) => error instanceof Error ? error.message : "Request failed. Try again.";
const input = "w-full border border-[#C9D3DF] bg-white px-3 py-2 text-[#17233A]";

type RazorpaySuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayFailure = { error?: { description?: string } };
type RazorpayInstance = { open: () => void; on: (event: "payment.failed", callback: (failure: RazorpayFailure) => void) => void };
type RazorpayConstructor = new (options: {
  key: string; amount: number; currency: string; name: string; description: string; order_id: string;
  handler: (result: RazorpaySuccess) => void; modal: { ondismiss: () => void };
  theme: { color: string };
}) => RazorpayInstance;
declare global { interface Window { Razorpay?: RazorpayConstructor } }

let razorpayScript: Promise<void> | null = null;
function loadRazorpayCheckout() {
  if (typeof window === "undefined") return Promise.reject(new Error("Payment checkout requires a browser."));
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScript) return razorpayScript;
  razorpayScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => window.Razorpay ? resolve() : reject(new Error("Payment checkout failed to load."));
    script.onerror = () => reject(new Error("Payment checkout failed to load."));
    document.head.appendChild(script);
  });
  return razorpayScript;
}

function Workspace() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [ops, setOps] = useState(false);
  const [paymentAvailable, setPaymentAvailable] = useState(false);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [opportunities, setOpportunities] = useState<Rfq[]>([]);
  const [sellerQuotes, setSellerQuotes] = useState<Quote[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedRfq, setSelectedRfq] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProductId, setEditingProductId] = useState("");
  const [orderActionId, setOrderActionId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [conversation, setConversation] = useState<TradeConversation | null>(null);
  const [messages, setMessages] = useState<TradeMessage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [verification, setVerification] = useState<VerificationCase | null>(null);
  const [view, setView] = useState<View>("rfqs");
  const [form, setForm] = useState<"organization" | "rfq" | "product" | "quote" | null>(null);
  const [quoteRfq, setQuoteRfq] = useState<Rfq | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const organization = organizations.find(item => item.id === organizationId);
  const buyer = organization?.kind === "buyer" || organization?.kind === "both";
  const seller = organization?.kind === "seller" || organization?.kind === "both";
  const currentRole = team.find(item => item.user_id === userId)?.role;
  const hasRole = (...roles: TeamRole[]) => Boolean(currentRole && roles.includes(currentRole));
  const canManageOrganization = hasRole("owner", "administrator");
  const canManageRfqs = Boolean(buyer && hasRole("owner", "administrator", "procurement_manager"));
  const canApproveQuotes = Boolean(buyer && hasRole("owner", "administrator", "purchase_approver"));
  const canSubmitQuotes = Boolean(seller && hasRole("owner", "administrator", "sales_manager", "sales_representative"));
  const canManageCatalog = Boolean(seller && hasRole("owner", "administrator", "sales_manager", "catalog_manager"));
  const canAdjustInventory = Boolean(seller && hasRole("owner", "administrator", "sales_manager", "catalog_manager", "inventory_manager", "warehouse_operator"));

  const loadAccount = useCallback(async () => {
    const user = await getIdentity();
    if (!user) { setUserId(null); setLoading(false); return; }
    const [nextOrganizations, nextCategories, nextOps, nextNotifications, nextPaymentAvailable] = await Promise.all([
      getOrganizations(), getCategories(), getOperationsAccess(user.id), getNotifications(), getPaymentAvailability(),
    ]);
    setUserId(user.id); setOrganizations(nextOrganizations); setCategories(nextCategories); setOps(nextOps); setNotifications(nextNotifications); setPaymentAvailable(nextPaymentAvailable);
    setOrganizationId(current => nextOrganizations.some(item => item.id === current) ? current : (nextOrganizations[0]?.id ?? ""));
    setLoading(false);
  }, []);
  useEffect(() => { void loadAccount().catch(err => { setError(errorText(err)); setLoading(false); }); }, [loadAccount]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        window.setTimeout(() => {
          void loadAccount().catch(err => { setError(errorText(err)); setLoading(false); });
        }, 0);
      } else if (event === "SIGNED_OUT") {
        setUserId(null);
        setOrganizations([]);
        setOrganizationId("");
        setLoading(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [loadAccount]);

  const loadData = useCallback(async () => {
    if (!organization) return;
    const [nextRfqs, nextOpportunities, nextSellerQuotes, nextProducts, nextOrders, nextVerification, nextTeam, nextInvitations] = await Promise.all([
      buyer ? getBuyerRfqs(organization.id) : Promise.resolve([]),
      seller ? getSellerRfqs() : Promise.resolve([]),
      seller ? getSellerQuotes(organization.id) : Promise.resolve([]),
      seller ? getProducts(organization.id) : Promise.resolve([]),
      getOrders(organization.id),
      getVerificationCase(organization.id),
      getTeamMembers(organization.id),
      getOrganizationInvitations(organization.id),
    ]);
    setRfqs(nextRfqs); setOpportunities(nextOpportunities); setSellerQuotes(nextSellerQuotes); setProducts(nextProducts); setOrders(nextOrders); setVerification(nextVerification); setTeam(nextTeam); setInvitations(nextInvitations);
  }, [organization, buyer, seller]);
  useEffect(() => { if (!organization) return; setView(buyer ? "rfqs" : "opportunities"); setConversation(null); setMessages([]); void loadData().catch(err => setError(errorText(err))); }, [loadData, organization, buyer]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); await loadData(); if (selectedRfq) setQuotes(await getQuotesForRfq(selectedRfq)); setNotifications(await getNotifications()); setNotice(success); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }
  async function openQuotes(id: string) {
    setSelectedRfq(id); setError("");
    try { setQuotes(await getQuotesForRfq(id)); } catch (err) { setError(errorText(err)); }
  }
  async function openConversation(context: "quote" | "order", referenceId: string) {
    setBusy(true); setError("");
    try {
      const thread = await getOrCreateConversation(context, referenceId);
      setConversation(thread); setMessages(await getMessages(thread.id));
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }
  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!conversation || !organization) return;
    const formElement = event.currentTarget;
    const body = String(formValues(event)["body"] ?? "").trim();
    if (!body) return;
    void run(async () => {
      await sendMessage(conversation.id, organization.id, body);
      setMessages(await getMessages(conversation.id));
      formElement.reset();
    }, "Message sent.");
  }
  function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!organization) return; const f = formValues(event);
    void run(() => createOrganizationInvitation(organization.id, String(f["email"]), String(f["role"]) as TeamRole), "Invitation created. Share the code securely with the invited person.");
  }
  function acceptInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = formValues(event);
    setBusy(true); setError(""); setNotice("");
    void acceptOrganizationInvitation(String(f["token"])).then(async () => {
      await loadAccount(); setNotice("Invitation accepted. Select the organization above.");
    }).catch(err => setError(errorText(err))).finally(() => setBusy(false));
  }
  function submitShipment(event: FormEvent<HTMLFormElement>, order: Order) {
    event.preventDefault(); const f = formValues(event);
    const lines = order.order_lines.map(line => ({
      order_line_id: line.id, quantity: Number(f[`quantity-${line.id}`] ?? 0),
    })).filter(line => line.quantity > 0);
    void run(async () => {
      await createShipment(order.id, {
        shippingMode: String(f["shippingMode"]), freightType: String(f["freightType"]),
        carrier: String(f["carrier"]), trackingNumber: String(f["trackingNumber"]),
        estimatedDeliveryAt: new Date(String(f["estimatedDelivery"])).toISOString(),
        lines,
      }); setOrderActionId("");
    }, "Shipment created. Dispatch it after handoff to the carrier.");
  }
  function submitDispute(event: FormEvent<HTMLFormElement>, order: Order) {
    event.preventDefault(); if (!organization) return; const f = formValues(event);
    void run(async () => {
      await openDispute(order.id, organization.id, String(f["type"]), String(f["description"]));
      setOrderActionId("");
    }, "Dispute opened and the order is on hold.");
  }
  function submitReview(event: FormEvent<HTMLFormElement>, order: Order) {
    event.preventDefault(); const f = formValues(event);
    void run(async () => {
      await createReview(order.id, Number(f["rating"]), String(f["body"])); setOrderActionId("");
    }, "Review published.");
  }
  function submitTaxDetails(event: FormEvent<HTMLFormElement>, order: Order) {
    event.preventDefault(); const f = formValues(event);
    void run(async () => {
      for (const line of order.order_lines) await setOrderLineHsn(line.id, String(f[`hsn-${line.id}`]));
      setOrderActionId("");
    }, "Order tax details saved.");
  }
  function generateDocument(order: Order, type: CommercialDocument["type"]) {
    if (!organization) return;
    void run(async () => {
      const result = await generateCommercialDocument(order.id, organization.id, type);
      const link = document.createElement("a"); link.href = result.signed_url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.click();
    }, `${type.replaceAll("_", " ")} generated.`);
  }
  function downloadDocument(path: string) {
    void getCommercialDocumentUrl(path).then(url => {
      const link = document.createElement("a"); link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.click();
    }).catch(err => setError(errorText(err)));
  }
  async function payOrder(order: Order) {
    const checkout = await initiateOrderPayment(order.id, crypto.randomUUID());
    await loadRazorpayCheckout();
    const Razorpay = window.Razorpay;
    if (!Razorpay) throw new Error("Payment checkout is unavailable.");
    await new Promise<void>((resolve, reject) => {
      let completed = false;
      const instance = new Razorpay({
        key: checkout.key_id, amount: checkout.amount_paise, currency: checkout.currency,
        name: "FeaBulk", description: `Payment for ${order.order_number}`, order_id: checkout.provider_order_id,
        theme: { color: "#F87908" },
        handler: result => {
          void confirmOrderPayment({
            providerOrderId: result.razorpay_order_id,
            providerPaymentId: result.razorpay_payment_id,
            signature: result.razorpay_signature,
          }).then(() => { completed = true; resolve(); }).catch(reject);
        },
        modal: { ondismiss: () => { if (!completed) reject(new Error("Payment window closed before completion.")); } },
      });
      instance.on("payment.failed", failure => reject(new Error(failure.error?.description ?? "Payment failed. You can retry safely.")));
      instance.open();
    });
  }
  function submitOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = formValues(event);
    void run(async () => { await createOrganization({
      legalName: String(f["legalName"]), displayName: String(f["displayName"]), kind: String(f["kind"]) as "buyer" | "seller",
      gstin: String(f["gstin"]), businessType: String(f["businessType"]),
      address: { address_line: String(f["address"]), city: String(f["city"]), state: String(f["state"]), pin_code: String(f["pin"]), country: "India" },
    }); await loadAccount(); setForm(null); }, "Business created. Verification is pending.");
  }
  function submitRfq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!organization) return; const f = formValues(event);
    void run(async () => { await createRfq(organization.id, {
      title: String(f["title"]), category_id: String(f["category"]), specifications: { description: String(f["specifications"]) },
      required_quantity: Number(f["quantity"]), unit_of_measure: String(f["unit"]),
      delivery_address: { address_line: String(f["address"]), pin_code: String(f["pin"]) },
      delivery_pin_code: String(f["pin"]), shipping_responsibility: String(f["shipping"]),
      quote_deadline: new Date(String(f["deadline"])).toISOString(), visibility: "verified_sellers",
    }); setForm(null); }, "RFQ draft saved.");
  }
  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!organization) return; const f = formValues(event);
    void run(async () => { await createProduct(organization.id, {
      name: String(f["name"]), slug: String(f["slug"]), category_id: String(f["category"]),
      description: String(f["description"]), seller_sku: String(f["sku"]), unit_of_measure: String(f["unit"]),
      hsn_code: String(f["hsn"]),
      minimum_order_quantity: Number(f["moq"]), available_quantity: Number(f["stock"]),
      gst_rate: Number(f["gst"]), lead_time_days: Number(f["lead"]),
    }); setForm(null); }, "Product draft saved.");
  }
  function submitEditProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editingProductId) return; const f = formValues(event);
    void run(async () => { await updateProductDraft(editingProductId, {
      name: String(f["name"]), slug: String(f["slug"]), category_id: String(f["category"]),
      seller_sku: String(f["sku"]), description: String(f["description"]),
      hsn_code: String(f["hsn"]),
      unit_of_measure: String(f["unit"]), minimum_order_quantity: Number(f["moq"]),
      gst_rate: Number(f["gst"]), lead_time_days: Number(f["lead"]),
    }); setEditingProductId(""); }, "Product draft updated.");
  }
  function submitSellerQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!organization || !quoteRfq) return; const f = formValues(event);
    void run(async () => { await submitQuote(quoteRfq.id, organization.id, {
      unit_price: Number(f["price"]), quantity: Number(f["quantity"]), gst_rate: Number(f["gst"]),
      shipping_charge: Number(f["freight"]), lead_time_days: Number(f["lead"]),
      validity_ends_at: new Date(String(f["validUntil"])).toISOString(), seller_notes: String(f["notes"]),
    }); setForm(null); setQuoteRfq(null); }, "Quote submitted.");
  }

  return <main className="min-h-screen bg-[#F7F8FA] text-[#17233A]">
    <header className="border-b border-[#DDE5EE] bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><a href="/" className="text-xl font-black text-[#102B52]">FEA<span className="text-[#F87908]">Bulk</span></a><div className="flex gap-4 text-sm font-bold"><a href="/">Marketplace</a>{userId && <button onClick={() => setShowNotifications(value => !value)}>Notifications ({notifications.filter(item => !item.read_at).length})</button>}{userId && <button onClick={() => void signOut().then(() => router.navigate({ to: "/auth" })).catch(err => setError(errorText(err)))}>Sign out</button>}</div></div></header>
    <div className="mx-auto max-w-7xl px-5 py-8">
      {loading ? <p>Loading account…</p> : !userId ? <section className="border bg-white p-6"><h1 className="text-2xl font-black">{error ? "We could not load your account" : "Sign in to continue"}</h1>{error && <p role="alert" className="mt-3 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}<a className="mt-4 inline-block bg-[#F87908] px-4 py-2 font-bold text-white" href="/auth">{error ? "Return to sign in" : "Sign in"}</a></section> : <>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-[#F87908]">Business workspace</p><h1 className="mt-2 text-3xl font-black text-[#102B52]">{organization?.display_name ?? "Set up your business"}</h1>{organization && <p className="mt-2 text-sm text-[#526178]">{organization.kind} · Verification: {organization.status.replaceAll("_", " ")}</p>}</div><div className="flex gap-2">{organizations.length > 1 && <select aria-label="Organization" className={input} value={organizationId} onChange={e => setOrganizationId(e.target.value)}>{organizations.map(item => <option key={item.id} value={item.id}>{item.display_name} ({item.kind})</option>)}</select>}<button className="border border-[#102B52] px-4 py-2 text-sm font-bold" onClick={() => setForm(form === "organization" ? null : "organization")}>Add business</button></div></div>
        {error && <p role="alert" className="mt-5 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="mt-5 border border-green-300 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
        {showNotifications && <section className="mt-5 border bg-white p-5"><h2 className="font-black">Notifications</h2>{notifications.length === 0 ? <p className="mt-2 text-sm">No notifications yet.</p> : <div className="mt-3 grid gap-2">{notifications.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm"><span>{item.template_key.replaceAll(".", " ").replaceAll("_", " ")} · {new Date(item.created_at).toLocaleString()}</span>{!item.read_at && <button className="button-secondary" onClick={() => void markNotificationRead(item.id).then(async () => setNotifications(await getNotifications())).catch(err => setError(errorText(err)))}>Mark read</button>}</div>)}</div>}</section>}
        <details className="mt-5 border bg-white p-4"><summary className="cursor-pointer text-sm font-bold">Join a team with an invitation code</summary><form onSubmit={acceptInvitation} className="mt-3 flex flex-wrap gap-2"><input aria-label="Invitation code" name="token" required minLength={36} maxLength={36} className="min-w-64 flex-1 border border-[#C9D3DF] p-2" placeholder="Paste the invitation code" /><button disabled={busy} className="button">Join team</button></form></details>
        {(form === "organization" || organizations.length === 0) && <section className="mt-6 border bg-white p-6"><h2 className="text-xl font-black">Create a business workspace</h2><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submitOrganization}><Field label="Business role"><select name="kind" className={input}><option value="buyer">Buyer</option><option value="seller">Seller</option></select></Field><Text name="legalName" label="Legal business name" minLength={2} /><Text name="displayName" label="Trading name" minLength={2} /><Text name="businessType" label="Business type" /><Text name="gstin" label="GSTIN (optional)" required={false} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][A-Za-z0-9]Z[A-Za-z0-9]" /><Text name="address" label="Registered address" /><Text name="city" label="City" /><Text name="state" label="State" /><Text name="pin" label="PIN code" pattern="[0-9]{6}" /><Action busy={busy}>Create business</Action></form></section>}
        {organization && <>
          <div className="mt-7 flex flex-wrap gap-2 border-b pb-3">{buyer && <Tab active={view === "rfqs"} onClick={() => setView("rfqs")}>Buyer RFQs</Tab>}{seller && <><Tab active={view === "opportunities"} onClick={() => setView("opportunities")}>Seller opportunities</Tab><Tab active={view === "catalog"} onClick={() => setView("catalog")}>Catalog</Tab></>}<Tab active={view === "orders"} onClick={() => setView("orders")}>Orders</Tab><Tab active={view === "team"} onClick={() => setView("team")}>Team</Tab></div>
          {organization.status !== "verified" && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border border-amber-300 bg-amber-50 p-4 text-sm"><p>Business verification: {verification?.status ?? "pending"}. RFQ publishing and quote submission require approval.</p>{canManageOrganization && verification && ["draft", "rejected", "resubmission_required"].includes(verification.status) && <button disabled={busy} className="button" onClick={() => void run(() => submitVerification(organization.id), "Verification submitted for review.")}>Submit for verification</button>}</div>}
          {view === "rfqs" && buyer && <section className="mt-6"><Heading title={"Requests for quotation (" + rfqs.length + ")"} action={canManageRfqs ? "Create RFQ" : undefined} onClick={canManageRfqs ? () => setForm(form === "rfq" ? null : "rfq") : undefined} />{canManageRfqs && form === "rfq" && <form className="mt-4 grid gap-3 border bg-white p-6 sm:grid-cols-2" onSubmit={submitRfq}><Text name="title" label="What do you need?" minLength={8} /><Field label="Category"><select name="category" required className={input}><option value="">Select a category</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Specifications"><textarea name="specifications" required className={input} /></Field><Text name="quantity" label="Quantity" type="number" min={1} /><Text name="unit" label="Unit" defaultValue="units" /><Text name="address" label="Delivery address" /><Text name="pin" label="Delivery PIN" pattern="[0-9]{6}" /><Text name="deadline" label="Quote deadline" type="datetime-local" /><Field label="Shipping"><select name="shipping" className={input}><option value="seller">Seller arranged</option><option value="buyer">Buyer arranged</option><option value="negotiable">Negotiable</option></select></Field><Action busy={busy}>Save RFQ draft</Action></form>}{rfqs.length === 0 ? <Empty>No RFQs yet.</Empty> : <div className="mt-4 grid gap-3">{rfqs.map(item => <Card key={item.id}><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-extrabold">{item.title}</h3><p className="text-sm text-[#526178]">{item.required_quantity} {item.unit_of_measure} · PIN {item.delivery_pin_code} · {item.status}</p></div><div className="flex gap-2">{canManageRfqs && item.status === "draft" && <button disabled={busy} className="button" onClick={() => void run(() => publishRfq(item.id), "RFQ published.")}>Publish</button>}<button className="button-secondary" onClick={() => void openQuotes(item.id)}>Compare quotes</button></div></div>{selectedRfq === item.id && <div className="mt-4 border-t pt-4">{quotes.length === 0 ? <p className="text-sm">No quotes received.</p> : quotes.map(quote => { const version = quote.quote_versions.find(v => v.version === quote.current_version); return <div key={quote.id} className="mt-2 flex flex-wrap items-center justify-between gap-3 bg-[#F7F8FA] p-3 text-sm"><span>Supplier {quote.seller_organization_id.slice(0, 8)} · v{quote.current_version} · {quote.status}</span><span>{version ? `₹${Number(version.unit_price).toLocaleString("en-IN")} × ${version.quantity}, ${version.lead_time_days} days` : "Terms unavailable"}</span>{canApproveQuotes && ["submitted", "revised"].includes(quote.status) && <button disabled={busy} className="button" onClick={() => void run(() => acceptQuote(quote.id), "Quote accepted; order created.")}>Accept quote</button>}<button className="button-secondary" onClick={() => void openConversation("quote", quote.id)}>Message seller</button></div>; })}</div>}</Card>)}</div>}</section>}
          {view === "opportunities" && seller && <section className="mt-6"><h2 className="text-xl font-black">Open RFQs ({opportunities.length})</h2>{opportunities.length === 0 ? <Empty>No open RFQs yet.</Empty> : <div className="mt-4 grid gap-3">{opportunities.map(item => <Card key={item.id}><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-extrabold">{item.title}</h3><p className="text-sm text-[#526178]">{item.required_quantity} {item.unit_of_measure} · PIN {item.delivery_pin_code} · closes {item.quote_deadline ? new Date(item.quote_deadline).toLocaleString() : "unspecified"}</p></div>{canSubmitQuotes && <button className="button" onClick={() => { setQuoteRfq(item); setForm("quote"); }}>Prepare quote</button>}</div></Card>)}</div>}{canSubmitQuotes && form === "quote" && quoteRfq && <form className="mt-4 grid gap-3 border bg-white p-6 sm:grid-cols-2" onSubmit={submitSellerQuote}><h3 className="text-lg font-bold sm:col-span-2">Quote: {quoteRfq.title}</h3><Text name="price" label="Unit price (INR)" type="number" min={0.01} step="0.01" /><Text name="quantity" label="Quantity" type="number" min={1} defaultValue={quoteRfq.required_quantity} /><Text name="gst" label="GST rate (%)" type="number" min={0} max={100} step="0.01" /><Text name="freight" label="Freight (INR)" type="number" min={0} defaultValue={0} step="0.01" /><Text name="lead" label="Lead time (days)" type="number" min={0} /><Text name="validUntil" label="Valid until" type="datetime-local" /><Field label="Notes"><textarea name="notes" className={input} /></Field><Action busy={busy}>Submit quote</Action></form>}{sellerQuotes.length > 0 && <div className="mt-7"><h3 className="text-lg font-black">Your submitted quotes ({sellerQuotes.length})</h3><div className="mt-3 grid gap-2">{sellerQuotes.map(quote => <Card key={quote.id}><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm">RFQ {opportunities.find(item => item.id === quote.rfq_id)?.title ?? quote.rfq_id.slice(0, 8)} · version {quote.current_version} · {quote.status}</span><button className="button-secondary" onClick={() => void openConversation("quote", quote.id)}>Message buyer</button></div></Card>)}</div></div>}</section>}
          {view === "catalog" && seller && <section className="mt-6"><Heading title={"Catalog (" + products.length + ")"} action={canManageCatalog ? "Add product" : undefined} onClick={canManageCatalog ? () => setForm(form === "product" ? null : "product") : undefined} />{canManageCatalog && form === "product" && <form className="mt-4 grid gap-3 border bg-white p-6 sm:grid-cols-2" onSubmit={submitProduct}><Text name="name" label="Product name" minLength={3} /><Text name="slug" label="Unique URL slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" /><Field label="Category"><select name="category" required className={input}><option value="">Select a category</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Text name="sku" label="Seller SKU" /><Text name="hsn" label="HSN code" pattern="[0-9]{4,8}" /><Field label="Description (20+ characters)"><textarea name="description" required minLength={20} className={input} /></Field><Text name="unit" label="Unit" defaultValue="units" /><Text name="moq" label="Minimum order quantity" type="number" min={1} /><Text name="stock" label="Available quantity" type="number" min={0} /><Text name="gst" label="GST rate (%)" type="number" min={0} max={100} step="0.01" /><Text name="lead" label="Lead time (days)" type="number" min={0} /><Action busy={busy}>Save product draft</Action></form>}{products.length === 0 ? <Empty>No products yet.</Empty> : <div className="mt-4 grid gap-3">{products.map(item => <Card key={item.id}><h3 className="font-extrabold">{item.name}</h3><p className="text-sm text-[#526178]">SKU {item.seller_sku} · MOQ {item.minimum_order_quantity} · Stock {item.available_quantity} · {item.listing_status} / {item.moderation_status}</p>{item.moderation_notes && <p className="mt-2 border-l-2 border-[#F87908] pl-3 text-sm">Review: {item.moderation_notes}</p>}{canManageCatalog && item.moderation_status === "rejected" && <button disabled={busy} className="button mt-3" onClick={() => void run(() => reopenRejectedProduct(item.id), "Rejected listing reopened for revision.")}>Reopen rejected listing</button>}{canManageCatalog && item.listing_status === "draft" && item.moderation_status === "pending" && !item.submitted_for_review_at && <button className="button-secondary mt-3" onClick={() => setEditingProductId(editingProductId === item.id ? "" : item.id)}>Edit draft</button>}{canManageCatalog && editingProductId === item.id && <form className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2" onSubmit={submitEditProduct}><Text name="name" label="Product name" defaultValue={item.name} minLength={3} /><Text name="slug" label="URL slug" defaultValue={item.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" /><Field label="Category"><select name="category" defaultValue={item.category_id ?? ""} required className={input}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Text name="sku" label="SKU" defaultValue={item.seller_sku} /><Text name="hsn" label="HSN code" pattern="[0-9]{4,8}" defaultValue={item.hsn_code ?? ""} /><Field label="Description"><textarea name="description" defaultValue={item.description} minLength={20} required className={input} /></Field><Text name="unit" label="Unit" defaultValue={item.unit_of_measure} /><Text name="moq" label="MOQ" type="number" min={1} defaultValue={item.minimum_order_quantity} /><Text name="gst" label="GST rate (%)" type="number" min={0} max={100} step="0.01" defaultValue={item.gst_rate ?? 0} /><Text name="lead" label="Lead time (days)" type="number" min={0} defaultValue={item.lead_time_days ?? 0} /><Action busy={busy}>Save changes</Action></form>}{item.product_price_tiers?.length ? <div className="mt-3 grid gap-1 text-sm">{item.product_price_tiers.map(tier => <div key={tier.id} className="flex items-center justify-between gap-3 bg-[#F7F8FA] p-2"><span>{tier.minimum_quantity}–{tier.maximum_quantity} units · ₹{Number(tier.unit_price).toLocaleString("en-IN")}/unit</span>{canManageCatalog && item.listing_status === "draft" && !item.submitted_for_review_at && <button disabled={busy} className="text-red-700 underline" onClick={() => void run(() => deletePriceTier(tier.id), "Price tier deleted.")}>Delete tier</button>}</div>)}</div> : null}{canManageCatalog && item.listing_status === "draft" && !item.submitted_for_review_at && <form className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4" onSubmit={event => { event.preventDefault(); const f = formValues(event); void run(() => addPriceTier(item.id, Number(f["min"]), Number(f["max"]), Number(f["price"])), "Price tier added."); }}><Text name="min" label="From quantity" type="number" min={item.minimum_order_quantity} /><Text name="max" label="To quantity" type="number" min={item.minimum_order_quantity} /><Text name="price" label="Unit price (INR)" type="number" min={0.01} step="0.01" /><button disabled={busy} className="button">Add price tier</button></form>}{canManageCatalog && item.listing_status === "draft" && item.moderation_status === "pending" && !item.submitted_for_review_at && <button disabled={busy} className="button mt-3" onClick={() => void run(() => submitProductForReview(item.id), "Product submitted for moderation.")}>Submit for review</button>}{canAdjustInventory && <form className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4" onSubmit={event => { event.preventDefault(); const f = formValues(event); void run(() => adjustInventory(item.id, Number(f["delta"]), String(f["reason"])), "Inventory updated."); }}><Text name="delta" label="Stock adjustment (+/-)" type="number" required step={1} /><Text name="reason" label="Reason" minLength={5} /><button disabled={busy} className="button">Update inventory</button></form>}</Card>)}</div>}</section>}
          {view === "orders" && <section className="mt-6"><h2 className="text-xl font-black">Orders ({orders.length})</h2>{orders.length === 0 ? <Empty>No orders yet.</Empty> : <div className="mt-4 grid gap-3">{orders.map(item => <OrderCard key={item.id} order={item} organization={organization} buyer={Boolean(buyer)} seller={Boolean(seller)} role={currentRole} paymentAvailable={paymentAvailable} busy={busy} activeAction={orderActionId} setActiveAction={setOrderActionId} run={run} openConversation={openConversation} payOrder={payOrder} submitShipment={submitShipment} submitDispute={submitDispute} submitReview={submitReview} submitTaxDetails={submitTaxDetails} generateDocument={generateDocument} downloadDocument={downloadDocument} />)}</div>}</section>}
          {view === "team" && <section className="mt-6"><h2 className="text-xl font-black">Team ({team.length})</h2><div className="mt-4 grid gap-3">{team.map(member => <Card key={member.user_id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">{member.email}</p><p className="text-sm text-[#526178]">{member.role.replaceAll("_", " ")}</p></div>{currentRole === "owner" && member.user_id !== userId && <button disabled={busy} className="button-secondary" onClick={() => void run(() => removeTeamMember(organization.id, member.user_id), "Team member removed.")}>Remove</button>}</div></Card>)}</div>{canManageOrganization && <><form onSubmit={submitInvitation} className="mt-6 grid gap-3 border bg-white p-5 sm:grid-cols-2"><h3 className="text-lg font-black sm:col-span-2">Invite a teammate</h3><Text name="email" label="Confirmed work email" type="email" /><Field label="Role"><select name="role" className={input}>{(["administrator", "procurement_manager", "purchase_approver", "accountant", "sales_manager", "sales_representative", "catalog_manager", "inventory_manager", "warehouse_operator", "viewer"] as TeamRole[]).filter(role => organization.kind === "both" || role === "administrator" || role === "viewer" || role === "accountant" || (buyer && ["procurement_manager", "purchase_approver"].includes(role)) || (seller && ["sales_manager", "sales_representative", "catalog_manager", "inventory_manager", "warehouse_operator"].includes(role))).map(role => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></Field><Action busy={busy}>Create invitation code</Action></form><div className="mt-6"><h3 className="font-black">Invitation codes</h3>{invitations.length === 0 ? <p className="mt-2 text-sm">No invitations yet.</p> : <div className="mt-3 grid gap-2">{invitations.map(item => <Card key={item.id}><p className="text-sm font-bold">{item.email} · {item.role.replaceAll("_", " ")} · {item.accepted_at ? "accepted" : new Date(item.expires_at) > new Date() ? "pending" : "expired"}</p>{!item.accepted_at && new Date(item.expires_at) > new Date() && <p className="mt-2 break-all font-mono text-sm">{item.token}</p>}</Card>)}</div>}</div></>}</section>}
          {conversation && <section className="mt-8 border border-[#C9D3DF] bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-black">Trade messages</h2><button className="button-secondary" onClick={() => { setConversation(null); setMessages([]); }}>Close</button></div><div className="mt-4 max-h-80 space-y-3 overflow-y-auto">{messages.length === 0 ? <p className="text-sm text-[#526178]">No messages yet.</p> : messages.map(item => <article key={item.id} className="border bg-[#F7F8FA] p-3"><p className="text-xs font-bold text-[#526178]">{item.sender_organization_id === organization.id ? "Your team" : "Other business"} · {new Date(item.created_at).toLocaleString()}</p><p className="mt-1 whitespace-pre-wrap text-sm">{item.body}</p></article>)}</div><form className="mt-4 flex flex-wrap gap-2" onSubmit={submitMessage}><label className="sr-only" htmlFor="message-body">Message</label><textarea id="message-body" name="body" required maxLength={8000} className="min-w-64 flex-1 border border-[#C9D3DF] p-3" placeholder="Write a message" /><button disabled={busy} className="button">Send message</button></form></section>}
        </>}
        {ops && <a className="mt-8 inline-block border border-[#102B52] px-4 py-2 text-sm font-bold text-[#102B52]" href="/operations">Open FEA operations</a>}
      </>}
    </div>
  </main>;
}

type OrderCardProps = {
  order: Order; organization: Organization; buyer: boolean; seller: boolean; role?: TeamRole | undefined; paymentAvailable: boolean; busy: boolean;
  activeAction: string; setActiveAction: (value: string) => void;
  run: (action: () => Promise<unknown>, success: string) => Promise<void>;
  openConversation: (context: "quote" | "order", referenceId: string) => Promise<void>;
  payOrder: (order: Order) => Promise<void>;
  submitShipment: (event: FormEvent<HTMLFormElement>, order: Order) => void;
  submitDispute: (event: FormEvent<HTMLFormElement>, order: Order) => void;
  submitReview: (event: FormEvent<HTMLFormElement>, order: Order) => void;
  submitTaxDetails: (event: FormEvent<HTMLFormElement>, order: Order) => void;
  generateDocument: (order: Order, type: CommercialDocument["type"]) => void;
  downloadDocument: (path: string) => void;
};
function OrderCard(props: OrderCardProps) {
  const { order, organization, buyer, seller, role, paymentAvailable, busy, activeAction, setActiveAction, run } = props;
  const isBuyer = buyer && order.buyer_organization_id === organization.id;
  const isSeller = seller && order.seller_organization_id === organization.id;
  const hasRole = (...roles: TeamRole[]) => Boolean(role && roles.includes(role));
  const canManageBuyerOrder = isBuyer && hasRole("owner", "administrator", "procurement_manager", "purchase_approver");
  const canPayBuyerOrder = isBuyer && hasRole("owner", "administrator", "purchase_approver", "accountant");
  const canCancelBuyerOrder = isBuyer && hasRole("owner", "administrator", "procurement_manager");
  const canManageSellerOrder = isSeller && hasRole("owner", "administrator", "sales_manager", "warehouse_operator");
  const canManageTax = isSeller && hasRole("owner", "administrator", "sales_manager", "accountant");
  const canGeneratePurchaseOrder = isBuyer && hasRole("owner", "administrator", "procurement_manager", "purchase_approver");
  const canGenerateSellerInvoice = isSeller && hasRole("owner", "administrator", "sales_manager", "accountant");
  const canGenerateFulfilmentDocument = isSeller && hasRole("owner", "administrator", "sales_manager", "warehouse_operator");
  const review = order.reviews[0];
  const latestPayment = [...order.payment_transactions].sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
  const paymentInProgress = Boolean(latestPayment && ["initiated", "pending", "authorized"].includes(latestPayment.status));
  const hasTaxInvoice = order.commercial_documents.some(item => item.type === "tax_invoice");
  const taxInvoiceStates = ["payment_secured", "processing", "ready_to_ship", "partially_fulfilled", "shipped", "delivered", "inspection", "completed", "disputed"];
  const fulfilmentDocumentStates = ["processing", "ready_to_ship", "partially_fulfilled", "shipped", "delivered", "inspection", "completed", "disputed"];
  return <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{order.order_number}</h3><p className="text-sm text-[#526178]">{order.status.replaceAll("_", " ")} · ₹{Number(order.grand_total).toLocaleString("en-IN")}</p>{order.order_lines.map(line => <p key={line.id} className="mt-1 text-xs text-[#526178]">{line.description}: {line.quantity} {line.unit_of_measure} × ₹{Number(line.unit_price).toLocaleString("en-IN")}</p>)}</div><div className="flex flex-wrap gap-2">
    {canManageSellerOrder && order.status === "awaiting_seller_confirmation" && <button disabled={busy} className="button" onClick={() => void run(() => transitionOrder(order.id, "awaiting_payment"), "Order confirmed; awaiting payment.")}>Confirm order</button>}
    {canCancelBuyerOrder && !paymentInProgress && ["awaiting_seller_confirmation", "awaiting_payment"].includes(order.status) && <button disabled={busy} className="button-secondary" onClick={() => void run(() => transitionOrder(order.id, "cancelled"), "Order cancelled.")}>Cancel order</button>}
    {paymentAvailable && canPayBuyerOrder && order.status === "awaiting_payment" && <button disabled={busy} className="button" onClick={() => void run(() => props.payOrder(order), "Payment verified securely.")}>Pay securely</button>}
    {canManageSellerOrder && order.status === "payment_secured" && <button disabled={busy} className="button" onClick={() => void run(() => transitionOrder(order.id, "processing"), "Order moved to processing.")}>Start processing</button>}
    {canManageSellerOrder && order.status === "processing" && <button disabled={busy} className="button" onClick={() => void run(() => transitionOrder(order.id, "ready_to_ship"), "Order is ready to ship.")}>Ready to ship</button>}
    {canManageSellerOrder && ["ready_to_ship", "partially_fulfilled"].includes(order.status) && <button className="button" onClick={() => setActiveAction(activeAction === `ship-${order.id}` ? "" : `ship-${order.id}`)}>Create shipment</button>}
    {canManageBuyerOrder && order.status === "delivered" && <button disabled={busy} className="button" onClick={() => void run(() => completeOrderInspection(order.id), "Inspection period started.")}>Start inspection</button>}
    {canManageBuyerOrder && order.status === "inspection" && order.inspection_ends_at && new Date(order.inspection_ends_at) <= new Date() && <button disabled={busy} className="button" onClick={() => void run(() => completeOrderInspection(order.id), "Order completed.")}>Complete order</button>}
    {(isBuyer || isSeller) && ["shipped", "delivered", "inspection"].includes(order.status) && <button className="button-secondary" onClick={() => setActiveAction(activeAction === `dispute-${order.id}` ? "" : `dispute-${order.id}`)}>Open dispute</button>}
    {isBuyer && order.status === "completed" && !review && <button className="button-secondary" onClick={() => setActiveAction(activeAction === `review-${order.id}` ? "" : `review-${order.id}`)}>Review seller</button>}
    {canManageTax && !hasTaxInvoice && !["completed", "cancelled", "returned"].includes(order.status) && <button className="button-secondary" onClick={() => setActiveAction(activeAction === `tax-${order.id}` ? "" : `tax-${order.id}`)}>Tax details</button>}<button className="button-secondary" onClick={() => void props.openConversation("order", order.id)}>Messages</button>
  </div></div>{latestPayment && <p className="mt-3 text-xs font-bold text-[#526178]">Payment: {latestPayment.status.replaceAll("_", " ")} · ₹{Number(latestPayment.amount).toLocaleString("en-IN")} · Reconciliation {latestPayment.reconciliation_status}</p>}
  {canManageTax && activeAction === `tax-${order.id}` && <form className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2" onSubmit={event => props.submitTaxDetails(event, order)}><h4 className="font-black sm:col-span-2">Order line tax details</h4>{order.order_lines.map(line => <Text key={line.id} name={`hsn-${line.id}`} label={`HSN: ${line.description}`} pattern="[0-9]{4,8}" defaultValue={line.hsn_code ?? ""} />)}<Action busy={busy}>Save tax details</Action></form>}
  <details className="mt-4 border-t pt-3"><summary className="cursor-pointer text-sm font-black">Commercial documents ({order.commercial_documents.length})</summary><div className="mt-3 flex flex-wrap gap-2">{canGeneratePurchaseOrder && !["draft", "cancelled"].includes(order.status) && <button disabled={busy} className="button-secondary" onClick={() => props.generateDocument(order, "purchase_order")}>Generate purchase order</button>}{canGenerateSellerInvoice && !["draft", "cancelled"].includes(order.status) && <button disabled={busy} className="button-secondary" onClick={() => props.generateDocument(order, "proforma_invoice")}>Generate proforma invoice</button>}{canGenerateSellerInvoice && taxInvoiceStates.includes(order.status) && <button disabled={busy} className="button-secondary" onClick={() => props.generateDocument(order, "tax_invoice")}>Generate tax invoice</button>}{canGenerateFulfilmentDocument && fulfilmentDocumentStates.includes(order.status) && <><button disabled={busy} className="button-secondary" onClick={() => props.generateDocument(order, "delivery_challan")}>Generate delivery challan</button><button disabled={busy} className="button-secondary" onClick={() => props.generateDocument(order, "packing_list")}>Generate packing list</button></>}</div>{order.commercial_documents.length > 0 && <div className="mt-3 grid gap-2">{order.commercial_documents.map(item => <button key={item.id} className="flex items-center justify-between border bg-[#F7F8FA] p-3 text-left text-sm" onClick={() => props.downloadDocument(item.storage_path)}><span>{item.type.replaceAll("_", " ")} · {item.document_number} · v{item.version}</span><span className="font-bold text-[#102B52]">Open</span></button>)}</div>}</details>  {order.shipments.length > 0 && <div className="mt-4 border-t pt-3"><h4 className="text-sm font-black">Shipments</h4>{order.shipments.map(shipment => <div key={shipment.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 bg-[#F7F8FA] p-3 text-sm"><span>{shipment.carrier} · {shipment.tracking_number} · {shipment.status.replaceAll("_", " ")}</span>{canManageSellerOrder && shipment.status === "ready" && <button disabled={busy} className="button" onClick={() => void run(() => dispatchShipment(shipment.id), "Shipment dispatched.")}>Dispatch</button>}{canManageBuyerOrder && ["dispatched", "in_transit"].includes(shipment.status) && <button disabled={busy} className="button" onClick={() => void run(() => confirmShipmentDelivery(shipment.id), "Delivery confirmed.")}>Confirm delivery</button>}</div>)}</div>}
  {order.disputes.length > 0 && <div className="mt-3 border-l-2 border-red-500 pl-3 text-sm"><strong>Dispute:</strong> {order.disputes[0]?.type.replaceAll("_", " ")} · {order.disputes[0]?.status.replaceAll("_", " ")}</div>}
  {review && <p className="mt-3 text-sm"><strong>Review:</strong> {"★".repeat(review.rating)} {review.body}</p>}
  {canManageSellerOrder && activeAction === `ship-${order.id}` && <form className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2" onSubmit={event => props.submitShipment(event, order)}><Field label="Shipping mode"><select name="shippingMode" className={input}><option value="seller_arranged">Seller arranged</option><option value="buyer_pickup">Buyer pickup</option><option value="platform_logistics">Platform logistics</option></select></Field><Field label="Freight type"><select name="freightType" className={input}><option value="parcel">Parcel</option><option value="carton">Carton</option><option value="pallet">Pallet</option><option value="ltl">LTL</option><option value="ftl">FTL</option><option value="air">Air</option><option value="ocean">Ocean</option></select></Field><Text name="carrier" label="Carrier" /><Text name="trackingNumber" label="Tracking number" /><Text name="estimatedDelivery" label="Estimated delivery" type="datetime-local" />{order.order_lines.map(line => <Text key={line.id} name={`quantity-${line.id}`} label={`Ship quantity: ${line.description}`} type="number" min={0} max={line.quantity} defaultValue={line.quantity} />)}<Action busy={busy}>Save shipment</Action></form>}
  {activeAction === `dispute-${order.id}` && <form className="mt-4 grid gap-3 border-t pt-4" onSubmit={event => props.submitDispute(event, order)}><Field label="Issue type"><select name="type" className={input}><option value="missing_quantity">Missing quantity</option><option value="damaged_goods">Damaged goods</option><option value="wrong_specifications">Wrong specifications</option><option value="quality_failure">Quality failure</option><option value="late_shipment">Late shipment</option><option value="non_delivery">Non-delivery</option><option value="invoice_or_payment">Invoice or payment</option><option value="other">Other</option></select></Field><Field label="Description (20+ characters)"><textarea name="description" required minLength={20} maxLength={12000} className={input} /></Field><Action busy={busy}>Open dispute</Action></form>}
  {activeAction === `review-${order.id}` && <form className="mt-4 grid gap-3 border-t pt-4" onSubmit={event => props.submitReview(event, order)}><Field label="Rating"><select name="rating" className={input}>{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} stars</option>)}</select></Field><Field label="Review"><textarea name="body" maxLength={2000} className={input} /></Field><Action busy={busy}>Publish review</Action></form>}
  </Card>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1 text-sm font-semibold text-[#405069]">{label}{children}</label>; }
function Text({ name, label, required = true, ...props }: { name: string; label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) { return <Field label={label}><input name={name} required={required} className={input} {...props} /></Field>; }
function Action({ busy, children }: { busy: boolean; children: ReactNode }) { return <button disabled={busy} className="button sm:col-span-2">{children}</button>; }
function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button className={`px-4 py-2 text-sm font-bold ${active ? "bg-[#102B52] text-white" : "bg-white text-[#102B52]"}`} onClick={onClick}>{children}</button>; }
function Heading({ title, action, onClick }: { title: string; action?: string | undefined; onClick?: (() => void) | undefined }) { return <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">{title}</h2>{action && onClick && <button className="button" onClick={onClick}>{action}</button>}</div>; }
function Empty({ children }: { children: ReactNode }) { return <p className="mt-4 border bg-white p-6 text-sm text-[#526178]">{children}</p>; }
function Card({ children }: { children: ReactNode }) { return <article className="border border-[#DDE5EE] bg-white p-5">{children}</article>; }

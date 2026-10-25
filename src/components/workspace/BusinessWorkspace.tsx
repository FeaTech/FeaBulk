import { SellerAuctionControls } from "@/components/auction/SellerAuctionControls";
import { ProductSaleFields, type ProductSaleType } from "@/components/auction/ProductSaleFields";
import { BuyerAuctions } from "@/components/auction/BuyerAuctions";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ImagePlus, Trash2, X } from "lucide-react";
import {
  acceptOrganizationInvitation,
  acceptQuote,
  addPriceTier,
  adjustInventory,
  completeOrderInspection,
  confirmOrderPayment,
  confirmShipmentDelivery,
  createOrganization,
  createOrganizationInvitation,
  createProductWithUniqueSlug,
  createReview,
  createRfq,
  createShipment,
  deletePriceTier,
  removeProduct,
  deleteProductImage,
  dispatchShipment,
  generateCommercialDocument,
  getBuyerRfqs,
  getCategories,
  getCommercialDocumentUrl,
  getIdentity,
  getMessages,
  getNotifications,
  getOperationsAccess,
  getOrders,
  getPaymentAvailability,
  getPublishedProductBySlug,
  getOrCreateConversation,
  getOrganizationInvitations,
  getOrganizations,
  getProductImages,
  getProducts,
  getQuotesForRfq,
  getSellerQuotes,
  getSellerRfqs,
  getSupplierDirectory,
  getSupplierRatings,
  getTeamMembers,
  getVerificationCase,
  initiateOrderPayment,
  publishRfq,
  markNotificationRead,
  openDispute,
  removeTeamMember,
  reopenRejectedProduct,
  sendMessage,
  signOut,
  setOrderLineHsn,
  submitProductForReview,
  submitQuote,
  submitVerification,
  subscribeToMessages,
  transitionOrder,
  updateProductSale,
  uploadProductImages,
  PRODUCT_IMAGE_ACCEPT,
  PRODUCT_IMAGE_LIMIT,
  type Category,
  type CommercialDocument,
  type Notification,
  type Order,
  type Organization,
  type OrganizationInvitation,
  type Product,
  type ProductDetail,
  type ProductImage,
  type Quote,
  type Rfq,
  type SupplierRating as Rating,
  type TeamMember,
  type TeamRole,
  type TradeConversation,
  type TradeMessage,
  type VerificationCase,
} from "@/lib/marketplace";
import { SupplierRating } from "@/components/marketplace/SupplierRating";
import { FieldLabel } from "@/components/InfoTip";
import { supabase } from "@/integrations/supabase/client";
import { LISTING_STAGE_LABELS, listingStage, submissionBlockers, tierCoversMinimumOrder } from "@/lib/listing";
import { productImageSelectionProblems } from "@/lib/product-image-rules";
import { slugCandidate, slugify } from "@/lib/slug";
import { ProductThumb } from "@/components/ProductThumb";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceLayout, BusinessIdentity, AddBusinessButton } from "./WorkspaceLayout";
import { WorkspaceOverview } from "./WorkspaceOverview";

type View =
  "overview" | "rfqs" | "suppliers" | "orders" | "catalog" | "opportunities" | "quotes" | "team";
type Supplier = { id: string; display_name: string };
type FormValues = Record<string, FormDataEntryValue>;
const formValues = (event: FormEvent<HTMLFormElement>): FormValues =>
  Object.fromEntries(new FormData(event.currentTarget));
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed. Try again.";
// Survives the sign-in redirect so a quote request started on a product page is not lost.
const RFQ_PRODUCT_STORAGE_KEY = "feabulk:rfq-product";
function readPendingRfqProduct() {
  try {
    return window.sessionStorage.getItem(RFQ_PRODUCT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}
function storePendingRfqProduct(slug: string) {
  try {
    if (slug) window.sessionStorage.setItem(RFQ_PRODUCT_STORAGE_KEY, slug);
    else window.sessionStorage.removeItem(RFQ_PRODUCT_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private or embedded browsers; the prefill is optional.
  }
}
const input = "w-full border border-input bg-card px-3 py-2 text-foreground";
// Simplified model: teammates are "Member" with the same access as the owner.
const INVITABLE_TEAM_ROLES: TeamRole[] = ["administrator"];
const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  administrator: "Member",
  procurement_manager: "Procurement manager",
  purchase_approver: "Purchase approver",
  accountant: "Accountant",
  sales_manager: "Sales manager",
  sales_representative: "Sales representative",
  catalog_manager: "Catalog manager",
  inventory_manager: "Inventory manager",
  warehouse_operator: "Warehouse operator",
  viewer: "Viewer",
};
const teamRoleLabel = (role: TeamRole) => TEAM_ROLE_LABELS[role];

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type RazorpayFailure = { error?: { description?: string } };
type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", callback: (failure: RazorpayFailure) => void) => void;
};
type RazorpayConstructor = new (options: {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (result: RazorpaySuccess) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
}) => RazorpayInstance;
declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let razorpayScript: Promise<void> | null = null;
function loadRazorpayCheckout() {
  if (typeof window === "undefined")
    return Promise.reject(new Error("Payment checkout requires a browser."));
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScript) return razorpayScript;
  razorpayScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () =>
      window.Razorpay ? resolve() : reject(new Error("Payment checkout failed to load."));
    script.onerror = () => reject(new Error("Payment checkout failed to load."));
    document.head.appendChild(script);
  });
  return razorpayScript;
}

export function Workspace({ expected }: { expected?: "buyer" | "seller" }) {
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierRatings, setSupplierRatings] = useState<Map<string, Rating>>(new Map());
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedRfq, setSelectedRfq] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productImages, setProductImages] = useState<Map<string, ProductImage[]>>(new Map());
  const [editingProductId, setEditingProductId] = useState("");
  const [managingProductId, setManagingProductId] = useState("");
  // The new product's slug follows its name until the seller types a slug of their own.
  const [productSaleType, setProductSaleType] = useState<ProductSaleType>("regular");
  const [editSaleType, setEditSaleType] = useState<ProductSaleType>("regular");
  // Problems with the photos chosen in each form, keyed by "new" or the product ID.
  const [photoProblems, setPhotoProblems] = useState<Record<string, string[]>>({});
  // Photos of the products in this business's orders, for the order cards.
  const [orderProductImages, setOrderProductImages] = useState<Map<string, ProductImage[]>>(new Map());
  const [orderActionId, setOrderActionId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [conversation, setConversation] = useState<TradeConversation | null>(null);
  const [messages, setMessages] = useState<TradeMessage[]>([]);
  const messageListRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [verification, setVerification] = useState<VerificationCase | null>(null);
  const [view, setView] = useState<View>("overview");
  const [form, setForm] = useState<"organization" | "rfq" | "product" | "quote" | null>(null);
  const [quoteRfq, setQuoteRfq] = useState<Rfq | null>(null);
  const [pendingRfqProduct, setPendingRfqProduct] = useState("");
  const [rfqProduct, setRfqProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const organization = organizations.find((item) => item.id === organizationId);
  const buyer = organization?.kind === "buyer" || organization?.kind === "both";
  const seller = organization?.kind === "seller" || organization?.kind === "both";
  const currentRole = team.find((item) => item.user_id === userId)?.role;
  const hasRole = (...roles: TeamRole[]) => Boolean(currentRole && roles.includes(currentRole));
  const canManageOrganization = hasRole("owner", "administrator");
  const canManageRfqs = Boolean(buyer && hasRole("owner", "administrator", "procurement_manager"));
  const canApproveQuotes = Boolean(buyer && hasRole("owner", "administrator", "purchase_approver"));
  const canSubmitQuotes = Boolean(
    seller && hasRole("owner", "administrator", "sales_manager", "sales_representative"),
  );
  const canManageCatalog = Boolean(
    seller && hasRole("owner", "administrator", "sales_manager", "catalog_manager"),
  );
  const canAdjustInventory = Boolean(
    seller &&
    hasRole(
      "owner",
      "administrator",
      "sales_manager",
      "catalog_manager",
      "inventory_manager",
      "warehouse_operator",
    ),
  );

  const loadAccount = useCallback(async () => {
    const user = await getIdentity();
    if (!user) {
      setUserId(null);
      setLoading(false);
      return;
    }
    // Payment-provider availability is not needed to open the workspace.
    void getPaymentAvailability().then(setPaymentAvailable).catch(() => setPaymentAvailable(false));
    const [nextOrganizations, nextCategories, nextOps, nextNotifications] =
      await Promise.all([
        getOrganizations(),
        getCategories(),
        getOperationsAccess(user.id),
        getNotifications(),
      ]);
    setUserId(user.id);
    setOrganizations(nextOrganizations);
    setCategories(nextCategories);
    setOps(nextOps);
    setNotifications(nextNotifications);
    setOrganizationId((current) =>
      nextOrganizations.some((item) => item.id === current)
        ? current
        : (nextOrganizations[0]?.id ?? ""),
    );
    setLoading(false);
  }, []);
  useEffect(() => {
    void loadAccount().catch((err) => {
      setError(errorText(err));
      setLoading(false);
    });
  }, [loadAccount]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        window.setTimeout(() => {
          void loadAccount().catch((err) => {
            setError(errorText(err));
            setLoading(false);
          });
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

  // Send each person to their own screen: admins to /admin, buyers to /buyer, sellers to /seller.
  useEffect(() => {
    if (loading || !userId) return;
    if (ops) {
      void router.navigate({ to: "/admin", replace: true });
      return;
    }
    const kind = organization?.kind === "seller" ? "seller" : organization?.kind === "buyer" ? "buyer" : null;
    if (kind && kind !== expected) void router.navigate({ to: kind === "buyer" ? "/buyer" : "/seller", replace: true });
  }, [loading, userId, ops, organization?.kind, expected, router]);

  const loadData = useCallback(async () => {
    if (!organization) return;
    const [
      nextRfqs,
      nextOpportunities,
      nextSellerQuotes,
      nextProducts,
      nextOrders,
      nextVerification,
      nextTeam,
      nextInvitations,
      nextSuppliers,
    ] = await Promise.all([
      buyer ? getBuyerRfqs(organization.id) : Promise.resolve([]),
      seller ? getSellerRfqs() : Promise.resolve([]),
      seller ? getSellerQuotes(organization.id) : Promise.resolve([]),
      seller ? getProducts(organization.id) : Promise.resolve([]),
      getOrders(organization.id),
      getVerificationCase(organization.id),
      getTeamMembers(organization.id),
      getOrganizationInvitations(organization.id),
      buyer ? getSupplierDirectory() : Promise.resolve([]),
    ]);
    setRfqs(nextRfqs);
    setOpportunities(nextOpportunities);
    setSellerQuotes(nextSellerQuotes);
    setProducts(nextProducts);
    // Images must not delay orders, team permissions, or verification status.
    void getProductImages(nextProducts.map(item => item.id), { strict: true })
      .then(setProductImages)
      .catch((err) => setError(`Product photos could not be loaded: ${errorText(err)}`));
    setOrders(nextOrders);
    const orderedProductIds = [
      ...new Set(nextOrders.flatMap((order) => order.order_lines.map((line) => line.product_id ?? "")).filter(Boolean)),
    ];
    void getProductImages(orderedProductIds).then(setOrderProductImages).catch(() => undefined);
    setVerification(nextVerification);
    setTeam(nextTeam);
    setInvitations(nextInvitations);
    setSuppliers(nextSuppliers);
    // Ratings are supporting detail, so a failure here must not block the workspace.
    void getSupplierRatings(nextSuppliers.map((item) => item.id))
      .then(setSupplierRatings)
      .catch(() => undefined);
  }, [organization, buyer, seller]);
  useEffect(() => {
    if (!organization) return;
    setView("overview");
    setConversation(null);
    setMessages([]);
    void loadData().catch((err) => setError(errorText(err)));
  }, [loadData, organization]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("product");
    if (requested) {
      storePendingRfqProduct(requested);
      window.history.replaceState(null, "", window.location.pathname);
    }
    setPendingRfqProduct(requested ?? readPendingRfqProduct());
  }, []);
  useEffect(() => {
    if (!pendingRfqProduct || !organization || team.length === 0) return;
    if (!canManageRfqs) {
      setError(
        "Requesting a quote needs a buyer business where you are an owner, administrator or procurement manager.",
      );
      return;
    }
    let active = true;
    void getPublishedProductBySlug(pendingRfqProduct)
      .then((item) => {
        if (!active) return;
        storePendingRfqProduct("");
        setPendingRfqProduct("");
        if (!item) {
          setError("That product is no longer listed, so the quote request was not prefilled.");
          return;
        }
        setError("");
        setRfqProduct(item);
        setView("rfqs");
        setForm("rfq");
      })
      .catch((err) => {
        if (active) setError(errorText(err));
      });
    return () => {
      active = false;
    };
  }, [pendingRfqProduct, organization, team, canManageRfqs]);

  useEffect(() => {
    if (form === "product") return;
    setProductSlug("");
    setProductSlugEdited(false);
    setProductSaleType("regular");
  }, [form]);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await loadData();
      if (selectedRfq) setQuotes(await getQuotesForRfq(selectedRfq));
      setNotifications(await getNotifications());
      setNotice(success);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function openQuotes(id: string) {
    setSelectedRfq(id);
    setError("");
    try {
      setQuotes(await getQuotesForRfq(id));
    } catch (err) {
      setError(errorText(err));
    }
  }
  async function openConversation(context: "quote" | "order", referenceId: string) {
    setBusy(true);
    setError("");
    try {
      const thread = await getOrCreateConversation(context, referenceId);
      setConversation(thread);
      setMessages(await getMessages(thread.id));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  const addMessage = useCallback((message: TradeMessage) => {
    setMessages((current) =>
      current.some((item) => item.id === message.id) ? current : [...current, message],
    );
  }, []);
  const conversationId = conversation?.id;
  useEffect(() => {
    if (!conversationId) return;
    return subscribeToMessages(conversationId, addMessage, () => {
      void getMessages(conversationId)
        .then(setMessages)
        .catch((err) => setError(errorText(err)));
    });
  }, [conversationId, addMessage]);
  useEffect(() => {
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);
  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!conversation || !organization) return;
    const formElement = event.currentTarget;
    const body = String(formValues(event)["body"] ?? "").trim();
    if (!body) return;
    // Chat skips run(): reloading the whole workspace on every message would stall the thread.
    setBusy(true);
    setError("");
    void sendMessage(conversation.id, organization.id, body)
      .then((sent) => {
        addMessage(sent);
        formElement.reset();
      })
      .catch((err) => setError(errorText(err)))
      .finally(() => setBusy(false));
  }
  function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    const f = formValues(event);
    void run(
      () =>
        createOrganizationInvitation(
          organization.id,
          String(f["email"]),
          String(f["role"]) as TeamRole,
        ),
      "Invitation created. Share the code securely with the invited person.",
    );
  }
  function acceptInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = formValues(event);
    setBusy(true);
    setError("");
    setNotice("");
    void acceptOrganizationInvitation(String(f["token"]))
      .then(async () => {
        await loadAccount();
        setNotice("Invitation accepted. Select the organization above.");
      })
      .catch((err) => setError(errorText(err)))
      .finally(() => setBusy(false));
  }
  function submitShipment(event: FormEvent<HTMLFormElement>, order: Order) {
    event.preventDefault();
    const f = formValues(event);
    const lines = order.order_lines
      .map((line) => ({
        order_line_id: line.id,
        quantity: Number(f[`quantity-${line.id}`] ?? 0),
      }))
      .filter((line) => line.quantity > 0);
    void run(async () => {
      await createShipment(order.id, {
        shippingMode: String(f["shippingMode"]),
        freightType: String(f["freightType"]),
        carrier: String(f["carrier"]),
        trackingNumber: String(f["trackingNumber"]),
        estimatedDeliveryAt: new Date(String(f["estimatedDelivery"])).toISOString(),
        lines,
      });
      setOrderActionId("");
    }, "Shipment created. Dispatch it after handoff to the carrier.");
  }
  function submitDispute(event: FormEvent<HTMLFormElement>, order: Order) {
    event.preventDefault();
    if (!organization) return;
    const f = formValues(event);
    void run(async () => {
      await openDispute(order.id, organization.id, String(f["type"]), String(f["description"]));
      setOrderActionId("");
    }, "Dispute opened and the order is on hold.");
  }
  function submitReview(event: FormEvent<HTMLFormElement>, order: Order) {
    event.preventDefault();
    const f = formValues(event);
    void run(async () => {
      await createReview(order.id, Number(f["rating"]), String(f["body"]));
      setOrderActionId("");
    }, "Review published.");
  }
  function submitTaxDetails(event: FormEvent<HTMLFormElement>, order: Order) {
    event.preventDefault();
    const f = formValues(event);
    void run(async () => {
      for (const line of order.order_lines)
        await setOrderLineHsn(line.id, String(f[`hsn-${line.id}`]));
      setOrderActionId("");
    }, "Order tax details saved.");
  }
  function generateDocument(order: Order, type: CommercialDocument["type"]) {
    if (!organization) return;
    void run(
      async () => {
        const result = await generateCommercialDocument(order.id, organization.id, type);
        const link = document.createElement("a");
        link.href = result.signed_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
      },
      `${type.replaceAll("_", " ")} generated.`,
    );
  }
  function downloadDocument(path: string) {
    void getCommercialDocumentUrl(path)
      .then((url) => {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
      })
      .catch((err) => setError(errorText(err)));
  }
  async function payOrder(order: Order) {
    const checkout = await initiateOrderPayment(order.id, crypto.randomUUID());
    await loadRazorpayCheckout();
    const Razorpay = window.Razorpay;
    if (!Razorpay) throw new Error("Payment checkout is unavailable.");
    await new Promise<void>((resolve, reject) => {
      let completed = false;
      const instance = new Razorpay({
        key: checkout.key_id,
        amount: checkout.amount_paise,
        currency: checkout.currency,
        name: "FeaBulk",
        description: `Payment for ${order.order_number}`,
        order_id: checkout.provider_order_id,
        theme: { color: "#F87908" },
        handler: (result) => {
          void confirmOrderPayment({
            providerOrderId: result.razorpay_order_id,
            providerPaymentId: result.razorpay_payment_id,
            signature: result.razorpay_signature,
          })
            .then(() => {
              completed = true;
              resolve();
            })
            .catch(reject);
        },
        modal: {
          ondismiss: () => {
            if (!completed) reject(new Error("Payment window closed before completion."));
          },
        },
      });
      instance.on("payment.failed", (failure) =>
        reject(new Error(failure.error?.description ?? "Payment failed. You can retry safely.")),
      );
      instance.open();
    });
  }
  function submitOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = formValues(event);
    void run(async () => {
      await createOrganization({
        legalName: String(f["legalName"]),
        displayName: String(f["displayName"]),
        kind: String(f["kind"]) as "buyer" | "seller",
        gstin: String(f["gstin"]),
        businessType: String(f["businessType"]),
        address: {
          address_line: String(f["address"]),
          city: String(f["city"]),
          state: String(f["state"]),
          pin_code: String(f["pin"]),
          country: "India",
        },
      });
      await loadAccount();
      setForm(null);
    }, "Business created. Verification is pending.");
  }
  function submitRfq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    const f = formValues(event);
    void run(async () => {
      await createRfq(organization.id, {
        title: String(f["title"]),
        category_id: String(f["category"]),
        specifications: { description: String(f["specifications"]) },
        required_quantity: Number(f["quantity"]),
        unit_of_measure: String(f["unit"]),
        delivery_address: { address_line: String(f["address"]), pin_code: String(f["pin"]) },
        delivery_pin_code: String(f["pin"]),
        shipping_responsibility: String(f["shipping"]),
        quote_deadline: new Date(String(f["deadline"])).toISOString(),
        visibility: "verified_sellers",
        ...(rfqProduct ? { product_id: rfqProduct.id } : {}),
      });
      setRfqProduct(null);
      setForm(null);
    }, "RFQ draft saved.");
  }
  // Photos chosen in a form's "images" input. An empty file input still submits one nameless entry.
  const chosenPhotos = (formElement: HTMLFormElement) =>
    new FormData(formElement)
      .getAll("images")
      .filter((value): value is File => value instanceof File && value.name !== "");
  const photoCount = (count: number) => `${count} photo${count === 1 ? "" : "s"}`;
  // Saving the product and uploading its photos are separate steps, so a failed photo
  // never loses the product; the seller is told exactly which file failed and why.
  function reportPhotoFailures(failures: string[]) {
    if (failures.length === 0) return;
    setError(
      `The product was saved, but ${photoCount(failures.length)} could not be uploaded. ${failures.join(" ")} You can add ${failures.length === 1 ? "it" : "them"} again from the product below.`,
    );
  }
  function photoPicker(formKey: string, existingCount: number) {
    const problems = photoProblems[formKey] ?? [];
    return (
      <div className="grid gap-1 sm:col-span-2">
        <ProductPhotoPicker
          label={existingCount > 0 ? "Add more photos" : "Product photos"}
          existingCount={existingCount}
          onProblems={(next) => setPhotoProblems((current) => ({ ...current, [formKey]: next }))}
        />
        {problems.length > 0 && (
          <ul role="alert" className="list-disc pl-5 text-sm text-destructive">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    const formElement = event.currentTarget;
    const f = formValues(event);
    const photos = chosenPhotos(formElement);
    const problems = productImageSelectionProblems(photos, 0);
    if (problems.length > 0) {
      setError(`Please fix the photos before saving. ${problems.join(" ")}`);
      return;
    }
    const requestedSlug = slugCandidate(String(f["name"]), 1);
    let savedSlug = requestedSlug;
    let saved = false;
    let photoResult = { uploaded: 0, failures: [] as string[] };
    void run(async () => {
      const created = await createProductWithUniqueSlug(organization.id, {
        name: String(f["name"]),
        slug: requestedSlug,
        category_id: String(f["category"]),
        description: String(f["description"]),
        seller_sku: `SKU-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        unit_of_measure: String(f["unit"]),
        hsn_code: String(f["hsn"]),
        minimum_order_quantity: productSaleType === "auction" ? Number(f["auction_quantity"]) : Number(f["moq"]),
        available_quantity: Number(f["stock"]),
        gst_rate: Number(f["gst"]),
        lead_time_days: Number(f["lead"]),
      }, {
        type: productSaleType,
        settings: productSaleType === "regular" ? { unit_price: Number(f["unit_price"]) } : {
          lot_type: String(f["lot_type"]), quantity: Number(f["auction_quantity"]),
          start_price: Number(f["start_price"]), bid_step: Number(f["bid_step"]),
          token_amount: Number(f["token_amount"]), duration_days: Number(f["duration_days"]),
          ...(f["starts_at"] ? { starts_at: new Date(String(f["starts_at"])).toISOString() } : {}),
        },
      });
      saved = true;
      savedSlug = created.slug;
      if (photos.length > 0) photoResult = await uploadProductImages(created.id, photos);
      setPhotoProblems((current) => ({ ...current, new: [] }));
      setForm(null);
    }, "Product draft saved.").then(() => {
      if (!saved) return;
      const address =
        savedSlug !== requestedSlug
          ? ` Another product already uses "${requestedSlug}", so this one's web address is /products/${savedSlug}.`
          : "";
      const added = photoResult.uploaded > 0 ? ` ${photoCount(photoResult.uploaded)} added.` : "";
      setNotice(
        `${productSaleType === "auction" ? "Auction" : "Regular-sale"} product is live in the marketplace.${added}${address}`,
      );
      reportPhotoFailures(photoResult.failures);
    });
  }
  function submitEditProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProductId) return;
    const productId = editingProductId;
    const f = formValues(event);
    const photos = chosenPhotos(event.currentTarget);
    const problems = productImageSelectionProblems(photos, (productImages.get(productId) ?? []).length);
    if (problems.length > 0) {
      setError(`Please fix the photos before saving. ${problems.join(" ")}`);
      return;
    }
    let saved = false;
    let photoResult = { uploaded: 0, failures: [] as string[] };
    void run(async () => {
      await updateProductSale(productId, {
        name: String(f["name"]),
        slug: String(f["slug"]),
        category_id: String(f["category"]),
        seller_sku: String(f["sku"]),
        description: String(f["description"]),
        hsn_code: String(f["hsn"]),
        unit_of_measure: String(f["unit"]),
        minimum_order_quantity: Number(f[editSaleType === "auction" ? "auction_quantity" : "moq"]),
        gst_rate: Number(f["gst"]),
        lead_time_days: Number(f["lead"]),
      }, editSaleType, editSaleType === "regular" ? { unit_price: Number(f["unit_price"]) } : {
        lot_type: String(f["lot_type"]), quantity: Number(f["auction_quantity"]),
        start_price: Number(f["start_price"]), bid_step: Number(f["bid_step"]),
        token_amount: Number(f["token_amount"]), duration_days: Number(f["duration_days"]),
        ...(f["starts_at"] ? { starts_at: new Date(String(f["starts_at"])).toISOString() } : {}),
      });
      saved = true;
      if (photos.length > 0) photoResult = await uploadProductImages(productId, photos);
      setPhotoProblems((current) => ({ ...current, [productId]: [] }));
      setEditingProductId("");
    }, "Product draft updated.").then(() => {
      if (!saved) return;
      if (photoResult.uploaded > 0)
        setNotice(`Product draft updated. ${photoCount(photoResult.uploaded)} added.`);
      reportPhotoFailures(photoResult.failures);
    });
  }
  function submitSellerQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !quoteRfq) return;
    const f = formValues(event);
    void run(async () => {
      await submitQuote(quoteRfq.id, organization.id, {
        unit_price: Number(f["price"]),
        quantity: Number(f["quantity"]),
        gst_rate: Number(f["gst"]),
        shipping_charge: Number(f["freight"]),
        lead_time_days: Number(f["lead"]),
        validity_ends_at: new Date(String(f["validUntil"])).toISOString(),
        seller_notes: String(f["notes"]),
      });
      setForm(null);
      setQuoteRfq(null);
    }, "Quote submitted.");
  }

  return (
    <WorkspaceLayout
      role={expected ?? (seller ? "seller" : "buyer")}
      view={view} setView={setView} signedIn={Boolean(userId)}
      hasOrganization={Boolean(organization)} organizationName={organization?.display_name}
      unread={notifications.filter(item => !item.read_at).length} showNotifications={showNotifications}
      onNotifications={() => setShowNotifications(value => !value)}
      onSignOut={() => void signOut().then(() => router.navigate({ to: "/auth" })).catch(err => setError(errorText(err)))}
    >
        {loading ? (
          <p>Loading account…</p>
        ) : !userId ? (
          <section className="border bg-card p-6">
            <h1 className="text-2xl font-black">
              {error ? "We could not load your account" : "Sign in to continue"}
            </h1>
            {error && (
              <p
                role="alert"
                className="mt-3 border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <a
              className="mt-4 inline-block bg-workspace-action px-4 py-2 font-bold text-workspace-action-foreground"
              href="/auth"
            >
              {error ? "Return to sign in" : "Sign in"}
            </a>
          </section>
        ) : (
          <>
            <BusinessIdentity name={organization?.display_name ?? "Set up your business"} status={organization?.status}>
              {organizations.length > 1 && <select aria-label="Organization" className={input} value={organizationId} onChange={e => setOrganizationId(e.target.value)}>{organizations.map(item => <option key={item.id} value={item.id}>{item.display_name} ({item.kind})</option>)}</select>}
              <AddBusinessButton onClick={() => setForm(form === "organization" ? null : "organization")} />
            </BusinessIdentity>
            {error && (
              <p
                role="alert"
                className="mt-5 border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="mt-5 border border-workspace-success/30 bg-workspace-success-soft p-3 text-sm text-workspace-success"
              >
                {notice}
              </p>
            )}
            {showNotifications && (
              <section className="mt-5 border bg-card p-5">
                <h2 className="font-black">Notifications</h2>
                {notifications.length === 0 ? (
                  <p className="mt-2 text-sm">No notifications yet.</p>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {notifications.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm"
                      >
                        <span>
                          {item.template_key.replaceAll(".", " ").replaceAll("_", " ")} ·{" "}
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                        {!item.read_at && (
                          <Button variant="outline"
                            className="button-secondary"
                            onClick={() =>
                              void markNotificationRead(item.id)
                                .then(async () => setNotifications(await getNotifications()))
                                .catch((err) => setError(errorText(err)))
                            }
                          >
                            Mark read
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
            <details className="my-5 border-b pb-4">
              <summary className="cursor-pointer text-sm font-bold">
                Join a team with an invitation code
              </summary>
              <form onSubmit={acceptInvitation} className="mt-3 flex flex-wrap gap-2">
                <input
                  aria-label="Invitation code"
                  name="token"
                  required
                  minLength={36}
                  maxLength={36}
                  className="min-w-64 flex-1 border border-input p-2"
                  placeholder="Paste the invitation code"
                />
                <Button variant="outline" disabled={busy} className="button" type="submit">
                  Join team
                </Button>
              </form>
            </details>
            {(form === "organization" || organizations.length === 0) && (
              <section className="mt-6 border bg-card p-6">
                <h2 className="text-xl font-black">Create a business workspace</h2>
                <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submitOrganization}>
                  <Field
                    label="Business role"
                    hint="Choose Buyer if this business purchases goods, or Seller if it lists products for sale."
                  >
                    <select name="kind" className={input}>
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller</option>
                    </select>
                  </Field>
                  <Text
                    name="legalName" label="Legal business name" minLength={2}
                    hint="The registered name exactly as it appears on your GST or incorporation certificate."
                  />
                  <Text
                    name="displayName" label="Trading name" minLength={2}
                    hint="The name customers know you by. It is shown on your listings and orders."
                  />
                  <Text
                    name="businessType" label="Business type"
                    hint="Your legal structure, for example Proprietorship, Partnership, LLP or Private limited company."
                  />
                  <Text
                    name="gstin"
                    label="GSTIN (optional)"
                    hint="Your 15-character GST number, for example 27AAAAA0000A1Z5. Leave blank if you are not GST registered."
                    required={false}
                    pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][A-Za-z0-9]Z[A-Za-z0-9]"
                  />
                  <Text
                    name="address" label="Registered address"
                    hint="Street address of your registered office, as shown on your registration documents."
                  />
                  <Text
                    name="city" label="City"
                    hint="City or town of the registered office."
                  />
                  <Text
                    name="state" label="State"
                    hint="State of the registered office, for example Telangana."
                  />
                  <Text
                    name="pin" label="PIN code" pattern="[0-9]{6}"
                    hint="6-digit postal code of the registered office."
                  />
                  <Action busy={busy}>Create business</Action>
                </form>
              </section>
            )}
            {organization && (
              <>
                {organization.status !== "verified" && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border border-workspace-warning/30 bg-workspace-warning-soft p-4 text-sm">
                    <p>
                      Business verification: {verification?.status ?? "pending"}. RFQ publishing and
                      quote submission require approval.
                    </p>
                    {canManageOrganization &&
                      verification &&
                      ["draft", "rejected", "resubmission_required"].includes(
                        verification.status,
                      ) && (
                        <Button variant="outline"
                          disabled={busy}
                          className="button"
                          onClick={() =>
                            void run(
                              () => submitVerification(organization.id),
                              "Verification submitted for review.",
                            )
                          }
                        >
                          Submit for verification
                        </Button>
                      )}
                  </div>
                )}
                {view === "overview" && (
                  <WorkspaceOverview
                    buyer={Boolean(buyer)}
                    rfqs={rfqs}
                    opportunities={opportunities}
                    quotes={sellerQuotes}
                    products={products}
                    productImages={productImages}
                    canCreate={buyer ? canManageRfqs : canManageCatalog}
                    orders={orders}
                    suppliers={suppliers}
                    setView={setView}
                    openRfq={() => {
                      setView("rfqs");
                      setForm("rfq");
                    }}
                    openProduct={() => {
                      setView("catalog");
                      setForm("product");
                    }}
                  />
                )}
                {view === "suppliers" && buyer && (
                  <section className="mt-6">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-black">
                          Verified supplier network ({suppliers.length})
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Discover approved sellers and buy their products directly.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <a className="button-secondary" href="/marketplace">
                          Browse catalog
                        </a>
                      </div>
                    </div>
                    {suppliers.length === 0 ? (
                      <Empty>No verified suppliers are available yet.</Empty>
                    ) : (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {suppliers.map((item) => (
                          <Card key={item.id}>
                            <p className="text-xs font-black uppercase tracking-wider text-workspace-warning">
                              Verified supplier
                            </p>
                            <h3 className="mt-2 text-lg font-extrabold text-workspace-brand">
                              {item.display_name}
                            </h3>
                            <p className="mt-1">
                              <SupplierRating rating={supplierRatings.get(item.id)} />
                            </p>
                            <a
                              className="mt-4 inline-block text-sm font-bold text-workspace-warning"
                              href={`/suppliers/${item.id}`}
                            >
                              View approved products →
                            </a>
                          </Card>
                        ))}
                      </div>
                    )}
                  </section>
                )}
                {view === "quotes" && seller && (
                  <section className="mt-6">
                    <div>
                      <h2 className="text-xl font-black">
                        Submitted quotes ({sellerQuotes.length})
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Track every commercial response and continue negotiation with the buyer.
                      </p>
                    </div>
                    {sellerQuotes.length === 0 ? (
                      <Empty>No quotes submitted yet.</Empty>
                    ) : (
                      <div className="mt-4 grid gap-3">
                        {sellerQuotes.map((quote) => {
                          const version = quote.quote_versions.find(
                            (item) => item.version === quote.current_version,
                          );
                          return (
                            <Card key={quote.id}>
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                    {quote.status.replaceAll("_", " ")} · version{" "}
                                    {quote.current_version}
                                  </p>
                                  <h3 className="mt-1 font-extrabold">
                                    RFQ{" "}
                                    {opportunities.find((item) => item.id === quote.rfq_id)
                                      ?.title ?? quote.rfq_id.slice(0, 8)}
                                  </h3>
                                  {version && (
                                    <p className="mt-2 text-sm text-muted-foreground">
                                      ₹{Number(version.unit_price).toLocaleString("en-IN")} ×{" "}
                                      {version.quantity} · {version.lead_time_days} day lead time ·
                                      valid until{" "}
                                      {new Date(version.validity_ends_at).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                <Button variant="outline"
                                  className="button-secondary"
                                  onClick={() => void openConversation("quote", quote.id)}
                                >
                                  Message buyer
                                </Button>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}
                {view === "rfqs" && buyer && (
                  <section className="mt-6">
                    <Heading
                      title={"Requests for quotation (" + rfqs.length + ")"}
                      action={canManageRfqs ? "Create RFQ" : undefined}
                      onClick={
                        canManageRfqs ? () => setForm(form === "rfq" ? null : "rfq") : undefined
                      }
                    />
                    {canManageRfqs && form === "rfq" && (
                      <form
                        key={rfqProduct?.id ?? "blank"}
                        className="mt-4 grid gap-3 border bg-card p-6 sm:grid-cols-2"
                        onSubmit={submitRfq}
                      >
                        {rfqProduct && (
                          <div className="flex flex-wrap items-center justify-between gap-3 border border-input bg-workspace-info-soft p-3 text-sm sm:col-span-2">
                            <p>
                              Requesting a quote for{" "}
                              <a
                                className="font-bold underline"
                                href={`/products/${rfqProduct.slug}`}
                              >
                                {rfqProduct.name}
                              </a>{" "}
                              from {rfqProduct.supplier_name}. Minimum order{" "}
                              {rfqProduct.minimum_order_quantity} {rfqProduct.unit_of_measure}.
                            </p>
                            <Button variant="outline"
                              type="button"
                              className="button-secondary"
                              onClick={() => setRfqProduct(null)}
                            >
                              Remove product
                            </Button>
                          </div>
                        )}
                        <Text
                          name="title"
                          label="What do you need?"
                          hint="A short title for your requirement, for example 5-ply corrugated cartons. At least 8 characters."
                          minLength={8}
                          maxLength={180}
                          defaultValue={rfqProduct ? rfqProduct.name.slice(0, 180) : ""}
                        />
                        <Field
                          label="Category"
                          hint="The category that best matches what you want to buy. Sellers in this category will see your request."
                        >
                          <select
                            name="category"
                            required
                            className={input}
                            defaultValue={rfqProduct?.category_id ?? ""}
                          >
                            <option value="">Select a category</option>
                            {categories.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          label="Specifications"
                          hint="Describe size, material, grade, packaging and any standards the product must meet."
                        >
                          <textarea name="specifications" required className={input} />
                        </Field>
                        <Text
                          name="quantity"
                          label="Quantity"
                          hint="How many units you want to buy, counted in the unit you enter next."
                          type="number"
                          min={rfqProduct?.minimum_order_quantity ?? 1}
                          defaultValue={rfqProduct?.minimum_order_quantity ?? ""}
                        />
                        <Text
                          name="unit"
                          label="Unit"
                          hint="The unit you count in, for example pieces, cartons, kg or rolls."
                          defaultValue={rfqProduct?.unit_of_measure ?? "units"}
                        />
                        <Text
                          name="address" label="Delivery address"
                          hint="Full address where the goods should be delivered."
                        />
                        <Text
                          name="pin" label="Delivery PIN" pattern="[0-9]{6}"
                          hint="6-digit postal code of the delivery address. Sellers use it to work out freight."
                        />
                        <Text
                          name="deadline" label="Quote deadline" type="datetime-local"
                          hint="The last date and time sellers can send a quote. It must be in the future."
                        />
                        <Field
                          label="Shipping"
                          hint="Who arranges transport: the seller, you, or to be agreed during negotiation."
                        >
                          <select name="shipping" className={input}>
                            <option value="seller">Seller arranged</option>
                            <option value="buyer">Buyer arranged</option>
                            <option value="negotiable">Negotiable</option>
                          </select>
                        </Field>
                        <Action busy={busy}>Save RFQ draft</Action>
                      </form>
                    )}
                    {rfqs.length === 0 ? (
                      <Empty>No RFQs yet.</Empty>
                    ) : (
                      <div className="mt-4 grid gap-3">
                        {rfqs.map((item) => (
                          <Card key={item.id}>
                            <div className="flex flex-wrap justify-between gap-3">
                              <div>
                                <h3 className="font-extrabold">{item.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {item.required_quantity} {item.unit_of_measure} · PIN{" "}
                                  {item.delivery_pin_code} · {item.status}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                {canManageRfqs && item.status === "draft" && (
                                  <Button variant="outline"
                                    disabled={busy}
                                    className="button"
                                    onClick={() =>
                                      void run(() => publishRfq(item.id), "RFQ published.")
                                    }
                                  >
                                    Publish
                                  </Button>
                                )}
                                <Button variant="outline"
                                  className="button-secondary"
                                  onClick={() => void openQuotes(item.id)}
                                >
                                  Compare quotes
                                </Button>
                              </div>
                            </div>
                            {selectedRfq === item.id && (
                              <div className="mt-4 border-t pt-4">
                                {quotes.length === 0 ? (
                                  <p className="text-sm">No quotes received.</p>
                                ) : (
                                  quotes.map((quote) => {
                                    const version = quote.quote_versions.find(
                                      (v) => v.version === quote.current_version,
                                    );
                                    const subtotal = version
                                      ? Number(version.unit_price) * Number(version.quantity)
                                      : 0;
                                    const landedTotal = version
                                      ? subtotal +
                                        (subtotal * Number(version.gst_rate)) / 100 +
                                        Number(version.shipping_charge) +
                                        Number(version.additional_charges) -
                                        Number(version.discount_amount)
                                      : 0;
                                    const supplierName =
                                      suppliers.find(
                                        (supplier) => supplier.id === quote.seller_organization_id,
                                      )?.display_name ??
                                      `Supplier ${quote.seller_organization_id.slice(0, 8)}`;
                                    return (
                                      <div
                                        key={quote.id}
                                        className="mt-3 grid gap-3 border bg-workspace-canvas p-4 text-sm lg:grid-cols-[1.2fr_1fr_auto] lg:items-center"
                                      >
                                        <div>
                                          <p className="font-extrabold text-workspace-brand">
                                            {supplierName}
                                          </p>
                                          <p className="mt-1 text-xs font-bold uppercase text-muted-foreground">
                                            Version {quote.current_version} ·{" "}
                                            {quote.status.replaceAll("_", " ")}
                                          </p>
                                        </div>
                                        {version ? (
                                          <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs">
                                            <span>Unit price</span>
                                            <strong>
                                              ₹{Number(version.unit_price).toLocaleString("en-IN")}
                                            </strong>
                                            <span>Quantity</span>
                                            <strong>{version.quantity}</strong>
                                            <span>GST</span>
                                            <strong>{version.gst_rate}%</strong>
                                            <span>Freight</span>
                                            <strong>
                                              ₹
                                              {Number(version.shipping_charge).toLocaleString(
                                                "en-IN",
                                              )}
                                            </strong>
                                            <span>Lead time</span>
                                            <strong>{version.lead_time_days} days</strong>
                                            <span>Landed total</span>
                                            <strong>
                                              ₹
                                              {landedTotal.toLocaleString("en-IN", {
                                                maximumFractionDigits: 2,
                                              })}
                                            </strong>
                                          </div>
                                        ) : (
                                          <span>Terms unavailable</span>
                                        )}
                                        <div className="flex flex-wrap gap-2 lg:justify-end">
                                          {canApproveQuotes &&
                                            ["submitted", "revised"].includes(quote.status) && (
                                              <Button variant="outline"
                                                disabled={busy}
                                                className="button"
                                                onClick={() =>
                                                  void run(
                                                    () => acceptQuote(quote.id),
                                                    "Quote accepted; order created.",
                                                  )
                                                }
                                              >
                                                Accept quote
                                              </Button>
                                            )}
                                          <Button variant="outline"
                                            className="button-secondary"
                                            onClick={() => void openConversation("quote", quote.id)}
                                          >
                                            Message seller
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    )}
                  </section>
                )}
                {view === "opportunities" && seller && (
                  <section className="mt-6">
                    <h2 className="text-xl font-black">Open RFQs ({opportunities.length})</h2>
                    {opportunities.length === 0 ? (
                      <Empty>No open RFQs yet.</Empty>
                    ) : (
                      <div className="mt-4 grid gap-3">
                        {opportunities.map((item) => (
                          <Card key={item.id}>
                            <div className="flex flex-wrap justify-between gap-3">
                              <div>
                                <h3 className="font-extrabold">{item.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {item.required_quantity} {item.unit_of_measure} · PIN{" "}
                                  {item.delivery_pin_code} · closes{" "}
                                  {item.quote_deadline
                                    ? new Date(item.quote_deadline).toLocaleString()
                                    : "unspecified"}
                                </p>
                              </div>
                              {canSubmitQuotes && (
                                <Button variant="outline"
                                  className="button"
                                  onClick={() => {
                                    setQuoteRfq(item);
                                    setForm("quote");
                                  }}
                                >
                                  Prepare quote
                                </Button>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                    {canSubmitQuotes && form === "quote" && quoteRfq && (
                      <form
                        className="mt-4 grid gap-3 border bg-card p-6 sm:grid-cols-2"
                        onSubmit={submitSellerQuote}
                      >
                        <h3 className="text-lg font-bold sm:col-span-2">Quote: {quoteRfq.title}</h3>
                        <Text
                          name="price"
                          label="Unit price (INR)"
                          hint="Your price for one unit in rupees, before GST and freight."
                          type="number"
                          min={0.01}
                          step="0.01"
                        />
                        <Text
                          name="quantity"
                          label="Quantity"
                          hint="How many units you can supply at this price."
                          type="number"
                          min={1}
                          defaultValue={quoteRfq.required_quantity}
                        />
                        <Text
                          name="gst"
                          label="GST rate (%)"
                          hint="The GST percentage that applies to this product, for example 5, 12 or 18."
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                        />
                        <Text
                          name="freight"
                          label="Freight (INR)"
                          hint="Total delivery charge in rupees for this order. Enter 0 if delivery is included in the price."
                          type="number"
                          min={0}
                          defaultValue={0}
                          step="0.01"
                        />
                        <Text
                          name="lead" label="Lead time (days)" type="number" min={0}
                          hint="Days you need from order confirmation until the goods are dispatched."
                        />
                        <Text
                          name="validUntil" label="Valid until" type="datetime-local"
                          hint="The date and time this quote expires. The buyer must accept it before then."
                        />
                        <Field
                          label="Notes"
                          hint="Anything the buyer should know, such as brand, packing or payment terms. Optional."
                        >
                          <textarea name="notes" className={input} />
                        </Field>
                        <Action busy={busy}>Submit quote</Action>
                      </form>
                    )}
                    {sellerQuotes.length > 0 && (
                      <div className="mt-7">
                        <h3 className="text-lg font-black">
                          Your submitted quotes ({sellerQuotes.length})
                        </h3>
                        <div className="mt-3 grid gap-2">
                          {sellerQuotes.map((quote) => (
                            <Card key={quote.id}>
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <span className="text-sm">
                                  RFQ{" "}
                                  {opportunities.find((item) => item.id === quote.rfq_id)?.title ??
                                    quote.rfq_id.slice(0, 8)}{" "}
                                  · version {quote.current_version} · {quote.status}
                                </span>
                                <Button variant="outline"
                                  className="button-secondary"
                                  onClick={() => void openConversation("quote", quote.id)}
                                >
                                  Message buyer
                                </Button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}
                {view === "catalog" && seller && (
                  <section className="mt-6">
                    <Heading
                      title={"Catalog (" + products.length + ")"}
                      action={canManageCatalog ? "Add product" : undefined}
                      onClick={
                        canManageCatalog
                          ? () => setForm(form === "product" ? null : "product")
                          : undefined
                      }
                    />
                    {canManageCatalog && form === "product" && (
                      <form
                        className="mt-4 grid gap-3 border bg-card p-6 sm:grid-cols-2"
                        onSubmit={submitProduct}
                      >
                        <ProductSaleFields saleType={productSaleType} onSaleTypeChange={setProductSaleType} />
                        <Text
                          name="name"
                          label="Product name"
                          hint="The name buyers will see, for example Stainless steel hex bolts, M8 x 30 mm. At least 3 characters."
                          minLength={3}
                        />
                        <Field
                          label="Category"
                          hint="The category buyers will browse to find this product."
                        >
                          <select name="category" required className={input}>
                            <option value="">Select a category</option>
                            {categories.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Text
                          name="sku" label="Seller SKU"
                          hint="Your own stock code for this product. It must be unique within your catalog."
                        />
                        <Text
                          name="hsn" label="HSN code" pattern="[0-9]{4,8}"
                          hint="The 4 to 8 digit HSN tax code for this product. It is printed on GST invoices."
                        />
                        <Field
                          label="Description (20+ characters)"
                          hint="Describe the product: material, size, grade, packing and typical use. At least 20 characters."
                        >
                          <textarea name="description" required minLength={20} className={input} />
                        </Field>
                        <Text
                          name="unit" label="Unit" defaultValue="units"
                          hint="The unit you sell in, for example pieces, cartons, kg or rolls."
                        />
                        <Text
                          name="stock" label="Available quantity" type="number" min={0}
                          hint="How many units you have in stock and ready to sell right now."
                        />
                        <Text
                          name="gst"
                          label="GST rate (%)"
                          hint="The GST percentage that applies to this product, for example 5, 12 or 18."
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                        />
                        <Text
                          name="lead" label="Lead time (days)" type="number" min={0}
                          hint="Days you need from order confirmation until the goods are dispatched."
                        />
                        {photoPicker("new", 0)}
                        <Action busy={busy}>Save product draft</Action>
                      </form>
                    )}
                    {products.length === 0 ? (
                      <Empty>No products yet.</Empty>
                    ) : (
                      <div className="mt-4 grid gap-3">
                        {products.map((item) => (
                          <article key={item.id} className="rounded-md border border-border bg-card">
                            <div className="flex items-center">
                            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left transition-colors hover:bg-workspace-canvas" onClick={() => {
                              setManagingProductId(item.id);
                              setEditSaleType(item.auctions?.some(a => a.status === "scheduled") ? "auction" : "regular");
                              if (item.listing_status === "draft" && item.moderation_status === "pending" && !item.submitted_for_review_at) setEditingProductId(item.id);
                            }}>
                              <ProductThumb src={productImages.get(item.id)?.[0]?.url} alt={productImages.get(item.id)?.[0]?.alt_text ?? item.name} name={item.name} className="size-12 shrink-0 rounded-md border" />
                              <div className="min-w-0 flex-1"><h3 className="truncate font-extrabold text-workspace-brand">{item.name}</h3>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">SKU {item.seller_sku} · Stock {item.available_quantity} · {LISTING_STAGE_LABELS[listingStage(item)]}</p></div>
                              <span className="text-xs font-bold text-workspace-brand">Manage →</span>
                            </button>
                            {canManageCatalog && item.listing_status !== "archived" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button type="button" variant="ghost" size="icon" className="mr-3 size-8 shrink-0 text-destructive hover:text-destructive" title="Delete product" aria-label={`Delete ${item.name}`}><Trash2 className="size-4" /></Button></AlertDialogTrigger>
                                <AlertDialogContent className="max-w-sm">
                                  <AlertDialogHeader><AlertDialogTitle>Remove this product?</AlertDialogTitle><AlertDialogDescription>{item.listing_status === "draft" && !item.submitted_for_review_at ? `“${item.name}” will be permanently deleted. This cannot be undone.` : `“${item.name}” will be removed from your catalog and the marketplace. Existing order records will be kept.`}</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void run(() => removeProduct(item.id), "Product removed.")}>Remove product</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            </div>
                            <Dialog open={managingProductId === item.id} onOpenChange={(open) => {
                              if (!open) { setManagingProductId(""); setEditingProductId(""); }
                            }}>
                              <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto p-5 sm:p-6">
                                <DialogHeader className="pr-8">
                                  <DialogTitle>{item.name}</DialogTitle>
                                  <DialogDescription>SKU {item.seller_sku} · MOQ {item.minimum_order_quantity} · Stock {item.available_quantity} · {LISTING_STAGE_LABELS[listingStage(item)]}</DialogDescription>
                                </DialogHeader>
                                {error && <p role="alert" className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
                            {canManageCatalog && item.listing_status !== "archived" && <SellerAuctionControls productId={item.id} unit={item.unit_of_measure ?? "units"} available={Number(item.available_quantity)} />}
                            {item.moderation_notes && (
                              <p className="mt-2 border-l-2 border-workspace-action pl-3 text-sm">
                                Review: {item.moderation_notes}
                              </p>
                            )}
                            {canManageCatalog && item.moderation_status === "rejected" && (
                              <Button variant="outline"
                                disabled={busy}
                                className="button mt-3"
                                onClick={() =>
                                  void run(
                                    () => reopenRejectedProduct(item.id),
                                    "Rejected listing reopened for revision.",
                                  )
                                }
                              >
                                Reopen rejected listing
                              </Button>
                            )}
                            {canManageCatalog && editingProductId === item.id && (
                              <form
                                className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2"
                                onSubmit={submitEditProduct}
                              >
                                <Text
                                  name="name"
                                  label="Product name"
                                  hint="The name buyers will see, for example Stainless steel hex bolts, M8 x 30 mm. At least 3 characters."
                                  defaultValue={item.name}
                                  minLength={3}
                                />
                                <Text
                                  name="slug"
                                  label="URL slug"
                                  hint="The last part of the product's web address. Use lowercase letters, numbers and hyphens only."
                                  defaultValue={item.slug}
                                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                                />
                                <Field
                                  label="Category"
                                  hint="The category buyers will browse to find this product."
                                >
                                  <select
                                    name="category"
                                    defaultValue={item.category_id ?? ""}
                                    required
                                    className={input}
                                  >
                                    {categories.map((category) => (
                                      <option key={category.id} value={category.id}>
                                        {category.name}
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                                <Text
                                  name="sku" label="SKU" defaultValue={item.seller_sku}
                                  hint="Your own stock code for this product. It must be unique within your catalog."
                                />
                                <Text
                                  name="hsn"
                                  label="HSN code"
                                  hint="The 4 to 8 digit HSN tax code for this product. It is printed on GST invoices."
                                  pattern="[0-9]{4,8}"
                                  defaultValue={item.hsn_code ?? ""}
                                />
                                <Field
                                  label="Description"
                                  hint="Describe the product: material, size, grade, packing and typical use. At least 20 characters."
                                >
                                  <textarea
                                    name="description"
                                    defaultValue={item.description}
                                    minLength={20}
                                    required
                                    className={input}
                                  />
                                </Field>
                                <Text
                                  name="unit"
                                  label="Unit"
                                  hint="The unit you sell in, for example pieces, cartons, kg or rolls."
                                  defaultValue={item.unit_of_measure}
                                />
                                <ProductSaleFields key={item.id} saleType={editSaleType} onSaleTypeChange={setEditSaleType} defaults={{
                                  minimumQuantity: item.minimum_order_quantity,
                                  unitPrice: item.product_price_tiers?.[0]?.unit_price,
                                  lotType: item.auctions?.find(a => a.status === "scheduled")?.lot_type,
                                  quantity: item.auctions?.find(a => a.status === "scheduled")?.quantity,
                                  startPrice: item.auctions?.find(a => a.status === "scheduled")?.start_price,
                                  bidStep: item.auctions?.find(a => a.status === "scheduled")?.bid_step,
                                  tokenAmount: item.auctions?.find(a => a.status === "scheduled")?.token_amount,
                                  durationDays: (() => { const a = item.auctions?.find(a => a.status === "scheduled"); return a ? (Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 86_400_000 : 7; })(),
                                }} />
                                <Text
                                  name="gst"
                                  label="GST rate (%)"
                                  hint="The GST percentage that applies to this product, for example 5, 12 or 18."
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="0.01"
                                  defaultValue={item.gst_rate ?? 0}
                                />
                                <Text
                                  name="lead"
                                  label="Lead time (days)"
                                  hint="Days you need from order confirmation until the goods are dispatched."
                                  type="number"
                                  min={0}
                                  defaultValue={item.lead_time_days ?? 0}
                                />
                                {photoPicker(item.id, (productImages.get(item.id) ?? []).length)}
                                <Action busy={busy}>Save changes</Action>
                              </form>
                            )}
                            <section className="mt-3 border-t pt-3">
                              <div className="flex items-center justify-between px-2 py-2 text-sm font-bold">
                                <span>Pricing</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                  {item.product_price_tiers?.length ?? 0} tier{item.product_price_tiers?.length === 1 ? "" : "s"}
                                </span>
                              </div>
                              <div className="px-2 pb-2">
                            {item.product_price_tiers?.length ? (
                              <div className="mt-3 grid gap-1 text-sm">
                                {item.product_price_tiers.map((tier) => (
                                  <div
                                    key={tier.id}
                                    className="flex items-center justify-between gap-3 bg-workspace-canvas p-2"
                                  >
                                    <span>
                                      {tier.minimum_quantity}–{tier.maximum_quantity} units · ₹
                                      {Number(tier.unit_price).toLocaleString("en-IN")}/unit
                                    </span>
                                    {canManageCatalog && (
                                        <Button variant="outline"
                                          disabled={busy}
                                          className="text-destructive underline"
                                          onClick={() =>
                                            void run(
                                              () => deletePriceTier(tier.id),
                                              "Price tier deleted.",
                                            )
                                          }
                                        >
                                          Delete tier
                                        </Button>
                                      )}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {canManageCatalog && (
                                <form
                                  className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    const formElement = event.currentTarget;
                                    const f = formValues(event);
                                    void run(async () => {
                                      await addPriceTier(
                                        item.id,
                                        Number(f["min"]),
                                        Number(f["max"]),
                                        Number(f["price"]),
                                      );
                                      formElement.reset();
                                    }, "Price tier added.");
                                  }}
                                >
                                  <Text
                                    // The first tier has to start at the minimum order quantity.
                                    key={tierCoversMinimumOrder(item) ? "next-tier" : "first-tier"}
                                    name="min"
                                    label="From quantity"
                                    hint="The smallest quantity this price applies to. Your first tier must start at the minimum order quantity."
                                    type="number"
                                    min={item.minimum_order_quantity}
                                    defaultValue={
                                      tierCoversMinimumOrder(item) ? "" : item.minimum_order_quantity
                                    }
                                  />
                                  <Text
                                    name="max"
                                    label="To quantity"
                                    hint="The largest quantity this price applies to. Price ranges must not overlap."
                                    type="number"
                                    min={item.minimum_order_quantity}
                                  />
                                  <Text
                                    name="price"
                                    label="Unit price (INR)"
                                    hint="Price for one unit in rupees within this quantity range, before GST."
                                    type="number"
                                    min={0.01}
                                    step="0.01"
                                  />
                                  <Button variant="outline" disabled={busy} className="button" type="submit">
                                    Add price tier
                                  </Button>
                                </form>
                              )}
                              </div>
                            </section>
                            <section className="border-t pt-3">
                              <div className="flex items-center justify-between px-2 py-2 text-sm font-bold">
                                <span>Photos</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                  {(productImages.get(item.id) ?? []).length}/{PRODUCT_IMAGE_LIMIT}
                                </span>
                              </div>
                              <div className="px-2 pb-2">
                            {(productImages.get(item.id) ?? []).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(productImages.get(item.id) ?? []).map((image) => (
                                  <figure key={image.id} className="relative size-16 text-xs">
                                    <ProductThumb
                                      src={image.url}
                                      alt={image.alt_text ?? item.name}
                                      name={item.name}
                                      className="size-16 rounded-md border"
                                    />
                                    {canManageCatalog &&
                                      item.listing_status === "draft" &&
                                      !item.submitted_for_review_at && (
                                        <Button type="button" variant="destructive" size="icon"
                                          disabled={busy}
                                          className="absolute -right-1 -top-1 size-6 rounded-full opacity-90 shadow-sm"
                                          title="Remove image"
                                          aria-label={`Remove image from ${item.name}`}
                                          onClick={() =>
                                            void run(
                                              () => deleteProductImage(image),
                                              "Product image removed.",
                                            )
                                          }
                                        >
                                          <X className="size-3" />
                                        </Button>
                                      )}
                                  </figure>
                                ))}
                              </div>
                            )}
                            {canManageCatalog &&
                              item.listing_status === "draft" &&
                              !item.submitted_for_review_at &&
                              (productImages.get(item.id) ?? []).length < PRODUCT_IMAGE_LIMIT && (
                                <form
                                  className="mt-3 grid gap-3 sm:grid-cols-[minmax(13rem,1fr)_minmax(12rem,1fr)_auto] sm:items-end"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    const formElement = event.currentTarget;
                                    const f = formValues(event);
                                    const photos = chosenPhotos(formElement);
                                    const problems = productImageSelectionProblems(
                                      photos,
                                      (productImages.get(item.id) ?? []).length,
                                    );
                                    if (photos.length === 0 || problems.length > 0) {
                                      setNotice("");
                                      setError(
                                        photos.length === 0
                                          ? "Choose at least one photo to upload."
                                          : problems.join(" "),
                                      );
                                      return;
                                    }
                                    let result = { uploaded: 0, failures: [] as string[] };
                                    void run(async () => {
                                      result = await uploadProductImages(
                                        item.id,
                                        photos,
                                        String(f["alt"] ?? ""),
                                      );
                                      formElement.reset();
                                      setPhotoProblems((current) => ({ ...current, [`card-${item.id}`]: [] }));
                                    }, "Product photos added.").then(() => {
                                      if (result.uploaded > 0)
                                        setNotice(`${photoCount(result.uploaded)} added to ${item.name}.`);
                                      else setNotice("");
                                      if (result.failures.length > 0)
                                        setError(
                                          `${photoCount(result.failures.length)} could not be uploaded. ${result.failures.join(" ")}`,
                                        );
                                    });
                                  }}
                                >
                                  <ProductPhotoPicker label="Add photos" existingCount={(productImages.get(item.id) ?? []).length} required compact onProblems={(next) => setPhotoProblems((current) => ({ ...current, [`card-${item.id}`]: next }))} />
                                  <Text
                                    name="alt"
                                    label="Image description"
                                    hint="A few words describing the photo, for buyers who cannot see images. Optional."
                                    required={false}
                                    maxLength={200}
                                  />
                                  <Button variant="outline" disabled={busy} className="button" type="submit">
                                    Upload photos
                                  </Button>
                                  {(photoProblems[`card-${item.id}`] ?? []).length > 0 && (
                                    <ul role="alert" className="basis-full list-disc pl-5 text-sm text-destructive">
                                      {(photoProblems[`card-${item.id}`] ?? []).map((problem) => (
                                        <li key={problem}>{problem}</li>
                                      ))}
                                    </ul>
                                  )}
                                </form>
                              )}
                              </div>
                            </section>
                            {canManageCatalog &&
                              item.listing_status === "draft" &&
                              item.moderation_status === "pending" &&
                              !item.submitted_for_review_at && (
                                <div className="mt-4 border-t pt-4">
                                  <p className="text-sm font-bold">
                                    The FeaBulk admin cannot see this product until you submit it.
                                  </p>
                                  {submissionBlockers(item, organization.status === "verified")
                                    .length > 0 ? (
                                    <ul className="mt-2 list-disc pl-5 text-sm" role="status">
                                      {submissionBlockers(
                                        item,
                                        organization.status === "verified",
                                      ).map((blocker) => (
                                        <li key={blocker}>{blocker}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      {(productImages.get(item.id) ?? []).length === 0
                                        ? "Ready to send. Adding a photo first is recommended, because the admin and buyers will see it."
                                        : "Ready to send. Prices and photos lock once you submit."}
                                    </p>
                                  )}
                                  <Button variant="outline"
                                    disabled={
                                      busy ||
                                      submissionBlockers(item, organization.status === "verified")
                                        .length > 0
                                    }
                                    className="button mt-3"
                                    onClick={() =>
                                      void run(
                                        () => submitProductForReview(item.id),
                                        "Product sent to the FeaBulk admin for review.",
                                      )
                                    }
                                  >
                                    Submit for review
                                  </Button>
                                </div>
                              )}
                            {canAdjustInventory && (
                              <section className="border-t pt-3">
                                <div className="flex items-center justify-between px-2 py-2 text-sm font-bold">
                                  <span>Inventory</span>
                                  <span className="text-xs font-normal text-muted-foreground">{item.available_quantity} in stock</span>
                                </div>
                              <form
                                className="grid gap-3 px-2 pb-2 pt-3 sm:grid-cols-[minmax(10rem,1fr)_minmax(14rem,2fr)_auto] sm:items-end"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  const f = formValues(event);
                                  void run(
                                    () =>
                                      adjustInventory(
                                        item.id,
                                        Number(f["delta"]),
                                        String(f["reason"]),
                                      ),
                                    "Inventory updated.",
                                  );
                                }}
                              >
                                <Text
                                  name="delta"
                                  label="Stock adjustment (+/-)"
                                  hint="Units to add or remove. Enter a positive number to add stock, or a negative number to reduce it."
                                  type="number"
                                  required
                                  step={1}
                                />
                                <Text
                                  name="reason" label="Reason" minLength={5}
                                  hint="Why the stock changed, for example new shipment received or damaged goods. At least 5 characters."
                                />
                                <Button variant="outline" disabled={busy} className="button" type="submit">
                                  Update inventory
                                </Button>
                              </form>
                              </section>
                            )}
                              </DialogContent>
                            </Dialog>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                )}
                {view === "orders" && buyer && organization && <BuyerAuctions organizationId={organization.id} />}
                {view === "orders" && (
                  <section className="mt-6">
                    <h2 className="text-xl font-black">Orders ({orders.length})</h2>
                    {orders.length === 0 ? (
                      <Empty>No orders yet.</Empty>
                    ) : (
                      <div className="mt-4 grid gap-3">
                        {orders.map((item) => (
                          <OrderCard
                            key={item.id}
                            order={item}
                            productImages={orderProductImages}
                            organization={organization}
                            buyer={Boolean(buyer)}
                            seller={Boolean(seller)}
                            role={currentRole}
                            paymentAvailable={paymentAvailable}
                            busy={busy}
                            activeAction={orderActionId}
                            setActiveAction={setOrderActionId}
                            run={run}
                            openConversation={openConversation}
                            payOrder={payOrder}
                            submitShipment={submitShipment}
                            submitDispute={submitDispute}
                            submitReview={submitReview}
                            submitTaxDetails={submitTaxDetails}
                            generateDocument={generateDocument}
                            downloadDocument={downloadDocument}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}
                {view === "team" && (
                  <section className="mt-6">
                    <h2 className="text-xl font-black">Team ({team.length})</h2>
                    <div className="mt-4 grid gap-3">
                      {team.map((member) => (
                        <Card key={member.user_id}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-bold">{member.email}</p>
                              <p className="text-sm text-muted-foreground">{teamRoleLabel(member.role)}</p>
                            </div>
                            {currentRole === "owner" && member.user_id !== userId && (
                              <Button variant="outline"
                                disabled={busy}
                                className="button-secondary"
                                onClick={() =>
                                  void run(
                                    () => removeTeamMember(organization.id, member.user_id),
                                    "Team member removed.",
                                  )
                                }
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                    {canManageOrganization && (
                      <>
                        <form
                          onSubmit={submitInvitation}
                          className="mt-6 grid gap-3 border bg-card p-5 sm:grid-cols-2"
                        >
                          <div className="sm:col-span-2">
                            <h3 className="text-lg font-black">Invite a teammate</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Invite people to this business workspace. FEA operations access is
                              managed separately.
                            </p>
                          </div>
                          <Text
                            name="email" label="Confirmed work email" type="email"
                            hint="Email of the person you are inviting. They must already have a FeaBulk account with a confirmed email."
                          />
                          <Field
                            label="Business role"
                            hint="What this person will be able to do in your business workspace."
                          >
                            <select name="role" className={input}>
                              {INVITABLE_TEAM_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {teamRoleLabel(role)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Action busy={busy}>Create invitation code</Action>
                        </form>
                        <div className="mt-6">
                          <h3 className="font-black">Invitation codes</h3>
                          {invitations.length === 0 ? (
                            <p className="mt-2 text-sm">No invitations yet.</p>
                          ) : (
                            <div className="mt-3 grid gap-2">
                              {invitations.map((item) => (
                                <Card key={item.id}>
                                  <p className="text-sm font-bold">
                                    {item.email} · {teamRoleLabel(item.role)} ·{" "}
                                    {item.accepted_at
                                      ? "accepted"
                                      : new Date(item.expires_at) > new Date()
                                        ? "pending"
                                        : "expired"}
                                  </p>
                                  {!item.accepted_at && new Date(item.expires_at) > new Date() && (
                                    <p className="mt-2 break-all font-mono text-sm">{item.token}</p>
                                  )}
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </section>
                )}
                {conversation && (
                  <section className="mt-8 border border-input bg-card p-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-black">Trade messages</h2>
                      <Button variant="outline"
                        className="button-secondary"
                        onClick={() => {
                          setConversation(null);
                          setMessages([]);
                        }}
                      >
                        Close
                      </Button>
                    </div>
                    <div ref={messageListRef} className="mt-4 max-h-80 space-y-3 overflow-y-auto">
                      {messages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No messages yet.</p>
                      ) : (
                        messages.map((item) => (
                          <article key={item.id} className="border bg-workspace-canvas p-3">
                            <p className="text-xs font-bold text-muted-foreground">
                              {item.sender_organization_id === organization.id
                                ? "Your team"
                                : "Other business"}{" "}
                              · {new Date(item.created_at).toLocaleString()}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm">{item.body}</p>
                          </article>
                        ))
                      )}
                    </div>
                    <form className="mt-4 flex flex-wrap gap-2" onSubmit={submitMessage}>
                      <label className="sr-only" htmlFor="message-body">
                        Message
                      </label>
                      <textarea
                        id="message-body"
                        name="body"
                        required
                        maxLength={8000}
                        className="min-w-64 flex-1 border border-input p-3"
                        placeholder="Write a message"
                      />
                      <Button variant="outline" disabled={busy} className="button" type="submit">
                        Send message
                      </Button>
                    </form>
                  </section>
                )}
              </>
            )}
            {ops && (
              <a
                className="mt-8 inline-block border border-border px-4 py-2 text-sm font-bold text-workspace-brand"
                href="/admin"
              >
                Open FEA operations
              </a>
            )}
          </>
        )}
    </WorkspaceLayout>
  );
}

type OrderCardProps = {
  order: Order;
  productImages: Map<string, ProductImage[]>;
  organization: Organization;
  buyer: boolean;
  seller: boolean;
  role?: TeamRole | undefined;
  paymentAvailable: boolean;
  busy: boolean;
  activeAction: string;
  setActiveAction: (value: string) => void;
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
  const {
    order,
    organization,
    buyer,
    seller,
    role,
    paymentAvailable,
    busy,
    activeAction,
    setActiveAction,
    run,
  } = props;
  const isBuyer = buyer && order.buyer_organization_id === organization.id;
  const isSeller = seller && order.seller_organization_id === organization.id;
  const hasRole = (...roles: TeamRole[]) => Boolean(role && roles.includes(role));
  const canManageBuyerOrder =
    isBuyer && hasRole("owner", "administrator", "procurement_manager", "purchase_approver");
  const canPayBuyerOrder =
    isBuyer && hasRole("owner", "administrator", "purchase_approver", "accountant");
  const canCancelBuyerOrder = isBuyer && hasRole("owner", "administrator", "procurement_manager");
  const canManageSellerOrder =
    isSeller && hasRole("owner", "administrator", "sales_manager", "warehouse_operator");
  const canManageTax = isSeller && hasRole("owner", "administrator", "sales_manager", "accountant");
  const canGeneratePurchaseOrder =
    isBuyer && hasRole("owner", "administrator", "procurement_manager", "purchase_approver");
  const canGenerateSellerInvoice =
    isSeller && hasRole("owner", "administrator", "sales_manager", "accountant");
  const canGenerateFulfilmentDocument =
    isSeller && hasRole("owner", "administrator", "sales_manager", "warehouse_operator");
  const review = order.reviews[0];
  const latestPayment = [...order.payment_transactions].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  )[0];
  const paymentInProgress = Boolean(
    latestPayment && ["initiated", "pending", "authorized"].includes(latestPayment.status),
  );
  const hasTaxInvoice = order.commercial_documents.some((item) => item.type === "tax_invoice");
  const taxInvoiceStates = [
    "payment_secured",
    "processing",
    "ready_to_ship",
    "partially_fulfilled",
    "shipped",
    "delivered",
    "inspection",
    "completed",
    "disputed",
  ];
  const fulfilmentDocumentStates = [
    "processing",
    "ready_to_ship",
    "partially_fulfilled",
    "shipped",
    "delivered",
    "inspection",
    "completed",
    "disputed",
  ];
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold">{order.order_number}</h3>
          <p className="text-sm text-muted-foreground">
            {order.status.replaceAll("_", " ")} · ₹
            {Number(order.grand_total).toLocaleString("en-IN")}
          </p>
          {order.order_lines.map((line) => {
            const photo = props.productImages.get(line.product_id ?? "")?.[0];
            return (
              <p key={line.id} className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <ProductThumb
                  src={photo?.url}
                  alt={photo?.alt_text ?? line.description}
                  name={line.description}
                  className="size-9 shrink-0 rounded border text-sm"
                />
                <span>
                  {line.description}: {line.quantity} {line.unit_of_measure} × ₹
                  {Number(line.unit_price).toLocaleString("en-IN")}
                </span>
              </p>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageSellerOrder && order.status === "awaiting_seller_confirmation" && (
            <Button variant="outline"
              disabled={busy}
              className="button"
              onClick={() =>
                void run(
                  () => transitionOrder(order.id, "awaiting_payment"),
                  "Order confirmed; awaiting payment.",
                )
              }
            >
              Confirm order
            </Button>
          )}
          {canCancelBuyerOrder &&
            !paymentInProgress &&
            ["awaiting_seller_confirmation", "awaiting_payment"].includes(order.status) && (
              <Button variant="outline"
                disabled={busy}
                className="button-secondary"
                onClick={() =>
                  void run(() => transitionOrder(order.id, "cancelled"), "Order cancelled.")
                }
              >
                Cancel order
              </Button>
            )}
          {paymentAvailable && canPayBuyerOrder && order.status === "awaiting_payment" && (
            <Button variant="outline"
              disabled={busy}
              className="button"
              onClick={() => void run(() => props.payOrder(order), "Payment verified securely.")}
            >
              Pay securely
            </Button>
          )}
          {canManageSellerOrder && order.status === "payment_secured" && (
            <Button variant="outline"
              disabled={busy}
              className="button"
              onClick={() =>
                void run(
                  () => transitionOrder(order.id, "processing"),
                  "Order moved to processing.",
                )
              }
            >
              Start processing
            </Button>
          )}
          {canManageSellerOrder && order.status === "processing" && (
            <Button variant="outline"
              disabled={busy}
              className="button"
              onClick={() =>
                void run(
                  () => transitionOrder(order.id, "ready_to_ship"),
                  "Order is ready to ship.",
                )
              }
            >
              Ready to ship
            </Button>
          )}
          {canManageSellerOrder &&
            ["ready_to_ship", "partially_fulfilled"].includes(order.status) && (
              <Button variant="outline"
                className="button"
                onClick={() =>
                  setActiveAction(activeAction === `ship-${order.id}` ? "" : `ship-${order.id}`)
                }
              >
                Create shipment
              </Button>
            )}
          {canManageBuyerOrder && order.status === "delivered" && (
            <Button variant="outline"
              disabled={busy}
              className="button"
              onClick={() =>
                void run(() => completeOrderInspection(order.id), "Inspection period started.")
              }
            >
              Start inspection
            </Button>
          )}
          {canManageBuyerOrder &&
            order.status === "inspection" &&
            order.inspection_ends_at &&
            new Date(order.inspection_ends_at) <= new Date() && (
              <Button variant="outline"
                disabled={busy}
                className="button"
                onClick={() =>
                  void run(() => completeOrderInspection(order.id), "Order completed.")
                }
              >
                Complete order
              </Button>
            )}
          {(isBuyer || isSeller) &&
            ["shipped", "delivered", "inspection"].includes(order.status) && (
              <Button variant="outline"
                className="button-secondary"
                onClick={() =>
                  setActiveAction(
                    activeAction === `dispute-${order.id}` ? "" : `dispute-${order.id}`,
                  )
                }
              >
                Open dispute
              </Button>
            )}
          {isBuyer && order.status === "completed" && !review && (
            <Button variant="outline"
              className="button-secondary"
              onClick={() =>
                setActiveAction(activeAction === `review-${order.id}` ? "" : `review-${order.id}`)
              }
            >
              Review seller
            </Button>
          )}
          {canManageTax &&
            !hasTaxInvoice &&
            !["completed", "cancelled", "returned"].includes(order.status) && (
              <Button variant="outline"
                className="button-secondary"
                onClick={() =>
                  setActiveAction(activeAction === `tax-${order.id}` ? "" : `tax-${order.id}`)
                }
              >
                Tax details
              </Button>
            )}
          <Button variant="outline"
            className="button-secondary"
            onClick={() => void props.openConversation("order", order.id)}
          >
            Messages
          </Button>
        </div>
      </div>
      {latestPayment && (
        <p className="mt-3 text-xs font-bold text-muted-foreground">
          Payment: {latestPayment.status.replaceAll("_", " ")} · ₹
          {Number(latestPayment.amount).toLocaleString("en-IN")} · Reconciliation{" "}
          {latestPayment.reconciliation_status}
        </p>
      )}
      {canManageTax && activeAction === `tax-${order.id}` && (
        <form
          className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"
          onSubmit={(event) => props.submitTaxDetails(event, order)}
        >
          <h4 className="font-black sm:col-span-2">Order line tax details</h4>
          {order.order_lines.map((line) => (
            <Text
              key={line.id}
              name={`hsn-${line.id}`}
              label={`HSN: ${line.description}`}
              hint="The 4 to 8 digit HSN tax code for this item. It is printed on the tax invoice."
              pattern="[0-9]{4,8}"
              defaultValue={line.hsn_code ?? ""}
            />
          ))}
          <Action busy={busy}>Save tax details</Action>
        </form>
      )}
      <details className="mt-4 border-t pt-3">
        <summary className="cursor-pointer text-sm font-black">
          Commercial documents ({order.commercial_documents.length})
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {canGeneratePurchaseOrder && !["draft", "cancelled"].includes(order.status) && (
            <Button variant="outline"
              disabled={busy}
              className="button-secondary"
              onClick={() => props.generateDocument(order, "purchase_order")}
            >
              Generate purchase order
            </Button>
          )}
          {canGenerateSellerInvoice && !["draft", "cancelled"].includes(order.status) && (
            <Button variant="outline"
              disabled={busy}
              className="button-secondary"
              onClick={() => props.generateDocument(order, "proforma_invoice")}
            >
              Generate proforma invoice
            </Button>
          )}
          {canGenerateSellerInvoice && taxInvoiceStates.includes(order.status) && (
            <Button variant="outline"
              disabled={busy}
              className="button-secondary"
              onClick={() => props.generateDocument(order, "tax_invoice")}
            >
              Generate tax invoice
            </Button>
          )}
          {canGenerateFulfilmentDocument && fulfilmentDocumentStates.includes(order.status) && (
            <>
              <Button variant="outline"
                disabled={busy}
                className="button-secondary"
                onClick={() => props.generateDocument(order, "delivery_challan")}
              >
                Generate delivery challan
              </Button>
              <Button variant="outline"
                disabled={busy}
                className="button-secondary"
                onClick={() => props.generateDocument(order, "packing_list")}
              >
                Generate packing list
              </Button>
            </>
          )}
        </div>
        {order.commercial_documents.length > 0 && (
          <div className="mt-3 grid gap-2">
            {order.commercial_documents.map((item) => (
              <Button variant="outline"
                key={item.id}
                className="flex items-center justify-between border bg-workspace-canvas p-3 text-left text-sm"
                onClick={() => props.downloadDocument(item.storage_path)}
              >
                <span>
                  {item.type.replaceAll("_", " ")} · {item.document_number} · v{item.version}
                </span>
                <span className="font-bold text-workspace-brand">Open</span>
              </Button>
            ))}
          </div>
        )}
      </details>{" "}
      {order.shipments.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <h4 className="text-sm font-black">Shipments</h4>
          {order.shipments.map((shipment) => (
            <div
              key={shipment.id}
              className="mt-2 flex flex-wrap items-center justify-between gap-2 bg-workspace-canvas p-3 text-sm"
            >
              <span>
                {shipment.carrier} · {shipment.tracking_number} ·{" "}
                {shipment.status.replaceAll("_", " ")}
              </span>
              {canManageSellerOrder && shipment.status === "ready" && (
                <Button variant="outline"
                  disabled={busy}
                  className="button"
                  onClick={() =>
                    void run(() => dispatchShipment(shipment.id), "Shipment dispatched.")
                  }
                >
                  Dispatch
                </Button>
              )}
              {canManageBuyerOrder && ["dispatched", "in_transit"].includes(shipment.status) && (
                <Button variant="outline"
                  disabled={busy}
                  className="button"
                  onClick={() =>
                    void run(() => confirmShipmentDelivery(shipment.id), "Delivery confirmed.")
                  }
                >
                  Confirm delivery
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {order.disputes.length > 0 && (
        <div className="mt-3 border-l-2 border-destructive pl-3 text-sm">
          <strong>Dispute:</strong> {order.disputes[0]?.type.replaceAll("_", " ")} ·{" "}
          {order.disputes[0]?.status.replaceAll("_", " ")}
        </div>
      )}
      {review && (
        <p className="mt-3 text-sm">
          <strong>Review:</strong> {"★".repeat(review.rating)} {review.body}
        </p>
      )}
      {canManageSellerOrder && activeAction === `ship-${order.id}` && (
        <form
          className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"
          onSubmit={(event) => props.submitShipment(event, order)}
        >
          <Field
            label="Shipping mode"
            hint="Who moves the goods: you arrange transport, the buyer collects, or FeaBulk logistics."
          >
            <select name="shippingMode" className={input}>
              <option value="seller_arranged">Seller arranged</option>
              <option value="buyer_pickup">Buyer pickup</option>
              <option value="platform_logistics">Platform logistics</option>
            </select>
          </Field>
          <Field
            label="Freight type"
            hint="How the goods are packed and carried, from a single parcel up to a full truck, air or sea."
          >
            <select name="freightType" className={input}>
              <option value="parcel">Parcel</option>
              <option value="carton">Carton</option>
              <option value="pallet">Pallet</option>
              <option value="ltl">LTL</option>
              <option value="ftl">FTL</option>
              <option value="air">Air</option>
              <option value="ocean">Ocean</option>
            </select>
          </Field>
          <Text
            name="carrier" label="Carrier"
            hint="Name of the transport company or courier carrying the goods."
          />
          <Text
            name="trackingNumber" label="Tracking number"
            hint="The consignment, LR or AWB number the buyer can use to track the shipment."
          />
          <Text
            name="estimatedDelivery" label="Estimated delivery" type="datetime-local"
            hint="The date and time you expect the goods to reach the buyer."
          />
          {order.order_lines.map((line) => (
            <Text
              key={line.id}
              name={`quantity-${line.id}`}
              label={`Ship quantity: ${line.description}`}
              hint="Units of this item in this shipment. Enter 0 to leave the item out."
              type="number"
              min={0}
              max={line.quantity}
              defaultValue={line.quantity}
            />
          ))}
          <Action busy={busy}>Save shipment</Action>
        </form>
      )}
      {activeAction === `dispute-${order.id}` && (
        <form
          className="mt-4 grid gap-3 border-t pt-4"
          onSubmit={(event) => props.submitDispute(event, order)}
        >
          <Field
            label="Issue type"
            hint="The kind of problem you had with this order."
          >
            <select name="type" className={input}>
              <option value="missing_quantity">Missing quantity</option>
              <option value="damaged_goods">Damaged goods</option>
              <option value="wrong_specifications">Wrong specifications</option>
              <option value="quality_failure">Quality failure</option>
              <option value="late_shipment">Late shipment</option>
              <option value="non_delivery">Non-delivery</option>
              <option value="invoice_or_payment">Invoice or payment</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field
            label="Description (20+ characters)"
            hint="Explain what went wrong, with quantities and dates. At least 20 characters."
          >
            <textarea
              name="description"
              required
              minLength={20}
              maxLength={12000}
              className={input}
            />
          </Field>
          <Action busy={busy}>Open dispute</Action>
        </form>
      )}
      {activeAction === `review-${order.id}` && (
        <form
          className="mt-4 grid gap-3 border-t pt-4"
          onSubmit={(event) => props.submitReview(event, order)}
        >
          <Field
            label="Rating"
            hint="Your overall rating of this seller for this order. 5 is the best."
          >
            <select name="rating" className={input}>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} stars
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Review"
            hint="Say what went well or badly. Other buyers will see this. Optional."
          >
            <textarea name="body" maxLength={2000} className={input} />
          </Field>
          <Action busy={busy}>Publish review</Action>
        </form>
      )}
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-muted-foreground">
      <FieldLabel label={label} hint={hint} />
      {children}
    </label>
  );
}
function ProductPhotoPicker({ label, existingCount, onProblems, required = false, compact = false }: {
  label: string; existingCount: number; onProblems: (problems: string[]) => void; required?: boolean; compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Array<{ file: File; url: string }>>([]);
  const replaceFiles = useCallback((files: File[]) => {
    setPreviews(current => {
      current.forEach(preview => URL.revokeObjectURL(preview.url));
      return files.map(file => ({ file, url: URL.createObjectURL(file) }));
    });
    onProblems(productImageSelectionProblems(files, existingCount));
  }, [existingCount, onProblems]);
  useEffect(() => {
    const formElement = inputRef.current?.form;
    if (!formElement) return;
    const reset = () => replaceFiles([]);
    formElement.addEventListener("reset", reset);
    return () => formElement.removeEventListener("reset", reset);
  }, [replaceFiles]);
  useEffect(() => () => previews.forEach(preview => URL.revokeObjectURL(preview.url)), [previews]);
  function removeSelectedFile(index: number) {
    const nextFiles = previews.filter((_, fileIndex) => fileIndex !== index).map(preview => preview.file);
    if (inputRef.current) {
      const transfer = new DataTransfer();
      nextFiles.forEach(file => transfer.items.add(file));
      inputRef.current.files = transfer.files;
    }
    replaceFiles(nextFiles);
  }
  return (
    <div className={compact ? "min-w-52 flex-1" : "sm:col-span-2"}>
      <span className="mb-1 block text-sm font-semibold text-muted-foreground">{label}</span>
      <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-md border border-dashed border-input bg-workspace-canvas px-3 py-2 transition-colors hover:border-workspace-action hover:bg-workspace-info-soft/40">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-workspace-brand shadow-sm"><ImagePlus className="size-4" /></span>
        <span className="min-w-0 text-sm"><span className="block font-semibold text-foreground">Choose product images</span><span className="block text-xs text-muted-foreground">JPG, PNG or WebP · 5 MB max · {PRODUCT_IMAGE_LIMIT - existingCount} remaining</span></span>
        <input ref={inputRef} name="images" type="file" multiple required={required} accept={PRODUCT_IMAGE_ACCEPT} className="sr-only" onChange={event => replaceFiles([...(event.currentTarget.files ?? [])])} />
      </label>
      {previews.length > 0 && <div className="mt-2 flex flex-wrap gap-2" aria-label="Selected images">
        {previews.map((preview, index) => <div key={`${preview.file.name}-${preview.file.lastModified}`} className="relative size-14">
          <img src={preview.url} alt="" className="size-14 rounded border object-cover" />
          <button type="button" className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow" onClick={() => removeSelectedFile(index)} aria-label={`Remove ${preview.file.name}`}><X className="size-3" /></button>
        </div>)}
      </div>}
    </div>
  );
}
function Text({
  name,
  label,
  hint,
  required = true,
  ...props
}: {
  name: string;
  label: string;
  hint?: string | undefined;
  required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint}>
      <input name={name} required={required} className={input} {...props} />
    </Field>
  );
}
function Action({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <Button type="submit" variant="workspace" disabled={busy} className="sm:col-span-2">
      {children}
    </Button>
  );
}
function Heading({
  title,
  action,
  onClick,
}: {
  title: string;
  action?: string | undefined;
  onClick?: (() => void) | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xl font-black">{title}</h2>
      {action && onClick && (
        <Button variant="outline" className="button" onClick={onClick}>
          {action}
        </Button>
      )}
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-4 border-y py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
function Card({ children }: { children: ReactNode }) {
  return <article className="rounded-md border border-border bg-card p-5 sm:p-6">{children}</article>;
}

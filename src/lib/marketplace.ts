import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugCandidate } from "@/lib/slug";
import {
  PRODUCT_IMAGE_LIMIT as IMAGE_LIMIT, PRODUCT_IMAGE_MAX_BYTES as IMAGE_MAX_BYTES, PRODUCT_IMAGE_TYPES,
  productImageErrorMessage, productImageFileProblem, resolveProductImageUrl,
} from "@/lib/product-image-rules";
import { createPublicReadCache } from "./public-read-cache";

const publicCatalogCache = createPublicReadCache();

const db = supabase;
// product_images and its commands are missing from the generated types until they are regenerated.
const untypedDb = supabase as unknown as SupabaseClient;

export type BusinessKind = "buyer" | "seller" | "both";
export type Organization = {
  id: string;
  legal_name: string;
  display_name: string;
  kind: BusinessKind;
  status: "pending_verification" | "verified" | "suspended";
};
export type Category = { id: string; name: string; slug: string };
export type Rfq = {
  id: string; title: string; status: string; required_quantity: number;
  unit_of_measure: string; delivery_pin_code: string; quote_deadline: string | null;
  category_id: string | null; created_at: string; buyer_organization_id: string;
};
export type Quote = {
  id: string; rfq_id: string; seller_organization_id: string;
  status: string; current_version: number;
  quote_versions: Array<{
    version: number; unit_price: number; quantity: number; gst_rate: number;
    shipping_charge: number; additional_charges: number; discount_amount: number;
    lead_time_days: number; validity_ends_at: string;
  }>;
};
export type Product = {
  id: string; name: string; slug: string; seller_sku: string;
  minimum_order_quantity: number; available_quantity: number;
  listing_status: string; moderation_status: string; submitted_for_review_at: string | null; created_at: string;
  description?: string; category_id?: string | null; unit_of_measure?: string; hsn_code?: string | null;
  gst_rate?: number | null; lead_time_days?: number; moderation_notes?: string | null;
  organization_id?: string;
  product_price_tiers?: Array<{ id: string; minimum_quantity: number; maximum_quantity: number; unit_price: number }>;
  auctions?: Array<{ status: string }>;
};
export type Order = {
  id: string; order_number: string; status: string; grand_total: number;
  buyer_organization_id: string; seller_organization_id: string; created_at: string;
  inspection_ends_at: string | null;
  order_lines: Array<{ id: string; product_id?: string | null; description: string; hsn_code: string | null; quantity: number; unit_of_measure: string; unit_price: number; gst_rate: number }>;
  shipments: Array<{ id: string; status: string; carrier: string | null; tracking_number: string | null; estimated_delivery_at: string | null }>;
  disputes: Array<{ id: string; status: string; type: string; description: string; opened_at: string }>;
  reviews: Array<{ id: string; rating: number; body: string | null }>;
  commercial_documents: CommercialDocument[];
  payment_transactions: PaymentTransaction[];
};
export type PaymentTransaction = {
  id: string; status: Database["public"]["Enums"]["payment_status"]; amount: number; currency: string;
  provider: string; provider_reference: string | null; provider_payment_reference: string | null;
  amount_refunded: number; reconciliation_status: string; created_at: string;
};
export type CommercialDocument = {
  id: string; order_id: string; type: Database["public"]["Enums"]["document_type"];
  document_number: string | null; version: number; storage_path: string;
  content_sha256: string; generated_at: string;
};
export type VerificationCase = {
  id: string; organization_id: string; status: string; business_type: string | null;
  registered_address: Record<string, string> | null; submitted_at: string | null;
};
export type Notification = {
  id: string; template_key: string; payload: Record<string, unknown>;
  read_at: string | null; created_at: string;
};
export type MarketplaceProduct = Product & {
  description: string; category_id: string | null; organization_id: string;
  product_price_tiers: Array<{ minimum_quantity: number; maximum_quantity: number; unit_price: number }>;
  supplier_name?: string;
  images?: ProductImage[];
};
export type ProductImage = {
  id: string; product_id: string; storage_path: string; alt_text: string | null; url: string;
};
export type ProductDetail = MarketplaceProduct & {
  unit_of_measure: string; lead_time_days: number; gst_rate: number | null; hsn_code: string | null;
  brand: string | null; manufacturer: string | null; country_of_origin: string | null;
  specifications?: unknown; warranty_terms?: string | null; sample_available?: boolean; sample_price?: number | null;
  customization_available?: boolean; private_label_available?: boolean; shipping_origin?: unknown;
  quantity_increment?: number; units_per_carton?: number | null;
  category: Category | null;
};
export type Supplier = { id: string; display_name: string; created_at: string };
export type SupplierRating = {
  organization_id: string; rating: number; review_count: number; order_completion_rate: number;
};
export type SupplierReview = { id: string; rating: number; body: string | null; created_at: string };
export type TradeConversation = {
  id: string; context: "quote" | "order"; buyer_organization_id: string;
  seller_organization_id: string; quote_id: string | null; order_id: string | null;
};
export type TradeMessage = {
  id: string; conversation_id: string; sender_organization_id: string | null;
  body: string; created_at: string;
};
export type TeamRole = Database["public"]["Enums"]["organization_role"];
export type OperationsRole = Database["public"]["Enums"]["operations_role"];
export type TeamMember = { user_id: string; email: string; role: TeamRole; joined_at: string };
export type OrganizationInvitation = {
  id: string; organization_id: string; email: string; role: TeamRole; token: string;
  expires_at: string; accepted_at: string | null; created_at: string;
};
export type Dispute = {
  id: string; order_id: string; opened_by_organization_id: string; type: string;
  status: string; description: string; opened_at: string; resolution: Record<string, unknown> | null;
};
export type OperationalIncident = {
  id: string; category: string; severity: "low" | "medium" | "high" | "critical";
  entity_type: string; entity_id: string; summary: string; details: Record<string, unknown>;
  status: "open" | "acknowledged"; first_detected_at: string; last_detected_at: string;
  acknowledgement_notes: string | null;
};
export type OperationsHealth = {
  summary: { open: number; acknowledged: number; critical: number; high: number };
  incidents: OperationalIncident[];
};
export type PlatformAccount = {
  user_id: string; email: string; full_name: string | null; email_confirmed: boolean;
  account_created_at: string; last_sign_in_at: string | null; organization_count: number;
  organization_names: string; operations_roles: string[];
};
export type PlatformOrganization = {
  organization_id: string; legal_name: string; display_name: string; kind: BusinessKind;
  status: string; gstin: string | null; member_count: number; verification_status: string;
  organization_created_at: string;
};

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("The server returned no data.");
  return result.data;
}

export async function getIdentity() {
  const { data: sessionData, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return null;

  // Pass the access token explicitly. This avoids a second storage lookup while
  // the router is switching from /auth to /app in embedded preview browsers.
  const { data, error } = await db.auth.getUser(sessionData.session.access_token);
  if (error) throw error;
  return data.user;
}
export async function getOrganizations(): Promise<Organization[]> {
  return unwrap((await db.from("organizations").select("id,legal_name,display_name,kind,status").order("created_at", { ascending: true })) as { data: Organization[] | null; error: { message: string } | null });
}
export async function getOperationsAccess(userId: string): Promise<boolean> {
  return (await getOperationsRoles(userId)).length > 0;
}
export async function getOperationsRoles(userId: string): Promise<OperationsRole[]> {
  const rows = unwrap((await db.from("operations_members").select("role").eq("user_id", userId)) as { data: Array<{ role: OperationsRole }> | null; error: { message: string } | null });
  return rows.map(item => item.role);
}
export async function getCategories(): Promise<Category[]> {
  return unwrap((await db.from("categories").select("id,name,slug").eq("is_active", true).order("name")) as { data: Category[] | null; error: { message: string } | null });
}
export async function getBuyerRfqs(organizationId: string): Promise<Rfq[]> {
  return unwrap((await db.from("rfqs").select("id,title,status,required_quantity,unit_of_measure,delivery_pin_code,quote_deadline,category_id,created_at,buyer_organization_id").eq("buyer_organization_id", organizationId).order("created_at", { ascending: false }).limit(50)) as { data: Rfq[] | null; error: { message: string } | null });
}
export async function getSellerRfqs(): Promise<Rfq[]> {
  return unwrap((await db.from("rfqs").select("id,title,status,required_quantity,unit_of_measure,delivery_pin_code,quote_deadline,category_id,created_at,buyer_organization_id").in("status", ["published", "receiving_quotes"]).in("visibility", ["verified_sellers", "public"]).order("created_at", { ascending: false }).limit(50)) as { data: Rfq[] | null; error: { message: string } | null });
}
export async function getQuotesForRfq(rfqId: string): Promise<Quote[]> {
  return unwrap((await db.from("rfq_quotes").select("id,rfq_id,seller_organization_id,status,current_version,quote_versions(version,unit_price,quantity,gst_rate,shipping_charge,additional_charges,discount_amount,lead_time_days,validity_ends_at)").eq("rfq_id", rfqId).order("created_at", { ascending: false })) as { data: Quote[] | null; error: { message: string } | null });
}
export async function getSellerQuotes(organizationId: string): Promise<Quote[]> {
  return unwrap((await db.from("rfq_quotes").select("id,rfq_id,seller_organization_id,status,current_version,quote_versions(version,unit_price,quantity,gst_rate,shipping_charge,additional_charges,discount_amount,lead_time_days,validity_ends_at)").eq("seller_organization_id", organizationId).order("created_at", { ascending: false }).limit(50)) as { data: Quote[] | null; error: { message: string } | null });
}
export async function getProducts(organizationId: string): Promise<Product[]> {
  return unwrap((await db.from("products").select("id,name,slug,seller_sku,description,category_id,hsn_code,unit_of_measure,gst_rate,lead_time_days,minimum_order_quantity,available_quantity,listing_status,moderation_status,moderation_notes,submitted_for_review_at,created_at,product_price_tiers(id,minimum_quantity,maximum_quantity,unit_price),auctions(status)").eq("organization_id", organizationId).neq("listing_status", "archived").order("created_at", { ascending: false }).limit(50)) as { data: Product[] | null; error: { message: string } | null });
}
export async function getOrders(organizationId: string): Promise<Order[]> {
  const orders = unwrap((await db.from("orders").select("id,order_number,status,grand_total,buyer_organization_id,seller_organization_id,inspection_ends_at,created_at,order_lines(id,product_id,description,hsn_code,quantity,unit_of_measure,unit_price,gst_rate),shipments(id,status,carrier,tracking_number,estimated_delivery_at),disputes(id,status,type,description,opened_at),reviews(id,rating,body),commercial_documents(id,order_id,type,document_number,version,storage_path,content_sha256,generated_at),payment_transactions(id,status,amount,currency,provider,provider_reference,provider_payment_reference,amount_refunded,reconciliation_status,created_at)").or(`buyer_organization_id.eq.${organizationId},seller_organization_id.eq.${organizationId}`).order("created_at", { ascending: false }).limit(50)) as { data: Order[] | null; error: { message: string } | null });
  // reviews.order_id is unique, so PostgREST returns a single review object (or null) rather
  // than a list. Normalise every nested relation to a list so screens can index them safely.
  const list = <T,>(value: T[] | T | null | undefined): T[] => Array.isArray(value) ? value : value ? [value] : [];
  return orders.map(order => ({
    ...order,
    order_lines: list(order.order_lines), shipments: list(order.shipments), disputes: list(order.disputes),
    reviews: list(order.reviews), commercial_documents: list(order.commercial_documents),
    payment_transactions: list(order.payment_transactions),
  }));
}

export type PaymentCheckout = {
  transaction_id: string; provider_order_id: string; key_id: string; amount_paise: number; currency: string;
};

export async function getPaymentAvailability(): Promise<boolean> {
  const { data, error } = await db.functions.invoke("payment-command", { body: { action: "status" } });
  if (error) return false;
  return Boolean((data as { available?: boolean } | null)?.available);
}

export async function initiateOrderPayment(orderId: string, requestId: string): Promise<PaymentCheckout> {
  const { data, error } = await db.functions.invoke("payment-command", { body: { action: "initiate", order_id: orderId, request_id: requestId } });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const details = await context.json().catch(() => null) as { message?: string; error?: string } | null;
      throw new Error(details?.message ?? details?.error ?? error.message);
    }
    throw error;
  }
  return data as PaymentCheckout;
}

export async function confirmOrderPayment(input: { providerOrderId: string; providerPaymentId: string; signature: string }) {
  const { data, error } = await db.functions.invoke("payment-command", { body: {
    action: "confirm", provider_order_id: input.providerOrderId,
    provider_payment_id: input.providerPaymentId, signature: input.signature,
  } });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const details = await context.json().catch(() => null) as { message?: string; error?: string } | null;
      throw new Error(details?.message ?? details?.error ?? error.message);
    }
    throw error;
  }
  return data as { accepted: boolean; status: string; transaction_id: string };
}
export async function createOrganization(input: { legalName: string; displayName: string; kind: BusinessKind; gstin?: string; businessType?: string; address?: Record<string, string> }): Promise<Organization> {
  return unwrap((await db.rpc("create_business_organization_command", {
    legal_name_input: input.legalName, display_name_input: input.displayName,
    kind_input: input.kind,
    ...(input.gstin ? { gstin_input: input.gstin } : {}),
    ...(input.businessType ? { business_type_input: input.businessType } : {}),
    ...(input.address ? { address_input: input.address } : {}),
  })) as { data: Organization | null; error: { message: string } | null });
}
export async function createRfq(organizationId: string, payload: Record<string, Json>): Promise<Rfq> {
  return unwrap((await db.rpc("create_rfq_command", {
    buyer_organization_id_input: organizationId, payload, request_id_input: crypto.randomUUID(),
  })) as { data: Rfq | null; error: { message: string } | null });
}
export async function publishRfq(id: string): Promise<Rfq> {
  return unwrap((await db.rpc("publish_rfq_command", { rfq_id_input: id })) as { data: Rfq | null; error: { message: string } | null });
}
export async function submitQuote(rfqId: string, organizationId: string, payload: Record<string, Json>): Promise<Quote> {
  return unwrap((await db.rpc("submit_quote_version_command", {
    rfq_id_input: rfqId, seller_organization_id_input: organizationId,
    payload, request_id_input: crypto.randomUUID(),
  })) as { data: Quote | null; error: { message: string } | null });
}
export async function acceptQuote(id: string): Promise<Order> {
  return unwrap((await db.rpc("accept_quote_command", { quote_id_input: id })) as { data: Order | null; error: { message: string } | null });
}
export async function createProduct(organizationId: string, payload: Record<string, Json>): Promise<Product> {
  return unwrap((await db.rpc("create_product_command", {
    organization_id_input: organizationId, payload, idempotency_key_input: crypto.randomUUID(),
  })) as { data: Product | null; error: { message: string } | null });
}
const SLUG_ATTEMPTS = 20;
// Slugs are unique across every seller, and a seller cannot see other sellers' drafts, so a
// clash only shows up on save. Retry with "-2", "-3"... instead of making the seller pick again.
export async function createProductWithUniqueSlug(organizationId: string, payload: Record<string, Json> & { slug: string }, sale?: { type: "regular" | "auction"; settings: Record<string, Json> }): Promise<Product> {
  for (let attempt = 1; ; attempt++) {
    try {
      const candidate = { ...payload, slug: slugCandidate(payload.slug, attempt) };
      if (!sale) return await createProduct(organizationId, candidate);
      return unwrap((await db.rpc("create_product_sale_command", {
        organization_id_input: organizationId, payload: candidate, idempotency_key_input: crypto.randomUUID(),
        sale_type_input: sale.type, sale_settings_input: sale.settings,
      })) as { data: Product | null; error: { message: string } | null });
    } catch (err) {
      const slugTaken = err instanceof Error && err.message.includes("products_slug_key");
      if (!slugTaken || attempt >= SLUG_ATTEMPTS) throw err;
    }
  }
}
export async function addPriceTier(productId: string, minimumQuantity: number, maximumQuantity: number, unitPrice: number) {
  return unwrap(await db.rpc("add_product_price_tier_command", {
    product_id_input: productId, minimum_quantity_input: minimumQuantity,
    maximum_quantity_input: maximumQuantity, unit_price_input: unitPrice,
  }));
}
export async function adjustInventory(productId: string, delta: number, reason: string): Promise<Product> {
  return unwrap((await db.rpc("adjust_inventory_command", {
    product_id_input: productId, delta_input: delta, reason_input: reason,
    request_id_input: crypto.randomUUID(),
  })) as { data: Product | null; error: { message: string } | null });
}
export async function reopenRejectedProduct(productId: string) {
  return unwrap(await db.rpc("reopen_rejected_product_command", { product_id_input: productId }));
}
export async function updateProductDraft(productId: string, payload: Record<string, Json>) {
  return unwrap(await db.rpc("update_product_draft_command", { product_id_input: productId, payload }));
}
export async function removeProduct(productId: string): Promise<void> {
  const { data: images, error: imageError } = await untypedDb.from("product_images").select("storage_path").eq("product_id", productId);
  if (imageError) throw new Error(imageError.message);
  const { data: result, error } = await untypedDb.rpc("remove_product_command", { product_id_input: productId });
  if (error) {
    if (/schema cache|could not find the function/i.test(error.message))
      throw new Error("Product deletion is not enabled in the database yet. A project administrator must apply the latest Supabase migration.");
    throw new Error(error.message);
  }
  // The database delete is authoritative. Storage cleanup is best-effort.
  const paths = (images as Array<{ storage_path: string }> | null)?.map(image => image.storage_path) ?? [];
  if (result === "deleted" && paths.length > 0) await db.storage.from(PRODUCT_IMAGE_BUCKET).remove(paths);
}
export async function deletePriceTier(tierId: string) {
  const { error } = await db.rpc("delete_product_price_tier_command", { tier_id_input: tierId });
  if (error) throw error;
}
export async function signOut() {
  const { error } = await db.auth.signOut();
  if (error) throw error;
}
export async function transitionOrder(id: string, nextState: Database["public"]["Enums"]["order_status"]): Promise<Order> {
  return unwrap((await db.rpc("transition_order_command", {
    order_id_input: id, next_state: nextState, request_id_input: crypto.randomUUID(),
  })) as { data: Order | null; error: { message: string } | null });
}
export async function getVerificationCase(organizationId: string): Promise<VerificationCase | null> {
  const { data, error } = await db.from("verification_cases")
    .select("id,organization_id,status,business_type,registered_address,submitted_at")
    .eq("organization_id", organizationId).maybeSingle();
  if (error) throw error;
  return data as VerificationCase | null;
}
export async function submitVerification(organizationId: string) {
  return unwrap(await db.rpc("submit_verification_case_command", { organization_id_input: organizationId }));
}
export async function submitProductForReview(productId: string) {
  return unwrap(await db.rpc("submit_product_for_review_command", { product_id_input: productId }));
}
export async function getVerificationQueue(): Promise<VerificationCase[]> {
  return unwrap((await db.from("verification_cases")
    .select("id,organization_id,status,business_type,registered_address,submitted_at")
    // Businesses that have not pressed "Submit for verification" are included so the admin
    // can still approve or reject them; submitted cases come first.
    .in("status", ["submitted", "under_review", "resubmission_required", "draft"])
    .order("submitted_at", { ascending: true, nullsFirst: false })) as { data: VerificationCase[] | null; error: { message: string } | null });
}
export async function reviewVerification(id: string, approve: boolean, notes: string) {
  return unwrap(await db.rpc("review_verification_case_command", {
    case_id_input: id, approve_input: approve,
    notes_input: notes.trim().length >= 10 ? notes.trim() : (notes.trim() ? `${notes.trim()} — reviewed by FeaBulk Admin` : approve ? "Approved by FeaBulk Admin" : "Rejected by FeaBulk Admin"),
  }));
}
// What a moderator needs to judge a listing, not just identify it.
const MODERATION_FIELDS = "id,name,slug,seller_sku,description,category_id,organization_id,unit_of_measure,hsn_code,gst_rate,lead_time_days,minimum_order_quantity,available_quantity,listing_status,moderation_status,submitted_for_review_at,created_at,product_price_tiers(id,minimum_quantity,maximum_quantity,unit_price)";
// Drafts that sellers saved but have not sent for review. Moderators cannot act on these;
// they are shown so "I saved a product but the admin cannot see it" has a visible answer.
export async function getUnsubmittedProductDrafts(): Promise<Product[]> {
  return unwrap((await db.from("products").select(MODERATION_FIELDS)
    .eq("listing_status", "draft").eq("moderation_status", "pending").is("submitted_for_review_at", null)
    .order("created_at", { ascending: false }).limit(50)) as { data: Product[] | null; error: { message: string } | null });
}
export async function getModerationQueue(): Promise<Product[]> {
  return unwrap((await db.from("products")
    .select(MODERATION_FIELDS)
    .eq("moderation_status", "pending").not("submitted_for_review_at", "is", null)
    .order("submitted_for_review_at")) as { data: Product[] | null; error: { message: string } | null });
}
export async function moderateProduct(id: string, approve: boolean, notes: string) {
  return unwrap(await db.rpc("moderate_product_command", {
    product_id_input: id, approve_input: approve, notes_input: notes,
  }));
}
export async function getNotifications(): Promise<Notification[]> {
  return unwrap((await db.from("notifications")
    .select("id,template_key,payload,read_at,created_at")
    .order("created_at", { ascending: false }).limit(20)) as { data: Notification[] | null; error: { message: string } | null });
}
export async function markNotificationRead(id: string) {
  return unwrap(await db.rpc("mark_notification_read_command", { notification_id_input: id }));
}
export async function searchPublishedProducts(term: string, categoryId: string, limit = 50, supplierId = ""): Promise<MarketplaceProduct[]> {
  return publicCatalogCache.read(JSON.stringify(["products", term.trim(), categoryId, limit, supplierId]), () => fetchPublishedProducts(term, categoryId, limit, supplierId));
}
async function fetchPublishedProducts(term: string, categoryId: string, limit: number, supplierId: string): Promise<MarketplaceProduct[]> {
  let query = db.from("products").select(
    "id,name,slug,seller_sku,description,category_id,organization_id,unit_of_measure,minimum_order_quantity,available_quantity,listing_status,moderation_status,submitted_for_review_at,created_at,product_price_tiers(minimum_quantity,maximum_quantity,unit_price)",
  ).eq("listing_status", "active").eq("moderation_status", "approved").limit(limit);
  if (term.trim()) query = query.textSearch("search_document", term.trim(), { type: "websearch" });
  if (categoryId) query = query.eq("category_id", categoryId);
  if (supplierId) query = query.eq("organization_id", supplierId);
  const products = unwrap((await query.order("created_at", { ascending: false })) as { data: MarketplaceProduct[] | null; error: { message: string } | null });
  if (products.length === 0) return [];
  const ids = [...new Set(products.map(item => item.organization_id))];
  const [supplierResult, images] = await Promise.all([
    db.from("supplier_directory").select("id,display_name").in("id", ids),
    getProductImages(products.map(item => item.id)),
  ]);
  const suppliers = unwrap(supplierResult as {
    data: Array<{ id: string; display_name: string }> | null; error: { message: string } | null;
  });
  const names = new Map(suppliers.map(item => [item.id, item.display_name]));
  return products.map(item => ({ ...item, supplier_name: names.get(item.organization_id) ?? "Verified supplier", images: images.get(item.id) ?? [] }));
}
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function startingUnitPrice(product: Pick<MarketplaceProduct, "product_price_tiers">): number | null {
  return product.product_price_tiers.reduce<number | null>((lowest, tier) => lowest === null ? Number(tier.unit_price) : Math.min(lowest, Number(tier.unit_price)), null);
}
export async function getPublishedProductBySlug(slug: string): Promise<ProductDetail | null> {
  return publicCatalogCache.read(JSON.stringify(["product-detail", slug]), () => fetchPublishedProductBySlug(slug));
}
async function fetchPublishedProductBySlug(slug: string): Promise<ProductDetail | null> {
  const { data, error } = await db.from("products").select(
    "id,name,slug,seller_sku,description,category_id,organization_id,unit_of_measure,hsn_code,gst_rate,lead_time_days,brand,manufacturer,country_of_origin,specifications,warranty_terms,sample_available,sample_price,customization_available,private_label_available,shipping_origin,quantity_increment,units_per_carton,minimum_order_quantity,available_quantity,listing_status,moderation_status,submitted_for_review_at,created_at,product_price_tiers(minimum_quantity,maximum_quantity,unit_price)",
  ).eq("slug", slug).eq("listing_status", "active").eq("moderation_status", "approved").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const product = data as unknown as Omit<ProductDetail, "category" | "supplier_name">;
  const [supplier, images, category] = await Promise.all([
    getSupplier(product.organization_id),
    getProductImages([product.id]),
    product.category_id
      ? db.from("categories").select("id,name,slug").eq("id", product.category_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (category.error) throw new Error(category.error.message);
  return {
    ...product,
    product_price_tiers: [...product.product_price_tiers].sort((a, b) => Number(a.minimum_quantity) - Number(b.minimum_quantity)),
    supplier_name: supplier?.display_name ?? "Verified supplier",
    images: images.get(product.id) ?? [],
    category: category.data as Category | null,
  };
}
const PRODUCT_IMAGE_BUCKET = "product-images";
const PRODUCT_IMAGE_EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const PRODUCT_IMAGE_ACCEPT = PRODUCT_IMAGE_TYPES.join(",");
export const PRODUCT_IMAGE_MAX_BYTES = IMAGE_MAX_BYTES;
export const PRODUCT_IMAGE_LIMIT = IMAGE_LIMIT;
// Public pages treat images as optional and fall back to the placeholder when the read fails.
// The seller's own workspace passes strict so a failed read is reported instead of hidden.
export async function getProductImages(productIds: string[], options: { strict?: boolean } = {}): Promise<Map<string, ProductImage[]>> {
  const images = new Map<string, ProductImage[]>();
  if (productIds.length === 0) return images;
  const { data, error } = await untypedDb.from("product_images").select("id,product_id,storage_path,alt_text")
    .in("product_id", productIds).order("sort_order").order("created_at");
  if (error && options.strict) throw new Error(error.message);
  if (error || !data) return images;
  for (const row of data as Array<Omit<ProductImage, "url">>) {
    const url = resolveProductImageUrl(row.storage_path, (key) => db.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(key).data.publicUrl);
    // A record whose path cannot load anywhere is skipped so the placeholder shows instead.
    if (!url) continue;
    images.set(row.product_id, [...(images.get(row.product_id) ?? []), { ...row, url }]);
  }
  return images;
}
// Stores the file under "<product id>/<random name>" and then records it against the product,
// so the photo is always tied to the product it was uploaded for.
export async function uploadProductImage(productId: string, file: File, altText: string): Promise<void> {
  const problem = productImageFileProblem(file);
  if (problem) throw new Error(problem);
  const extension = PRODUCT_IMAGE_EXTENSIONS[file.type];
  const path = `${productId}/${crypto.randomUUID()}.${extension}`;
  try {
    const upload = await db.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (upload.error) throw new Error(upload.error.message);
  } catch (err) {
    throw new Error(productImageErrorMessage(err instanceof Error ? err.message : String(err)));
  }
  const { error } = await untypedDb.rpc("add_product_image_command", {
    product_id_input: productId, storage_path_input: path, alt_text_input: altText,
  });
  if (error) {
    await db.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]).catch(() => undefined);
    throw new Error(productImageErrorMessage(error.message));
  }
}
// Uploads several photos one after another and reports each failure by file name, so one bad
// file does not hide the others or leave the seller guessing which photo is missing.
export async function uploadProductImages(productId: string, files: File[], altText = ""): Promise<{ uploaded: number; failures: string[] }> {
  let uploaded = 0;
  const failures: string[] = [];
  for (const file of files) {
    try {
      await uploadProductImage(productId, file, altText);
      uploaded++;
    } catch (err) {
      failures.push(`"${file.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { uploaded, failures };
}
export async function deleteProductImage(image: ProductImage): Promise<void> {
  const { error } = await untypedDb.rpc("delete_product_image_command", { image_id_input: image.id });
  if (error) throw new Error(error.message);
  // The listing no longer references the file; a failed cleanup only leaves an unused object.
  await db.storage.from(PRODUCT_IMAGE_BUCKET).remove([image.storage_path]);
}
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data, error } = await db.from("categories").select("id,name,slug").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Category | null;
}
// Suppliers have no slug column yet, so public supplier URLs carry the organization ID.
export async function getSupplier(id: string): Promise<Supplier | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const { data, error } = await db.from("supplier_directory").select("id,display_name,created_at").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Supplier | null;
}
// supplier_metrics is refreshed by a trigger on reviews, so a supplier without a row has no reviews.
export async function getSupplierRatings(supplierIds: string[]): Promise<Map<string, SupplierRating>> {
  const ids = [...new Set(supplierIds)];
  if (ids.length === 0) return new Map();
  const [metrics, reviews] = await Promise.all([
    db.from("supplier_metrics").select("organization_id,rating,order_completion_rate").in("organization_id", ids),
    db.from("reviews").select("seller_organization_id").in("seller_organization_id", ids).limit(5000),
  ]);
  if (metrics.error) throw new Error(metrics.error.message);
  if (reviews.error) throw new Error(reviews.error.message);
  const counts = new Map<string, number>();
  for (const review of reviews.data ?? []) counts.set(review.seller_organization_id, (counts.get(review.seller_organization_id) ?? 0) + 1);
  return new Map((metrics.data ?? []).map(item => [item.organization_id, {
    organization_id: item.organization_id, rating: Number(item.rating),
    review_count: counts.get(item.organization_id) ?? 0,
    order_completion_rate: Number(item.order_completion_rate),
  }]));
}
export async function getSupplierReviews(supplierId: string, limit = 20): Promise<SupplierReview[]> {
  return unwrap((await db.from("reviews").select("id,rating,body,created_at")
    .eq("seller_organization_id", supplierId).order("created_at", { ascending: false }).limit(limit)) as {
    data: SupplierReview[] | null; error: { message: string } | null;
  });
}
export async function getSupplierDirectory(): Promise<Array<{ id: string; display_name: string }>> {
  return unwrap((await db.from("supplier_directory").select("id,display_name").order("display_name").limit(100)) as {
    data: Array<{ id: string; display_name: string }> | null; error: { message: string } | null;
  });
}
export async function getOrCreateConversation(context: "quote" | "order", referenceId: string): Promise<TradeConversation> {
  return unwrap((await db.rpc("get_or_create_trade_conversation_command", {
    context_input: context, reference_id_input: referenceId,
  })) as { data: TradeConversation | null; error: { message: string } | null });
}
export async function getMessages(conversationId: string): Promise<TradeMessage[]> {
  return unwrap((await db.from("messages").select("id,conversation_id,sender_organization_id,body,created_at")
    .eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(100)) as {
    data: TradeMessage[] | null; error: { message: string } | null;
  });
}
// Calls onMessage for each new message the caller is allowed to read, and onSubscribed
// once the stream is live so the caller can reload anything sent while it was connecting.
// Needs public.messages in the supabase_realtime publication; without it no events arrive.
export function subscribeToMessages(conversationId: string, onMessage: (message: TradeMessage) => void, onSubscribed?: () => void): () => void {
  const channel = db.channel(`trade-messages:${conversationId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, payload => {
      const row = payload.new as TradeMessage;
      onMessage({ id: row.id, conversation_id: row.conversation_id, sender_organization_id: row.sender_organization_id, body: row.body, created_at: row.created_at });
    })
    .subscribe(status => { if (status === "SUBSCRIBED") onSubscribed?.(); });
  return () => { void db.removeChannel(channel); };
}
export async function sendMessage(conversationId: string, senderOrganizationId: string, body: string): Promise<TradeMessage> {
  return unwrap((await db.rpc("send_trade_message_command", {
    conversation_id_input: conversationId, sender_organization_id_input: senderOrganizationId,
    body_input: body, request_id_input: crypto.randomUUID(),
  })) as { data: TradeMessage | null; error: { message: string } | null });
}
export async function getTeamMembers(organizationId: string): Promise<TeamMember[]> {
  return unwrap((await db.rpc("list_team_members_command", { organization_id_input: organizationId })) as {
    data: TeamMember[] | null; error: { message: string } | null;
  });
}
export async function getOrganizationInvitations(organizationId: string): Promise<OrganizationInvitation[]> {
  return unwrap((await db.from("organization_invitations")
    .select("id,organization_id,email,role,token,expires_at,accepted_at,created_at")
    .eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50)) as {
    data: OrganizationInvitation[] | null; error: { message: string } | null;
  });
}
export async function createOrganizationInvitation(organizationId: string, email: string, role: TeamRole): Promise<OrganizationInvitation> {
  return unwrap((await db.rpc("create_organization_invitation_command", {
    organization_id_input: organizationId, email_input: email, role_input: role,
  })) as { data: OrganizationInvitation | null; error: { message: string } | null });
}
export async function acceptOrganizationInvitation(token: string) {
  return unwrap(await db.rpc("accept_organization_invitation_command", { token_input: token }));
}
export async function removeTeamMember(organizationId: string, userId: string) {
  const { error } = await db.rpc("remove_team_member_command", {
    organization_id_input: organizationId, user_id_input: userId,
  });
  if (error) throw error;
}
export async function createShipment(orderId: string, input: {
  shippingMode: string; freightType: string; carrier: string; trackingNumber: string;
  estimatedDeliveryAt: string; lines: Array<{ order_line_id: string; quantity: number }>;
}) {
  return unwrap(await db.rpc("create_shipment_command", {
    order_id_input: orderId, shipping_mode_input: input.shippingMode,
    freight_type_input: input.freightType, carrier_input: input.carrier,
    tracking_number_input: input.trackingNumber,
    estimated_delivery_input: input.estimatedDeliveryAt,
    lines_input: input.lines, request_id_input: crypto.randomUUID(),
  }));
}
export async function dispatchShipment(id: string) {
  return unwrap(await db.rpc("dispatch_shipment_command", { shipment_id_input: id }));
}
export async function confirmShipmentDelivery(id: string) {
  return unwrap(await db.rpc("confirm_shipment_delivery_command", { shipment_id_input: id }));
}
export async function openDispute(orderId: string, organizationId: string, type: string, description: string) {
  return unwrap(await db.rpc("open_dispute_command", {
    order_id_input: orderId, organization_id_input: organizationId,
    type_input: type, description_input: description, request_id_input: crypto.randomUUID(),
  }));
}
export async function completeOrderInspection(orderId: string) {
  return unwrap(await db.rpc("complete_order_inspection_command", { order_id_input: orderId }));
}
export async function createReview(orderId: string, rating: number, body: string) {
  return unwrap(await db.rpc("create_review_command", {
    order_id_input: orderId, rating_input: rating, body_input: body,
  }));
}
export async function setOrderLineHsn(orderLineId: string, hsnCode: string) {
  return unwrap(await db.rpc("set_order_line_tax_details_command", {
    order_line_id_input: orderLineId, hsn_code_input: hsnCode,
  }));
}
export async function generateCommercialDocument(orderId: string, organizationId: string, documentType: CommercialDocument["type"]) {
  const { data, error } = await db.functions.invoke("commercial-document", { body: {
    order_id: orderId, organization_id: organizationId,
    document_type: documentType, request_id: crypto.randomUUID(),
  } });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const details = await context.json().catch(() => null) as { message?: string; error?: string } | null;
      throw new Error(details?.message ?? details?.error ?? error.message);
    }
    throw error;
  }
  return data as { document: CommercialDocument; signed_url: string };
}
export async function getCommercialDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await db.storage.from("commercial-documents").createSignedUrl(storagePath, 600);
  if (error) throw error;
  return data.signedUrl;
}
export async function getDisputeQueue(): Promise<Dispute[]> {
  return unwrap((await db.from("disputes").select("id,order_id,opened_by_organization_id,type,status,description,opened_at,resolution")
    .neq("status", "resolved").order("opened_at")) as { data: Dispute[] | null; error: { message: string } | null });
}
export async function resolveDispute(id: string, outcome: string, notes: string) {
  return unwrap(await db.rpc("resolve_dispute_command", {
    dispute_id_input: id, outcome_input: outcome, notes_input: notes,
  }));
}
export async function getOperationsHealth(): Promise<OperationsHealth> {
  return unwrap((await db.rpc("get_operations_health_command")) as {
    data: OperationsHealth | null; error: { message: string } | null;
  });
}
export async function acknowledgeOperationalIncident(id: string, notes: string) {
  return unwrap(await db.rpc("acknowledge_operational_incident_command", {
    incident_id_input: id, notes_input: notes,
  }));
}

type UntypedRpcResult<T> = { data: T | null; error: { message: string } | null };
async function callUntypedRpc<T>(name: string): Promise<T> {
  const call = db.rpc.bind(db) as unknown as (functionName: string) => Promise<UntypedRpcResult<T>>;
  return unwrap(await call(name));
}
export async function getPlatformAccounts(): Promise<PlatformAccount[]> {
  return callUntypedRpc<PlatformAccount[]>("get_platform_accounts_command");
}
export async function getPlatformOrganizations(): Promise<PlatformOrganization[]> {
  return callUntypedRpc<PlatformOrganization[]>("get_platform_organizations_command");
}

export type PlatformOrder = { id: string; order_number: string; status: string; grand_total: number; buyer_name: string; seller_name: string; created_at: string; payment_status: string | null; shipment_status: string | null };
export type PlatformPayment = { id: string; order_number: string; provider: string; provider_reference: string | null; status: string; amount: number; reconciliation_status: string; verified_at: string | null; created_at: string };
export type AdminCategory = { id: string; parent_id: string | null; name: string; slug: string; is_active: boolean; product_count: number };
export async function getPlatformOrders(): Promise<PlatformOrder[]> {
  return callUntypedRpc<PlatformOrder[]>("get_platform_orders_command");
}
export async function getPlatformPayments(): Promise<PlatformPayment[]> {
  return callUntypedRpc<PlatformPayment[]>("get_platform_payments_command");
}
export async function getAdminCategories(): Promise<AdminCategory[]> {
  return callUntypedRpc<AdminCategory[]>("get_all_categories_command");
}
export async function saveCategory(input: { id: string | null; name: string; slug: string; parent_id: string | null; is_active: boolean }) {
  const call = db.rpc.bind(db) as unknown as (n: string, a: Record<string, unknown>) => Promise<UntypedRpcResult<string>>;
  return unwrap(await call("upsert_category_command", {
    id_input: input.id, name_input: input.name, slug_input: input.slug, parent_id_input: input.parent_id, is_active_input: input.is_active,
  }));
}

// Buyers order listed products directly at the tier price; the seller then confirms.
export async function placeDirectOrder(input: { productId: string; buyerOrganizationId: string; quantity: number; addressLine: string; pinCode: string }): Promise<Order> {
  return unwrap((await db.rpc("place_direct_order_command" as never, {
    product_id_input: input.productId,
    buyer_organization_id_input: input.buyerOrganizationId,
    quantity_input: input.quantity,
    delivery_address_input: { address_line: input.addressLine, pin_code: input.pinCode },
  } as never)) as unknown as { data: Order | null; error: { message: string } | null });
}

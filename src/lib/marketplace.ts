import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

const db = supabase;

export type BusinessKind = "buyer" | "seller" | "both";
export type Organization = {
  id: string;
  legal_name: string;
  display_name: string;
  kind: BusinessKind;
  status: "pending_verification" | "verified" | "suspended";
};
export type Category = { id: string; name: string };
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
  product_price_tiers?: Array<{ id: string; minimum_quantity: number; maximum_quantity: number; unit_price: number }>;
};
export type Order = {
  id: string; order_number: string; status: string; grand_total: number;
  buyer_organization_id: string; seller_organization_id: string; created_at: string;
  inspection_ends_at: string | null;
  order_lines: Array<{ id: string; description: string; hsn_code: string | null; quantity: number; unit_of_measure: string; unit_price: number; gst_rate: number }>;
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
};
export type TradeConversation = {
  id: string; context: "quote" | "order"; buyer_organization_id: string;
  seller_organization_id: string; quote_id: string | null; order_id: string | null;
};
export type TradeMessage = {
  id: string; conversation_id: string; sender_organization_id: string | null;
  body: string; created_at: string;
};
export type TeamRole = Database["public"]["Enums"]["organization_role"];
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
  const rows = unwrap((await db.from("operations_members").select("role").eq("user_id", userId).limit(1)) as { data: Array<{ role: string }> | null; error: { message: string } | null });
  return rows.length > 0;
}
export async function getCategories(): Promise<Category[]> {
  return unwrap((await db.from("categories").select("id,name").eq("is_active", true).order("name")) as { data: Category[] | null; error: { message: string } | null });
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
  return unwrap((await db.from("products").select("id,name,slug,seller_sku,description,category_id,hsn_code,unit_of_measure,gst_rate,lead_time_days,minimum_order_quantity,available_quantity,listing_status,moderation_status,moderation_notes,submitted_for_review_at,created_at,product_price_tiers(id,minimum_quantity,maximum_quantity,unit_price)").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50)) as { data: Product[] | null; error: { message: string } | null });
}
export async function getOrders(organizationId: string): Promise<Order[]> {
  return unwrap((await db.from("orders").select("id,order_number,status,grand_total,buyer_organization_id,seller_organization_id,inspection_ends_at,created_at,order_lines(id,description,hsn_code,quantity,unit_of_measure,unit_price,gst_rate),shipments(id,status,carrier,tracking_number,estimated_delivery_at),disputes(id,status,type,description,opened_at),reviews(id,rating,body),commercial_documents(id,order_id,type,document_number,version,storage_path,content_sha256,generated_at),payment_transactions(id,status,amount,currency,provider,provider_reference,provider_payment_reference,amount_refunded,reconciliation_status,created_at)").or(`buyer_organization_id.eq.${organizationId},seller_organization_id.eq.${organizationId}`).order("created_at", { ascending: false }).limit(50)) as { data: Order[] | null; error: { message: string } | null });
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
    .in("status", ["submitted", "under_review"]).order("submitted_at")) as { data: VerificationCase[] | null; error: { message: string } | null });
}
export async function reviewVerification(id: string, approve: boolean, notes: string) {
  return unwrap(await db.rpc("review_verification_case_command", {
    case_id_input: id, approve_input: approve, notes_input: notes,
  }));
}
export async function getModerationQueue(): Promise<Product[]> {
  return unwrap((await db.from("products")
    .select("id,name,slug,seller_sku,minimum_order_quantity,available_quantity,listing_status,moderation_status,submitted_for_review_at,created_at")
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
export async function searchPublishedProducts(term: string, categoryId: string): Promise<MarketplaceProduct[]> {
  let query = db.from("products").select(
    "id,name,slug,seller_sku,description,category_id,organization_id,minimum_order_quantity,available_quantity,listing_status,moderation_status,submitted_for_review_at,created_at,product_price_tiers(minimum_quantity,maximum_quantity,unit_price)",
  ).eq("listing_status", "active").eq("moderation_status", "approved").limit(50);
  if (term.trim()) query = query.textSearch("search_document", term.trim(), { type: "websearch" });
  if (categoryId) query = query.eq("category_id", categoryId);
  const products = unwrap((await query.order("created_at", { ascending: false })) as { data: MarketplaceProduct[] | null; error: { message: string } | null });
  if (products.length === 0) return [];
  const ids = [...new Set(products.map(item => item.organization_id))];
  const suppliers = unwrap((await db.from("supplier_directory").select("id,display_name").in("id", ids)) as {
    data: Array<{ id: string; display_name: string }> | null; error: { message: string } | null;
  });
  const names = new Map(suppliers.map(item => [item.id, item.display_name]));
  return products.map(item => ({ ...item, supplier_name: names.get(item.organization_id) ?? "Verified supplier" }));
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

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const documentTypes = ["purchase_order", "proforma_invoice", "tax_invoice", "delivery_challan", "packing_list"] as const;
type DocumentType = typeof documentTypes[number];
type Input = { order_id: string; organization_id: string; document_type: DocumentType; request_id: string };

const htmlEscape = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const money = (value: unknown) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0));
const label = (type: DocumentType) => ({ purchase_order: "Purchase Order", proforma_invoice: "Proforma Invoice", tax_invoice: "Tax Invoice", delivery_challan: "Delivery Challan", packing_list: "Packing List" })[type];
const addressText = (value: unknown) => {
  const address = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return [address.address, address.address_line, address.line1, address.line2, address.city, address.state, address.pin_code, address.pin].filter(Boolean).map(htmlEscape).join(", ");
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });

function renderDocument(input: {
  type: DocumentType; number: string; version: number; order: Record<string, any>;
  issuer: Record<string, any>; recipient: Record<string, any>; issuerAddress: unknown; recipientAddress: unknown;
}) {
  const { type, number, version, order, issuer, recipient } = input;
  const isTaxInvoice = type === "tax_invoice";
  const sameState = isTaxInvoice && String(issuer.gstin).slice(0, 2) === String(recipient.gstin).slice(0, 2);
  const lines = (order.order_lines ?? []) as Array<Record<string, any>>;
  const rows = lines.map((line, index) => {
    const taxable = Number(line.quantity) * Number(line.unit_price);
    const allocatedDiscount = Number(order.taxable_amount) > 0 ? Number(order.discount_amount) * taxable / Number(order.taxable_amount) : 0;
    const tax = (taxable - allocatedDiscount) * Number(line.gst_rate) / 100;
    return `<tr><td>${index + 1}</td><td>${htmlEscape(line.description)}${line.seller_sku ? `<br><small>SKU: ${htmlEscape(line.seller_sku)}</small>` : ""}</td><td>${htmlEscape(line.hsn_code || "—")}</td><td class="num">${htmlEscape(line.quantity)} ${htmlEscape(line.unit_of_measure)}</td><td class="num">₹${money(line.unit_price)}</td><td class="num">₹${money(taxable)}</td><td class="num">${money(line.gst_rate)}%</td><td class="num">₹${money(tax)}</td></tr>`;
  }).join("");
  const taxBreakdown = isTaxInvoice ? (sameState
    ? `<div><span>CGST</span><strong>₹${money(Number(order.gst_amount) / 2)}</strong></div><div><span>SGST</span><strong>₹${money(Number(order.gst_amount) / 2)}</strong></div>`
    : `<div><span>IGST</span><strong>₹${money(order.gst_amount)}</strong></div>`) : `<div><span>GST</span><strong>₹${money(order.gst_amount)}</strong></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><meta name="viewport" content="width=device-width"><title>${htmlEscape(label(type))} ${htmlEscape(number)}</title><style>
  @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#102b52;margin:0;font-size:12px;line-height:1.45}header{display:flex;justify-content:space-between;border-bottom:3px solid #f87908;padding-bottom:14px}.brand{font-size:24px;font-weight:800}.brand b{color:#f87908}.title{text-align:right}h1{font-size:24px;margin:0}.muted{color:#526178}.parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:22px 0}.box{border:1px solid #c9d3df;padding:12px}.box h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px;color:#526178}.box p{margin:3px 0}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{border:1px solid #c9d3df;padding:8px;vertical-align:top}th{background:#eaf2fb;text-align:left}.num{text-align:right;white-space:nowrap}.totals{margin-left:auto;width:310px}.totals div{display:flex;justify-content:space-between;padding:5px 0}.totals .grand{font-size:15px;border-top:2px solid #102b52;margin-top:5px;padding-top:9px}.note{margin-top:25px;border-top:1px solid #c9d3df;padding-top:10px}.footer{margin-top:35px;display:flex;justify-content:space-between}.signature{text-align:center;min-width:190px;border-top:1px solid #102b52;padding-top:7px;margin-top:35px}@media print{button{display:none}}</style></head><body>
  <header><div><div class="brand">FEA<b>Bulk</b></div><div class="muted">Commercial document record</div></div><div class="title"><h1>${htmlEscape(label(type))}</h1><div><strong>${htmlEscape(number)}</strong> · Version ${version}</div><div class="muted">Issued ${htmlEscape(new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }))} IST</div></div></header>
  <section class="parties"><div class="box"><h2>${type === "purchase_order" ? "Buyer / issuer" : "Seller / issuer"}</h2><p><strong>${htmlEscape(issuer.legal_name)}</strong></p><p>${addressText(input.issuerAddress) || "Address unavailable"}</p><p>GSTIN: ${htmlEscape(issuer.gstin || "Not provided")}</p></div><div class="box"><h2>${type === "purchase_order" ? "Supplier" : "Buyer / recipient"}</h2><p><strong>${htmlEscape(recipient.legal_name)}</strong></p><p>${addressText(input.recipientAddress) || "Address unavailable"}</p><p>GSTIN: ${htmlEscape(recipient.gstin || "Not provided")}</p></div></section>
  <div class="box"><strong>Order:</strong> ${htmlEscape(order.order_number)} &nbsp; <strong>Currency:</strong> ${htmlEscape(order.currency)} &nbsp; <strong>Status:</strong> ${htmlEscape(String(order.status).replaceAll("_", " "))}<br><strong>Delivery address:</strong> ${addressText(order.delivery_address)}</div>
  <table><thead><tr><th>#</th><th>Description</th><th>HSN</th><th class="num">Quantity</th><th class="num">Unit price</th><th class="num">Taxable</th><th class="num">GST</th><th class="num">Tax</th></tr></thead><tbody>${rows}</tbody></table>
  <section class="totals"><div><span>Taxable value</span><strong>₹${money(order.taxable_amount)}</strong></div><div><span>Freight</span><strong>₹${money(order.freight_amount)}</strong></div><div><span>Additional charges</span><strong>₹${money(order.additional_charge_amount)}</strong></div><div><span>Discount</span><strong>− ₹${money(order.discount_amount)}</strong></div>${taxBreakdown}<div class="grand"><span>Grand total</span><strong>₹${money(order.grand_total)}</strong></div></section>
  ${type === "proforma_invoice" ? '<p class="note"><strong>Notice:</strong> This proforma invoice is a commercial offer and is not a tax invoice.</p>' : ""}
  <footer class="footer"><div><strong>System record</strong><br><span class="muted">Generated from the accepted FeaBulk order snapshot.</span></div><div class="signature">Authorized signatory<br>${htmlEscape(issuer.legal_name)}</div></footer>
  </body></html>`;
}

export default Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("authorization") ?? "";
  if (!supabaseUrl || !serviceKey) return json({ error: "server_not_configured" }, 503);
  if (!authorization.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401);
  let input: Input;
  try { input = await request.json() as Input; } catch { return json({ error: "invalid_json" }, 400); }
  if (!input.order_id || !input.organization_id || !input.request_id || !documentTypes.includes(input.document_type)) return json({ error: "invalid_request" }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = authorization.slice(7);
  const { data: identity, error: identityError } = await admin.auth.getUser(token);
  if (identityError || !identity.user) return json({ error: "invalid_session" }, 401);

  const { data: job, error: reserveError } = await admin.rpc("reserve_commercial_document_internal", {
    actor_id_input: identity.user.id, organization_id_input: input.organization_id,
    order_id_input: input.order_id, document_type_input: input.document_type, request_id_input: input.request_id,
  });
  if (reserveError) return json({ error: "document_not_allowed", message: reserveError.message }, 422);

  if (job.status === "generated") {
    const { data: existing } = await admin.from("commercial_documents").select("*").eq("storage_path", job.storage_path).single();
    const { data: signed } = await admin.storage.from("commercial-documents").createSignedUrl(job.storage_path, 600);
    return json({ document: existing, signed_url: signed?.signedUrl });
  }
  if (job.status === "failed") return json({ error: "generation_previously_failed", message: job.failure_code }, 409);

  const { data: order, error: orderError } = await admin.from("orders")
    .select("id,order_number,status,currency,taxable_amount,gst_amount,freight_amount,additional_charge_amount,discount_amount,grand_total,delivery_address,buyer_organization_id,seller_organization_id,order_lines(id,description,seller_sku,hsn_code,quantity,unit_of_measure,unit_price,gst_rate)")
    .eq("id", input.order_id).single();
  if (orderError || !order) return json({ error: "order_snapshot_failed" }, 500);
  const [{ data: buyer }, { data: seller }, { data: buyerCase }, { data: sellerCase }] = await Promise.all([
    admin.from("organizations").select("id,legal_name,display_name,gstin,status").eq("id", order.buyer_organization_id).single(),
    admin.from("organizations").select("id,legal_name,display_name,gstin,status").eq("id", order.seller_organization_id).single(),
    admin.from("verification_cases").select("registered_address").eq("organization_id", order.buyer_organization_id).maybeSingle(),
    admin.from("verification_cases").select("registered_address").eq("organization_id", order.seller_organization_id).maybeSingle(),
  ]);
  if (!buyer || !seller) return json({ error: "organization_snapshot_failed" }, 500);
  const issuer = input.document_type === "purchase_order" ? buyer : seller;
  const recipient = input.document_type === "purchase_order" ? seller : buyer;
  const issuerAddress = input.document_type === "purchase_order" ? buyerCase?.registered_address : sellerCase?.registered_address;
  const recipientAddress = input.document_type === "purchase_order" ? sellerCase?.registered_address : buyerCase?.registered_address;
  const html = renderDocument({ type: input.document_type, number: job.document_number, version: job.version, order, issuer, recipient, issuerAddress, recipientAddress });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html));
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const { error: uploadError } = await admin.storage.from("commercial-documents").upload(job.storage_path, new Blob([html], { type: "text/html" }), { contentType: "text/html", upsert: true, cacheControl: "0" });
  if (uploadError) return json({ error: "document_storage_failed", message: uploadError.message }, 503);
  const metadata = { mime_type: "text/html", order_number: order.order_number, issuer: { id: issuer.id, legal_name: issuer.legal_name, gstin: issuer.gstin }, recipient: { id: recipient.id, legal_name: recipient.legal_name, gstin: recipient.gstin }, generated_at: new Date().toISOString() };
  const { data: document, error: finalizeError } = await admin.rpc("finalize_commercial_document_internal", { job_id_input: job.id, content_sha256_input: sha256, metadata_input: metadata });
  if (finalizeError) return json({ error: "document_registration_failed", message: finalizeError.message }, 500);
  const { data: signed, error: signError } = await admin.storage.from("commercial-documents").createSignedUrl(job.storage_path, 600);
  if (signError) return json({ document, error: "download_link_failed" }, 500);
  return json({ document, signed_url: signed.signedUrl }, 201);
});

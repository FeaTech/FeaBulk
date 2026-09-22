import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });
const encoder = new TextEncoder();

type InitiateInput = { action: "initiate"; order_id: string; request_id: string };
type ConfirmInput = { action: "confirm"; provider_order_id: string; provider_payment_id: string; signature: string };
type Input = InitiateInput | ConfirmInput | { action: "status" };
type RazorpayOrder = { id: string; amount: number; currency: string; receipt: string; status: string };
type RazorpayOrderCollection = { items?: RazorpayOrder[] };
type RazorpayPayment = { id: string; order_id: string; amount: number; amount_refunded: number; currency: string; status: string };

async function hmacSha256(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

export default Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  const authorization = request.headers.get("authorization") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "server_not_configured" }, 503);
  if (!authorization.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401);
  let input: Input;
  try { input = await request.json() as Input; } catch { return json({ error: "invalid_json" }, 400); }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identity, error: identityError } = await admin.auth.getUser(authorization.slice(7));
  if (identityError || !identity.user) return json({ error: "invalid_session" }, 401);
  const caller = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } },
  });
  if (input.action === "status") return json({ available: Boolean(keyId && keySecret), provider: "razorpay" });
  if (!keyId || !keySecret) return json({ error: "payment_provider_not_configured" }, 503);
  const providerAuthorization = `Basic ${btoa(`${keyId}:${keySecret}`)}`;

  if (input.action === "initiate") {
    if (!uuid.test(input.order_id) || !uuid.test(input.request_id)) return json({ error: "invalid_request" }, 400);
    const { data: transaction, error: reserveError } = await caller.rpc("initiate_payment_attempt_command", {
      order_id_input: input.order_id, idempotency_key_input: input.request_id,
    });
    if (reserveError || !transaction) return json({ error: "payment_not_allowed", message: reserveError?.message }, 422);
    if (transaction.provider_reference) {
      return json({ transaction_id: transaction.id, provider_order_id: transaction.provider_reference, key_id: keyId, amount_paise: Math.round(Number(transaction.amount) * 100), currency: transaction.currency });
    }
    const receipt = `fea_${String(transaction.id).replaceAll("-", "")}`;
    const providerResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST", headers: { Authorization: providerAuthorization, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Math.round(Number(transaction.amount) * 100), currency: "INR", receipt, notes: { feabulk_order_id: input.order_id, feabulk_transaction_id: transaction.id } }),
    });
    const providerBody = await providerResponse.json().catch(() => null) as RazorpayOrder | { error?: { description?: string } } | null;
    let providerOrder = providerResponse.ok && providerBody && "id" in providerBody ? providerBody : null;
    if (!providerOrder) {
      const recoveryResponse = await fetch(`https://api.razorpay.com/v1/orders?receipt=${encodeURIComponent(receipt)}&count=1`, {
        headers: { Authorization: providerAuthorization },
      });
      const recovery = await recoveryResponse.json().catch(() => null) as RazorpayOrderCollection | null;
      providerOrder = recoveryResponse.ok ? recovery?.items?.find(item => item.receipt === receipt) ?? null : null;
    }
    if (!providerOrder) {
      const message = providerBody && "error" in providerBody ? providerBody.error?.description : "Razorpay order creation failed";
      if (providerResponse.status >= 400 && providerResponse.status < 500) await admin.rpc("fail_payment_attempt_internal", { transaction_id_input: transaction.id, failure_reason_input: message });
      return json({ error: "provider_order_failed", message }, providerResponse.status >= 500 ? 503 : 422);
    }
    if (providerOrder.amount !== Math.round(Number(transaction.amount) * 100) || providerOrder.currency !== "INR" || providerOrder.receipt !== receipt) {
      await admin.rpc("fail_payment_attempt_internal", { transaction_id_input: transaction.id, failure_reason_input: "Razorpay order response mismatch" });
      return json({ error: "provider_response_mismatch" }, 502);
    }
    const { data: attached, error: attachError } = await admin.rpc("attach_payment_provider_reference_internal", {
      transaction_id_input: transaction.id, provider_reference_input: providerOrder.id,
    });
    if (attachError || !attached) return json({ error: "payment_registration_failed", message: attachError?.message }, 500);
    return json({ transaction_id: attached.id, provider_order_id: providerOrder.id, key_id: keyId, amount_paise: providerOrder.amount, currency: providerOrder.currency }, 201);
  }

  if (input.action !== "confirm" || !input.provider_order_id || !input.provider_payment_id || !input.signature) return json({ error: "invalid_request" }, 400);
  const expectedSignature = await hmacSha256(keySecret, `${input.provider_order_id}|${input.provider_payment_id}`);
  if (!constantTimeEqual(input.signature, expectedSignature)) return json({ error: "invalid_payment_signature" }, 401);
  const { data: visibleTransaction, error: accessError } = await caller.from("payment_transactions")
    .select("id,provider_reference").eq("provider_reference", input.provider_order_id).maybeSingle();
  if (accessError || !visibleTransaction) return json({ error: "payment_access_denied" }, 403);
  const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(input.provider_payment_id)}`, {
    headers: { Authorization: providerAuthorization },
  });
  const payment = await paymentResponse.json().catch(() => null) as RazorpayPayment | null;
  if (!paymentResponse.ok || !payment) return json({ error: "payment_verification_failed" }, 503);
  if (payment.order_id !== input.provider_order_id || !["authorized", "captured"].includes(payment.status)) return json({ error: "payment_not_captured" }, 409);
  const eventType = payment.status === "captured" ? "payment.captured" : "payment.authorized";
  const paymentPayload = JSON.stringify(payment);
  const { data: applied, error: applyError } = await admin.rpc("apply_razorpay_payment_event_internal", {
    event_id_input: `checkout:${payment.id}:${payment.status}`,
    event_type_input: eventType,
    provider_reference_input: payment.order_id,
    payment_reference_input: payment.id,
    amount_paise_input: payment.amount,
    amount_refunded_paise_input: payment.amount_refunded ?? 0,
    currency_input: payment.currency,
    payload_sha256_input: await sha256(paymentPayload),
  });
  if (applyError || !applied) return json({ error: "payment_reconciliation_failed", message: applyError?.message }, 500);
  return json({ accepted: true, status: applied.status, transaction_id: applied.id });
});

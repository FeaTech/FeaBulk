import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  amount_refunded?: number;
  currency: string;
  status: string;
};
type RazorpayEvent = {
  event: string;
  payload?: { payment?: { entity?: RazorpayPayment } };
};

const encoder = new TextEncoder();
const supportedEvents = new Set(["payment.authorized", "payment.captured", "payment.failed", "payment.refunded"]);

async function hmacSha256(secret: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(payload: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(payload));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function equalConstantTime(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

export default Deno.serve(async (request) => {
  if (request.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !supabaseUrl || !serviceKey) return Response.json({ error: "webhook_not_configured" }, { status: 503 });

  const rawBody = await request.text();
  const suppliedSignature = request.headers.get("x-razorpay-signature") ?? "";
  const expectedSignature = await hmacSha256(secret, rawBody);
  if (!equalConstantTime(suppliedSignature, expectedSignature)) return Response.json({ error: "invalid_signature" }, { status: 401 });
  const eventId = request.headers.get("x-razorpay-event-id") ?? "";
  if (!eventId) return Response.json({ error: "missing_event_id" }, { status: 400 });

  let event: RazorpayEvent;
  try { event = JSON.parse(rawBody) as RazorpayEvent; } catch { return Response.json({ error: "invalid_payload" }, { status: 400 }); }
  if (!supportedEvents.has(event.event)) return Response.json({ ignored: true, event: event.event ?? "unknown" });
  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment.order_id || !Number.isInteger(payment.amount) || payment.amount <= 0 || payment.currency !== "INR") {
    return Response.json({ error: "invalid_payment_event" }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: transaction, error } = await admin.rpc("apply_razorpay_payment_event_internal", {
    event_id_input: eventId,
    event_type_input: event.event,
    provider_reference_input: payment.order_id,
    payment_reference_input: payment.id,
    amount_paise_input: payment.amount,
    amount_refunded_paise_input: payment.amount_refunded ?? 0,
    currency_input: payment.currency,
    payload_sha256_input: await sha256(rawBody),
  });
  if (error) {
    const unknownReference = error.message.includes("Unknown Razorpay order reference");
    return Response.json({ error: unknownReference ? "unknown_provider_reference" : "event_processing_failed" }, { status: unknownReference ? 404 : 422 });
  }
  return Response.json({ accepted: true, transaction_id: transaction.id, status: transaction.status });
});

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type ProviderEvent = {
  id: string;
  provider_reference: string;
  status: "captured" | "failed" | "refunded";
};

const encoder = new TextEncoder();

async function hmacSha256(secret: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

function equalConstantTime(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

export default Deno.serve(async (request) => {
  if (request.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });
  const secret = Deno.env.get("PAYMENT_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !supabaseUrl || !serviceKey) return Response.json({ error: "webhook_not_configured" }, { status: 503 });

  const rawBody = await request.text();
  const suppliedSignature = request.headers.get("x-fea-signature")?.replace(/^sha256=/, "") ?? "";
  const expectedSignature = await hmacSha256(secret, rawBody);
  if (!equalConstantTime(suppliedSignature, expectedSignature)) return Response.json({ error: "invalid_signature" }, { status: 401 });

  let event: ProviderEvent;
  try {
    event = JSON.parse(rawBody) as ProviderEvent;
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (!event.id || !event.provider_reference || !["captured", "failed", "refunded"].includes(event.status)) {
    return Response.json({ error: "invalid_event" }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: transaction, error: fetchError } = await admin
    .from("payment_transactions")
    .select("id, status, webhook_event_id")
    .eq("provider_reference", event.provider_reference)
    .maybeSingle();
  if (fetchError) return Response.json({ error: "transaction_lookup_failed" }, { status: 500 });
  if (!transaction) return Response.json({ error: "unknown_provider_reference" }, { status: 404 });
  if (transaction.webhook_event_id === event.id) return Response.json({ duplicate: true });
  if (transaction.webhook_event_id) return Response.json({ error: "replay_detected" }, { status: 409 });

  const { error: updateError } = await admin
    .from("payment_transactions")
    .update({ status: event.status, webhook_event_id: event.id, verified_at: new Date().toISOString() })
    .eq("id", transaction.id)
    .is("webhook_event_id", null);
  if (updateError) return Response.json({ error: "transaction_update_failed" }, { status: 500 });
  return Response.json({ accepted: true });
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/payment-webhook' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"name":"Functions"}'

*/

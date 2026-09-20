// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default { fetch: withSupabase({ auth: ["publishable", "secret"] }, async (request, ctx) => {
  if (request.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });
  const body = await request.json() as { organizationId?: string; idempotencyKey?: string; payload?: Record<string, unknown> };
  if (!body.organizationId || !body.idempotencyKey || !uuid.test(body.organizationId) || !uuid.test(body.idempotencyKey) || !body.payload) return Response.json({ error: "invalid_request" }, { status: 400 });
  const { data: auth } = await ctx.supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await ctx.supabase.rpc("create_product_command", { organization_id_input: body.organizationId, payload: body.payload, idempotency_key_input: body.idempotencyKey });
  return error ? Response.json({ error: error.message }, { status: 422 }) : Response.json({ data }, { status: 201 });
}) };

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/catalog-command' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"name":"Functions"}'

*/

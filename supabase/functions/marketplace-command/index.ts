import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type Command =
  | { action: "create_rfq"; organizationId: string; idempotencyKey: string; payload: Record<string, unknown> }
  | { action: "submit_quote"; organizationId: string; rfqId: string; idempotencyKey: string; payload: Record<string, unknown> }
  | { action: "transition_order"; orderId: string; nextState: string; idempotencyKey: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function badRequest(message: string) {
  return Response.json({ error: { code: "invalid_request", message } }, { status: 400 });
}

function isCommand(value: unknown): value is Command {
  if (value === null || typeof value !== "object") return false;
  const command = value as Record<string, unknown>;
  return typeof command.action === "string" && typeof command.idempotencyKey === "string" && uuid.test(command.idempotencyKey);
}

function assertUuid(value: unknown, field: string): string | Response {
  return typeof value === "string" && uuid.test(value) ? value : badRequest(`${field} must be a UUID`);
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: { code: "method_not_allowed", message: "Use POST" } }, { status: 405 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("Request body must be valid JSON");
    }
    if (!isCommand(body)) return badRequest("action and UUID idempotencyKey are required");

    const { data: auth, error: authError } = await ctx.supabase.auth.getUser();
    if (authError || !auth.user) return Response.json({ error: { code: "unauthorized", message: "Authentication required" } }, { status: 401 });

    if (body.action === "create_rfq") {
      const organizationId = assertUuid(body.organizationId, "organizationId");
      if (organizationId instanceof Response) return organizationId;
      if (!body.payload || typeof body.payload !== "object") return badRequest("payload is required");
      const { data, error } = await ctx.supabase.rpc("create_rfq_command", {
        buyer_organization_id_input: organizationId,
        payload: body.payload,
        request_id_input: body.idempotencyKey,
      });
      if (error) return Response.json({ error: { code: "rfq_create_failed", message: error.message } }, { status: 422 });
      return Response.json({ data }, { status: 201 });
    }

    if (body.action === "submit_quote") {
      const organizationId = assertUuid(body.organizationId, "organizationId");
      const rfqId = assertUuid(body.rfqId, "rfqId");
      if (organizationId instanceof Response) return organizationId;
      if (rfqId instanceof Response) return rfqId;
      if (!body.payload || typeof body.payload !== "object") return badRequest("payload is required");
      const { data, error } = await ctx.supabase.rpc("submit_quote_version_command", {
        rfq_id_input: rfqId,
        seller_organization_id_input: organizationId,
        payload: body.payload,
        request_id_input: body.idempotencyKey,
      });
      if (error) return Response.json({ error: { code: "quote_submit_failed", message: error.message } }, { status: 422 });
      return Response.json({ data }, { status: 201 });
    }

    const orderId = assertUuid(body.orderId, "orderId");
    if (orderId instanceof Response) return orderId;
    if (!body.nextState || typeof body.nextState !== "string") return badRequest("nextState is required");
    const { data, error } = await ctx.supabase.rpc("transition_order_command", {
      order_id_input: orderId,
      next_state: body.nextState,
      request_id_input: body.idempotencyKey,
    });
    if (error) return Response.json({ error: { code: "order_transition_failed", message: error.message } }, { status: 422 });
    return Response.json({ data });
  }),
};

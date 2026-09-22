# FeaBulk

FeaBulk is a B2B wholesale marketplace in active development. The app uses TanStack Start and Supabase. It is **not production ready**: real payment initiation and reconciliation, seller payouts, shipping integrations, tax-document generation, dispute resolution, monitoring, and end-to-end tests remain unfinished. Do not accept live orders or funds.

## Current working flows

- Email/password buyer or seller signup and organization-scoped access.
- Business creation and verification submission; operations reviewers approve or reject.
- Buyer RFQ drafting and publishing after verification.
- Seller listing drafts, price tiers, moderation submission and review.
- Seller quote submission with immutable versions; buyer comparison and quote acceptance.
- Organization invitations with role-scoped team membership.
- Buyer-seller messaging tied to quotes and orders.
- Order creation, seller confirmation, audited inventory reservation and adjustments.
- Partial shipments, dispatch, buyer delivery confirmation and timed inspection.
- Dispute opening, operations resolution and completed-order reviews.
- Durable in-app notifications and audit/outbox records for key transitions.

Business verification and listing moderation require an explicitly provisioned operations account. There is no self-service admin signup. To bootstrap the first platform administrator, an authorized database operator must insert the known Supabase Auth user ID into `public.operations_members` with role `platform_administrator`. Verify the person's identity first; never grant this role to an arbitrary buyer or seller account.

## Local setup

1. Install dependencies with `npm install`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to a development Supabase project. Do not put a service-role key in browser variables.
3. Apply `supabase/migrations` in timestamp order. Use a separate project for development and tests.
4. Run `npm run dev`; use `npx tsc --noEmit` and `npm run build` for checks.

The original Lovable project is at https://lovable.dev/projects/d8d14b79-c713-4212-9e16-d3e37891ee37 and the published preview is https://bulk-creator-hub.lovable.app. The linked Supabase project has the migrations applied. Review environment variables and deployment status separately before relying on the preview.

## Operational gaps

The `payment-webhook` Edge Function is only a generic signed-event receiver. It does not initiate a payment with a provider, verify a provider-specific event, or make payouts. Keep it disabled until a provider adapter, real credentials, replay tests and reconciliation are in place. Carrier tracking, GST document generation and provider-backed refunds also require actual service integrations and operational processes. Manual shipment tracking is persisted, but it is not synchronized with a carrier.

# FeaBulk

FeaBulk is a B2B wholesale marketplace in active development. The app uses TanStack Start and Supabase. It is **not production ready**: Razorpay credentials and account activation, seller Route onboarding and settlement release, provider-backed refunds, carrier integrations, external alert delivery, legal review of generated GST documents, and end-to-end tests remain unfinished. Do not accept live orders or funds.

## Current working flows

- Email/password buyer or seller signup and organization-scoped access.
- Business creation and verification submission; operations reviewers approve or reject.
- Buyer RFQ drafting and publishing after verification.
- Seller listing drafts, price tiers, moderation submission and review.
- Seller quote submission with immutable versions; buyer comparison and quote acceptance.
- Organization invitations with role-scoped team membership.
- Buyer-seller messaging tied to quotes and orders.
- Order creation, seller confirmation, audited inventory reservation and adjustments.
- Razorpay checkout order creation, callback verification, signed webhook reconciliation, replay protection and double-entry capture records.
- Partial shipments, dispatch, buyer delivery confirmation and timed inspection.
- Dispute opening, operations resolution and completed-order reviews.
- Durable in-app notifications and audit/outbox records for key transitions.
- Immutable, versioned purchase orders, proforma invoices, GST invoices, delivery challans and packing lists in private storage.
- Five-minute operational health scans for payment, payout, fulfilment, event delivery, document and SLA exceptions.

Business verification and listing moderation require an explicitly provisioned operations account. There is no self-service admin signup. To bootstrap the first platform administrator, an authorized database operator must insert the known Supabase Auth user ID into `public.operations_members` with role `platform_administrator`. Verify the person's identity first; never grant this role to an arbitrary buyer or seller account.

## Local setup

1. Install dependencies with `npm install`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to a development Supabase project. Do not put a service-role key in browser variables.
3. Apply `supabase/migrations` in timestamp order. Use a separate project for development and tests.
4. Run `npm run dev`; use `npx tsc --noEmit` and `npm run build` for checks.

### Razorpay test setup

The deployed `payment-command` and `payment-webhook` functions implement the Razorpay Orders and Payments flow. Store `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` as Supabase Edge Function secrets. Configure the Razorpay webhook URL as `https://<project-ref>.supabase.co/functions/v1/payment-webhook` and subscribe to `payment.authorized`, `payment.captured`, `payment.failed` and `payment.refunded`. The checkout action stays hidden when the provider credentials are absent. Use Razorpay test mode and replay the webhook test suite before enabling live keys.

The original Lovable project is at https://lovable.dev/projects/d8d14b79-c713-4212-9e16-d3e37891ee37 and the published preview is https://bulk-creator-hub.lovable.app. The linked Supabase project has the migrations applied. Review environment variables and deployment status separately before relying on the preview.

## Operational gaps

Razorpay payment collection is implemented but intentionally unavailable until valid test credentials are installed. Seller settlement still requires Razorpay Route linked-account onboarding, transfer creation on hold, inspection-based release and transfer webhook reconciliation. Provider-backed refunds and carrier tracking also require their external integrations and operational processes. Commercial documents are generated as immutable printable HTML records; a qualified Indian tax professional must approve their legal wording and fields before live use. Manual shipment tracking is persisted, but it is not synchronized with a carrier. Operational incidents are detected in the app, but external paging and email delivery are not configured.

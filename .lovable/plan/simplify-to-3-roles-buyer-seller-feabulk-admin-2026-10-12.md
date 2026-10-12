# Simplify to 3 roles: Buyer, Seller, FeaBulk Admin

## What changes for people

- **Sign up:** the form asks "I want to buy" or "I want to sell". The "both" option is removed. New accounts wait as "Pending approval" until a FeaBulk Admin approves them.
- **After login, each person gets their own screen:**
  - **Buyer screen** (`/buyer`): browse, send requests for quotes, see quotes, orders, deliveries, disputes, messages and teammates.
  - **Seller screen** (`/seller`): products, stock, incoming quote requests, sending quotes, orders, shipping, payouts, messages and teammates.
  - **FeaBulk Admin screen** (`/admin`): approve or reject new buyers and sellers, approve product listings, see all quote requests and orders, payments, disputes, categories and users.
  - Signing in sends each person to the right screen automatically. If you open someone else's screen, you get sent back to your own.
- **Pending accounts** see a "Your account is under review" page until they are approved. Rejected accounts see the reason.
- **Teammates:** a buyer or seller can invite teammates. Teammates get the same screen and access as the owner. There are no other company roles.
- **All requests go through the admin:** new businesses, product listings and disputes all need FeaBulk Admin approval. The approval queues are on the admin screen.

## Roles removed

- The 11 company roles become just **owner** and **member**, with the same access.
- The 6 admin roles become one role, **FeaBulk Admin**.
- The 2 people who are admins today (including b.kanth08@gmail.com) stay FeaBulk Admins. The 6 company owners stay owners.
- Any existing "both" business becomes a buyer. I'll tell you if there are any.

## Technical details

- Migration: rename the role values in place. Map `organization_role` to {owner, member}, with every non-owner becoming member. Collapse `operations_role` to {feabulk_admin}. Remove `both` from `organization_kind`. Rewrite the security-definer checks (`ops_has_role`, RLS helpers, `*_command` functions) that reference the old roles so they check `feabulk_admin`, or org membership with any role. Existing data stays.
- Routes: add `/buyer`, `/seller` and `/admin` under the protected layout. `/app` becomes a redirect that chooses a destination from the user's org kind, admin membership and verification status. The current `app.tsx` is split into buyer and seller views, reusing its sections. `operations.tsx` becomes `/admin` with one role check, and `/operations` redirects there.
- Signup: remove the "both" option from `auth.tsx`. The org is created with `status = pending_verification`, and the existing verification queue handles approvals.
- Every command function keeps checking access on the server. Hiding something on screen is never the only protection.

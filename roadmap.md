# Reference-site refresh

# Auction and payment readiness

- [ ] Enforce the seven-day deadline on late bids and test the rule.
- [ ] Add safe sale-choice editing for existing products.
- [ ] Implement automatic losing-token refunds with verified payment callbacks.
- [ ] Configure and test Razorpay; requires provider credentials.
- [ ] Verify signed-in publishing, approval, ordering, and payments; external Supabase session unavailable.

# Product sale choice

- [x] Add Regular sale/Auction selection and conditional new-product fields.
- [x] Save the selected pricing or auction settings atomically with the new product.
- [x] Verify isolated form switching, desktop/phone layout, and auction rule tests.
- [ ] Verify signed-in product saving; blocked by unavailable authenticated testing for external Supabase.

- [x] Align typography, semantic colors, and public-page spacing with feabulk.com.
- [x] Improve phone layouts and remove avoidable page-loading delays.
- [x] Verify public browsing and mobile rendering; authenticated checks remain unavailable for the external Supabase connection.

# Buyer and seller redesign

- [x] Add role-specific menus and page headings without changing access or actions.
- [x] Redesign activity summaries, orders, and product presentation using shared design tokens.
- [x] Check page rendering and isolated presentation interactions; authenticated end-to-end testing is unavailable for the external Supabase connection.

# Loading performance

- [x] Measure product and page loading and remove unnecessary waiting.
- [x] Reuse public catalog data on navigation and improve image decoding.
- [x] Verify product search and page navigation with live data; signed-in workspace timing remains unavailable for the external Supabase connection.
# Auctions for products

Sellers can choose to sell a product by auction instead of (or alongside) Buy now. Buyers pay a token to join, bid until the timer ends, and the winner buys at the final price with the token deducted. FeaBulk collects all money, as with normal orders.

## How it works

**Seller (when adding or editing a product)**
- New "Sell by auction" option with:
  - Lot: what the winner gets — seller chooses either a fixed whole lot (e.g. 5,000 units for one total price) or a per-unit price for a fixed quantity.
  - Starting price and minimum bid step.
  - Token amount (seller sets it, in rupees).
  - Duration: 1 to 7 days (start immediately once the listing is approved, or at a chosen start time).
- Auction goes through the same FeaBulk admin listing review before it goes live.
- Seller sees live bids, bidder count and the result on their screen.

**Buyer**
- Product page shows an auction panel: current highest bid, time left, bid history (bidder names hidden, e.g. "Bidder 3").
- "Join auction — pay ₹X token" opens the normal payment checkout. After payment, the buyer can place bids.
- Each bid must beat the current highest by at least the bid step; bids are refused after the end time.
- Buyer screen gets an "Auctions" section: auctions joined, your bid, winning/outbid, and balance to pay.

**When the auction ends**
- Highest bidder wins. An order is created automatically for the winning price, addressed to the seller, status "Awaiting payment".
- Winner pays the balance = final price + GST − token, from their Orders section.
- Losing bidders' tokens are refunded in full automatically.
- No bids: auction closes, all tokens refunded, seller can relist.
- Winner doesn't pay within the payment window (proposed: 48 hours): token is forfeited and the auction closes; seller can relist.

**FeaBulk Admin**
- New "Auctions" tab: live and ended auctions, tokens held, refunds, forfeits, unpaid winners.

## Decisions to confirm
- Payment window for the winner: 48 hours (adjustable).
- Anti-sniping: a bid in the last 2 minutes extends the end by 2 minutes (can drop if not wanted).
- Forfeited tokens: kept by FeaBulk, or passed to the seller? Proposed: passed to the seller minus FeaBulk fee — tell me if different.

## Technical details
- New tables: `auctions` (product, lot type, quantity, start price, bid step, token amount, starts_at, ends_at, status, winner, order_id), `auction_participants` (buyer org, token payment transaction, refund status), `auction_bids` (append-only). RLS: public read of live auction summary; bids readable with bidder anonymised; writes only through security-definer commands.
- Commands: `create_auction_command`, `place_bid_command` (row lock on auction, validates time, step, paid participant, not own product, max 7 days enforced by validation trigger), `settle_auction_command` (creates order, applies token as credit, queues refunds via `outbox_events`).
- Token payments reuse the existing Razorpay flow in `payment-command` with a new "auction_token" purpose; refunds use Razorpay refunds through the same function. Requires Razorpay keys to be configured (payments currently show unavailable without them).
- Ending auctions: settle on read when expired, plus one hourly scheduled backstop to settle auctions nobody viewed and expire unpaid winners.
- Realtime subscription on `auction_bids` for the live bid panel.
- UI: auction fields in the seller product form (`BusinessWorkspace`), `AuctionPanel` on `products/$slug`, auction badge on `ProductCard`, buyer/seller Auctions sections, admin Auctions tab.
- Tests: bid step, 7-day max, token deducted from balance, losers refunded, forfeit on non-payment.

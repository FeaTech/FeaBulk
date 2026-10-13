type ListingFacts = {
  listing_status: string;
  moderation_status: string;
  submitted_for_review_at: string | null;
  minimum_order_quantity: number;
  product_price_tiers?:
    Array<{ minimum_quantity: number | string; maximum_quantity: number | string }> | undefined;
};

export type ListingStage = "draft" | "in_review" | "rejected" | "live" | "inactive";

/** Where a listing is on its way from a seller's draft to the public marketplace. */
export function listingStage(product: ListingFacts): ListingStage {
  if (product.moderation_status === "rejected") return "rejected";
  if (product.listing_status === "active" && product.moderation_status === "approved")
    return "live";
  if (product.listing_status !== "draft") return "inactive";
  return product.submitted_for_review_at ? "in_review" : "draft";
}

export const LISTING_STAGE_LABELS: Record<ListingStage, string> = {
  draft: "Draft · not sent to the FeaBulk admin yet",
  in_review: "Sent · waiting for FeaBulk admin review",
  rejected: "Rejected · see the review note",
  live: "Live in the marketplace",
  inactive: "Not listed",
};

/**
 * The database only accepts a submission when one price tier includes the minimum order
 * quantity, so a buyer ordering the minimum always has a price.
 */
export function tierCoversMinimumOrder(product: ListingFacts): boolean {
  const minimum = Number(product.minimum_order_quantity);
  return (product.product_price_tiers ?? []).some(
    (tier) => Number(tier.minimum_quantity) <= minimum && Number(tier.maximum_quantity) >= minimum,
  );
}

/** What still stands between a draft and "Submit for review", in the order a seller fixes it. */
export function submissionBlockers(product: ListingFacts, sellerVerified: boolean): string[] {
  const blockers: string[] = [];
  const minimum = Number(product.minimum_order_quantity).toLocaleString("en-IN");
  if ((product.product_price_tiers ?? []).length === 0)
    blockers.push(`Add a price tier that starts at the minimum order quantity (${minimum}).`);
  else if (!tierCoversMinimumOrder(product))
    blockers.push(
      `No price tier includes the minimum order quantity (${minimum}). Add a tier that starts at ${minimum}.`,
    );
  if (!sellerVerified)
    blockers.push("Your business must be verified by FeaBulk before products can be submitted.");
  return blockers;
}

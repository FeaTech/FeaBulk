export type PriceTier = { minimum_quantity: number; maximum_quantity: number; unit_price: number };

export type PriceEstimate =
  | { status: "invalid" }
  | { status: "below_minimum"; minimumQuantity: number }
  // No tier covers the quantity, so the supplier has to quote it.
  | { status: "quote_required"; reason: "no_tiers" | "outside_tiers" }
  | {
      status: "priced";
      quantity: number;
      tier: PriceTier;
      unitPrice: number;
      subtotal: number;
      gstRate: number | null;
      gstAmount: number;
      total: number;
      // The next cheaper tier, when ordering more would lower the unit price.
      nextTier: { minimumQuantity: number; unitPrice: number } | null;
    };

/**
 * Indicative price for a quantity from a product's bulk tiers. Amounts are worked out in
 * paise so totals do not pick up floating point drift. GST is added only when the rate is known.
 */
export function estimatePrice(
  tiers: PriceTier[],
  quantity: number,
  options: { minimumOrderQuantity?: number; gstRate?: number | null } = {},
): PriceEstimate {
  if (!Number.isInteger(quantity) || quantity <= 0) return { status: "invalid" };
  const minimumOrderQuantity = Number(options.minimumOrderQuantity ?? 1);
  if (quantity < minimumOrderQuantity)
    return { status: "below_minimum", minimumQuantity: minimumOrderQuantity };

  const sorted = tiers
    .map((tier) => ({
      minimum_quantity: Number(tier.minimum_quantity),
      maximum_quantity: Number(tier.maximum_quantity),
      unit_price: Number(tier.unit_price),
    }))
    .sort((a, b) => a.minimum_quantity - b.minimum_quantity);
  if (sorted.length === 0) return { status: "quote_required", reason: "no_tiers" };

  const tier = sorted.find(
    (item) => quantity >= item.minimum_quantity && quantity <= item.maximum_quantity,
  );
  if (!tier) {
    const lowest = sorted[0]?.minimum_quantity ?? minimumOrderQuantity;
    return quantity < lowest
      ? { status: "below_minimum", minimumQuantity: lowest }
      : { status: "quote_required", reason: "outside_tiers" };
  }

  const gstRate = options.gstRate == null ? null : Number(options.gstRate);
  const subtotalPaise = Math.round(tier.unit_price * 100) * quantity;
  const gstPaise = gstRate === null ? 0 : Math.round((subtotalPaise * gstRate) / 100);
  const cheaper = sorted.find(
    (item) => item.minimum_quantity > quantity && item.unit_price < tier.unit_price,
  );
  return {
    status: "priced",
    quantity,
    tier,
    unitPrice: tier.unit_price,
    subtotal: subtotalPaise / 100,
    gstRate,
    gstAmount: gstPaise / 100,
    total: (subtotalPaise + gstPaise) / 100,
    nextTier: cheaper
      ? { minimumQuantity: cheaper.minimum_quantity, unitPrice: cheaper.unit_price }
      : null,
  };
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

type Tier = { unit_price: number | string };
type ViewProduct = {
  category_id: string | null;
  organization_id: string;
  minimum_order_quantity: number;
  created_at: string;
  name: string;
  product_price_tiers: Tier[];
  images?: unknown[] | undefined;
};

export type CatalogSort = "newest" | "price_low" | "price_high" | "moq_low" | "name";
export const CATALOG_SORTS: Array<{ value: CatalogSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "price_low", label: "Price: low to high" },
  { value: "price_high", label: "Price: high to low" },
  { value: "moq_low", label: "Lowest minimum order" },
  { value: "name", label: "Name: A to Z" },
];

export type CatalogFilters = {
  categoryId: string;
  supplierIds: string[];
  minPrice: number | null;
  maxPrice: number | null;
  maxMoq: number | null;
  withPhotos: boolean;
  sort: CatalogSort;
};

export const EMPTY_FILTERS: CatalogFilters = {
  categoryId: "",
  supplierIds: [],
  minPrice: null,
  maxPrice: null,
  maxMoq: null,
  withPhotos: false,
  sort: "newest",
};

/** Lowest and highest unit price across a product's bulk tiers, or null when unpriced. */
export function priceRange(tiers: Tier[]): { min: number; max: number } | null {
  const prices = tiers
    .map((tier) => Number(tier.unit_price))
    .filter((price) => Number.isFinite(price));
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** "₹28 – ₹34" for a tiered price, "₹28" for a single price. */
export function formatPriceRange(range: { min: number; max: number }): string {
  const format = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return range.min === range.max
    ? format(range.min)
    : `${format(range.min)} – ${format(range.max)}`;
}

/**
 * Applies the marketplace filters and sort. A price filter keeps a product when any of its
 * tiers falls inside the range, the way buyers read "products available at this price".
 * Unpriced products are left out of price filters and sorted after priced ones.
 */
export function applyCatalogView<T extends ViewProduct>(
  products: T[],
  filters: CatalogFilters,
): T[] {
  const filtered = products.filter((product) => {
    if (filters.categoryId && product.category_id !== filters.categoryId) return false;
    if (filters.supplierIds.length > 0 && !filters.supplierIds.includes(product.organization_id))
      return false;
    if (filters.maxMoq !== null && Number(product.minimum_order_quantity) > filters.maxMoq)
      return false;
    if (filters.withPhotos && (product.images?.length ?? 0) === 0) return false;
    if (filters.minPrice !== null || filters.maxPrice !== null) {
      const range = priceRange(product.product_price_tiers);
      if (!range) return false;
      if (filters.minPrice !== null && range.max < filters.minPrice) return false;
      if (filters.maxPrice !== null && range.min > filters.maxPrice) return false;
    }
    return true;
  });
  const lowest = (product: T) =>
    priceRange(product.product_price_tiers)?.min ?? Number.POSITIVE_INFINITY;
  const highest = (product: T) =>
    priceRange(product.product_price_tiers)?.max ?? Number.NEGATIVE_INFINITY;
  const sorted = [...filtered];
  switch (filters.sort) {
    case "price_low":
      return sorted.sort((a, b) => lowest(a) - lowest(b));
    case "price_high":
      return sorted.sort((a, b) => highest(b) - highest(a));
    case "moq_low":
      return sorted.sort(
        (a, b) => Number(a.minimum_order_quantity) - Number(b.minimum_order_quantity),
      );
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

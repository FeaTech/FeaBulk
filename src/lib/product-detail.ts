// Turns a product's stored attributes into the label/value rows and review summary the
// product details page shows. Kept free of React so the rules can be unit tested.

type SpecSource = {
  brand?: string | null;
  manufacturer?: string | null;
  country_of_origin?: string | null;
  unit_of_measure: string;
  minimum_order_quantity: number;
  quantity_increment?: number | null;
  units_per_carton?: number | null;
  available_quantity: number;
  lead_time_days: number;
  gst_rate: number | null;
  hsn_code: string | null;
  seller_sku: string;
  warranty_terms?: string | null;
  sample_available?: boolean | null;
  sample_price?: number | null;
  customization_available?: boolean | null;
  private_label_available?: boolean | null;
  specifications?: unknown;
};

const count = (value: number) => Number(value).toLocaleString("en-IN");
const titleCase = (key: string) =>
  key
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

/** Seller-entered specification pairs, skipping empty values and nested objects. */
export function customSpecifications(specifications: unknown): Array<[string, string]> {
  if (!specifications || typeof specifications !== "object" || Array.isArray(specifications))
    return [];
  return Object.entries(specifications as Record<string, unknown>)
    .filter(([key]) => key !== "description")
    .flatMap(([key, value]): Array<[string, string]> => {
      if (value === null || value === undefined || value === "") return [];
      if (Array.isArray(value)) {
        const items = value.filter((item) => typeof item === "string" || typeof item === "number");
        return items.length ? [[titleCase(key), items.join(", ")]] : [];
      }
      if (typeof value === "object") return [];
      if (typeof value === "boolean") return [[titleCase(key), value ? "Yes" : "No"]];
      return [[titleCase(key), String(value)]];
    });
}

/** The specification table: core trade facts first, then anything the seller added. */
export function productSpecifications(product: SpecSource): Array<[string, string]> {
  const unit = product.unit_of_measure;
  const rows: Array<[string, string | null | undefined | false]> = [
    ["Brand", product.brand],
    ["Manufacturer", product.manufacturer],
    ["Country of origin", product.country_of_origin],
    ["Sold in", unit],
    ["Minimum order", `${count(product.minimum_order_quantity)} ${unit}`],
    [
      "Order in multiples of",
      product.quantity_increment && Number(product.quantity_increment) > 1
        ? `${count(product.quantity_increment)} ${unit}`
        : null,
    ],
    ["Units per carton", product.units_per_carton ? count(product.units_per_carton) : null],
    ["Stock available", `${count(product.available_quantity)} ${unit}`],
    [
      "Dispatch time",
      `${product.lead_time_days} day${Number(product.lead_time_days) === 1 ? "" : "s"}`,
    ],
    ["GST rate", product.gst_rate === null ? null : `${Number(product.gst_rate)}%`],
    ["HSN code", product.hsn_code],
    ["Seller SKU", product.seller_sku],
    ["Warranty", product.warranty_terms],
    [
      "Samples",
      product.sample_available
        ? product.sample_price
          ? `Available at ₹${count(product.sample_price)}`
          : "Available"
        : null,
    ],
    ["Customisation", product.customization_available ? "Available" : null],
    ["Private label", product.private_label_available ? "Available" : null],
  ];
  return [
    ...rows.filter((row): row is [string, string] => typeof row[1] === "string" && row[1] !== ""),
    ...customSpecifications(product.specifications),
  ];
}

/** "Hyderabad, Telangana" from the stored shipping origin, when the seller gave one. */
export function shippingOrigin(origin: unknown): string | null {
  if (!origin || typeof origin !== "object" || Array.isArray(origin)) return null;
  const place = origin as Record<string, unknown>;
  const parts = ["city", "state"]
    .map((key) => place[key])
    .filter((value): value is string => typeof value === "string" && value.trim() !== "");
  return parts.length ? parts.join(", ") : null;
}

export type RatingSummary = {
  average: number;
  total: number;
  // Index 0 is five stars, index 4 is one star.
  counts: [number, number, number, number, number];
};

export function ratingSummary(reviews: Array<{ rating: number }>): RatingSummary {
  const counts: RatingSummary["counts"] = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const review of reviews) {
    const stars = Math.min(5, Math.max(1, Math.round(Number(review.rating))));
    const index = 5 - stars;
    counts[index] = (counts[index] ?? 0) + 1;
    sum += stars;
  }
  return {
    average: reviews.length ? Math.round((sum / reviews.length) * 10) / 10 : 0,
    total: reviews.length,
    counts,
  };
}

/** Whole years since a date, for "3 yrs on FeaBulk"; under a year reads as "New". */
export function yearsSince(date: string, now = new Date()): number {
  const start = new Date(date);
  let years = now.getFullYear() - start.getFullYear();
  const beforeAnniversary =
    now.getMonth() < start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}

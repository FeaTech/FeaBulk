import type { Product, ProductImage } from "@/lib/marketplace";

/** Everything a moderator needs to judge a listing: seller, terms, description, prices and photos. */
export function ProductReviewDetails({
  product,
  images,
  sellerName,
  categoryName,
}: {
  product: Product;
  images: ProductImage[];
  sellerName: string;
  categoryName: string;
}) {
  const unit = product.unit_of_measure ?? "units";
  const tiers = [...(product.product_price_tiers ?? [])].sort(
    (a, b) => Number(a.minimum_quantity) - Number(b.minimum_quantity),
  );
  const facts: Array<[string, string]> = [
    ["Seller", sellerName],
    ["Category", categoryName],
    ["Seller SKU", product.seller_sku],
    ["Minimum order", `${Number(product.minimum_order_quantity).toLocaleString("en-IN")} ${unit}`],
    ["Stock", `${Number(product.available_quantity).toLocaleString("en-IN")} ${unit}`],
    ["HSN code", product.hsn_code || "Not provided"],
    ["GST rate", product.gst_rate == null ? "Not provided" : `${product.gst_rate}%`],
    [
      "Lead time",
      product.lead_time_days == null ? "Not provided" : `${product.lead_time_days} days`,
    ],
    ["Web address", `/products/${product.slug}`],
  ];

  return (
    <div>
      <h3 className="text-lg font-bold">{product.name}</h3>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-bold uppercase tracking-wide text-[#526178]">{label}</dt>
            <dd className="break-words font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <h4 className="mt-4 text-xs font-bold uppercase tracking-wide text-[#526178]">Description</h4>
      <p className="mt-1 whitespace-pre-wrap text-sm">
        {product.description || "No description provided."}
      </p>

      <h4 className="mt-4 text-xs font-bold uppercase tracking-wide text-[#526178]">Price tiers</h4>
      {tiers.length === 0 ? (
        <p className="mt-1 text-sm">No price tiers.</p>
      ) : (
        <ul className="mt-1 grid gap-1 text-sm">
          {tiers.map((tier) => (
            <li key={tier.id}>
              {Number(tier.minimum_quantity).toLocaleString("en-IN")}–
              {Number(tier.maximum_quantity).toLocaleString("en-IN")} {unit}:{" "}
              <strong>₹{Number(tier.unit_price).toLocaleString("en-IN")}</strong> per unit
            </li>
          ))}
        </ul>
      )}

      <h4 className="mt-4 text-xs font-bold uppercase tracking-wide text-[#526178]">
        Images ({images.length})
      </h4>
      {images.length === 0 ? (
        <p className="mt-1 text-sm">The seller has not uploaded any images.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((image) => (
            <a
              key={image.id}
              href={image.url}
              target="_blank"
              rel="noreferrer"
              title="Open full size"
            >
              <img
                src={image.url}
                alt={image.alt_text ?? product.name}
                className="h-28 w-28 border object-cover"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

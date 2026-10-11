import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PriceCalculator } from "@/components/marketplace/PriceCalculator";
import { Breadcrumbs, PageMessage, PublicShell } from "@/components/marketplace/PublicShell";
import { SupplierRating } from "@/components/marketplace/SupplierRating";
import {
  getPublishedProductBySlug,
  getSupplierRatings,
  type ProductDetail,
  type SupplierRating as Rating,
} from "@/lib/marketplace";

export const Route = createFileRoute("/products/$slug")({
  head: () => ({
    meta: [
      { title: "Wholesale Product | FEA Bulk" },
      {
        name: "description",
        content: "Bulk pricing, minimum order quantity and supplier details on FEA Bulk.",
      },
      { property: "og:title", content: "Wholesale Product | FEA Bulk" },
      {
        property: "og:description",
        content: "Bulk pricing, minimum order quantity and supplier details on FEA Bulk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [rating, setRating] = useState<Rating | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getPublishedProductBySlug(slug)
      .then((item) => {
        if (!active) return;
        setProduct(item);
        if (!item) return;
        document.title = `${item.name} | FEA Bulk`;
        // Ratings are supporting detail, so a failure here must not hide the product.
        void getSupplierRatings([item.organization_id])
          .then((ratings) => {
            if (active) setRating(ratings.get(item.organization_id));
          })
          .catch(() => undefined);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Product failed to load.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading)
    return (
      <PublicShell>
        <p role="status">Loading product…</p>
      </PublicShell>
    );
  if (error)
    return (
      <PublicShell>
        <p role="alert" className="border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      </PublicShell>
    );
  if (!product)
    return (
      <PublicShell>
        <PageMessage title="Product not found">
          This listing does not exist or is no longer approved for sale.
        </PageMessage>
      </PublicShell>
    );

  const unit = product.unit_of_measure;
  const facts: Array<[string, string]> = [
    ["Minimum order", `${product.minimum_order_quantity.toLocaleString("en-IN")} ${unit}`],
    ["Available", `${product.available_quantity.toLocaleString("en-IN")} ${unit}`],
    ["Lead time", `${product.lead_time_days} days`],
    ["GST rate", product.gst_rate === null ? "Confirmed on quote" : `${product.gst_rate}%`],
    ["HSN code", product.hsn_code ?? "Not provided"],
    ["Seller SKU", product.seller_sku],
    ["Brand", product.brand ?? "Not provided"],
    ["Country of origin", product.country_of_origin ?? "Not provided"],
  ];

  return (
    <PublicShell>
      <Breadcrumbs
        items={[
          { label: "Marketplace", href: "/marketplace" },
          ...(product.category
            ? [{ label: product.category.name, href: `/categories/${product.category.slug}` }]
            : []),
          { label: product.name },
        ]}
      />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div
          className="flex aspect-[4/3] items-center justify-center bg-[#EAF2FB] text-8xl font-black text-[#102B52]"
          aria-hidden="true"
        >
          {product.name.charAt(0).toUpperCase()}
        </div>
        <section>
          <p className="text-xs font-black uppercase tracking-wider text-[#F87908]">
            <a href={`/suppliers/${product.organization_id}`}>{product.supplier_name}</a>
          </p>
          <p className="mt-1">
            <SupplierRating rating={rating} />
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#102B52]">{product.name}</h1>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{product.description}</p>

          <h2 className="mt-8 text-lg font-black">Bulk pricing</h2>
          {product.product_price_tiers.length === 0 ? (
            <p className="mt-3 border bg-white p-4 text-sm">
              This supplier prices by quotation. Send an RFQ to receive a quote.
            </p>
          ) : (
            <table className="mt-3 w-full border bg-white text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-[#526178]">
                  <th className="p-3">Quantity ({unit})</th>
                  <th className="p-3">Unit price</th>
                </tr>
              </thead>
              <tbody>
                {product.product_price_tiers.map((tier) => (
                  <tr key={tier.minimum_quantity} className="border-b last:border-b-0">
                    <td className="p-3">
                      {Number(tier.minimum_quantity).toLocaleString("en-IN")}–
                      {Number(tier.maximum_quantity).toLocaleString("en-IN")}
                    </td>
                    <td className="p-3 font-bold">
                      ₹{Number(tier.unit_price).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-[#526178]">
            Prices exclude GST and freight. The final price is confirmed on the supplier&apos;s
            quote.
          </p>
          {product.product_price_tiers.length > 0 && (
            <PriceCalculator
              tiers={product.product_price_tiers}
              minimumOrderQuantity={product.minimum_order_quantity}
              unit={unit}
              gstRate={product.gst_rate}
            />
          )}

          <a
            href={`/app?product=${encodeURIComponent(product.slug)}`}
            className="button mt-6 inline-block"
          >
            Request quote for this product
          </a>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-black">Product details</h2>
        <dl className="mt-3 grid gap-px border bg-[#DDE5EE] sm:grid-cols-2 lg:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label} className="bg-white p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-[#526178]">{label}</dt>
              <dd className="mt-1 text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </PublicShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Breadcrumbs,
  PageMessage,
  ProductCard,
  PublicShell,
} from "@/components/marketplace/PublicShell";
import { SupplierRating } from "@/components/marketplace/SupplierRating";
import {
  getSupplier,
  getSupplierRatings,
  getSupplierReviews,
  searchPublishedProducts,
  type MarketplaceProduct,
  type Supplier,
  type SupplierRating as Rating,
  type SupplierReview,
} from "@/lib/marketplace";

export const Route = createFileRoute("/suppliers/$slug")({
  head: () => ({
    meta: [
      { title: "Verified Supplier | FEA Bulk" },
      { name: "description", content: "Approved wholesale listings from a verified supplier." },
      { property: "og:title", content: "Verified Supplier | FEA Bulk" },
      {
        property: "og:description",
        content: "Approved wholesale listings from a verified supplier.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupplierPage,
});

function SupplierPage() {
  // The route parameter carries the supplier's organization ID until suppliers get slugs.
  const { slug } = Route.useParams();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [rating, setRating] = useState<Rating | undefined>(undefined);
  const [reviews, setReviews] = useState<SupplierReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getSupplier(slug)
      .then(async (item) => {
        const [listings, ratings, nextReviews] = item
          ? await Promise.all([
              searchPublishedProducts("", "", 50, item.id),
              getSupplierRatings([item.id]),
              getSupplierReviews(item.id),
            ])
          : [[], new Map<string, Rating>(), []];
        if (!active) return;
        setSupplier(item);
        setProducts(listings);
        setRating(item ? ratings.get(item.id) : undefined);
        setReviews(nextReviews);
        if (item) document.title = `${item.display_name} | FEA Bulk`;
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Supplier failed to load.");
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
        <p role="status">Loading supplier…</p>
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
  if (!supplier)
    return (
      <PublicShell>
        <PageMessage title="Supplier not found">
          This business is not in the verified supplier directory.
        </PageMessage>
      </PublicShell>
    );

  return (
    <PublicShell>
      <Breadcrumbs
        items={[{ label: "Marketplace", href: "/marketplace" }, { label: supplier.display_name }]}
      />
      <p className="mt-6 text-xs font-black uppercase tracking-wider text-[#F87908]">
        Verified supplier
      </p>
      <h1 className="mt-2 text-3xl font-black text-[#102B52]">{supplier.display_name}</h1>
      <p className="mt-2 text-sm text-[#526178]">
        On FEA Bulk since {new Date(supplier.created_at).toLocaleDateString("en-IN")}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border bg-white p-4">
        <SupplierRating rating={rating} />
        {rating && rating.review_count > 0 && (
          <span className="text-sm text-[#526178]">
            {rating.order_completion_rate}% of orders completed
          </span>
        )}
      </div>

      <h2 className="mt-8 text-xl font-black">Approved products ({products.length})</h2>
      {products.length === 0 ? (
        <p className="mt-4 border bg-white p-6 text-sm">
          This supplier has no approved listings yet.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      )}

      <h2 className="mt-10 text-xl font-black">Buyer reviews ({reviews.length})</h2>
      {reviews.length === 0 ? (
        <p className="mt-4 border bg-white p-6 text-sm">
          No buyer has reviewed this supplier yet. Reviews come from completed orders.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {reviews.map((review) => (
            <li key={review.id} className="border bg-white p-4">
              <p className="text-sm font-bold" aria-label={`${review.rating} out of 5`}>
                <span className="text-[#F87908]" aria-hidden="true">
                  {"★".repeat(review.rating)}
                </span>
                <span className="text-[#C9D3DF]" aria-hidden="true">
                  {"★".repeat(5 - review.rating)}
                </span>
                <span className="ml-2 font-normal text-[#526178]">
                  Verified buyer · {new Date(review.created_at).toLocaleDateString("en-IN")}
                </span>
              </p>
              {review.body && <p className="mt-2 whitespace-pre-wrap text-sm">{review.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </PublicShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Star,
  Store,
  Truck,
} from "lucide-react";
import { BuyNow } from "@/components/marketplace/BuyNow";
import { AuctionPanel } from "@/components/auction/AuctionPanel";
import { MarketplaceCard } from "@/components/marketplace/MarketplaceCard";
import { MarketplaceHeader } from "@/components/marketplace/MarketplaceHeader";
import { PriceCalculator } from "@/components/marketplace/PriceCalculator";
import { Breadcrumbs, PageMessage, PublicShell } from "@/components/marketplace/PublicShell";
import { ProductThumb } from "@/components/ProductThumb";
import { Button } from "@/components/ui/button";
import { formatPriceRange, priceRange } from "@/lib/catalog-view";
import {
  getPublishedProductBySlug,
  getSupplier,
  getSupplierRatings,
  getSupplierReviews,
  searchPublishedProducts,
  type MarketplaceProduct,
  type ProductDetail,
  type Supplier,
  type SupplierRating as Rating,
  type SupplierReview,
} from "@/lib/marketplace";
import {
  productSpecifications,
  ratingSummary,
  shippingOrigin,
  yearsSince,
} from "@/lib/product-detail";

export const Route = createFileRoute("/products/$slug")({
  head: () => ({
    meta: [
      { title: "Wholesale Product | FEA Bulk" },
      {
        name: "description",
        content: "Bulk pricing, specifications and verified seller details on FEA Bulk.",
      },
      { property: "og:title", content: "Wholesale Product | FEA Bulk" },
      {
        property: "og:description",
        content: "Bulk pricing, specifications and verified seller details on FEA Bulk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductPage,
});

// Supporting sections load after the product and never block it from showing.
type Related = {
  supplier: Supplier | null;
  rating: Rating | undefined;
  reviews: SupplierReview[];
  sellerProducts: MarketplaceProduct[];
  similar: MarketplaceProduct[];
  ratings: Map<string, Rating>;
};
const EMPTY_RELATED: Related = {
  supplier: null,
  rating: undefined,
  reviews: [],
  sellerProducts: [],
  similar: [],
  ratings: new Map(),
};

function ProductPage() {
  const { slug } = Route.useParams();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [related, setRelated] = useState<Related>(EMPTY_RELATED);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setSelectedImage(0);
    setRelated(EMPTY_RELATED);
    void getPublishedProductBySlug(slug)
      .then((item) => {
        if (!active) return;
        setProduct(item);
        if (!item) return;
        document.title = `${item.name} | FEA Bulk`;
        void Promise.all([
          getSupplier(item.organization_id).catch(() => null),
          getSupplierReviews(item.organization_id, 200).catch(() => []),
          searchPublishedProducts("", "", 50, item.organization_id).catch(() => []),
          item.category_id
            ? searchPublishedProducts("", item.category_id, 50).catch(() => [])
            : Promise.resolve([]),
        ]).then(async ([supplier, reviews, fromSeller, inCategory]) => {
          const sellerProducts = fromSeller.filter((other) => other.id !== item.id).slice(0, 8);
          const similar = inCategory
            .filter((other) => other.organization_id !== item.organization_id)
            .slice(0, 8);
          const ratings = await getSupplierRatings([
            item.organization_id,
            ...similar.map((other) => other.organization_id),
          ]).catch(() => new Map<string, Rating>());
          if (!active) return;
          setRelated({
            supplier,
            rating: ratings.get(item.organization_id),
            reviews,
            sellerProducts,
            similar,
            ratings,
          });
        });
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

  // Marketplace "Buy now" links arrive with #buy-now; the form only exists once the product
  // has loaded, after the browser already tried to jump, so scroll to it then.
  useEffect(() => {
    if (!product || window.location.hash !== "#buy-now") return;
    const timer = window.setTimeout(
      () => document.getElementById("buy-now")?.scrollIntoView({ block: "start" }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [product]);

  const header = <MarketplaceHeader category={product?.category?.slug ?? ""} />;

  if (loading)
    return (
      <PublicShell header={header}>
        <div className="grid animate-pulse gap-6 lg:grid-cols-[5fr_5fr_3fr]" aria-hidden="true">
          <div className="aspect-square rounded-lg bg-card" />
          <div className="h-96 rounded-lg bg-card" />
          <div className="h-72 rounded-lg bg-card" />
        </div>
        <p role="status" className="sr-only">
          Loading product…
        </p>
      </PublicShell>
    );
  if (error)
    return (
      <PublicShell header={header}>
        <p
          role="alert"
          className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      </PublicShell>
    );
  if (!product)
    return (
      <PublicShell header={header}>
        <PageMessage title="Product not found">
          This listing does not exist or is no longer approved for sale.
        </PageMessage>
      </PublicShell>
    );

  const unit = product.unit_of_measure;
  const images = product.images ?? [];
  const shownImage = images[selectedImage] ?? images[0];
  const range = priceRange(product.product_price_tiers);
  const inStock = Number(product.available_quantity) >= Number(product.minimum_order_quantity);
  const openAuction = product.auctions?.find(
    (a) => a.status === "scheduled" || a.status === "awaiting_payment",
  );
  const buyable = Boolean(range) && inStock;
  const specs = productSpecifications(product);
  const origin = shippingOrigin(product.shipping_origin);
  const summary = ratingSummary(related.reviews);
  const sellerSince = related.supplier?.created_at;
  const sellerYears = sellerSince ? yearsSince(sellerSince) : null;
  const shortDescription =
    product.description.length > 280
      ? `${product.description.slice(0, 280).trimEnd()}…`
      : product.description;
  const goToOrder = () => document.getElementById("buy-now")?.scrollIntoView({ block: "start" });

  return (
    <PublicShell header={header}>
      <Breadcrumbs
        items={[
          { label: "Marketplace", href: "/marketplace" },
          ...(product.category
            ? [
                {
                  label: product.category.name,
                  href: `/marketplace?category=${product.category.slug}`,
                },
              ]
            : []),
          { label: product.name },
        ]}
      />

      {/* Top: gallery, key facts and the seller card, like a B2B marketplace listing. */}
      <div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-[5fr_5fr_3fr]">
        <section aria-label="Product photos" className="min-w-0">
          <div className="relative overflow-hidden rounded-lg border bg-card">
            <ProductThumb
              src={shownImage?.url}
              alt={shownImage?.alt_text ?? product.name}
              name={product.name}
              loading="eager"
              className="aspect-square w-full text-8xl"
            />
            {images.length > 1 && (
              <>
                <GalleryArrow
                  side="left"
                  label="Previous photo"
                  onClick={() =>
                    setSelectedImage((selectedImage - 1 + images.length) % images.length)
                  }
                />
                <GalleryArrow
                  side="right"
                  label="Next photo"
                  onClick={() => setSelectedImage((selectedImage + 1) % images.length)}
                />
                <span className="absolute bottom-3 right-3 rounded bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                  {selectedImage + 1} / {images.length}
                </span>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label={`Show photo ${index + 1} of ${images.length}`}
                  aria-pressed={index === selectedImage}
                  onClick={() => setSelectedImage(index)}
                  className={`shrink-0 overflow-hidden rounded border-2 ${index === selectedImage ? "border-workspace-action" : "border-transparent hover:border-border"}`}
                >
                  <ProductThumb src={image.url} alt="" name={product.name} className="size-16" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="product-name" className="min-w-0">
          {product.category && (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {product.category.name}
            </p>
          )}
          <h1
            id="product-name"
            className="mt-1 text-2xl font-bold leading-tight text-workspace-brand sm:text-3xl"
          >
            {product.name}
          </h1>
          <p className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
            {range ? (
              <>
                {formatPriceRange(range)}
                <span className="text-base font-medium text-muted-foreground"> / {unit}</span>
              </>
            ) : (
              <span className="text-xl text-muted-foreground">Price on request</span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {range && product.product_price_tiers.length > 1
              ? "Lower prices for larger orders. "
              : ""}
            Prices exclude GST and freight.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span
              className={`rounded-full px-2.5 py-1 ${inStock ? "bg-workspace-success-soft text-workspace-success" : "bg-destructive/10 text-destructive"}`}
            >
              {inStock ? "In stock" : "Out of stock"}
            </span>
            <span className="rounded-full bg-workspace-info-soft px-2.5 py-1 text-workspace-brand">
              Min. order {Number(product.minimum_order_quantity).toLocaleString("en-IN")} {unit}
            </span>
          </div>

          <table className="mt-5 w-full overflow-hidden rounded-lg border text-sm">
            <tbody>
              {specs.slice(0, 8).map(([label, value], index) => (
                <tr key={label} className={index % 2 === 0 ? "bg-muted/50" : "bg-card"}>
                  <th
                    scope="row"
                    className="w-2/5 px-3 py-2 text-left font-medium text-muted-foreground"
                  >
                    {label}
                  </th>
                  <td className="px-3 py-2 font-semibold">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {specs.length > 8 && (
            <a
              href="#specifications"
              className="mt-2 inline-block text-sm font-semibold text-workspace-warning hover:underline"
            >
              See all {specs.length} specifications
            </a>
          )}

          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
            {shortDescription}
          </p>
          {shortDescription !== product.description && (
            <a
              href="#description"
              className="text-sm font-semibold text-workspace-warning hover:underline"
            >
              Read full description
            </a>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="workspace" className="h-11 px-6" onClick={goToOrder}>
              {buyable ? "Buy now" : openAuction ? "View auction" : "See pricing & ordering"}
            </Button>
            {range && (
              <Button variant="outline" className="h-11" onClick={goToOrder}>
                Bulk price calculator
              </Button>
            )}
          </div>
        </section>

        <aside aria-label="Seller" className="min-w-0 md:col-span-2 lg:col-span-1">
          <div className="rounded-lg border bg-card p-5 lg:sticky lg:top-[calc(var(--public-header-height,0px)+1.5rem)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sold by
            </p>
            <Link
              to="/suppliers/$slug"
              params={{ slug: product.organization_id }}
              className="mt-1 block text-lg font-bold leading-snug text-workspace-brand hover:text-workspace-warning"
            >
              {product.supplier_name}
            </Link>
            {origin && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-4" aria-hidden="true" /> {origin}
              </p>
            )}
            <ul className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <li className="flex items-center gap-1 rounded-full bg-workspace-success-soft px-2.5 py-1 text-workspace-success">
                <BadgeCheck className="size-3.5" aria-hidden="true" /> Verified business
              </li>
              <li className="flex items-center gap-1 rounded-full bg-workspace-info-soft px-2.5 py-1 text-workspace-brand">
                <ShieldCheck className="size-3.5" aria-hidden="true" /> Listing reviewed
              </li>
              {sellerYears !== null && (
                <li className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {sellerYears > 0
                    ? `${sellerYears} yr${sellerYears === 1 ? "" : "s"} on FeaBulk`
                    : "New on FeaBulk"}
                </li>
              )}
            </ul>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <Stars value={related.rating?.rating ?? 0} />
              {summary.total > 0 ? (
                <a href="#reviews" className="font-semibold hover:underline">
                  {Number(related.rating?.rating ?? summary.average).toFixed(1)} ({summary.total})
                </a>
              ) : (
                <span className="text-muted-foreground">No reviews yet</span>
              )}
            </div>
            {related.rating && summary.total > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {related.rating.order_completion_rate}% of orders completed
              </p>
            )}
            <div className="mt-5 grid gap-2">
              {buyable && (
                <Button variant="workspace" className="h-11" onClick={goToOrder}>
                  Buy now
                </Button>
              )}
              <Button asChild variant="outline" className="h-11">
                <Link to="/suppliers/$slug" params={{ slug: product.organization_id }}>
                  <Store /> View seller profile
                </Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <nav
        aria-label="On this page"
        className="sticky top-[var(--public-header-height,0px)] z-10 mt-8 -mx-1 overflow-x-auto border-b bg-workspace-canvas/95 backdrop-blur"
      >
        <ul className="flex gap-1 whitespace-nowrap px-1 text-sm font-semibold">
          {[
            ["#buy-now", "Pricing & order"],
            ["#specifications", "Specifications"],
            ["#description", "Description"],
            ["#seller", "About the seller"],
            ["#reviews", "Reviews"],
          ].map(([href, label]) => (
            <li key={href}>
              <a
                href={href}
                className="block border-b-2 border-transparent px-3 py-3 text-muted-foreground hover:border-workspace-action hover:text-foreground"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DetailSection id="buy-now" title="Bulk pricing & order">
          {product.product_price_tiers.length === 0 && !openAuction ? (
            <p className="text-sm">This supplier has not listed a price yet.</p>
          ) : product.product_price_tiers.length === 0 ? null : (
            <table className="w-full overflow-hidden rounded-lg border text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">Quantity ({unit})</th>
                  <th className="p-3">Price per {unit}</th>
                </tr>
              </thead>
              <tbody>
                {product.product_price_tiers.map((tier) => (
                  <tr key={tier.minimum_quantity} className="border-t">
                    <td className="p-3">
                      {Number(tier.minimum_quantity).toLocaleString("en-IN")} –{" "}
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
          {product.product_price_tiers.length > 0 && (
            <PriceCalculator
              tiers={product.product_price_tiers}
              minimumOrderQuantity={product.minimum_order_quantity}
              unit={unit}
              gstRate={product.gst_rate}
            />
          )}
          <AuctionPanel productId={product.id} slug={product.slug} />
          {product.product_price_tiers.length > 0 ? (
            <BuyNow
              productId={product.id}
              slug={product.slug}
              moq={Number(product.minimum_order_quantity)}
              available={Number(product.available_quantity)}
              unit={unit}
              tiers={product.product_price_tiers}
            />
          ) : openAuction ? null : (
            <p className="mt-6 border bg-card p-4 text-sm">
              This product is not available to buy yet.
            </p>
          )}
        </DetailSection>

        <div className="grid content-start gap-6">
          <DetailSection id="specifications" title="Specifications">
            <table className="w-full overflow-hidden rounded-lg border text-sm">
              <tbody>
                {specs.map(([label, value], index) => (
                  <tr key={label} className={index % 2 === 0 ? "bg-muted/50" : "bg-card"}>
                    <th
                      scope="row"
                      className="w-2/5 px-3 py-2 text-left font-medium text-muted-foreground"
                    >
                      {label}
                    </th>
                    <td className="px-3 py-2 font-semibold">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DetailSection>
          <DetailSection id="description" title="Product description">
            <p className="whitespace-pre-wrap text-sm leading-6">{product.description}</p>
          </DetailSection>
          <DetailSection title="Additional information">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <InfoItem
                icon={<PackageCheck />}
                label="Availability"
                value={inStock ? "In stock" : "Out of stock"}
              />
              <InfoItem
                icon={<Clock3 />}
                label="Dispatch time"
                value={`${product.lead_time_days} day${Number(product.lead_time_days) === 1 ? "" : "s"}`}
              />
              <InfoItem
                icon={<Truck />}
                label="Ships from"
                value={origin ?? "Confirmed by the seller"}
              />
              <InfoItem icon={<ShieldCheck />} label="Price" value="Excludes GST and freight" />
            </dl>
          </DetailSection>
        </div>
      </div>

      {related.sellerProducts.length > 0 && (
        <ProductStrip
          title={`More products from ${product.supplier_name ?? "this seller"}`}
          viewAll={{
            to: "/suppliers/$slug",
            params: { slug: product.organization_id },
            label: "View all",
          }}
          products={related.sellerProducts}
          ratings={related.ratings}
          categoryName={product.category?.name}
        />
      )}
      {related.similar.length > 0 && (
        <ProductStrip
          title={`Similar products from other suppliers`}
          {...(product.category
            ? {
                viewAll: {
                  to: "/marketplace",
                  search: { category: product.category.slug },
                  label: `All ${product.category.name}`,
                },
              }
            : {})}
          products={related.similar}
          ratings={related.ratings}
          categoryName={product.category?.name}
        />
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <DetailSection
          id="reviews"
          title={`Ratings & reviews of ${product.supplier_name ?? "this seller"}`}
        >
          {summary.total === 0 ? (
            <p className="text-sm text-muted-foreground">
              No buyer has reviewed this seller yet. Reviews come from completed orders.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-4xl font-bold">{summary.average.toFixed(1)}</p>
                  <Stars value={summary.average} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {summary.total} review{summary.total === 1 ? "" : "s"}
                  </p>
                </div>
                <ul className="min-w-48 flex-1 space-y-1 text-xs">
                  {summary.counts.map((value, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <span className="w-6 text-right">{5 - index}★</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-workspace-action"
                          style={{ width: `${(value / summary.total) * 100}%` }}
                        />
                      </span>
                      <span className="w-6 text-muted-foreground">{value}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <ul className="mt-5 divide-y">
                {related.reviews.slice(0, 5).map((review) => (
                  <li key={review.id} className="py-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Stars value={review.rating} />
                      Verified buyer · {new Date(review.created_at).toLocaleDateString("en-IN")}
                    </div>
                    {review.body && (
                      <p className="mt-1 whitespace-pre-wrap text-sm">{review.body}</p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </DetailSection>

        <DetailSection id="seller" title={`About ${product.supplier_name ?? "the seller"}`}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <InfoItem
              icon={<BadgeCheck />}
              label="Verification"
              value="Business verified by FeaBulk"
            />
            <InfoItem
              icon={<CalendarDays />}
              label="Member since"
              value={
                sellerSince
                  ? new Date(sellerSince).toLocaleDateString("en-IN", {
                      month: "long",
                      year: "numeric",
                    })
                  : "—"
              }
            />
            <InfoItem
              icon={<Store />}
              label="Approved products"
              value={String(related.sellerProducts.length + 1)}
            />
            <InfoItem
              icon={<Star />}
              label="Orders completed"
              value={
                related.rating && summary.total > 0
                  ? `${related.rating.order_completion_rate}%`
                  : "Not rated yet"
              }
            />
          </dl>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/suppliers/$slug" params={{ slug: product.organization_id }}>
              View seller profile
            </Link>
          </Button>
        </DetailSection>
      </div>

      {/* Phones keep the price and the main action in reach while scrolling. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate font-bold">
            {range ? formatPriceRange(range) : "Price on request"}
            {range && <span className="text-xs font-medium text-muted-foreground"> / {unit}</span>}
          </p>
          <Button variant="workspace" className="shrink-0" onClick={goToOrder}>
            {buyable ? "Buy now" : openAuction ? "View auction" : "View pricing"}
          </Button>
        </div>
      </div>
      <div className="h-16 md:hidden" aria-hidden="true" />
    </PublicShell>
  );
}

function GalleryArrow({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow hover:bg-card ${side === "left" ? "left-3" : "right-3"}`}
    >
      <Icon className="size-5" />
    </button>
  );
}

function Stars({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <span className="flex" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={`size-4 ${star <= filled ? "fill-workspace-action text-workspace-action" : "text-border"}`}
        />
      ))}
    </span>
  );
}

function DetailSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-label={title} className="scroll-mt-[calc(var(--public-header-height,0px)+4rem)] rounded-lg border bg-card p-5">
      <h2 className="mb-4 text-lg font-bold text-workspace-brand">{title}</h2>
      {children}
    </section>
  );
}

function InfoItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted-foreground [&>svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-semibold">{value}</dd>
      </div>
    </div>
  );
}

function ProductStrip({
  title,
  viewAll,
  products,
  ratings,
  categoryName,
}: {
  title: string;
  viewAll?:
    | { to: "/suppliers/$slug"; params: { slug: string }; label: string }
    | { to: "/marketplace"; search: { category: string }; label: string };
  products: MarketplaceProduct[];
  ratings: Map<string, Rating>;
  categoryName: string | undefined;
}) {
  return (
    <section aria-label={title} className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="text-lg font-bold text-workspace-brand sm:text-xl">{title}</h2>
        {viewAll &&
          ("params" in viewAll ? (
            <Link
              to={viewAll.to}
              params={viewAll.params}
              className="shrink-0 text-sm font-semibold text-workspace-warning hover:underline"
            >
              {viewAll.label} →
            </Link>
          ) : (
            <Link
              to={viewAll.to}
              search={viewAll.search}
              className="shrink-0 text-sm font-semibold text-workspace-warning hover:underline"
            >
              {viewAll.label} →
            </Link>
          ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {products.slice(0, 4).map((item) => (
          <MarketplaceCard
            key={item.id}
            product={item}
            rating={ratings.get(item.organization_id)}
            categoryName={categoryName}
          />
        ))}
      </div>
    </section>
  );
}

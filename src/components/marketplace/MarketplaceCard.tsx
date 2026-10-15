import { Link } from "@tanstack/react-router";
import { BadgeCheck, Package } from "lucide-react";
import { ProductThumb } from "@/components/ProductThumb";
import { SupplierRating } from "@/components/marketplace/SupplierRating";
import { Button } from "@/components/ui/button";
import { formatPriceRange, priceRange } from "@/lib/catalog-view";
import type { MarketplaceProduct, SupplierRating as Rating } from "@/lib/marketplace";

/**
 * A marketplace listing card: photo, name, price range per unit, minimum order, seller
 * with verification and rating, and the two actions a buyer has today.
 */
export function MarketplaceCard({
  product,
  rating,
  categoryName,
}: {
  product: MarketplaceProduct;
  rating: Rating | undefined;
  categoryName: string | undefined;
}) {
  const range = priceRange(product.product_price_tiers);
  const unit = product.unit_of_measure ?? "unit";
  const photo = product.images?.[0];
  const inStock = Number(product.available_quantity) >= Number(product.minimum_order_quantity);
  const details = { to: "/products/$slug" as const, params: { slug: product.slug } };

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-within:shadow-md">
      <Link {...details} className="relative block" tabIndex={-1} aria-hidden="true">
        <ProductThumb
          src={photo?.url}
          alt={photo?.alt_text ?? product.name}
          name={product.name}
          className="aspect-[4/3] w-full text-4xl sm:text-5xl"
        />
        {(product.images?.length ?? 0) > 1 && (
          <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {product.images?.length} photos
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        {categoryName && (
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {categoryName}
          </p>
        )}
        <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-5 text-workspace-brand sm:text-[15px]">
          <Link {...details} className="hover:text-workspace-warning">
            {product.name}
          </Link>
        </h3>

        <p className="mt-2 text-base font-bold text-foreground sm:text-lg">
          {range ? (
            <>
              {formatPriceRange(range)}
              <span className="text-sm font-medium text-muted-foreground"> / {unit}</span>
            </>
          ) : (
            <span className="text-base text-muted-foreground">Price on request</span>
          )}
        </p>
        <dl className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          <div className="flex gap-1">
            <dt>Min. order:</dt>
            <dd className="font-semibold text-foreground">
              {Number(product.minimum_order_quantity).toLocaleString("en-IN")} {unit}
            </dd>
          </div>
          <div className="flex items-center gap-1">
            <Package className="size-3.5" aria-hidden="true" />
            <dt className="sr-only">Stock</dt>
            <dd className={inStock ? "" : "font-semibold text-destructive"}>
              {inStock
                ? `${Number(product.available_quantity).toLocaleString("en-IN")} ${unit} in stock`
                : "Out of stock"}
            </dd>
          </div>
        </dl>

        <div className="mt-3 border-t pt-3">
          <Link
            to="/suppliers/$slug"
            params={{ slug: product.organization_id }}
            className="flex min-w-0 items-center gap-1 text-sm font-semibold text-foreground hover:text-workspace-warning"
          >
            <span className="truncate">{product.supplier_name ?? "Verified supplier"}</span>
            <BadgeCheck
              className="size-4 shrink-0 text-workspace-success"
              aria-label="Verified supplier"
            />
          </Link>
          <div className="mt-1">
            <SupplierRating rating={rating} />
          </div>
        </div>

        {/* Buy now opens the product page at its order form; unpriced or out-of-stock
            listings can only be viewed, since there is no seller enquiry flow yet. */}
        <div
          className={`mt-auto grid gap-2 pt-4 ${inStock && range ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
        >
          <Button asChild variant="outline" size="sm" className="font-semibold">
            <Link {...details}>View details</Link>
          </Button>
          {inStock && range && (
            <Button asChild variant="workspace" size="sm">
              <Link {...details} hash="buy-now">
                Buy now
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

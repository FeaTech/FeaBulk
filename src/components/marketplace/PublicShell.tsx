import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ProductThumb } from "@/components/ProductThumb";
import { getIdentity, startingUnitPrice, type MarketplaceProduct } from "@/lib/marketplace";

export function PublicShell({ children, fullWidth = false }: { children: ReactNode; fullWidth?: boolean }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    void getIdentity()
      .then(user => { if (active) setSignedIn(Boolean(user)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return (
    <main className="min-h-screen bg-workspace-canvas text-foreground">
      <header className="border-b bg-card">
        <div className="public-container grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-5">
          <Link to="/" className="text-xl font-bold text-workspace-brand">
            FEA<span className="text-workspace-action">Bulk</span>
          </Link>
          <div className="flex shrink-0 gap-3 text-xs font-semibold sm:gap-6 sm:text-sm">
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/app">Workspace</Link>
            {!signedIn && <Link to="/auth">Sign in</Link>}
          </div>
        </div>
      </header>
      {fullWidth ? children : <div className="public-container py-8 sm:py-12">{children}</div>}
    </main>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-muted-foreground">
      {items.map((item, index) => (
        <span key={item.label} className="flex gap-2">
          {index > 0 && <span aria-hidden="true">/</span>}
          {item.href ? (
            <a className="font-semibold hover:text-workspace-action" href={item.href}>
              {item.label}
            </a>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="border bg-card p-8">
      <h1 className="text-2xl font-bold text-workspace-brand">{title}</h1>
      {children && <p className="mt-2 text-sm text-muted-foreground">{children}</p>}
      <Link to="/marketplace" className="mt-4 inline-block text-sm font-semibold text-workspace-warning">
        Browse the marketplace →
      </Link>
    </section>
  );
}

export function ProductPicture({
  product,
  className,
}: {
  product: Pick<MarketplaceProduct, "name" | "images">;
  className: string;
}) {
  const image = product.images?.[0];
  // Falls back to the product's letter when there is no photo or the file cannot be loaded.
  return (
    <ProductThumb
      src={image?.url}
      alt={image?.alt_text ?? product.name}
      name={product.name}
      className={className}
    />
  );
}

export function ProductCard({ product }: { product: MarketplaceProduct }) {
  const price = startingUnitPrice(product);
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border bg-card p-5">
      <Link to="/products/$slug" params={{ slug: product.slug }} className="mb-4 block" aria-hidden="true" tabIndex={-1}>
        <ProductPicture product={product} className="aspect-[4/3] w-full rounded-md text-4xl" />
      </Link>
      <h3 className="text-lg font-semibold text-workspace-brand">
        <Link className="hover:text-workspace-action" to="/products/$slug" params={{ slug: product.slug }}>
          {product.name}
        </Link>
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        <Link className="hover:text-workspace-action" to="/suppliers/$slug" params={{ slug: product.organization_id }}>
          {product.supplier_name ?? "Verified supplier"}
        </Link>
      </p>
      <p className="mt-3 line-clamp-3 text-sm">{product.description}</p>
      <div className="mt-auto pt-4">
        <p className="text-sm font-bold">
          MOQ {product.minimum_order_quantity} · {product.available_quantity} available
        </p>
        <p className="mt-1 text-sm">
          {price === null
            ? "Price by quotation"
            : `From ₹${price.toLocaleString("en-IN")} per unit`}
        </p>
        <Link to="/products/$slug" params={{ slug: product.slug }} className="mt-4 inline-block text-sm font-semibold text-workspace-warning">
          View product →
        </Link>
      </div>
    </article>
  );
}

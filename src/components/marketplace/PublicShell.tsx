import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ProductThumb } from "@/components/ProductThumb";
import { getIdentity, startingUnitPrice, type MarketplaceProduct } from "@/lib/marketplace";

export function PublicShell({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    void getIdentity()
      .then(user => { if (active) setSignedIn(Boolean(user)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return (
    <main className="min-h-screen bg-[#F7F8FA] text-[#17233A]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="text-xl font-black text-[#102B52]">
            FEA<span className="text-[#F87908]">Bulk</span>
          </Link>
          <div className="flex gap-4 text-sm font-bold">
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/app">Workspace</Link>
            {!signedIn && <Link to="/auth">Sign in</Link>}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10">{children}</div>
    </main>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-[#526178]">
      {items.map((item, index) => (
        <span key={item.label} className="flex gap-2">
          {index > 0 && <span aria-hidden="true">/</span>}
          {item.href ? (
            <a className="font-semibold hover:text-[#F87908]" href={item.href}>
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
    <section className="border bg-white p-8">
      <h1 className="text-2xl font-black text-[#102B52]">{title}</h1>
      {children && <p className="mt-2 text-sm text-[#526178]">{children}</p>}
      <Link to="/marketplace" className="mt-4 inline-block text-sm font-extrabold text-[#D96806]">
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
    <article className="flex h-full flex-col border bg-white p-5">
      <Link to="/products/$slug" params={{ slug: product.slug }} className="mb-4 block" aria-hidden="true" tabIndex={-1}>
        <ProductPicture product={product} className="h-28 w-full text-4xl" />
      </Link>
      <h3 className="text-lg font-extrabold text-[#102B52]">
        <Link className="hover:text-[#F87908]" to="/products/$slug" params={{ slug: product.slug }}>
          {product.name}
        </Link>
      </h3>
      <p className="mt-1 text-sm text-[#526178]">
        <a className="hover:text-[#F87908]" href={`/suppliers/${product.organization_id}`}>
          {product.supplier_name ?? "Verified supplier"}
        </a>
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
        <Link to="/products/$slug" params={{ slug: product.slug }} className="mt-4 inline-block text-sm font-extrabold text-[#D96806]">
          View product →
        </Link>
      </div>
    </article>
  );
}

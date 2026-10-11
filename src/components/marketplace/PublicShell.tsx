import type { ReactNode } from "react";
import { startingUnitPrice, type MarketplaceProduct } from "@/lib/marketplace";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F7F8FA] text-[#17233A]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <a href="/" className="text-xl font-black text-[#102B52]">
            FEA<span className="text-[#F87908]">Bulk</span>
          </a>
          <div className="flex gap-4 text-sm font-bold">
            <a href="/marketplace">Marketplace</a>
            <a href="/app">Workspace</a>
            <a href="/auth">Sign in</a>
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
      <a href="/marketplace" className="mt-4 inline-block text-sm font-extrabold text-[#D96806]">
        Browse the marketplace →
      </a>
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
  return image ? (
    <img
      src={image.url}
      alt={image.alt_text ?? product.name}
      loading="lazy"
      className={`${className} bg-[#EAF2FB] object-cover`}
    />
  ) : (
    <div
      className={`${className} flex items-center justify-center bg-[#EAF2FB] font-black text-[#102B52]`}
      aria-hidden="true"
    >
      {product.name.charAt(0).toUpperCase()}
    </div>
  );
}

export function ProductCard({ product }: { product: MarketplaceProduct }) {
  const price = startingUnitPrice(product);
  const href = `/products/${product.slug}`;
  return (
    <article className="flex h-full flex-col border bg-white p-5">
      <a href={href} className="mb-4 block" aria-hidden="true" tabIndex={-1}>
        <ProductPicture product={product} className="h-28 w-full text-4xl" />
      </a>
      <h3 className="text-lg font-extrabold text-[#102B52]">
        <a className="hover:text-[#F87908]" href={href}>
          {product.name}
        </a>
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
        <a href={href} className="mt-4 inline-block text-sm font-extrabold text-[#D96806]">
          View product →
        </a>
      </div>
    </article>
  );
}

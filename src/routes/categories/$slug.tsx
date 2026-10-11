import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Breadcrumbs,
  PageMessage,
  ProductCard,
  PublicShell,
} from "@/components/marketplace/PublicShell";
import {
  getCategoryBySlug,
  searchPublishedProducts,
  type Category,
  type MarketplaceProduct,
} from "@/lib/marketplace";

export const Route = createFileRoute("/categories/$slug")({
  head: () => ({
    meta: [
      { title: "Wholesale Category | FEA Bulk" },
      { name: "description", content: "Approved wholesale products by category on FEA Bulk." },
      { property: "og:title", content: "Wholesale Category | FEA Bulk" },
      {
        property: "og:description",
        content: "Approved wholesale products by category on FEA Bulk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getCategoryBySlug(slug)
      .then(async (item) => {
        const listings = item ? await searchPublishedProducts("", item.id) : [];
        if (!active) return;
        setCategory(item);
        setProducts(listings);
        if (item) document.title = `${item.name} | FEA Bulk`;
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Category failed to load.");
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
        <p role="status">Loading category…</p>
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
  if (!category)
    return (
      <PublicShell>
        <PageMessage title="Category not found">This category is not available.</PageMessage>
      </PublicShell>
    );

  return (
    <PublicShell>
      <Breadcrumbs
        items={[{ label: "Marketplace", href: "/marketplace" }, { label: category.name }]}
      />
      <p className="mt-6 text-xs font-black uppercase tracking-wider text-[#F87908]">Category</p>
      <h1 className="mt-2 text-3xl font-black text-[#102B52]">{category.name}</h1>

      <h2 className="mt-8 text-xl font-black">Approved products ({products.length})</h2>
      {products.length === 0 ? (
        <p className="mt-4 border bg-white p-6 text-sm">
          No approved products are listed in this category yet.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      )}
    </PublicShell>
  );
}

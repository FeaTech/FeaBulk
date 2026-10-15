import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  BadgeCheck,
  LayoutGrid,
  LogOut,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { MarketplaceCard } from "@/components/marketplace/MarketplaceCard";
import { Button } from "@/components/ui/button";
import {
  applyCatalogView,
  CATALOG_SORTS,
  EMPTY_FILTERS,
  type CatalogFilters,
  type CatalogSort,
} from "@/lib/catalog-view";
import {
  getCategories,
  getIdentity,
  getSupplierRatings,
  searchPublishedProducts,
  signOut,
  type Category,
  type MarketplaceProduct,
  type SupplierRating as Rating,
} from "@/lib/marketplace";

type MarketplaceSearch = { q?: string; category?: string; sort?: CatalogSort };
const SORT_VALUES = new Set<string>(CATALOG_SORTS.map((item) => item.value));

export const Route = createFileRoute("/marketplace")({
  // Search, category and sort live in the address so a results page can be shared or reloaded.
  validateSearch: (search: Record<string, unknown>): MarketplaceSearch => ({
    ...(typeof search["q"] === "string" && search["q"] ? { q: search["q"] } : {}),
    ...(typeof search["category"] === "string" && search["category"]
      ? { category: search["category"] }
      : {}),
    ...(typeof search["sort"] === "string" && SORT_VALUES.has(search["sort"])
      ? { sort: search["sort"] as CatalogSort }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Wholesale Marketplace | FEA Bulk" },
      {
        name: "description",
        content: "Browse approved wholesale products from verified suppliers on FEA Bulk.",
      },
      { property: "og:title", content: "Wholesale Marketplace | FEA Bulk" },
      {
        property: "og:description",
        content: "Browse approved wholesale products from verified suppliers on FEA Bulk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Marketplace,
});

// Enough for the current catalog; filters and sort then run instantly in the browser.
const CATALOG_LIMIT = 200;

function Marketplace() {
  const { q = "", category = "", sort = "newest" } = Route.useSearch();
  const navigate = useNavigate({ from: "/marketplace" });
  const requestId = useRef(0);
  const [term, setTerm] = useState(q);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [ratings, setRatings] = useState<Map<string, Rating>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxMoq, setMaxMoq] = useState("");
  const [withPhotos, setWithPhotos] = useState(false);

  const categoryRecord = categories.find((item) => item.slug === category);
  const setSearch = (next: Partial<MarketplaceSearch>) =>
    void navigate({
      search: (current: MarketplaceSearch) => {
        const merged = { ...current, ...next };
        return {
          ...(merged.q ? { q: merged.q } : {}),
          ...(merged.category ? { category: merged.category } : {}),
          ...(merged.sort && merged.sort !== "newest" ? { sort: merged.sort } : {}),
        };
      },
      replace: true,
    });

  useEffect(() => {
    let active = true;
    void getIdentity()
      .then((user) => {
        if (active) setSignedIn(Boolean(user));
      })
      .catch(() => {
        if (active) setSignedIn(false);
      });
    void getCategories()
      .then((items) => {
        if (active) setCategories(items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // The search term is matched on the server; everything else filters the loaded results.
  useEffect(() => {
    const id = ++requestId.current;
    setTerm(q);
    setLoading(true);
    setError("");
    void searchPublishedProducts(q, "", CATALOG_LIMIT)
      .then(async (items) => {
        if (id !== requestId.current) return;
        setProducts(items);
        const sellerIds = [...new Set(items.map((item) => item.organization_id))];
        const nextRatings = await getSupplierRatings(sellerIds).catch(
          () => new Map<string, Rating>(),
        );
        if (id === requestId.current) setRatings(nextRatings);
      })
      .catch((err) => {
        if (id === requestId.current)
          setError(err instanceof Error ? err.message : "Search failed.");
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    const requests = requestId;
    return () => {
      // Leaving or changing the search invalidates any request still in flight.
      requests.current++;
    };
  }, [q]);

  const filters: CatalogFilters = {
    ...EMPTY_FILTERS,
    categoryId: categoryRecord?.id ?? "",
    supplierIds,
    minPrice: minPrice === "" ? null : Number(minPrice),
    maxPrice: maxPrice === "" ? null : Number(maxPrice),
    maxMoq: maxMoq === "" ? null : Number(maxMoq),
    withPhotos,
    sort,
  };
  const visible = applyCatalogView(products, filters);
  const categoryNames = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name])),
    [categories],
  );
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of products)
      if (item.category_id) counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1);
    return counts;
  }, [products]);
  const sellers = useMemo(() => {
    const names = new Map<string, { name: string; count: number }>();
    for (const item of products) {
      const entry = names.get(item.organization_id);
      names.set(item.organization_id, {
        name: item.supplier_name ?? "Verified supplier",
        count: (entry?.count ?? 0) + 1,
      });
    }
    return [...names.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [products]);
  const activeFilterCount =
    (category ? 1 : 0) +
    supplierIds.length +
    (minPrice || maxPrice ? 1 : 0) +
    (maxMoq ? 1 : 0) +
    (withPhotos ? 1 : 0);

  function clearFilters() {
    setSupplierIds([]);
    setMinPrice("");
    setMaxPrice("");
    setMaxMoq("");
    setWithPhotos(false);
    setSearch({ category: "" });
  }
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSearch({ q: term.trim() });
  }

  const inputClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";
  const filterPanel = (
    <div className="space-y-6">
      <FilterGroup title="Category">
        <ul className="space-y-1 text-sm">
          <li>
            <FilterOption
              active={!category}
              onClick={() => setSearch({ category: "" })}
              label="All categories"
              count={products.length}
            />
          </li>
          {categories.map((item) => (
            <li key={item.id}>
              <FilterOption
                active={item.slug === category}
                onClick={() => setSearch({ category: item.slug })}
                label={item.name}
                count={categoryCounts.get(item.id) ?? 0}
              />
            </li>
          ))}
        </ul>
      </FilterGroup>
      <FilterGroup title="Price per unit (₹)">
        <div className="grid grid-cols-2 gap-2">
          <input
            aria-label="Minimum price per unit"
            inputMode="decimal"
            type="number"
            min={0}
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            placeholder="Min"
            className={inputClass}
          />
          <input
            aria-label="Maximum price per unit"
            inputMode="decimal"
            type="number"
            min={0}
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            placeholder="Max"
            className={inputClass}
          />
        </div>
      </FilterGroup>
      <FilterGroup title="Minimum order up to">
        <input
          aria-label="Largest acceptable minimum order"
          inputMode="numeric"
          type="number"
          min={1}
          value={maxMoq}
          onChange={(event) => setMaxMoq(event.target.value)}
          placeholder="Any quantity"
          className={inputClass}
        />
      </FilterGroup>
      <FilterGroup title="Suppliers">
        {sellers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suppliers in these results.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {sellers.map(([id, seller]) => (
              <li key={id}>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-[var(--workspace-action)]"
                    checked={supplierIds.includes(id)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSupplierIds((current) =>
                        checked ? [...current, id] : current.filter((item) => item !== id),
                      );
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{seller.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {seller.count} product{seller.count === 1 ? "" : "s"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </FilterGroup>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 accent-[var(--workspace-action)]"
          checked={withPhotos}
          onChange={(event) => setWithPhotos(event.target.checked)}
        />
        Only products with photos
      </label>
      {activeFilterCount > 0 && (
        <Button variant="outline" size="sm" className="w-full" onClick={clearFilters}>
          Clear all filters
        </Button>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-workspace-canvas text-foreground">
      <header className="sticky top-0 z-20 border-b bg-card/95 shadow-sm backdrop-blur">
        <div className="public-container grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto]">
          <Link
            to="/"
            aria-label="FEA Bulk home"
            className="text-xl font-bold text-workspace-brand sm:text-2xl"
          >
            FEA<span className="text-workspace-action">Bulk</span>
          </Link>
          <nav aria-label="Account" className="flex items-center justify-end gap-2 md:order-3">
            {signedIn === true && (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link to="/app">
                    <UserRound />
                    My workspace
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Sign out"
                  onClick={() => void signOut().then(() => navigate({ to: "/auth" }))}
                >
                  <LogOut />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            )}
            {signedIn === false && (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild variant="workspace" size="sm">
                  <Link to="/auth">Join free</Link>
                </Button>
              </>
            )}
          </nav>
          <form
            onSubmit={submitSearch}
            role="search"
            className="col-span-2 flex min-w-0 overflow-hidden rounded-md border-2 border-workspace-brand md:order-2 md:col-span-1"
          >
            <select
              aria-label="Category"
              value={category}
              onChange={(event) => setSearch({ category: event.target.value })}
              className="hidden max-w-44 border-r bg-muted px-3 text-sm sm:block"
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Search products"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search products, brands or SKU"
              className="min-w-0 flex-1 bg-background px-3 py-2.5 text-sm outline-none"
            />
            <button
              type="submit"
              className="flex items-center gap-2 bg-workspace-brand px-4 text-sm font-bold text-card hover:opacity-90"
            >
              <Search className="size-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>
        </div>
        <nav aria-label="Categories" className="border-t">
          <div className="public-container flex gap-2 overflow-x-auto py-2 [scrollbar-width:none]">
            <CategoryChip active={!category} onClick={() => setSearch({ category: "" })}>
              <LayoutGrid className="size-3.5" /> All products
            </CategoryChip>
            {categories.map((item) => (
              <CategoryChip
                key={item.id}
                active={item.slug === category}
                onClick={() => setSearch({ category: item.slug })}
              >
                {item.name}
              </CategoryChip>
            ))}
          </div>
        </nav>
      </header>

      <div className="public-container py-6">
        <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside aria-label="Filters" className="hidden lg:block">
            <div className="sticky top-36 rounded-lg border bg-card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-workspace-brand">
                <SlidersHorizontal className="size-4" /> Filters
              </h2>
              {filterPanel}
            </div>
          </aside>

          <section aria-labelledby="results-heading" className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1
                  id="results-heading"
                  className="text-xl font-bold text-workspace-brand sm:text-2xl"
                >
                  {categoryRecord?.name ?? (q ? `Results for "${q}"` : "All wholesale products")}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground" role="status">
                  {loading
                    ? "Loading products…"
                    : `${visible.length} product${visible.length === 1 ? "" : "s"} from verified suppliers`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="lg:hidden"
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen(true)}
                >
                  <SlidersHorizontal /> Filters
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </Button>
                <label className="flex items-center gap-2 text-sm">
                  <span className="hidden text-muted-foreground sm:inline">Sort by</span>
                  <select
                    aria-label="Sort products"
                    value={sort}
                    onChange={(event) => setSearch({ sort: event.target.value as CatalogSort })}
                    className="rounded-md border bg-card px-3 py-2 text-sm"
                  >
                    {CATALOG_SORTS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {categoryRecord && (
                  <ActiveChip onRemove={() => setSearch({ category: "" })}>
                    {categoryRecord.name}
                  </ActiveChip>
                )}
                {(minPrice || maxPrice) && (
                  <ActiveChip
                    onRemove={() => {
                      setMinPrice("");
                      setMaxPrice("");
                    }}
                  >
                    ₹{minPrice || "0"} – {maxPrice ? `₹${maxPrice}` : "any"} per unit
                  </ActiveChip>
                )}
                {maxMoq && (
                  <ActiveChip onRemove={() => setMaxMoq("")}>Min. order up to {maxMoq}</ActiveChip>
                )}
                {supplierIds.map((id) => (
                  <ActiveChip
                    key={id}
                    onRemove={() =>
                      setSupplierIds((current) => current.filter((item) => item !== id))
                    }
                  >
                    {sellers.find(([sellerId]) => sellerId === id)?.[1].name ?? "Supplier"}
                  </ActiveChip>
                ))}
                {withPhotos && (
                  <ActiveChip onRemove={() => setWithPhotos(false)}>With photos</ActiveChip>
                )}
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            {loading ? (
              <div
                className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
                aria-hidden="true"
              >
                {Array.from({ length: 8 }, (_, index) => (
                  <div key={index} className="h-96 animate-pulse rounded-lg border bg-card" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="mt-6 rounded-lg border bg-card p-10 text-center">
                <p className="font-semibold text-workspace-brand">
                  No products match these filters.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try another search word or clear a filter.
                </p>
                {(activeFilterCount > 0 || q) && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      clearFilters();
                      setSearch({ q: "", category: "" });
                    }}
                  >
                    Show all products
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {visible.map((item) => (
                  <MarketplaceCard
                    key={item.id}
                    product={item}
                    rating={ratings.get(item.organization_id)}
                    categoryName={
                      item.category_id ? categoryNames.get(item.category_id) : undefined
                    }
                  />
                ))}
              </div>
            )}

            <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <BadgeCheck className="size-4 text-workspace-success" aria-hidden="true" />
              Every listing is reviewed by FeaBulk and sold by a verified business.
            </p>
          </section>
        </div>
      </div>

      {filtersOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
        >
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/40"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(22rem,90vw)] flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-bold text-workspace-brand">Filters</h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close filters"
                onClick={() => setFiltersOpen(false)}
              >
                <X />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{filterPanel}</div>
            <div className="border-t p-4">
              <Button variant="workspace" className="w-full" onClick={() => setFiltersOpen(false)}>
                Show {visible.length} product{visible.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function FilterOption({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left ${active ? "bg-workspace-info-soft font-semibold text-workspace-brand" : "hover:bg-muted"}`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </button>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? "border-workspace-brand bg-workspace-brand text-card" : "bg-card hover:border-workspace-brand"}`}
    >
      {children}
    </button>
  );
}

function ActiveChip({ onRemove, children }: { onRemove: () => void; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 font-medium">
      {children}
      <button
        type="button"
        aria-label="Remove filter"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-muted"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LayoutGrid, LogOut, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCategories, getIdentity, signOut, type Category } from "@/lib/marketplace";

export type MarketplaceQuery = { q?: string; category?: string };

/**
 * The sticky marketplace header: logo, search with a category picker, account actions and
 * category chips. On the marketplace it updates the results in place (`onSearch`); elsewhere
 * it sends the visitor to the marketplace with their search. Its height is published as
 * `--public-header-height` so sticky content below can sit underneath it.
 */
export function MarketplaceHeader({
  query = "",
  category = "",
  categories: providedCategories,
  onSearch,
}: {
  query?: string;
  category?: string;
  categories?: Category[];
  onSearch?: (next: MarketplaceQuery) => void;
}) {
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement>(null);
  const [term, setTerm] = useState(query);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [loadedCategories, setLoadedCategories] = useState<Category[]>([]);
  const categories = providedCategories ?? loadedCategories;

  useEffect(() => setTerm(query), [query]);

  useEffect(() => {
    let active = true;
    void getIdentity()
      .then((user) => {
        if (active) setSignedIn(Boolean(user));
      })
      .catch(() => {
        if (active) setSignedIn(false);
      });
    if (!providedCategories)
      void getCategories()
        .then((items) => {
          if (active) setLoadedCategories(items);
        })
        .catch(() => undefined);
    return () => {
      active = false;
    };
    // Categories passed in by the page are fetched there; only load them once otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const publish = () =>
      root.style.setProperty("--public-header-height", `${header.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--public-header-height");
    };
  }, []);

  const search = (next: MarketplaceQuery) => {
    if (onSearch) return onSearch(next);
    const merged = { q: query, category, ...next };
    void navigate({
      to: "/marketplace",
      search: {
        ...(merged.q ? { q: merged.q } : {}),
        ...(merged.category ? { category: merged.category } : {}),
      },
    });
  };

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    search({ q: term.trim() });
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-20 border-b bg-card/95 shadow-sm backdrop-blur"
    >
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
            onChange={(event) => search({ category: event.target.value })}
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
          <CategoryChip active={!category} onClick={() => search({ category: "" })}>
            <LayoutGrid className="size-3.5" /> All products
          </CategoryChip>
          {categories.map((item) => (
            <CategoryChip
              key={item.id}
              active={item.slug === category}
              onClick={() => search({ category: item.slug })}
            >
              {item.name}
            </CategoryChip>
          ))}
        </div>
      </nav>
    </header>
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

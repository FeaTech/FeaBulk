// Matches the products.slug check constraint: lowercase letters and digits joined by single hyphens.
const MAX_SLUG_LENGTH = 80;
const FALLBACK_SLUG = "product";

/** URL slug for a product name, e.g. "Steel Hex Bolts, M8 x 30 mm" -> "steel-hex-bolts-m8-x-30-mm". */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
  return slug;
}

/**
 * The slug to try on a given attempt at saving: the base first, then "-2", "-3" and so on,
 * shortened where needed so the suffix still fits.
 */
export function slugCandidate(base: string, attempt: number): string {
  const root = slugify(base) || FALLBACK_SLUG;
  if (attempt <= 1) return root;
  const suffix = `-${attempt}`;
  return `${root.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/, "")}${suffix}`;
}

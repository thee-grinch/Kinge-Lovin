/**
 * lib/lovin/format.ts
 * Formatting helpers (currency, slugs, tags) for the Lovin marketplace.
 */

const DEFAULT_CURRENCY = process.env.LOVIN_DEFAULT_CURRENCY || "KES";

/** Format a price stored as minor units (int) into a display string. */
export function formatPrice(
  minorUnits: number,
  currency: string = DEFAULT_CURRENCY,
  locale = "en-US"
): string {
  if (!Number.isFinite(minorUnits)) minorUnits = 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: minorUnits % 100 === 0 ? 0 : 2,
    }).format(minorUnits / 100);
  } catch {
    return `${currency} ${(minorUnits / 100).toFixed(2)}`;
  }
}

/** kebab-case slug from a title; appends a short suffix to keep it unique. */
export function slugify(input: string, suffix = ""): string {
  const base = (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return suffix ? `${base}-${suffix}` : base;
}

/** Parse a tags string ("a, b ; c") into a deduped array (max n). */
export function parseTags(input: string | string[] | null | undefined, max = 8): string[] {
  const arr = Array.isArray(input)
    ? input
    : (input || "").split(/[,;]+/).map((t) => t.trim());
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of arr) {
    const k = t.toLowerCase();
    if (k && !seen.has(k) && out.length < max) {
      seen.add(k);
      out.push(t);
    }
  }
  return out;
}

export const CONDITIONS = [
  "NEW",
  "LIKE_NEW",
  "USED",
  "REFURBISHED",
  "FOR_PARTS",
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CURRENCIES = ["KES", "USD", "NGN", "TZS", "UGX", "GHS"] as const;

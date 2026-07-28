/**
 * lib/lovin/whatsapp.ts
 * WhatsApp Click-to-Chat helpers for the Lovin marketplace.
 *
 * - normalizePhone: parse/validate an international phone to E.164 (digits only, no "+")
 * - buildWhatsAppUrl: https://wa.me/<E.164>?text=<encoded>
 * - buildPrefilledMessage: fill a seller-configurable template with product fields
 *
 * Reference: https://faq.whatsapp.com/5913398998672934 (Click to chat)
 */

/** ISO 3166-1 alpha-2 → calling code (launch subset; extend freely). */
export const COUNTRY_DIAL_CODES: Record<string, string> = {
  KE: "254", UG: "256", TZ: "255", NG: "234", GH: "233", ZA: "27",
  US: "1",  GB: "44",  IN: "91",  AE: "971", SA: "966", EG: "20",
};

export const DEFAULT_COUNTRY =
  (process.env.LOVIN_DEFAULT_COUNTRY || "KE").toUpperCase();

export const DEFAULT_TEMPLATE =
  process.env.LOVIN_WHATSAPP_TEMPLATE ||
  'Hi {sellerName}, I\'m interested in "{title}" (#{shortId}) listed for {price} on Lovin. {buyerNote}';

export interface NormalizedPhone {
  ok: boolean;
  /** E.164 digits without "+", e.g. "254712345678". Undefined when !ok. */
  phone?: string;
  error?: "empty" | "too_short" | "too_long" | "invalid";
}

/**
 * Normalize a phone to E.164 digits.
 * Handles "+254712...", "254712...", "0712 345 678", "00 254 712...".
 * If a local number (no country code) is given, prefixes the configured
 * default country dial code.
 */
export function normalizePhone(
  input: string | null | undefined,
  defaultCountry: string = DEFAULT_COUNTRY
): NormalizedPhone {
  if (!input) return { ok: false, error: "empty" };

  // Keep only digits; remember whether an explicit "+" was present.
  const hadPlus = /^\s*\+/.test(input);
  let digits = input.replace(/[^\d]/g, "");

  if (!digits) return { ok: false, error: "empty" };

  // Explicit international: "+", "00", or a known dial code already present.
  if (hadPlus) {
    // leading zeros after a "+" are invalid; strip a stray leading 0
    digits = digits.replace(/^0+/, "");
  } else if (digits.startsWith("00")) {
    // "00" international prefix
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    // Local number (e.g. 0712 345678) → prepend default dial code
    const cc = COUNTRY_DIAL_CODES[defaultCountry];
    if (!cc) return { ok: false, error: "invalid" };
    digits = cc + digits.slice(1);
  } else if (!looksLikeDialCode(digits, defaultCountry)) {
    // No leading 0 and doesn't look like a full intl number → assume local
    const cc = COUNTRY_DIAL_CODES[defaultCountry];
    if (!cc) return { ok: false, error: "invalid" };
    digits = cc + digits;
  }

  // E.164 length is 6..15 (country code + subscriber).
  if (digits.length < 6) return { ok: false, error: "too_short" };
  if (digits.length > 15) return { ok: false, error: "too_long" };

  return { ok: true, phone: digits };
}

function looksLikeDialCode(digits: string, defaultCountry: string): boolean {
  const cc = COUNTRY_DIAL_CODES[defaultCountry];
  if (cc && digits.startsWith(cc)) return true;
  // Starts with any other known dial code?
  return Object.values(COUNTRY_DIAL_CODES).some((c) => digits.startsWith(c));
}

/**
 * Build a wa.me click-to-chat URL.
 * Prefer https://wa.me over api.whatsapp.com (lighter, fewer quirks).
 */
export function buildWhatsAppUrl(phoneE164: string, text?: string): string {
  const base = `https://wa.me/${phoneE164}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export interface TemplateVars {
  sellerName?: string;
  title?: string;
  id?: string;
  shortId?: string;
  price?: string; // already formatted, e.g. "KES 129,990"
  city?: string;
  buyerNote?: string;
}

/** Fill {placeholders} in a template, leaving unknown tokens blank. */
export function fillTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key];
    return v && v.trim() ? v.trim() : "";
  }).replace(/\s{2,}/g, " ").trim();
}

export function buildPrefilledMessage(
  template: string | undefined,
  vars: TemplateVars
): string {
  return fillTemplate(template || DEFAULT_TEMPLATE, vars);
}

/** Short, human-friendly id for messages (last 6 of a uuid or SKU). */
export function shortId(id: string | undefined): string {
  if (!id) return "—";
  return id.replace(/-/g, "").slice(-6).toUpperCase();
}

/**
 * lib/lovin/image-optimization.ts
 * Image optimization + CDN delivery for Lovin.
 *
 * Provider: Cloudinary (default). Switch with LOVIN_IMAGE_PROVIDER.
 * - f_auto  → AVIF/WebP by Accept header
 * - q_auto  → perceptual quality
 * - fl_lossy|strip metadata
 * - responsive srcset via next/image loader
 */

export const IMAGE_PROVIDER =
  (process.env.LOVIN_IMAGE_PROVIDER || "cloudinary").toLowerCase();

export const CLOUD_NAME = process.env.LOVIN_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
export const UPLOAD_PRESET = process.env.LOVIN_UPLOAD_PRESET || "lovin_unsigned";

/** Max upload size enforced by the upload preset (MB). */
export const MAX_UPLOAD_MB = Number(process.env.LOVIN_MAX_UPLOAD_MB || 8);
export const IMG_MAX_WIDTH = Number(process.env.LOVIN_IMG_MAX_WIDTH || 2400);

/** Responsive widths used to build srcset across the app. */
export const RESPONSIVE_WIDTHS = [200, 400, 640, 800, 1080, 1200, 1600];

export const IMAGE_ROLES = {
  main: { w: 1200, ar: "1:1" },
  gallery: { w: 800, ar: "1:1" },
  thumb: { w: 400, ar: "1:1" },
  og: { w: 1200, ar: "1.91:1" },
} as const;

export type ImageRole = keyof typeof IMAGE_ROLES;

/**
 * Build a Cloudinary transform URL.
 * `publicIdOrUrl` may be a bare public id ("v1/p_88/main") or a full URL.
 */
export function cloudinaryUrl(
  publicIdOrUrl: string,
  opts: { w?: number; h?: number; role?: ImageRole; format?: "auto" | "webp" | "avif" | "jpg" } = {}
): string {
  if (!publicIdOrUrl) return "";
  if (!CLOUD_NAME) {
    // Fallback: return as-is so dev without Cloudinary still renders.
    return publicIdOrUrl.startsWith("http") ? publicIdOrUrl : `/${publicIdOrUrl}`;
  }
  const publicId = publicIdOrUrl.replace(/^https?:\/\/res\.cloudinary\.com\/[^/]+\//, "")
    .replace(/^image\/upload\/(v\d+\/)?/, "");

  const parts = ["f_auto", "q_auto", "fl_ignore_aspect_ratio:false"];
  const role = opts.role ? IMAGE_ROLES[opts.role] : null;
  const w = opts.w ?? role?.w;
  if (w) parts.push(`w_${Math.min(w, IMG_MAX_WIDTH)}`);
  if (opts.h) parts.push(`h_${opts.h}`);
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${parts.join(",")}/${publicId}`;
}

/**
 * next/image loader. next/image calls this with {src, width, quality}.
 * We map width → nearest preset and let Cloudinary pick format/quality.
 */
export function cloudinaryLoader({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  return cloudinaryUrl(src, { w: width });
}

/** Build a comma-joined srcset string for a given source. */
export function buildSrcSet(publicIdOrUrl: string): string {
  return RESPONSIVE_WIDTHS.map(
    (w) => `${cloudinaryUrl(publicIdOrUrl, { w })} ${w}w`
  ).join(", ");
}

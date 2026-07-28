import Image, { ImageProps } from "next/image";
import { cloudinaryLoader } from "@/lib/lovin/image-optimization";

/**
 * Drop-in replacement for next/image that routes through Cloudinary.
 * f_auto/q_auto ensure AVIF/WebP + perceptual quality; <Image> builds the
 * responsive srcset from `sizes` + the loader.
 */
export default function OptimizedImage({
  loader = cloudinaryLoader,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px",
  ...props
}: ImageProps) {
  return <Image loader={loader} sizes={sizes} loading="lazy" {...props} />;
}

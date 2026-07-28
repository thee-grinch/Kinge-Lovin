/** @type {import('next').NextConfig} */
const cloudName = process.env.LOVIN_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

const nextConfig = {
    images: {
        // Lovin: prefer AVIF/WebP for Lighthouse + bandwidth savings.
        formats: ['image/avif', 'image/webp'],
        remotePatterns: [
          { protocol: 'https', hostname: 'placehold.co', port: "" },
          // Cloudinary CDN delivery (LOVIN_IMAGE_PROVIDER=cloudinary).
          { protocol: 'https', hostname: 'res.cloudinary.com', port: "" },
          // Optional: allow sellers to hot-link Unsplash/S3 until re-hosted.
          { protocol: 'https', hostname: 'images.unsplash.com', port: "" },
        ],
        // When using the Cloudinary loader we bypass next/image optimization;
        // when serving local/origin images we cap the optimizer sizes here.
        deviceSizes: [640, 750, 828, 1080, 1200, 1600, 2048],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
      },
    env: {
        NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    },
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'X-Frame-Options',
              value: 'DENY',
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
            },
            {
              key: 'X-XSS-Protection',
              value: '1; mode=block',
            },
          ],
        },
      ];
    },
};

export default nextConfig;

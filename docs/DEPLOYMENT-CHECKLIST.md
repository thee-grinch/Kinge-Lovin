# Lovin — Deployment Checklist (go-live)

Use this end-to-end. Items marked **[env]** are environment variables; **[db]** require a migration; **[sec]** are security gates that must pass before public launch.

---

## 1. Prerequisites & accounts
- [ ] Node 20+, MySQL 8+ (or PlanetScale/RDS), and (recommended) a Cloudinary account.
- [ ] Domain + DNS (apex + `www`); TLS certs (Caddy/Nginx/Cloudflare/edge).
- [ ] WhatsApp test: a phone with WhatsApp to validate `wa.me` deep-links on iOS + Android + desktop web.
- [ ] **[env]** `LOVIN_DEFAULT_COUNTRY`, `LOVIN_DEFAULT_CURRENCY`, `LOVIN_WHATSAPP_TEMPLATE`.

## 2. Configuration (`.env`)
- [ ] **[env]** `DATABASE_URL` (mysql connection string).
- [ ] **[env]** `NEXTAUTH_URL` (public origin), `NEXTAUTH_SECRET` (32+ random bytes).
- [ ] **[env]** `NEXT_PUBLIC_API_BASE_URL` (Express origin, e.g. `https://api.lovin.app`).
- [ ] **[env]** `LOVIN_IMAGE_PROVIDER=cloudinary`, `LOVIN_CLOUD_NAME`, `LOVIN_CLOUDINARY_API_KEY/SECRET`, `LOVIN_UPLOAD_PRESET`.
- [ ] **[env]** `LOVIN_AUTO_PUBLISH=false` (keep review queue on) for launch; flip later.
- [ ] **[env]** `LOVIN_MAX_UPLOAD_MB=8`, `LOVIN_IMG_MAX_WIDTH=2400`.
- [ ] Confirm CORS allow-list on Express includes only the public frontend origins.

## 3. Database
- [ ] **[db]** Merge `docs/schema-lovin.prisma` deltas; `npx prisma migrate dev --name lovin_marketplace`.
- [ ] **[db]** Seed categories, currencies, an admin user (`server/createAdminUser.js`), and an admin-approved seller.
- [ ] **[db]** Backfill `price` semantics (minor units) for any legacy rows if migrating existing catalog.
- [ ] Run `node scripts/migration-validator.js validate` (existing safe-migrate tool).

## 4. Image optimization
- [ ] Create Cloudinary **upload preset** (`lovin_unsigned`): `f_auto,q_auto, metadata strip`, `max_image_size 8MB`, `max_width 2400`, `moderation: explicit` (optional NSFW screen).
- [ ] Verify `next.config.mjs` `formats:['image/avif','image/webp']` + Cloudinary host in `remotePatterns`.
- [ ] Confirm `<OptimizedImage>` produces a multi-width `srcset` and lazy-loads.

## 5. WhatsApp Click-to-Chat
- [ ] `/api/whatsapp/click` returns a valid `https://wa.me/<E.164>?text=…` for sample products.
- [ ] Prefilled template renders `{title} #{shortId} {price}` correctly across currencies.
- [ ] Fallback modal (copy number / `sms:` / WhatsApp Web) tested when WhatsApp is absent.
- [ ] **[sec]** Rate-limit `/api/whatsapp/click` per `buyerId` and per seller phone (already have `express-rate-limit`); add CAPTCHA after N clicks.

## 6. Seller & admin
- [ ] Seller registration + email verification; password hashed with bcrypt (existing NextAuth).
- [ ] Seller can create (single + batch), edit, archive; sees leads/views.
- [ ] Admin can approve/reject/feature listings, approve/suspend sellers, CRUD categories, export analytics.
- [ ] **[sec]** `middleware.ts` gates `/admin/*` on `role=admin`; seller routes on authenticated seller.

## 7. SEO, performance, accessibility
- [ ] Pretty URLs: `/p/:slug`, `/c/:slug`, `/seller/:slug`; canonical + noindex on drafts/archived.
- [ ] `generateMetadata` + JSON-LD `Product`/`Offer`; `og:image` from Cloudinary `og` variant.
- [ ] `app/sitemap.ts` + `app/robots.ts`; submit sitemap to Google Search Console.
- [ ] Lighthouse (mobile, throttled) ≥ **90** on Home / Category / Product — fix top issues.
- [ ] A11y: axe 0 critical; alt text required in forms; keyboard-reachable WhatsApp button; AA contrast.

## 8. Privacy & compliance
- [ ] Publish `/privacy` policy (data logged, retention, cookie table, WhatsApp redirection notice).
- [ ] Store **hashed/truncated IP only** for leads; raw IP never persisted.
- [ ] Anonymous `buyerId` cookie = first-party, `SameSite=Lax`, 12-month expiry, documented.
- [ ] DSAR path for sellers (export/delete) wired to cascade delete of products/leads/profile.
- [ ] Cookie consent banner only if non-essential analytics (GA) enabled — off by default.

## 9. Analytics
- [ ] Confirm `AnalyticsEvent` rows for `PRODUCT_VIEW`, `WHATSAPP_CLICK`, `SEARCH`, `CATEGORY_VIEW`.
- [ ] Admin + seller dashboards render; CSV export downloads.
- [ ] Conversion (leads ÷ views) computes per listing/seller/category.

## 10. Testing & CI
- [ ] Unit tests pass: `whatsapp.ts`, `image-optimization.ts`, `format.ts`, CSV mapping.
- [ ] Integration (supertest): products filters/sort/pagination, `/api/whatsapp/click` lead insert.
- [ ] E2E (Playwright): browse → product → WhatsApp → assert `wa.me` link + a `Lead` row.
- [ ] GitHub Actions: lint + typecheck + test + build; Lighthouse CI on PR.

## 11. Launch & ops
- [ ] `bun install` (frontend) + `cd server && npm ci`; build & start both (`next start` + `node app.js`).
- [ ] Health checks for Next + Express; centralized logging (winston already present).
- [ ] Backups: enable `npm run db:backup` cron; test restore.
- [ ] Monitor Cloudinary credits; set billing alerts.
- [ ] Rollback plan: keep previous image tag; DB migration is additive (safe to revert app only).

## 12. Optional / later
- [ ] **WhatsApp Business API**: separate Cloud API/BSP, template approval, opt-in, billing per seller — behind `LeadSource=BUSINESS_API` flag (note Meta approval + cost).
- [ ] 2FA for sellers/admin (NextAuth supports TOTP).
- [ ] Abuse auto-moderation (Cloudinary `moderation: explicit` + keyword filter on title/description).

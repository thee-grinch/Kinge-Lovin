# Lovin Sellers — Design & Implementation Spec

> A lightweight, account-free marketplace where **sellers** list products and **buyers** browse and contact sellers via **WhatsApp Click-to-Chat**.
>
> Status: Design v1.0 · Target: Lighthouse ≥ 90 (perf / a11y / best-practices) · Build on the existing Singitronic stack (Next.js 15 + Express + Prisma/MySQL + NextAuth).

---

## 0. TL;DR

| | Decision |
|---|---|
| **Buyers** | No accounts, ever. Anonymous browsing + WhatsApp lead. |
| **Sellers** | Authenticated (NextAuth, email+password, bcrypt). Self-register → email verify → auto-publish (admin can switch to approval mode). |
| **Contact** | WhatsApp Click-to-Chat (`https://wa.me/<E.164>?text=<prefilled>`). Server logs each click as a *lead*. |
| **Listings** | Single form **and** batch (CSV + ZIP of images). Draft / Publish / Archive. |
| **Images** | Cloudinary (recommended) — upload → auto WebP/AVIF, responsive `srcset`, thumbnails, metadata stripped. Next.js `<Image>` loader for CDN delivery. |
| **Moderation** | Admin panel: approve/feature/hide sellers & listings, manage categories, abuse removal. |
| **Analytics** | Anonymous event log: product views, WhatsApp clicks, searches, top categories. Export CSV. |
| **SEO/Perf** | SSR product & category pages, pretty URLs (`/c/electronics`, `/p/samsung-galaxy-s24`), meta tags, sitemap, lazy images. |

> **Key defaults** (override via env): base phone country `KE` (+254), currency `KES`, default listing status on publish = `PENDING_REVIEW` (safe default) or `PUBLISHED` (set `LOVIN_AUTO_PUBLISH=true`). Image host = Cloudinary. Analytics cookie lifetime = 12 months.

---

## 1. How Lovin maps onto the existing codebase

The repo is already a working Next.js + Express + Prisma marketplace engine. Lovin is a **behavioural layer** on top of it, not a rewrite. Reused vs. added:

| Existing (reuse) | Lovin change |
|---|---|
| `Product`, `Image`, `Category`, `Merchant`, `bulk_upload_*`, `User`, `Notification`, NextAuth | Extend with marketplace fields & new tables (§3). |
| Express `/api/*` controllers (`products`, `category`, `search`, `slugs`, `bulkUpload`, `merchant`) | Add `/api/whatsapp`, `/api/leads`, `/api/seller`, `/api/admin`, `/api/analytics`, `/api/images`. |
| Cart / checkout / `Customer_order` | **Removed from buyer flow** (no purchases). Kept in schema but hidden; the *order* is replaced by a WhatsApp **lead**. |
| Wishlist / buyer login | Wishlist becomes optional anonymous "saved" (localStorage). Buyer login pages redirect home. |
| Admin dashboard (`app/(dashboard)/admin`) | Extended with moderation queue, seller approvals, featured, analytics. |
| Bulk upload (CSV) | Extended with Lovin fields + ZIP image bundle + column mapping UI. |
| `next/image` + `placehold.co` host | Replaced by Cloudinary loader & hosts (§6). |

**Architecture (no new infra required):**

```
                     ┌──────────────────────────────────────────────┐
   Browser (no auth) │  Next.js 15 (App Router, SSR/RSC, static)     │
   - browse / search │  /p/:slug  /c/:category  /seller/*  /admin/*  │
   - click WhatsApp  │  <WhatsAppButton> → wa.me deep link           │
                     └───────────────┬──────────────────────────────┘
                                     │ REST (apiClient) + NextAuth session
                                     ▼
                     ┌──────────────────────────────────────────────┐
                     │  Express API (:3001) — Prisma + MySQL         │
                     │  /api/products /api/search /api/whatsapp      │
                     │  /api/seller /api/admin /api/images /analytics│
                     └───────┬───────────────────────┬──────────────┘
                             │                       │
                     ┌───────▼────────┐      ┌───────▼─────────┐
                     │  MySQL (Prisma)│      │  Cloudinary CDN │
                     │  products,     │      │  WebP/AVIF,     │
                     │  leads, events │      │  thumbnails     │
                     └────────────────┘      └─────────────────┘
```

---

## 2. Step-by-step user flows

### 2.1 Buyer browse → WhatsApp (primary flow)
1. **Home** `/` — hero, category tiles, featured/newest grid, search bar.
2. **Category** `/c/electronics?price=0-50000&condition=new&sort=newest` — filter sidebar + product grid (infinite scroll / pagination).
3. **Product detail** `/p/samsung-galaxy-s24` — gallery, price (KES), condition, location, tags, seller card, **WhatsApp "Chat with seller"** button.
4. **Click WhatsApp** → server `POST /api/whatsapp/click` logs a lead (anonymous) → 302 to `https://wa.me/254712345678?text=Hi%2C+is+...+available%3F` → WhatsApp app/web opens prefilled.
5. *Fallback*: if WhatsApp unavailable, show modal with seller phone + copy button + "Open SMS" link.

### 2.2 Seller onboarding & upload
1. **Register** `/register?role=seller` — email, password, display name, default WhatsApp phone (E.164), city/region.
2. **Verify email** → on first login, dashboard is empty with "Create your first listing" CTA.
3. **Single listing** `/seller/listings/new` — form (§7.3) → Save Draft / Publish.
4. **Batch upload** `/seller/bulk-upload` — upload CSV (+ optional ZIP) → **map columns** → **validate** (errors preview) → **Publish all / Draft all**.
5. **Manage** `/seller/listings` — table of active/archived, edit, archive, view **leads** (WhatsApp clicks) & **views**.

### 2.3 Admin moderation
1. **Moderation queue** `/admin/moderation` — listings in `PENDING_REVIEW`; approve / reject (reason) / feature.
2. **Sellers** `/admin/sellers` — approve/ suspend, see listing & lead counts.
3. **Categories** `/admin/categories` — CRUD nested categories.
4. **Analytics** `/admin/analytics` — views, leads, conversion (leads/views), top categories, top searches; export CSV.

---

## 3. Data model (Prisma delta)

Add to `prisma/schema.prisma`. Existing tables stay; we extend `Product`/`Category` and add `SellerProfile`, `Lead`, `AnalyticsEvent`, `ImageVariant`, `ModerationAction`, `SearchQuery`.

> Pricing note: `Product.price` is kept as integer **minor units** (cents) to avoid float rounding; `currency` is a code. WhatsApp phone stored E.164, no `+`.

### 3.1 New enums
```prisma
enum ListingStatus   { DRAFT  PENDING_REVIEW  PUBLISHED  REJECTED  ARCHIVED }
enum ItemCondition   { NEW  LIKE_NEW  USED  REFURBISHED  FOR_PARTS }
enum LeadSource      { PRODUCT_PAGE  SEARCH  CATEGORY  SELLER_CARD  QR_CODE }
enum AnalyticsKind   { PAGE_VIEW  PRODUCT_VIEW  WHATSAPP_CLICK  SEARCH  CATEGORY_VIEW }
enum SellerStatus    { PENDING  ACTIVE  SUSPENDED  REJECTED }
```

### 3.2 Extend `Product`
```prisma
model Product {
  // ...existing fields...
  status          ListingStatus @default(DRAFT)
  condition       ItemCondition @default(NEW)
  currency        String        @default("KES")     // ISO 4217
  price           Int                                 // minor units
  locationCity    String?
  locationRegion  String?
  tags            Json?                              // ["flagship","5G"]
  whatsappPhone   String?                            // E.164; falls back to seller default
  externalUrl     String?
  shippingInfo    String?
  sku             String?
  featured        Boolean       @default(false)
  moderationNote  String?
  publishedAt     DateTime?

  // relations
  merchantId      String
  merchant        Merchant      @relation(fields: [merchantId], references: [id])
  sellerProfileId String?
  sellerProfile   SellerProfile? @relation(fields: [sellerProfileId], references: [id])
  leads           Lead[]
  analytics       AnalyticsEvent[]
  imageVariants   ImageVariant[]
  moderation      ModerationAction[]

  @@index([status, publishedAt])   // public feed
  @@index([categoryId, status])
  @@index([sellerProfileId])
  @@index([featured])
}
```

### 3.3 Extend `Category` (nested + SEO)
```prisma
model Category {
  id        String     @id @default(uuid())
  name      String     @unique
  slug      String     @unique          // /c/:slug
  parentId  String?
  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children  Category[] @relation("CategoryTree")
  icon      String?
  image     String?
  products  Product[]
  @@index([parentId])
}
```

### 3.4 New: `SellerProfile`, `Lead`, `AnalyticsEvent`, `ImageVariant`, `ModerationAction`, `SearchQuery`
```prisma
model SellerProfile {
  id              String       @id @default(uuid())
  userId          String       @unique
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  displayName     String
  slug            String       @unique            // /seller/:slug
  defaultPhone    String                          // E.164
  whatsappEnabled Boolean      @default(true)
  city            String?
  region          String?
  avatarUrl       String?
  status          SellerStatus @default(PENDING)
  featuredSeller  Boolean      @default(false)
  createdAt       DateTime     @default(now())
  products        Product[]
  leads           Lead[]
  @@index([status])
}

model Lead {
  id          String     @id @default(uuid())
  productId   String
  product     Product    @relation(fields: [productId], references: [id], onDelete: Cascade)
  sellerId    String?
  seller      SellerProfile? @relation(fields: [sellerId], references: [id])
  buyerId     String     // anonymous cookie id (no PII)
  phone       String                          // seller phone that was contacted
  source      LeadSource @default(PRODUCT_PAGE)
  message     String?                         // prefilled text used
  ipHash      String?                          // sha256, geo only, not raw IP
  createdAt   DateTime   @default(now())
  @@index([productId, createdAt])
  @@index([sellerId, createdAt])
}

model AnalyticsEvent {
  id         String        @id @default(uuid())
  kind       AnalyticsKind
  productId  String?
  product    Product?      @relation(fields: [productId], references: [id])
  categoryId String?
  sellerId   String?
  buyerId    String
  meta       Json?         // {query, page, filters, referrer_host}
  createdAt  DateTime      @default(now())
  @@index([kind, createdAt])
  @@index([productId])
  @@index([buyerId])
}

model ImageVariant {
  id           String   @id @default(uuid())
  productId    String
  product      Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  publicId     String                  // Cloudinary public id / asset key
  url          String                  // canonical CDN url
  width        Int
  height       Int
  format       String                  // webp|avif|jpg
  role         String                  // main|gallery|thumb|og
  altText      String?
  @@index([productId, role])
}

model ModerationAction {
  id         String   @id @default(uuid())
  productId  String?
  product    Product? @relation(fields: [productId], references: [id])
  sellerId   String?
  adminId    String?
  action     String                     // approve|reject|feature|hide|suspend
  reason     String?
  createdAt  DateTime @default(now())
  @@index([productId])
}

model SearchQuery {
  id        String   @id @default(uuid())
  query     String
  results   Int
  buyerId   String
  createdAt DateTime @default(now())
  @@index([query, createdAt])
}
```

A consolidated, copy-pasteable schema is in [`docs/schema-lovin.prisma`](./schema-lovin.prisma).

### 3.5 Seed defaults
- **Currencies**: `KES`, `USD`, `NGN`, `TZS`, `UGX`, `GHS` (display via `Intl.NumberFormat`).
- **Categories**: Electronics, Fashion, Home & Garden, Vehicles, Property, Jobs, Services, Health & Beauty.
- **Conditions**: New / Like New / Used / Refurbished / For Parts.

---

## 4. API specification

Base: Express at `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3001`). Auth: NextAuth session cookie forwarded; admin/seller gates enforced server-side. All write endpoints behind `express-rate-limit`.

### 4.1 Public (no auth)

| Method | Path | Purpose | Query / body |
|---|---|---|---|
| GET | `/api/products` | Paginated, filtered feed | `q`,`category`,`min`,`max`,`condition`,`city`,`sort=newest\|price_asc\|price_desc`,`page`,`pageSize`,`featured` |
| GET | `/api/products/:slug` | Single listing detail | — |
| GET | `/api/categories` | Tree of categories | — |
| GET | `/api/search?q=` | Search (writes `SearchQuery`) | `q`,`page`,`pageSize` |
| GET | `/api/whatsapp/link/:productId` | Returns built `wa.me` URL + prefilled text | `msg?` (buyer note) |

**`GET /api/products` response:**
```json
{
  "items": [{
    "id":"p_88","slug":"samsung-galaxy-s24","title":"Samsung Galaxy S24",
    "price":129990,"currency":"KES","condition":"NEW",
    "mainImage":"https://res.cloudinary.com/lovin/image/upload/f_auto,q_auto,w_400/v1/p_88/main",
    "city":"Nairobi","sellerName":"Mobility Hub","featured":false,
    "publishedAt":"2026-07-20T09:00:00Z"
  }],
  "page":1,"pageSize":24,"total":512,"totalPages":22
}
```

### 4.2 WhatsApp lead tracking (anonymous)
```
POST /api/whatsapp/click
Body: { productId, source, message, buyerId, note? }
→ { ok:true, url:"https://wa.me/254712345678?text=...", phone:"254712345678" }
```
Server normalizes the phone to E.164, builds the `wa.me` link, inserts a `Lead`, fires an `AnalyticsEvent(WHATSAPP_CLICK)`, and returns the link so the client can do `window.location = url` (one hop, no CORS issues, tracked server-side).

### 4.3 Seller (auth, role=seller)
| Method | Path |
|---|---|
| GET | `/api/seller/me` |
| POST | `/api/seller/listings` (create) · PUT `/api/seller/listings/:id` · DELETE |
| GET | `/api/seller/listings?status=` · `/api/seller/listings/:id/leads` |
| GET | `/api/seller/stats?range=30d` (views, leads, conversion, top listings) |
| POST | `/api/seller/bulk-upload` (multipart: `csv` + optional `zip`) → returns `batchId` |
| GET | `/api/seller/bulk-upload/:batchId` (preview/validate) |
| POST | `/api/seller/bulk-upload/:batchId/publish` · `/draft` |

### 4.4 Admin (auth, role=admin)
| Method | Path |
|---|---|
| GET/POST | `/api/admin/sellers` (list / approve / suspend) |
| GET | `/api/admin/moderation?status=PENDING_REVIEW` |
| POST | `/api/admin/listings/:id/approve` · `/reject` · `/feature` · `/archive` |
| CRUD | `/api/admin/categories` |
| GET | `/api/admin/analytics?range=30d` · `/export.csv` |

### 4.5 Images
```
POST /api/images/upload   (multipart: file, productId?, role=main|gallery)
→ Cloudinary eager transforms applied server-side; returns:
{ publicId, variants:[
   {role:"main",w:1200,format:"webp",url:"..."},
   {role:"thumb",w:400,format:"webp",url:"..."},
   {role:"og",w:1200,format:"jpg",url:"..."} ] }
```

### 4.6 Error envelope (consistent)
```json
{ "error": { "code":"VALIDATION", "message":"price must be >= 0", "fields":["price"] } }
```
Codes: `VALIDATION | NOT_FOUND | UNAUTHORIZED | FORBIDDEN | RATE_LIMITED | CONFLICT | SERVER`.

---

## 5. WhatsApp Click-to-Chat design

**Link format** (international-safe): `https://wa.me/<E.164>?text=<urlencoded>`. Prefer `wa.me` over `api.whatsapp.com` (lighter, no `?phone=` quirks). Phone **digits only, no `+`**, leading zeros stripped, country code required.

**Normalization** (see `lib/lovin/whatsapp.ts`):
1. Strip all non-digits, drop leading `00`/`0`, default-prefix with base country (env `LOVIN_DEFAULT_COUNTRY=KE` → `254`).
2. Validate length 6–15 (E.164). Reject otherwise → admin/seller warned at save time.

**Prefilled message template** (stored per-seller + global default in `LOVIN_WHATSAPP_TEMPLATE`):
```
Hi {sellerName}, I'm interested in "{title}" (#{shortId}) listed for {price} on Lovin. {buyerNote}
```
Placeholders: `{sellerName}`, `{title}`, `{id}`, `{shortId}`, `{price}`, `{city}`, `{buyerNote}`. `price` rendered via `Intl.NumberFormat(currency)`.

**Buyer note**: optional single-line input on the product page; included only if non-empty.

**Fallback** (no WhatsApp installed / desktop without app): a modal offers (a) copy seller phone, (b) `sms:` link, (c) "open WhatsApp Web" link. Detected via `navigator.userAgent` + a 1.5s timeout on `wa.me` focus loss.

**Future: WhatsApp Business API** (not enabled by default). For high-volume sellers, a separate Cloud API / BSP integration with message templates, opt-in, and Meta approval. Tracked behind `LeadSource=BUSINESS_API`. Cost & approval noted in `docs/DEPLOYMENT-CHECKLIST.md`.

---

## 6. Image optimization

**Provider: Cloudinary** (recommended; free tier covers launch). Alternatives: Imgix, Cloudflare Images, or `next/image` + S3 + a sharp worker. Switchable via `LOVIN_IMAGE_PROVIDER`.

**Pipeline:**
1. Seller uploads (drag-drop / file picker / CSV cell URL).
2. Server `POST /api/images/upload` streams to Cloudinary with an **unsigned/signed upload preset** that:
   - converts `f_auto` (WebP/AVIF by Accept header), `q_auto` quality,
   - strips metadata (`fl_keep Attribution` off),
   - enforces **max upload size** (`max_image_size` in preset; default **8 MB**, `max_width 2400`).
3. On response, store `publicId` + generated `ImageVariant` rows (main 1200, gallery 800, thumb 400, og 1200 jpg).

**Responsive delivery** — Next.js `<Image>` with a Cloudinary loader so the browser picks the smallest source:
```tsx
// next/image loader
import { cloudinaryLoader } from "@/lib/lovin/image-optimization";
<Image loader={cloudinaryLoader} src={variant.url} width={400} height={400}
       sizes="(max-width:768px) 50vw, 25vw" alt={alt} loading="lazy" />
```
The loader emits a `srcset` of `w_200,w_400,w_800,w_1200/f_auto,q_auto` transforms — no manual srcset code.

**`next.config.mjs`** — allow Cloudinary host + set `formats:['image/avif','image/webp']` (see `next.config.mjs` patch in code section).

**Defaults / config knobs** (env): `LOVIN_MAX_UPLOAD_MB=8`, `LOVIN_IMG_MAX_WIDTH=2400`, `LOVIN_IMG_QUALITY=auto`, `LOVIN_CLOUD_NAME`, `LOVIN_CLOUDINARY_API_KEY/SECRET`, `LOVIN_UPLOAD_PRESET=lovin_unsigned`.

---

## 7. Seller experience

### 7.1 Onboarding decision
**Default = self-register with email verification + soft moderation.** Sellers can publish immediately to `PENDING_REVIEW`; admin flips `LOVIN_AUTO_PUBLISH=true` for instant publishing. This balances low friction (more sellers) with safety (admin can reject).

### 7.2 Seller dashboard (`/seller`)
Cards: **Active listings**, **Drafts**, **WhatsApp leads (7d)**, **Views (7d)**, **Conversion %**. Tables: recent listings (status, views, leads, actions), recent leads (time, listing, source). Chart: views vs leads over 30d (`react-apexcharts`, already a dep).

### 7.3 Single listing form (`/seller/listings/new`)
Fields → backing `Product` field:

| Field | Type | Rule |
|---|---|---|
| Title | text | 3–80 chars → drives `slug` |
| Description | textarea (sanitized, `lib/sanitize`) | ≤ 4000 |
| Category | select (tree) | required |
| Price + Currency | number + select | price ≥ 0, minor units |
| Condition | select | enum |
| Stock (optional) | number | ≥ 0 |
| City / Region | text/autocomplete | required for filters |
| Tags | chip input | ≤ 8 |
| WhatsApp phone | tel (E.164) | defaults to seller's; validated |
| External link (optional) | url | https only |
| Shipping info (optional) | text | |
| SKU (optional) | text | |
| Images | multi-upload + reorder | ≥ 1 to publish |

Save → `DRAFT`. Publish → `PENDING_REVIEW` (or `PUBLISHED`). Live form validation via `zod` (already a dep).

### 7.4 Batch upload (`/seller/bulk-upload`)
**Inputs:** CSV (required) + ZIP of images (optional). Flow:
1. **Upload** → server parses (`csv-parse`, already a dep), creates `bulk_upload_batch` (`PENDING`).
2. **Map columns** → UI shows detected headers; seller maps each to a Lovin field (sensible auto-guess by header name). Persist mapping on the batch.
3. **Validate** → per-row: required fields, phone E.164, category exists/autocreate, price ≥ 0, image references resolve in ZIP (`images/sku-1.jpg`). Errors surfaced inline with row numbers; batch status `PARTIAL`.
4. **Preview** → table of N rows with status ✓/✗.
5. **Publish all / Draft all** → server creates `Product`s + `ImageVariant`s, links `bulk_upload_item`.

**CSV spec** (see [`docs/lovin-bulk-upload-spec.csv`](./lovin-bulk-upload-spec.csv)):
```
title,description,category,price,currency,condition,stock,city,region,tags,whatsappPhone,externalUrl,shippingInfo,sku,imageRefs
```
- `price` in major units (e.g. `1299.99`); server multiplies by 100 for storage.
- `category` matches a category `slug` or `name`; unknown → flagged.
- `imageRefs` = `;`-separated filenames that must exist in the uploaded ZIP (e.g. `s24-1.jpg;s24-2.jpg`), **or** `http(s)://` URLs fetched & re-hosted to Cloudinary on publish.
- Existing bulk-upload tables (`bulk_upload_batch/item`) are reused; Lovin adds the new fields to the item snapshot.

---

## 8. Admin panel (`/admin`)

| Page | Function |
|---|---|
| `/admin/moderation` | Queue of `PENDING_REVIEW` listings; approve / reject(reason) / feature / hide. Inline image review. |
| `/admin/sellers` | Approve (`PENDING→ACTIVE`), suspend, feature; view leads/listings counts. |
| `/admin/listings` | Full table; archive/remove inappropriate; set featured; force status. |
| `/admin/categories` | CRUD nested categories (name, slug, parent, icon, image). |
| `/admin/analytics` | Views, leads, conversion, top categories, top searches, top sellers; **Export CSV**. |
| `/admin/reports` | Abuse reports (flag button on product page → `ModerationAction`). |

---

## 9. Public browsing · SEO · Performance · Accessibility

- **URLs**: `/p/:slug`, `/c/:slug`, `/seller/:slug`, `/search?q=`. Slugs unique & kebab-cased.
- **SSR**: product & category pages are server components (already the pattern in `app/product/[productSlug]/page.tsx`). Generate static + ISR (`revalidate=300`) for published listings.
- **Metadata**: `generateMetadata` per product/category → `<title>`, `og:image` (Cloudinary `og` variant), `twitter:card`, JSON-LD `Product` + `Offer` schema (price, availability, seller).
- **Sitemap/robots**: `app/sitemap.ts` + `app/robots.ts` enumerating published products/categories.
- **Perf**: `next/image` AVIF/WebP + lazy; route-level code splitting; infinite scroll via intersection observer; CSS via Tailwind (already purged).
- **A11y**: semantic landmarks, `alt` on all images (required in form), focus-visible styles, `aria-current` on active filters, color-contrast AA, keyboard-reachable WhatsApp button, `prefers-reduced-motion` respected.
- **Targets**: Lighthouse ≥ 90 on Home / Category / Product (mobile, throttled).

---

## 10. Privacy & compliance (GDPR-aware, no buyer accounts)

- **No buyer PII collected.** Buyers never give a name/email/phone. The only buyer identifier is a random `buyerId` cookie (first-party, `SameSite=Lax`, 12 months, documented in privacy policy).
- **What we log per WhatsApp click**: timestamp, `productId`, `sellerPhone`, anonymous `buyerId`, `source`, **hashed IP** (sha256, truncated, geo-region only, never raw IP), referrer host. No raw IP persisted.
- **Cookies**: one essential `buyerId` (analytics) + NextAuth session cookie (sellers/admin only). Show a lightweight consent banner only if non-essential analytics (e.g., GA) is enabled — off by default.
- **Seller data**: email, hashed password (bcrypt), display name, phone. Sellers can export/delete their account & listings (DSAR) via `/seller/settings` → triggers cascade delete of their `Product`s/`Lead`s/`SellerProfile`.
- **Privacy policy page** (`/privacy`) explaining data logged, retention (leads 24 months, analytics events 12 months), seller phone visibility, and WhatsApp redirection. Cookie table included.
- **WhatsApp redirection notice**: button tooltip + privacy link — clicking leaves Lovin and opens WhatsApp/ Meta apps.

---

## 11. Analytics & tracking

**Event log** = `AnalyticsEvent` rows (§3). KPIs:
- **Product views** (`PRODUCT_VIEW`), **category views** (`CATEGORY_VIEW`).
- **WhatsApp clicks / leads** (`WHATSAPP_CLICK` → `Lead`).
- **Conversion** = leads / product views (per listing, per seller, per category).
- **Search** = `SearchQuery` (query, results count) → "top searches", "zero-result searches".
- **Export**: `GET /api/admin/analytics/export.csv` and per-seller `/api/seller/stats/export.csv`.

Dashboards use `react-apexcharts` (already present) for time-series + bar charts.

---

## 12. Testing strategy

| Layer | Tool | Coverage |
|---|---|---|
| Unit | Vitest / Jest | `whatsapp.ts` (phone normalization, link build, template), `image-optimization.ts` (loader URL), CSV mapping, price/currency formatting. |
| Integration | Supertest (Express) | `/api/products` filters/sort/pagination, `/api/whatsapp/click` inserts lead + returns link, `/api/seller/listings` CRUD with auth. |
| E2E | Playwright | **Browse → click-to-chat** (assert `wa.me` link + Lead row), seller create listing, batch upload happy path, admin approve. |
| A11y/Perf | `@axe-core/playwright`, Lighthouse CI in GitHub Actions. |

Example E2E (Playwright): *Home → category → product → WhatsApp button → assert `href` matches `/^https:\/\/wa.me\/\d{6,15}\?text=/.+Samsung/` and a `Lead` was created.*

---

## 13. Implementation plan (phased)

| Phase | Scope | Exit |
|---|---|---|
| **0 — Foundation** | Prisma Lovin additions + migration; env/config; `whatsapp.ts`, `image-optimization.ts`, `<WhatsAppButton>`; `/api/whatsapp/click`. | Lead logs on click; images via Cloudinary. |
| **1 — Public** | Product/category/search pages with filters/sort/pagination; SEO meta + JSON-LD; sitemap. | Browse → WhatsApp green path. |
| **2 — Sellers** | Register/verify, dashboard, single-listing form, seller stats. | Seller can list & see leads. |
| **3 — Batch** | CSV+ZIP upload, column mapping, validate, publish. | 100-row import works. |
| **4 — Admin** | Moderation queue, sellers, categories, featured, analytics + export. | Admin can run the marketplace. |
| **5 — Hardening** | Rate limits, 2FA optional, abuse reporting, Lighthouse ≥ 90, tests, privacy policy. | Production-ready. |

---

## 14. Where things live (file map)

```
lib/lovin/whatsapp.ts              # phone normalize, link build, template
lib/lovin/image-optimization.ts    # Cloudinary loader + URL builders
lib/lovin/format.ts                # currency/price, slug, tags
components/lovin/WhatsAppButton.tsx
components/lovin/SellerListingForm.tsx
components/lovin/OptimizedImage.tsx
app/api/whatsapp/click/route.ts    # Next route (proxies to Express / logs)
app/seller/...                     # seller UI
app/admin/moderation|sellers|categories|analytics/...
docs/LOVIN-DESIGN.md               # this file
docs/schema-lovin.prisma           # consolidated schema additions
docs/lovin-bulk-upload-spec.csv    # CSV template
docs/DEPLOYMENT-CHECKLIST.md       # go-live checklist
wireframes/*.html                  # clickable mockups (open index.html)
```

---

## 15. Risks & mitigations

| Risk | Mitigation |
|---|---|
| WhatsApp number misuse / spam to sellers | Rate limit `/api/whatsapp/click` per buyerId + per phone; CAPTCHA after N clicks; hide phone until click. |
| Inappropriate listings | Default `PENDING_REVIEW`; abuse report button; admin quick-hide. |
| Image abuse / huge uploads | Cloudinary preset max size; MIME check; virus/NSFW moderation hook (`moderation: explicit` in Cloudinary). |
| SEO of dynamic catalog | ISR + sitemap; canonical tags; noindex drafts/archived. |
| Cost (Cloudinary/WhatsApp) | Free tier first; Business API behind feature flag with per-seller billing note. |

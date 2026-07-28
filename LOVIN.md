# Lovin Sellers 🟢

A lightweight, **account-free** marketplace layer built on top of this Next.js + Express + Prisma/MySQL codebase. Sellers list products; buyers browse and contact sellers via **WhatsApp Click-to-Chat** — no checkout, no buyer accounts.

> Start here 👉 **[docs/LOVIN-DESIGN.md](./docs/LOVIN-DESIGN.md)** — the full design & implementation spec.

## What's in this delivery

| | Path | What |
|---|---|---|
| 📄 Spec | [`docs/LOVIN-DESIGN.md`](./docs/LOVIN-DESIGN.md) | Architecture, data model, API spec, WhatsApp design, seller/admin UX, SEO/perf/a11y, privacy, analytics, testing, phased plan, risks |
| 🗄️ Data | [`docs/schema-lovin.prisma`](./docs/schema-lovin.prisma) | Consolidated Prisma additions (SellerProfile, Lead, AnalyticsEvent, ImageVariant, ModerationAction, SearchQuery + Product/Category extensions) |
| 📋 Spec | [`docs/lovin-bulk-upload-spec.csv`](./docs/lovin-bulk-upload-spec.csv) | Batch upload CSV template with 5 example rows |
| ✅ Ops | [`docs/DEPLOYMENT-CHECKLIST.md`](./docs/DEPLOYMENT-CHECKLIST.md) | End-to-end go-live checklist (env, db, security, SEO, privacy) |
| 🖼️ Mockups | [`wireframes/index.html`](./wireframes/index.html) | 7 clickable wireframes: Home, Category, Product+WhatsApp, Seller dashboard, Listing form, Batch upload, Admin |

### Working code modules (the marketplace behavior)
```
lib/lovin/whatsapp.ts            # phone→E.164 normalize, wa.me link builder, prefilled template
lib/lovin/image-optimization.ts  # Cloudinary loader, AVIF/WebP, responsive srcset
lib/lovin/format.ts              # currency, slug, tags
components/lovin/WhatsAppButton.tsx     # click-to-chat + fallback modal (the conversion CTA)
components/lovin/OptimizedImage.tsx     # next/image via Cloudinary
components/lovin/SellerListingForm.tsx  # zod-validated single-listing form
app/api/whatsapp/click/route.ts        # logs a Lead, returns wa.me URL
```
- ✅ All Lovin files **type-check clean** (`tsc --noEmit`).
- ✅ WhatsApp phone normalization verified for 6 international formats (incl. `+254…`, `0712…`, `00 254 …`).

## The one idea to remember
> The **green WhatsApp button replaces checkout.** Buyers never create an account. A click logs an anonymous **Lead** and opens a prefilled chat with the seller. That's the whole product.

## Quick start (dev)
```bash
# frontend
npm install && npm run dev          # http://localhost:3000
# backend (separate Express API)
cd server && npm install && npm start   # http://localhost:3001
```
Configure `.env` per [`docs/DEPLOYMENT-CHECKLIST.md`](./docs/DEPLOYMENT-CHECKLIST.md) (DATABASE_URL, NEXTAUTH_SECRET, Cloudinary keys, `LOVIN_*`).

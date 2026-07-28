import { NextRequest, NextResponse } from "next/server";
import {
  normalizePhone,
  buildWhatsAppUrl,
  buildPrefilledMessage,
  DEFAULT_TEMPLATE,
} from "@/lib/lovin/whatsapp";
import { formatPrice } from "@/lib/lovin/format";

export const runtime = "nodejs";

/**
 * POST /api/whatsapp/click
 * Anonymous. Logs a WhatsApp lead and returns the wa.me link to open.
 *
 * In production this forwards to the Express API (NEXT_PUBLIC_API_BASE_URL/api/whatsapp/click)
 * which writes Lead + AnalyticsEvent rows. Here we compute the link so the
 * component works end-to-end in dev without the backend running.
 *
 * Body: { productId, source?, note?, sellerName?, title?, price?, currency?, city?, sellerPhone }
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "VALIDATION", message: "Invalid JSON" } }, { status: 400 });
  }

  const productId = String(body.productId || "");
  const sellerPhoneRaw = String(body.sellerPhone || body.phone || "");
  const sellerPhone = String(body.sellerPhone || "");

  if (!productId) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "productId required", fields: ["productId"] } },
      { status: 400 }
    );
  }

  const norm = normalizePhone(sellerPhoneRaw);
  if (!norm.ok || !norm.phone) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: `Invalid seller phone (${norm.error})`, fields: ["sellerPhone"] } },
      { status: 400 }
    );
  }

  const msg = buildPrefilledMessage(
    (body.template as string) || DEFAULT_TEMPLATE,
    {
      sellerName: body.sellerName as string,
      title: body.title as string,
      id: productId,
      price: formatPrice(Number(body.price) || 0, (body.currency as string) || "KES"),
      city: body.city as string,
      buyerNote: (body.note as string) || "",
    }
  );

  const url = buildWhatsAppUrl(norm.phone, msg);

  // ---- Persist (forward to Express) ----
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
  try {
    await fetch(`${apiBase}/api/whatsapp/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        source: body.source || "PRODUCT_PAGE",
        message: msg,
        phone: norm.phone,
        note: body.note || null,
      }),
      // best-effort: don't block the redirect on analytics failures
    }).catch(() => null);
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true, url, phone: norm.phone });
}

"use client";

import { useState, useCallback } from "react";
import { FaWhatsapp } from "react-icons/fa6";
import {
  buildPrefilledMessage,
  buildWhatsAppUrl,
  shortId,
  DEFAULT_TEMPLATE,
} from "@/lib/lovin/whatsapp";
import { formatPrice } from "@/lib/lovin/format";

export interface WhatsAppButtonProps {
  productId: string;
  title: string;
  price: number; // minor units
  currency?: string;
  sellerName?: string;
  sellerPhone: string; // E.164 digits
  city?: string;
  template?: string;
  trackUrl?: string; // POST endpoint that logs the lead and returns { url }
  className?: string;
}

/**
 * Click-to-Chat button.
 * 1. POST to trackUrl (logs a Lead) → receives the wa.me URL.
 * 2. Opens WhatsApp (same-tab redirect for mobile deep-link reliability).
 * 3. Fallback modal if WhatsApp isn't installed / can't open.
 */
export default function WhatsAppButton({
  productId,
  title,
  price,
  currency = "KES",
  sellerName,
  sellerPhone,
  city,
  template = DEFAULT_TEMPLATE,
  trackUrl = "/api/whatsapp/click",
  className = "",
}: WhatsAppButtonProps) {
  const [showFallback, setShowFallback] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = useCallback(async (note?: string) => {
    setBusy(true);
    let url = "";
    try {
      const res = await fetch(trackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, source: "PRODUCT_PAGE", note }),
      });
      const data = await res.json();
      url = data?.url;
    } catch {
      /* network blocked: compute link client-side as a graceful fallback */
    }
    if (!url) {
      const msg = buildPrefilledMessage(template, {
        sellerName,
        title,
        id: productId,
        shortId: shortId(productId),
        price: formatPrice(price, currency),
        city,
        buyerNote: note,
      });
      url = buildWhatsAppUrl(sellerPhone, msg);
    }
    setBusy(false);

    // Same-tab so mobile deep-links work; detect failure after a delay.
    const win = window.open(url, "_self");
    if (win === null) {
      // popup blocked → try new tab, else show fallback
      if (!window.open(url, "_blank")) setShowFallback(true);
    }
  }, [trackUrl, productId, template, sellerName, title, city, sellerPhone, price, currency]);

  return (
    <>
      <button
        type="button"
        onClick={() => open()}
        disabled={busy}
        aria-label={`Chat with ${sellerName || "seller"} on WhatsApp about ${title}`}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3
                    text-base font-semibold text-white shadow-sm transition
                    hover:bg-[#1ebe57] focus-visible:outline focus-visible:ring-4
                    focus-visible:ring-[#25D366]/40 disabled:opacity-60 ${className}`}
      >
        <FaWhatsapp aria-hidden className="h-5 w-5" />
        {busy ? "Opening…" : "Chat on WhatsApp"}
      </button>

      {showFallback && (
        <FallbackModal
          phone={sellerPhone}
          title={title}
          priceLabel={formatPrice(price, currency)}
          onClose={() => setShowFallback(false)}
        />
      )}
    </>
  );
}

function FallbackModal({
  phone,
  title,
  priceLabel,
  onClose,
}: {
  phone: string;
  title: string;
  priceLabel: string;
  onClose: () => void;
}) {
  const copy = () => navigator.clipboard?.writeText(`+${phone}`);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="WhatsApp fallback"
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-gray-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">WhatsApp not detected</h3>
        <p className="mt-1 text-sm text-gray-600">
          You can reach the seller directly about <strong>{title}</strong>{" "}
          ({priceLabel}).
        </p>
        <p className="mt-4 text-2xl font-mono tracking-wide">+{phone}</p>
        <div className="mt-4 flex flex-col gap-2">
          <a
            href={`sms:+${phone}`}
            className="rounded-lg bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white"
          >
            Open SMS
          </a>
          <a
            href={`https://web.whatsapp.com/send?phone=${phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-[#25D366] px-4 py-2 text-center text-sm font-medium text-white"
          >
            Open WhatsApp Web
          </a>
          <button
            onClick={copy}
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Copy number
          </button>
          <button onClick={onClose} className="text-sm text-gray-500">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

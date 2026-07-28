"use client";

import { useState } from "react";
import { z } from "zod";
import { slugify, parseTags, CONDITIONS, CURRENCIES, type Condition } from "@/lib/lovin/format";
import { normalizePhone } from "@/lib/lovin/whatsapp";

const schema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().min(10).max(4000),
  category: z.string().min(1),
  price: z.number().min(0),
  currency: z.enum(CURRENCIES as unknown as [string, ...string[]]),
  condition: z.enum(CONDITIONS as unknown as [string, ...string[]]),
  stock: z.number().int().min(0).optional(),
  city: z.string().min(1),
  region: z.string().optional(),
  tags: z.string().optional(),
  whatsappPhone: z.string().min(1),
  externalUrl: z.string().url().optional().or(z.literal("")),
  shippingInfo: z.string().optional(),
  sku: z.string().optional(),
});

type Values = z.input<typeof schema>;

const empty: Values = {
  title: "", description: "", category: "", price: 0, currency: "KES",
  condition: "NEW", city: "", region: "", tags: "", whatsappPhone: "",
  externalUrl: "", shippingInfo: "", sku: "",
};

const FIELDS: { name: keyof Values; label: string; type?: string; placeholder?: string }[] = [
  { name: "title", label: "Title", placeholder: 'e.g. Samsung Galaxy S24 Ultra' },
  { name: "price", label: "Price", type: "number", placeholder: "1299.99" },
  { name: "city", label: "City", placeholder: "Nairobi" },
  { name: "region", label: "Region (optional)" },
  { name: "sku", label: "SKU (optional)" },
  { name: "externalUrl", label: "External link (optional)", type: "url", placeholder: "https://" },
  { name: "shippingInfo", label: "Shipping info (optional)" },
];

/**
 * Single-listing form. Validates with zod, normalizes the WhatsApp number,
 * converts price to minor units, and POSTs to the Express API.
 */
export default function SellerListingForm({
  sellerDefaultPhone = "",
  categories = [],
  submitUrl = "/api/seller/listings",
}: {
  sellerDefaultPhone?: string;
  categories?: { id: string; name: string }[];
  submitUrl?: string;
}) {
  const [values, setValues] = useState<Values>({
    ...empty,
    whatsappPhone: sellerDefaultPhone,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [publish, setPublish] = useState(false);

  const set = (k: keyof Values, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      ...values,
      price: Number(values.price) || 0,
      stock: values.stock ? Number(values.stock) : undefined,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[issue.path[0] as string] = issue.message;
      const phone = normalizePhone(values.whatsappPhone);
      if (!phone.ok) fe.whatsappPhone = "Enter a valid international phone, e.g. +254712345678";
      setErrors(fe);
      return;
    }
    setErrors({});
    setStatus("saving");
    const phone = normalizePhone(values.whatsappPhone)!;
    const payload = {
      ...parsed.data,
      whatsappPhone: phone.phone,
      priceMinor: Math.round(Number(parsed.data.price) * 100), // major → minor units
      slug: slugify(parsed.data.title),
      tags: parseTags(parsed.data.tags),
      status: publish ? "PENDING_REVIEW" : "DRAFT",
    };
    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      {FIELDS.map(({ name, label, type = "text", placeholder }) => (
        <Field key={name} label={label} error={errors[name]}>
          <input
            type={type}
            step={type === "number" ? "0.01" : undefined}
            value={values[name] as string}
            placeholder={placeholder}
            onChange={(e) => set(name, e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          />
        </Field>
      ))}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" error={errors.category}>
          <select value={values.category} onChange={(e) => set("category", e.target.value)} className="w-full rounded-lg border px-3 py-2">
            <option value="">Select…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Currency" error={errors.currency}>
          <select value={values.currency} onChange={(e) => set("currency", e.target.value)} className="w-full rounded-lg border px-3 py-2">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Condition" error={errors.condition}>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => (
            <button type="button" key={c} onClick={() => set("condition", c as string)}
              className={`rounded-full border px-3 py-1 text-sm ${values.condition === c ? "border-emerald-600 bg-emerald-50 text-emerald-700" : ""}`}>
              {c.replace("_", " ").toLowerCase()}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Description" error={errors.description}>
        <textarea rows={5} value={values.description} onChange={(e) => set("description", e.target.value)} className="w-full rounded-lg border px-3 py-2" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="WhatsApp phone" error={errors.whatsappPhone} hint="International, e.g. +254712345678">
          <input type="tel" value={values.whatsappPhone} onChange={(e) => set("whatsappPhone", e.target.value)} className="w-full rounded-lg border px-3 py-2" />
        </Field>
        <Field label="Tags (optional)" hint="comma separated, max 8">
          <input value={values.tags} onChange={(e) => set("tags", e.target.value)} className="w-full rounded-lg border px-3 py-2" />
        </Field>
      </div>

      {status === "done" && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved ✓ — {publish ? "submitted for review." : "saved as draft."}</p>}
      {status === "error" && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Something went wrong. Try again.</p>}

      <div className="flex gap-3">
        <button type="submit" onClick={() => setPublish(false)} disabled={status === "saving"}
          className="rounded-xl border px-5 py-2.5 font-medium">Save draft</button>
        <button type="submit" onClick={() => setPublish(true)} disabled={status === "saving"}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700">
          {status === "saving" ? "Saving…" : "Publish"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export type { Condition };

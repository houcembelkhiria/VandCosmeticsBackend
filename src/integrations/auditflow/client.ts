// Copyright (c) 2025 Belia IT. All rights reserved.
//
// AuditFlow Storefront client (ADR-014 phase 4). One file, no dependency besides
// `fetch` (Node 18+, Next.js, Deno, browsers) and `node:crypto` for webhook
// verification. Copy it into a storefront or publish it as a package.
//
//   const af = createClient({ baseUrl: "https://erp.client.tn", apiKey: process.env.AUDITFLOW_KEY! });
//   const { data, nextCursor } = await af.listProducts({ limit: 12 });
//   const order = await af.createOrder({ customer: {...}, lines: [{ sku: "PRD-X-001", qty: 1 }] }, { idempotencyKey: cartId });
//
// Browser code uses a PUBLIC key (read-only); orders need a SECRET key, so call
// createOrder from your server only.
import { createHmac, timingSafeEqual } from "node:crypto";

export type Money = string; // "107.088", always 3 decimals

export interface Price { currency: string; ht: Money; ttc: Money; compareAtHt: Money | null; compareAtTtc: Money | null }
export interface Variant {
  id: string; sku: string; name: string;
  options: Record<string, { value: string; label: string; axis: string; hex?: string }>;
  price: Price; priceTiers?: { minQty: number; ht: Money; ttc: Money }[];
  inStock: boolean; available: number; onHand?: number; reserved?: number;
}
export interface Product {
  id: string; handle: string; title: string; description: string | null;
  seo: { title: string | null; description: string | null };
  type: { code: string; name: string } | null;
  attributes: Record<string, unknown>;
  images: { id: string; url: string; alt: string | null; width: number | null; height: number | null }[];
  collections: { handle: string; title: string }[];
  variants: Variant[];
  priceFrom: { currency: string; ht: Money; ttc: Money } | null;
  inStock: boolean; updatedAt: string;
}
export interface StockLevel { sku: string; found: boolean; inStock: boolean; available: number; onHand?: number; reserved?: number }
export interface NewOrder {
  channelCode?: string; externalRef?: string; idempotencyKey?: string; paymentMethod?: "COD" | "BANK_TRANSFER" | "IN_STORE";
  customer: { name: string; phone: string; email?: string; address?: string; city?: string; governorate?: string };
  lines: { sku?: string; itemId?: string; qty: number }[];
  shippingFee?: number; notes?: string;
}
export interface OrderSummary { id: string; number: string; status: string; total: Money; currency: string; expiresAt: string | null; replayed?: boolean; externalRef?: string | null; createdAt?: string }

export class AuditFlowError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown, public retryAfterSec?: number) {
    super(message);
    this.name = "AuditFlowError";
  }
}

export interface ClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Unbound secret keys must name the channel. */
  channel?: string;
  lang?: "fr" | "en" | "ar";
  timeoutMs?: number;
  /** Inject a custom fetch (tests, Next.js `fetch` options, proxies). */
  fetch?: typeof fetch;
}

type Query = Record<string, string | number | undefined | null>;

export function createClient(opts: ClientOptions) {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const doFetch = opts.fetch ?? fetch;

  async function call<T>(method: "GET" | "POST", path: string, o: { query?: Query; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
    const url = new URL(base + path);
    for (const [k, v] of Object.entries({ channel: opts.channel, lang: opts.lang, ...o.query })) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    const res = await doFetch(url, {
      method,
      headers: { Authorization: `Bearer ${opts.apiKey}`, Accept: "application/json", ...(o.body !== undefined ? { "Content-Type": "application/json" } : {}), ...o.headers },
      body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    });
    const text = await res.text();
    const parsed = text ? (JSON.parse(text) as unknown) : undefined;
    if (!res.ok) {
      const e = (parsed as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
      throw new AuditFlowError(res.status, e?.code ?? "unknown", e?.message ?? `HTTP ${res.status}`, e?.details, Number(res.headers.get("retry-after")) || undefined);
    }
    return parsed as T;
  }

  return {
    me: () => call<{ key: { id: string; name: string; kind: "PUBLIC" | "SECRET"; scopes: string[]; channel: { code: string; name: string; currency: string } | null } }>("GET", "/api/v1/me"),
    listProducts: (q: { q?: string; collection?: string; limit?: number; cursor?: string } = {}) =>
      call<{ data: Product[]; nextCursor: string | null }>("GET", "/api/v1/products", { query: q }),
    /** Walk every page. */
    async *iterateProducts(q: { q?: string; collection?: string; pageSize?: number } = {}): AsyncGenerator<Product> {
      let cursor: string | undefined;
      do {
        const page = await call<{ data: Product[]; nextCursor: string | null }>("GET", "/api/v1/products", { query: { q: q.q, collection: q.collection, limit: q.pageSize ?? 50, cursor } });
        for (const p of page.data) yield p;
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
    },
    getProduct: async (handle: string) => (await call<{ data: Product }>("GET", `/api/v1/products/${encodeURIComponent(handle)}`)).data,
    listCollections: async () => (await call<{ data: { handle: string; title: string; description: string | null; parent: string | null; productCount: number }[] }>("GET", "/api/v1/collections")).data,
    getStock: async (skus: string[]) => (await call<{ data: StockLevel[] }>("GET", "/api/v1/stock", { query: { sku: skus.join(",") } })).data,
    getEntities: async (code: string) => (await call<{ data: Record<string, unknown>[] }>("GET", `/api/v1/entities/${encodeURIComponent(code)}`)).data,
    createOrder: async (order: NewOrder, o: { idempotencyKey?: string } = {}) =>
      (await call<{ order: OrderSummary }>("POST", "/api/v1/orders", { body: order, headers: o.idempotencyKey ? { "Idempotency-Key": o.idempotencyKey } : undefined })).order,
    getOrder: async (id: string) => (await call<{ order: Record<string, unknown> }>("GET", `/api/v1/orders/${encodeURIComponent(id)}`)).order,
    listOrders: async (q: { externalRef?: string; status?: string; limit?: number } = {}) => (await call<{ data: OrderSummary[] }>("GET", "/api/v1/orders", { query: q })).data,
    cancelOrder: async (id: string, reason?: string) => (await call<{ order: { id: string; status: string } }>("POST", `/api/v1/orders/${encodeURIComponent(id)}/cancel`, { body: { reason } })).order,
  };
}

export interface WebhookEvent<T = Record<string, unknown>> { id: string; type: string; createdAt: string; data: T }

/**
 * Check a webhook and parse it. Pass the RAW request body (not re-serialised JSON).
 * Throws on a bad or stale signature. Dedupe on `event.id`: delivery is at-least-once.
 */
export function verifyWebhook<T = Record<string, unknown>>(rawBody: string, signatureHeader: string | null, secret: string, opts: { toleranceSec?: number; nowMs?: number } = {}): WebhookEvent<T> {
  const parts = Object.fromEntries((signatureHeader ?? "").split(",").map((p) => { const i = p.indexOf("="); return [p.slice(0, i).trim(), p.slice(i + 1).trim()]; }));
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !parts.v1) throw new Error("Signature de webhook absente ou illisible.");
  if (Math.abs(Math.floor((opts.nowMs ?? Date.now()) / 1000) - t) > (opts.toleranceSec ?? 300)) throw new Error("Signature de webhook expirée.");
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex"), "hex");
  const given = Buffer.from(parts.v1, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new Error("Signature de webhook invalide.");
  return JSON.parse(rawBody) as WebhookEvent<T>;
}

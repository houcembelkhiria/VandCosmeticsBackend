// Pure mapping between AuditFlow's storefront model and Vanda's tables.
import type { Product } from './client';

export interface VandaVariant { id: string; name: string; sku: string; price?: number; stock: number }

/** What the sync writes into Vanda's `products`. */
export interface VandaProductRow {
  auditflow_id: string;
  auditflow_sku: string | null;
  title: string;
  slug: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  images: string[];
  variants: VandaVariant[];
  attributes: Record<string, string>;
  category: string | null;
  stock: number;
  featured: boolean;
}

const money = (v: string): number => Math.round(Number(v) * 100) / 100;

function flattenAttribute(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (Array.isArray(v)) return v.map(String).join(', ');
  return String(v);
}

export function mapProduct(p: Product): VandaProductRow {
  const sellable = p.variants;
  const single = sellable.length === 1 && Object.keys(sellable[0].options).length === 0;
  const cheapest = sellable.length ? sellable.reduce((m, v) => (Number(v.price.ttc) < Number(m.price.ttc) ? v : m)) : null;
  const price = cheapest ? money(cheapest.price.ttc) : 0;
  const compare = cheapest?.price.compareAtTtc ? money(cheapest.price.compareAtTtc) : null;

  const variants: VandaVariant[] = single
    ? []
    : sellable.map((v) => {
        const label = Object.values(v.options).map((o) => o.label).join(' / ');
        const vp = money(v.price.ttc);
        return { id: v.sku, name: label || v.name, sku: v.sku, ...(vp !== price ? { price: vp } : {}), stock: Math.max(0, Math.floor(v.available)) };
      });

  const attributes: Record<string, string> = {};
  for (const [k, v] of Object.entries(p.attributes)) {
    const s = flattenAttribute(v);
    if (s !== null) attributes[k] = s;
  }

  return {
    auditflow_id: p.id,
    auditflow_sku: single ? sellable[0].sku : null,
    title: p.title,
    slug: p.handle,
    description: p.description ?? '',
    price,
    compare_at_price: compare !== null && compare > price ? compare : null,
    images: p.images.map((i) => i.url),
    variants,
    attributes,
    category: p.collections[0]?.title ?? null,
    stock: sellable.reduce((s, v) => s + Math.max(0, Math.floor(v.available)), 0),
    featured: false,
  };
}

export type VandaOrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

/** AuditFlow owns the order pipeline; Vanda only mirrors it. */
export function mapOrderStatus(af: string): VandaOrderStatus {
  switch (af) {
    case 'CONFIRMED': return 'processing';
    case 'SHIPPED': return 'shipped';
    case 'DELIVERED': return 'delivered';
    case 'CANCELLED':
    case 'EXPIRED':
    case 'RETURNED': return 'cancelled';
    default: return 'pending';
  }
}

/** Delivery fee as AuditFlow wants it (HT, 3 decimals). */
export function shippingFeeHt(fee: number, includesVat: boolean, vatRate: number): number {
  const f = Number.isFinite(fee) && fee > 0 ? fee : 0;
  return Math.round((includesVat ? f / (1 + vatRate) : f) * 1000) / 1000;
}

/** JSON with sorted keys: Postgres JSONB does not keep object key order, so a plain stringify cannot compare rows. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canonicalJson(o[k])).join(',') + '}';
}

const num2 = (v: unknown) => (v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100);

/** Is the stored Vanda row already what the sync would write? (No write when nothing changed.) */
export function productUnchanged(existing: Omit<VandaProductRow, 'featured'>, row: VandaProductRow): boolean {
  return (
    existing.title === row.title && existing.slug === row.slug && existing.description === row.description &&
    num2(existing.price) === num2(row.price) && num2(existing.compare_at_price) === num2(row.compare_at_price) &&
    canonicalJson(existing.images) === canonicalJson(row.images) && canonicalJson(existing.variants) === canonicalJson(row.variants) &&
    canonicalJson(existing.attributes) === canonicalJson(row.attributes) && (existing.category ?? null) === row.category &&
    existing.stock === row.stock && (existing.auditflow_sku ?? null) === row.auditflow_sku
  );
}

import { createHmac } from 'node:crypto';
import type { Product } from '../../src/integrations/auditflow/client';
import { mapProduct, type VandaOrderStatus, type VandaProductRow } from '../../src/integrations/auditflow/mapper';
import type { ManagedProduct, NewOrderRow, ProductSkus, VandaStore } from '../../src/integrations/auditflow/store';

export const variant = (sku: string, over: Record<string, unknown> = {}) => ({
  id: 'v-' + sku, sku, name: 'Item ' + sku, options: {} as Record<string, { value: string; label: string; axis: string }>,
  price: { currency: 'TND', ht: '100.000', ttc: '119.000', compareAtHt: null, compareAtTtc: null },
  inStock: true, available: 10, ...over,
});

export const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1', handle: 'serum-eclat', title: 'Sérum éclat', description: 'Un sérum', seo: { title: null, description: null },
  type: { code: 'skincare', name: 'Soin' }, attributes: {}, images: [{ id: 'm1', url: 'https://erp.test/api/media/m1', alt: null, width: 1, height: 1 }],
  collections: [{ handle: 'soins', title: 'Soins visage' }], variants: [variant('PRD-X-001')], priceFrom: { currency: 'TND', ht: '100.000', ttc: '119.000' },
  inStock: true, updatedAt: '2026-11-03T00:00:00Z', ...over,
} as Product);

/** In-memory VandaStore with the same observable behaviour as the Supabase one. */
export class FakeStore implements VandaStore {
  products = new Map<string, ManagedProduct>();
  orders = new Map<string, NewOrderRow & { status: VandaOrderStatus }>();
  events = new Set<string>();
  failInsertOrder = false;
  failNextUpsert = false;
  private seq = 0;

  async listManaged() { return [...this.products.values()]; }
  async upsertProduct(row: VandaProductRow, existing: ManagedProduct | undefined) {
    if (this.failNextUpsert) { this.failNextUpsert = false; throw new Error('db down'); }
    const { featured: _f, ...rest } = row;
    if (existing) {
      const { id: _i, ...before } = existing;
      const unchanged = JSON.stringify(before) === JSON.stringify(rest);
      this.products.set(existing.auditflow_id, { ...rest, id: existing.id });
      return unchanged ? ('unchanged' as const) : ('updated' as const);
    }
    this.products.set(row.auditflow_id, { ...rest, id: `vp-${++this.seq}` });
    return 'created' as const;
  }
  async deleteManaged(ids: string[]) { let n = 0; for (const id of ids) if (this.products.delete(id)) n++; return n; }
  async deleteManagedBySlug(slug: string) { let n = 0; for (const [k, p] of this.products) if (p.slug === slug) { this.products.delete(k); n++; } return n; }
  async skusFor(ids: string[]) {
    const out = new Map<string, ProductSkus>();
    for (const p of this.products.values()) if (ids.includes(p.id)) out.set(p.id, { auditflowSku: p.auditflow_sku, variantSkus: p.variants.map((v) => v.sku) });
    return out;
  }
  async insertOrder(row: NewOrderRow) {
    if (this.failInsertOrder) throw new Error('insert failed');
    this.orders.set(row.id, row);
    return { ...row } as Record<string, unknown>;
  }
  async getOrder(id: string) { const o = this.orders.get(id); return o ? { id, auditflow_order_id: o.auditflow_order_id, status: o.status } : null; }
  async setOrderStatusByAuditflowId(afId: string, status: VandaOrderStatus, afStatus: string) {
    let n = 0;
    for (const o of this.orders.values()) if (o.auditflow_order_id === afId) { o.status = status; o.auditflow_status = afStatus; n++; }
    return n;
  }
  async recordEvent(id: string) { if (this.events.has(id)) return false; this.events.add(id); return true; }
  async forgetEvent(id: string) { this.events.delete(id); }
  seed(p: Product) { const row = mapProduct(p); const id = `vp-${++this.seq}`; const { featured: _f, ...rest } = row; this.products.set(p.id, { ...rest, id }); return id; }
}

export const sign = (secret: string, body: string, nowMs = Date.now()) => {
  const t = Math.floor(nowMs / 1000);
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
};

/** Minimal Express req/res doubles. */
export function httpPair(body: string, headers: Record<string, string> = {}) {
  const req = { body: Buffer.from(body), header: (n: string) => headers[n.toLowerCase()] } as never;
  const out: { status: number; json: unknown } = { status: 0, json: null };
  const res = { status(s: number) { out.status = s; return this; }, json(j: unknown) { out.json = j; return this; } } as never;
  return { req, res, out };
}

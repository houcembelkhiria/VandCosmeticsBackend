import { describe, expect, it } from 'vitest';
import { canonicalJson, mapOrderStatus, mapProduct, productUnchanged, shippingFeeHt } from '../../src/integrations/auditflow/mapper';
import { product, variant } from './helpers';

describe('mapProduct', () => {
  it('a single plain item becomes a product without variants, keeping its SKU for ordering', () => {
    const r = mapProduct(product());
    expect(r).toMatchObject({ auditflow_id: 'p1', auditflow_sku: 'PRD-X-001', slug: 'serum-eclat', price: 119, compare_at_price: null, stock: 10, category: 'Soins visage', variants: [], featured: false });
    expect(r.images).toEqual(['https://erp.test/api/media/m1']);
  });

  it('several variants become Vanda variants keyed by SKU, with per-variant stock and a differing price', () => {
    const opt = (v: string, l: string) => ({ value: v, label: l, axis: 'Teinte' });
    const r = mapProduct(product({
      variants: [
        variant('S-NUDE', { options: { shade: opt('nude', 'Nude') }, available: 4 }),
        variant('S-ROUGE', { options: { shade: opt('rouge', 'Rouge') }, available: 0, inStock: false, price: { currency: 'TND', ht: '110.000', ttc: '130.900', compareAtHt: null, compareAtTtc: null } }),
      ],
    }));
    expect(r.auditflow_sku).toBeNull();
    expect(r.variants).toEqual([
      { id: 'S-NUDE', name: 'Nude', sku: 'S-NUDE', stock: 4 },
      { id: 'S-ROUGE', name: 'Rouge', sku: 'S-ROUGE', price: 130.9, stock: 0 },
    ]);
    expect(r.price).toBe(119); // cheapest TTC
    expect(r.stock).toBe(4);
  });

  it('keeps a compare-at price only when it is higher, rounds money to 2 decimals and floors fractional stock', () => {
    const p = product({ variants: [variant('A', { available: 3.9, price: { currency: 'TND', ht: '90.000', ttc: '107.100', compareAtHt: '120.000', compareAtTtc: '142.800' } })] });
    expect(mapProduct(p)).toMatchObject({ price: 107.1, compare_at_price: 142.8, stock: 3 });
    const odd = product({ variants: [variant('A', { price: { currency: 'TND', ht: '89.990', ttc: '107.088', compareAtHt: '50.000', compareAtTtc: '59.500' } })] });
    expect(mapProduct(odd)).toMatchObject({ price: 107.09, compare_at_price: null });
  });

  it('flattens public attributes to strings and tolerates missing description and collections', () => {
    const r = mapProduct(product({ description: null, collections: [], attributes: { brand: 'Vanda', vegan: true, skin_type: ['dry', 'oily'], empty: '', none: null } }));
    expect(r.attributes).toEqual({ brand: 'Vanda', vegan: 'Oui', skin_type: 'dry, oily' });
    expect(r.description).toBe('');
    expect(r.category).toBeNull();
  });

  it('a product with no sellable variant has price 0 and stock 0 instead of crashing', () => {
    expect(mapProduct(product({ variants: [] }))).toMatchObject({ price: 0, stock: 0, variants: [], auditflow_sku: null });
  });
});

describe('order status and shipping fee', () => {
  it('mirrors the AuditFlow pipeline onto Vanda statuses', () => {
    expect(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED', 'EXPIRED', 'WHATEVER'].map(mapOrderStatus))
      .toEqual(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'cancelled', 'cancelled', 'pending']);
  });
  it('turns the TTC delivery fee into the HT amount AuditFlow expects, so the total matches', () => {
    expect(shippingFeeHt(8.33, true, 0.19)).toBe(7);
    expect(shippingFeeHt(7, false, 0.19)).toBe(7);
    expect(shippingFeeHt(5, true, 0)).toBe(5);
    for (const bad of [NaN, -3, 0]) expect(shippingFeeHt(bad as number, true, 0.19)).toBe(0);
  });
});

describe('change detection', () => {
  const stored = () => { const { featured: _f, ...r } = mapProduct(product({ variants: [variant('A', { options: { shade: { value: 'n', label: 'Nude', axis: 'Teinte' } } }), variant('B', { options: { shade: { value: 'r', label: 'Rouge', axis: 'Teinte' } } })] })); return r; };

  it('ignores object key order, which Postgres JSONB does not preserve', () => {
    const row = { ...stored(), featured: false };
    const reordered = { ...stored(), variants: stored().variants.map((v) => ({ stock: v.stock, sku: v.sku, name: v.name, id: v.id })), attributes: {} };
    expect(canonicalJson({ b: 1, a: { d: 1, c: 2 } })).toBe(canonicalJson({ a: { c: 2, d: 1 }, b: 1 }));
    expect(productUnchanged(reordered, row)).toBe(true);
  });
  it('treats numeric strings from the database like numbers, and sees every real change', () => {
    const row = { ...stored(), featured: false };
    expect(productUnchanged({ ...stored(), price: String(row.price) as unknown as number }, row)).toBe(true);
    for (const change of [{ title: 'x' }, { stock: 99 }, { price: 1 }, { images: [] }, { category: 'Autre' }, { description: 'd' }, { compare_at_price: 200 }, { auditflow_sku: 'Z' }, { attributes: { a: '1' } }]) {
      expect(productUnchanged({ ...stored(), ...change } as never, row), JSON.stringify(change)).toBe(false);
    }
    expect(productUnchanged({ ...stored(), variants: [{ ...stored().variants[0], stock: 0 }, stored().variants[1]] }, row)).toBe(false);
  });
});

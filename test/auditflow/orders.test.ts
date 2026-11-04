import { describe, expect, it, vi } from 'vitest';
import { AuditFlowError } from '../../src/integrations/auditflow/client';
import { OrderRejected, placeOrder, type OrderInput } from '../../src/integrations/auditflow/orders';
import { FakeStore, product, variant } from './helpers';

const config = { shippingFeeIncludesVat: true, shippingVatRate: 0.19 };
const input = (over: Partial<OrderInput> = {}): OrderInput => ({
  userId: null, customerEmail: 'a@b.tn', customerName: 'Amine',
  items: [{ productId: 'vp-1', quantity: 2, unitPrice: 119, title: 'Sérum' }],
  shipping: { fullName: 'Amine Ben Salah', email: 'a@b.tn', phone: '22 123 456', address: '12 rue X', city: 'Tunis', state: 'Tunis', zipCode: '1000', country: 'TN', deliveryFee: 8.33 },
  subtotal: 238, discount: 0, total: 246.33, ...over,
});
const af = { id: 'af1', number: 'WEB-2026-0001', status: 'PENDING', total: '247.330', currency: 'TND', expiresAt: null };
const clientOk = () => ({ createOrder: vi.fn(async () => af), cancelOrder: vi.fn(async () => ({ id: 'af1', status: 'CANCELLED' })) });
const setup = () => { const store = new FakeStore(); store.seed(product()); return store; };

describe('placeOrder', () => {
  it('reserves in AuditFlow first, with the SKU, an idempotency key, and the delivery fee converted to HT', async () => {
    const store = setup(), client = clientOk();
    const { order, auditflow } = await placeOrder({ client, store, config }, input(), 'VANDA-1');
    expect(client.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ externalRef: 'VANDA-1', paymentMethod: 'COD', shippingFee: 7, lines: [{ sku: 'PRD-X-001', qty: 2 }], customer: expect.objectContaining({ phone: '22 123 456', governorate: 'Tunis' }) }),
      { idempotencyKey: 'VANDA-1' },
    );
    expect(auditflow.number).toBe('WEB-2026-0001');
    // AuditFlow's total (with stamp duty) is what is recorded and charged
    expect(order).toMatchObject({ id: 'VANDA-1', total: 247.33, auditflow_total: 247.33, status: 'pending', auditflow_order_id: 'af1', auditflow_number: 'WEB-2026-0001' });
  });

  it('free delivery sends no fee; variants are matched by SKU', async () => {
    const store = new FakeStore();
    const id = store.seed(product({ id: 'pv', handle: 'pv', variants: [variant('S-NUDE', { options: { shade: { value: 'nude', label: 'Nude', axis: 'Teinte' } } }), variant('S-ROUGE', { options: { shade: { value: 'rouge', label: 'Rouge', axis: 'Teinte' } } })] }));
    const client = clientOk();
    await placeOrder({ client, store, config }, input({ items: [{ productId: id, variantId: 'S-ROUGE', quantity: 1, unitPrice: 119, title: 'x' }], shipping: { ...input().shipping, isFreeDelivery: true } }), 'V2');
    expect(client.createOrder).toHaveBeenCalledWith(expect.objectContaining({ shippingFee: 0, lines: [{ sku: 'S-ROUGE', qty: 1 }] }), expect.anything());
  });

  it('rejects an item that is not orderable through AuditFlow, before calling it', async () => {
    const store = setup(), client = clientOk();
    for (const items of [
      [{ productId: 'legacy-product', quantity: 1, unitPrice: 1, title: 'Old' }],
      [{ productId: 'vp-1', variantId: 'NOT-A-SKU', quantity: 1, unitPrice: 1, title: 'x' }],
    ]) {
      await expect(placeOrder({ client, store, config }, input({ items }), 'V3')).rejects.toMatchObject({ status: 400 });
    }
    expect(client.createOrder).not.toHaveBeenCalled();
    expect(store.orders.size).toBe(0);
  });

  it('maps out-of-stock to the 400 shape the frontend already handles, and records nothing', async () => {
    const store = setup();
    const client = { ...clientOk(), createOrder: vi.fn(async () => { throw new AuditFlowError(409, 'out_of_stock', 'x', [{ name: 'Sérum', requested: '5.000', available: '2.000' }]); }) };
    const err = await placeOrder({ client, store, config }, input(), 'V4').catch((e) => e);
    expect(err).toBeInstanceOf(OrderRejected);
    expect(err.status).toBe(400);
    expect(err.body).toEqual({ error: 'Insufficient stock', details: ['Insufficient stock for "Sérum". Available: 2, Required: 5'] });
    expect(store.orders.size).toBe(0);
  });

  it('maps other AuditFlow refusals and outages without leaking internals', async () => {
    const store = setup();
    const fail = (e: Error) => ({ ...clientOk(), createOrder: vi.fn(async () => { throw e; }) });
    expect(await placeOrder({ client: fail(new AuditFlowError(422, 'invalid_request', 'Numéro de téléphone tunisien invalide')), store, config }, input(), 'V5').catch((e) => e)).toMatchObject({ status: 400, body: { error: 'Numéro de téléphone tunisien invalide' } });
    expect(await placeOrder({ client: fail(new AuditFlowError(429, 'rate_limited', 'x')), store, config }, input(), 'V6').catch((e) => e)).toMatchObject({ status: 429 });
    const down = await placeOrder({ client: fail(new Error('ECONNREFUSED 10.0.0.5')), store, config }, input(), 'V7').catch((e) => e);
    expect(down).toMatchObject({ status: 502 });
    expect(JSON.stringify(down.body)).not.toMatch(/ECONNREFUSED|10\.0/);
  });

  it('cancels the AuditFlow order when Vanda cannot record its own (no orphan reservation)', async () => {
    const store = setup();
    store.failInsertOrder = true;
    const client = clientOk();
    await expect(placeOrder({ client, store, config }, input(), 'V8')).rejects.toThrow('insert failed');
    expect(client.cancelOrder).toHaveBeenCalledWith('af1', expect.any(String));
  });

  it('a failing compensation is logged, not thrown over the original error', async () => {
    const store = setup();
    store.failInsertOrder = true;
    const client = { ...clientOk(), cancelOrder: vi.fn(async () => { throw new Error('also down'); }) };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(placeOrder({ client, store, config }, input(), 'V9')).rejects.toThrow('insert failed');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

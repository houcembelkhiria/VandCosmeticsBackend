import { describe, expect, it } from 'vitest';
import { createWebhookHandler } from '../../src/integrations/auditflow/webhook';
import { AuditFlowError } from '../../src/integrations/auditflow/client';
import { FakeStore, httpPair, product, sign, variant } from './helpers';

const SECRET = 'whsec_test_secret';
const ev = (type: string, data: Record<string, unknown> = {}, id = 'e-' + Math.random().toString(36).slice(2)) => JSON.stringify({ id, type, createdAt: '2026-11-03T00:00:00Z', data });
const feed = (list: ReturnType<typeof product>[]) => ({
  async *iterateProducts() { for (const p of list) yield p; },
  async getProduct(handle: string) { const p = list.find((x) => x.handle === handle); if (!p) throw new AuditFlowError(404, 'not_found', 'x'); return p; },
});
const post = async (handler: ReturnType<typeof createWebhookHandler>, body: string, sig?: string) => {
  const { req, res, out } = httpPair(body, sig === undefined ? { 'x-auditflow-signature': sign(SECRET, body) } : { 'x-auditflow-signature': sig });
  await handler(req, res);
  return out;
};

describe('webhook handler', () => {
  it('rejects a missing, forged, tampered or stale signature with 401 and does nothing', async () => {
    const store = new FakeStore();
    const h = createWebhookHandler({ client: feed([]), store, secret: SECRET });
    const body = ev('order.updated', { id: 'af1', status: 'SHIPPED' });
    expect((await post(h, body, '')).status).toBe(401);
    expect((await post(h, body, sign('whsec_wrong', body))).status).toBe(401);
    expect((await post(h, body + ' ', sign(SECRET, body))).status).toBe(401);
    expect((await post(h, body, sign(SECRET, body, Date.now() - 3_600_000))).status).toBe(401);
    expect(store.events.size).toBe(0);
  });

  it('is off (503) without a configured secret', async () => {
    const h = createWebhookHandler({ client: feed([]), store: new FakeStore(), secret: null });
    expect((await post(h, ev('stock.changed'))).status).toBe(503);
  });

  it('acknowledges a duplicate delivery without processing it again', async () => {
    const store = new FakeStore();
    store.seed(product());
    const h = createWebhookHandler({ client: feed([product({ variants: [variant('PRD-X-001', { available: 2 })] })]), store, secret: SECRET });
    const body = ev('stock.changed', { productHandle: 'serum-eclat' }, 'same-event');
    expect((await post(h, body)).json).toEqual({ ok: true });
    expect([...store.products.values()][0].stock).toBe(2);
    store.products.get('p1')!.stock = 99; // would be overwritten if processed again
    expect((await post(h, body)).json).toEqual({ ok: true, duplicate: true });
    expect([...store.products.values()][0].stock).toBe(99);
  });

  it('stock.changed refreshes just that product; without a handle it falls back to a full sync', async () => {
    const store = new FakeStore();
    store.seed(product({ id: 'a', handle: 'a' }));
    store.seed(product({ id: 'b', handle: 'b' }));
    const a2 = product({ id: 'a', handle: 'a', variants: [variant('A', { available: 1 })] });
    const h = createWebhookHandler({ client: feed([a2, product({ id: 'b', handle: 'b', variants: [variant('B', { available: 7 })] })]), store, secret: SECRET });
    await post(h, ev('stock.changed', { productHandle: 'a' }));
    expect(store.products.get('a')!.stock).toBe(1);
    expect(store.products.get('b')!.stock).toBe(10); // untouched by the single refresh
    await post(h, ev('stock.changed', { productHandle: null }));
    expect(store.products.get('b')!.stock).toBe(7);
  });

  it('product events run a full sync, including creating and removing products', async () => {
    const store = new FakeStore();
    store.seed(product({ id: 'old', handle: 'old' }));
    const h = createWebhookHandler({ client: feed([product({ id: 'new', handle: 'new' })]), store, secret: SECRET });
    await post(h, ev('product.updated', { id: 'new' }));
    expect([...store.products.keys()]).toEqual(['new']);
  });

  it('order events mirror the AuditFlow status onto the Vanda order', async () => {
    const store = new FakeStore();
    store.orders.set('V1', { id: 'V1', auditflow_order_id: 'af1', auditflow_number: 'WEB-1', auditflow_status: 'PENDING', status: 'pending' } as never);
    const h = createWebhookHandler({ client: feed([]), store, secret: SECRET });
    for (const [type, st, expected] of [['order.updated', 'CONFIRMED', 'processing'], ['order.updated', 'SHIPPED', 'shipped'], ['order.updated', 'DELIVERED', 'delivered'], ['order.cancelled', 'CANCELLED', 'cancelled']] as const) {
      await post(h, ev(type, { id: 'af1', status: st }));
      expect(store.orders.get('V1')).toMatchObject({ status: expected, auditflow_status: st });
    }
    expect((await post(h, ev('order.updated', { id: 'unknown', status: 'SHIPPED' }))).status).toBe(200); // not a Vanda order: ignored
  });

  it('ignores event types it does not care about, but still acknowledges them', async () => {
    const h = createWebhookHandler({ client: feed([]), store: new FakeStore(), secret: SECRET });
    for (const t of ['webhook.test', 'order.created', 'invoice.created', 'something.new']) expect((await post(h, ev(t))).status).toBe(200);
  });

  it('a failure answers 500 and forgets the event so the retry is processed', async () => {
    const store = new FakeStore();
    store.failNextUpsert = true;
    const h = createWebhookHandler({ client: feed([product()]), store, secret: SECRET });
    const body = ev('product.updated', {}, 'retry-me');
    expect((await post(h, body)).status).toBe(500);
    expect(store.events.has('retry-me')).toBe(false);
    expect((await post(h, body)).status).toBe(200);
    expect(store.products.size).toBe(1);
  });
});

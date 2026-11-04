import { describe, expect, it } from 'vitest';
import { AuditFlowError } from '../../src/integrations/auditflow/client';
import { coalesce, syncCatalog, syncProduct } from '../../src/integrations/auditflow/sync';
import { FakeStore, product, variant } from './helpers';

const feed = (list: ReturnType<typeof product>[]) => ({
  async *iterateProducts() { for (const p of list) yield p; },
  async getProduct(handle: string) { const p = list.find((x) => x.handle === handle); if (!p) throw new AuditFlowError(404, 'not_found', 'x'); return p; },
});

describe('syncCatalog', () => {
  it('creates, updates, leaves unchanged and removes what AuditFlow no longer publishes', async () => {
    const store = new FakeStore();
    const a = product({ id: 'a', handle: 'a', title: 'A' }), b = product({ id: 'b', handle: 'b', title: 'B' }), c = product({ id: 'c', handle: 'c', title: 'C' });
    store.seed(b); store.seed(c);
    const b2 = product({ id: 'b', handle: 'b', title: 'B' }); // unchanged
    const c2 = product({ id: 'c', handle: 'c', title: 'C renamed' });
    const r = await syncCatalog({ client: feed([a, b2, c2]), store });
    expect(r).toEqual({ created: 1, updated: 1, unchanged: 1, deleted: 0, skippedDeletion: false });
    const r2 = await syncCatalog({ client: feed([a]), store });
    expect(r2).toMatchObject({ unchanged: 1, deleted: 2 });
    expect([...store.products.keys()]).toEqual(['a']);
  });

  it('is idempotent: a second run changes nothing', async () => {
    const store = new FakeStore();
    const list = [product({ id: 'a', handle: 'a' }), product({ id: 'b', handle: 'b' })];
    await syncCatalog({ client: feed(list), store });
    expect(await syncCatalog({ client: feed(list), store })).toEqual({ created: 0, updated: 0, unchanged: 2, deleted: 0, skippedDeletion: false });
  });

  it('refuses to wipe the shop when AuditFlow suddenly returns nothing', async () => {
    const store = new FakeStore();
    store.seed(product({ id: 'a', handle: 'a' }));
    const r = await syncCatalog({ client: feed([]), store });
    expect(r).toMatchObject({ deleted: 0, skippedDeletion: true });
    expect(store.products.size).toBe(1);
    expect((await syncCatalog({ client: feed([]), store }, { allowEmpty: true })).deleted).toBe(1);
  });

  it('never touches hand-made Vanda products (those without an AuditFlow id)', async () => {
    const store = new FakeStore(); // listManaged only returns managed rows by construction
    store.seed(product({ id: 'a', handle: 'a' }));
    expect((await syncCatalog({ client: feed([product({ id: 'a', handle: 'a' })]), store })).deleted).toBe(0);
  });
});

describe('syncProduct', () => {
  it('refreshes one product after a stock change', async () => {
    const store = new FakeStore();
    store.seed(product());
    const moved = product({ variants: [variant('PRD-X-001', { available: 3 })] });
    expect(await syncProduct({ client: feed([moved]), store }, 'serum-eclat')).toBe('updated');
    expect([...store.products.values()][0].stock).toBe(3);
  });
  it('removes the product when it is no longer published (404), and propagates other errors', async () => {
    const store = new FakeStore();
    store.seed(product());
    expect(await syncProduct({ client: feed([]), store }, 'serum-eclat')).toBe('deleted');
    expect(store.products.size).toBe(0);
    const broken = { async *iterateProducts() {}, async getProduct() { throw new AuditFlowError(500, 'server_error', 'boom'); } };
    await expect(syncProduct({ client: broken, store }, 'x')).rejects.toThrow('boom');
  });
});

describe('coalesce', () => {
  it('never runs two at once and runs exactly once more for requests that arrived meanwhile', async () => {
    let active = 0, max = 0, runs = 0;
    const run = coalesce(async () => { runs++; active++; max = Math.max(max, active); await new Promise((r) => setTimeout(r, 20)); active--; });
    await Promise.all([run(), run(), run(), run()]);
    expect(max).toBe(1);
    expect(runs).toBe(2);
    await run();
    expect(runs).toBe(3);
  });
  it('a failing run does not block later ones', async () => {
    let n = 0;
    const run = coalesce(async () => { n++; if (n === 1) throw new Error('once'); });
    await expect(run()).rejects.toThrow('once');
    await run();
    expect(n).toBe(2);
  });
});

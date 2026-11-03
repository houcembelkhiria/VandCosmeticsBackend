import { AuditFlowError, createClient, type Product } from './client';
import { mapProduct } from './mapper';
import type { VandaStore } from './store';

type Client = ReturnType<typeof createClient>;
export interface SyncDeps { client: Pick<Client, 'iterateProducts' | 'getProduct'>; store: VandaStore }
export interface SyncReport { created: number; updated: number; unchanged: number; deleted: number; skippedDeletion: boolean }

/**
 * Make Vanda's managed products equal to what AuditFlow publishes: create, update,
 * remove those no longer published. Refuses to delete everything when AuditFlow
 * returns nothing while Vanda has products (misconfigured key/channel, outage).
 */
export async function syncCatalog({ client, store }: SyncDeps, opts: { allowEmpty?: boolean } = {}): Promise<SyncReport> {
  const products: Product[] = [];
  for await (const p of client.iterateProducts({ pageSize: 50 })) products.push(p);

  const existing = await store.listManaged();
  const byId = new Map(existing.map((e) => [e.auditflow_id, e]));
  const report: SyncReport = { created: 0, updated: 0, unchanged: 0, deleted: 0, skippedDeletion: false };

  for (const p of products) report[await store.upsertProduct(mapProduct(p), byId.get(p.id))]++;

  const live = new Set(products.map((p) => p.id));
  const gone = existing.filter((e) => !live.has(e.auditflow_id)).map((e) => e.auditflow_id);
  if (gone.length > 0) {
    if (products.length === 0 && !opts.allowEmpty) report.skippedDeletion = true;
    else report.deleted = await store.deleteManaged(gone);
  }
  return report;
}

/** Refresh one product (stock change): fetch it, upsert it; if it is no longer published, remove it. */
export async function syncProduct({ client, store }: SyncDeps, handle: string): Promise<'created' | 'updated' | 'unchanged' | 'deleted'> {
  try {
    const p = await client.getProduct(handle);
    const existing = (await store.listManaged()).find((e) => e.auditflow_id === p.id);
    return await store.upsertProduct(mapProduct(p), existing);
  } catch (e) {
    if (e instanceof AuditFlowError && e.status === 404) {
      await store.deleteManagedBySlug(handle);
      return 'deleted';
    }
    throw e;
  }
}

/** Runs `fn` at most once at a time; a request that arrives meanwhile triggers exactly one more run. */
export function coalesce(fn: () => Promise<unknown>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let again = false;
  const run = async () => {
    do {
      again = false;
      await fn();
    } while (again);
  };
  return async () => {
    if (running) { again = true; return running; }
    running = run().finally(() => { running = null; });
    return running;
  };
}

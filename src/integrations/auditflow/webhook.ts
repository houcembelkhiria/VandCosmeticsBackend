import type { Request, Response } from 'express';
import { createClient, verifyWebhook, type WebhookEvent } from './client';
import { mapOrderStatus } from './mapper';
import { syncCatalog, syncProduct, coalesce } from './sync';
import type { VandaStore } from './store';

type Client = ReturnType<typeof createClient>;

export interface WebhookDeps {
  client: Pick<Client, 'iterateProducts' | 'getProduct'>;
  store: VandaStore;
  secret: string | null;
}

/**
 * POST /api/webhooks/auditflow — must receive the RAW body (express.raw), because the
 * signature covers the exact bytes. Answers 2xx only once the event is handled, so
 * AuditFlow retries a failure; duplicates are acknowledged and ignored.
 */
export function createWebhookHandler(deps: WebhookDeps) {
  const fullSync = coalesce(() => syncCatalog(deps));

  return async (req: Request, res: Response) => {
    if (!deps.secret) return res.status(503).json({ error: 'Webhook not configured' });
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    let event: WebhookEvent<Record<string, unknown>>;
    try {
      event = verifyWebhook(raw, req.header('x-auditflow-signature') ?? null, deps.secret);
    } catch {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (!(await deps.store.recordEvent(event.id, event.type))) return res.status(200).json({ ok: true, duplicate: true });

    try {
      switch (event.type) {
        case 'stock.changed': {
          const handle = typeof event.data.productHandle === 'string' ? event.data.productHandle : null;
          if (handle) await syncProduct(deps, handle); else await fullSync();
          break;
        }
        case 'product.created':
        case 'product.updated':
        case 'product.deleted':
          await fullSync();
          break;
        case 'order.updated':
        case 'order.cancelled': {
          const id = String(event.data.id ?? '');
          const status = String(event.data.status ?? '');
          if (id && status) await deps.store.setOrderStatusByAuditflowId(id, mapOrderStatus(status), status);
          break;
        }
        default:
          break; // webhook.test, order.created (we placed it), invoice.created …
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      await deps.store.forgetEvent(event.id); // let the retry process it
      console.error('AuditFlow webhook failed:', event.type, e);
      return res.status(500).json({ error: 'Processing failed' });
    }
  };
}

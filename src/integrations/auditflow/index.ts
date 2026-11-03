import type { NextFunction, Request, Response } from 'express';
import { createClient } from './client';
import { loadAuditflowConfig, type AuditflowConfig } from './config';
import { SupabaseStore } from './supabaseStore';
import { syncCatalog } from './sync';

export interface AuditflowRuntime {
  config: AuditflowConfig;
  client: ReturnType<typeof createClient>;
  store: SupabaseStore;
}

let cached: AuditflowRuntime | null | undefined;

/** The integration, or null when it is not configured (the backend then behaves as before). */
export function getAuditflow(): AuditflowRuntime | null {
  if (cached !== undefined) return cached;
  const config = loadAuditflowConfig();
  cached = config ? { config, client: createClient({ baseUrl: config.baseUrl, apiKey: config.apiKey }), store: new SupabaseStore() } : null;
  return cached;
}

/** For tests. */
export function resetAuditflowForTests() { cached = undefined; }

/** Route guard: when AuditFlow owns the catalogue, Vanda's own product writes are refused. */
export function blockWhenManagedByAuditflow(req: Request, res: Response, next: NextFunction) {
  if (!getAuditflow()) return next();
  return res.status(409).json({ error: 'Le catalogue est géré dans AuditFlow : modifiez les produits et le stock là-bas.', code: 'MANAGED_EXTERNALLY' });
}

/** Safety net for missed webhooks: full reconcile every N minutes. */
export function startReconcile(): void {
  const af = getAuditflow();
  if (!af || af.config.reconcileMinutes <= 0) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await syncCatalog(af);
      if (r.created + r.updated + r.deleted > 0) console.log('[auditflow] reconcile', r);
    } catch (e) {
      console.error('[auditflow] reconcile failed:', e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 5_000).unref();
  setInterval(tick, af.config.reconcileMinutes * 60_000).unref();
}

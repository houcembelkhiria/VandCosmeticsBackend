import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { getAuditflow } from '../integrations/auditflow';
import { syncCatalog } from '../integrations/auditflow/sync';

const router = Router();

// Full catalogue sync on demand (also runs on webhooks and every AUDITFLOW_RECONCILE_MINUTES).
router.post('/sync', authenticateToken, requireAdmin, async (_req, res) => {
  const af = getAuditflow();
  if (!af) return res.status(404).json({ error: 'AuditFlow integration is not configured' });
  try {
    res.json(await syncCatalog(af));
  } catch (error) {
    console.error('AuditFlow sync error:', error);
    res.status(502).json({ error: 'Sync failed' });
  }
});

router.get('/status', authenticateToken, requireAdmin, (_req, res) => {
  const af = getAuditflow();
  res.json({ enabled: !!af, url: af?.config.baseUrl ?? null, webhookConfigured: !!af?.config.webhookSecret, reconcileMinutes: af?.config.reconcileMinutes ?? 0 });
});

export default router;

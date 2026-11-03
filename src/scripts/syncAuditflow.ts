// One-off / scheduled full catalogue sync:  npm run sync:auditflow
import dotenv from 'dotenv';
dotenv.config();
import { getAuditflow } from '../integrations/auditflow';
import { syncCatalog } from '../integrations/auditflow/sync';

(async () => {
  const af = getAuditflow();
  if (!af) { console.error('AuditFlow n\'est pas configuré (AUDITFLOW_URL, AUDITFLOW_API_KEY).'); process.exit(2); }
  const report = await syncCatalog(af, { allowEmpty: process.argv.includes('--allow-empty') });
  console.log(JSON.stringify(report));
  if (report.skippedDeletion) { console.error('AuditFlow n\'a renvoyé aucun produit : suppression ignorée (utiliser --allow-empty pour forcer).'); process.exit(1); }
})().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

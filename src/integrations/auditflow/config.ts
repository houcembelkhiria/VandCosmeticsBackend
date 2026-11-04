// AuditFlow integration (pilot). Off unless AUDITFLOW_URL and AUDITFLOW_API_KEY are set:
// with them unset the backend behaves exactly as before.
export interface AuditflowConfig {
  baseUrl: string;
  /** Secret API key (afk_sec_…): orders and catalogue. Server side only. */
  apiKey: string;
  /** Webhook signing secret (whsec_…). Without it the webhook route answers 503. */
  webhookSecret: string | null;
  /** Vanda's delivery fee is shown TTC; AuditFlow stores it HT and adds VAT. */
  shippingFeeIncludesVat: boolean;
  /** VAT rate AuditFlow applies to the delivery fee (its setting orders.shippingTvaRate). */
  shippingVatRate: number;
  /** Full catalogue reconcile period, a safety net for missed webhooks. 0 = off. */
  reconcileMinutes: number;
}

export function loadAuditflowConfig(env: NodeJS.ProcessEnv = process.env): AuditflowConfig | null {
  const baseUrl = env.AUDITFLOW_URL?.trim().replace(/\/+$/, '');
  const apiKey = env.AUDITFLOW_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  if (!/^https?:\/\//.test(baseUrl)) throw new Error('AUDITFLOW_URL doit commencer par http(s)://');
  if (!/^afk_sec_[0-9a-f]{8}_[0-9a-f]{32}$/.test(apiKey)) throw new Error('AUDITFLOW_API_KEY doit être une clé secrète AuditFlow (afk_sec_…)');
  const vat = Number(env.AUDITFLOW_SHIPPING_VAT_RATE ?? '0.19');
  const reconcile = Number(env.AUDITFLOW_RECONCILE_MINUTES ?? '30');
  if (![0, 0.07, 0.13, 0.19].includes(vat)) throw new Error('AUDITFLOW_SHIPPING_VAT_RATE : 0, 0.07, 0.13 ou 0.19');
  if (!Number.isFinite(reconcile) || reconcile < 0) throw new Error('AUDITFLOW_RECONCILE_MINUTES invalide');
  return {
    baseUrl, apiKey,
    webhookSecret: env.AUDITFLOW_WEBHOOK_SECRET?.trim() || null,
    shippingFeeIncludesVat: (env.AUDITFLOW_SHIPPING_FEE_INCLUDES_VAT ?? 'true') !== 'false',
    shippingVatRate: vat,
    reconcileMinutes: reconcile,
  };
}

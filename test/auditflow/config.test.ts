import { describe, expect, it } from 'vitest';
import { loadAuditflowConfig } from '../../src/integrations/auditflow/config';
import { blockWhenManagedByAuditflow, resetAuditflowForTests } from '../../src/integrations/auditflow';

const KEY = 'afk_sec_' + 'a1b2c3d4' + '_' + '0'.repeat(32);

describe('config', () => {
  it('is off unless both URL and key are set', () => {
    expect(loadAuditflowConfig({})).toBeNull();
    expect(loadAuditflowConfig({ AUDITFLOW_URL: 'https://erp.x.tn' })).toBeNull();
    expect(loadAuditflowConfig({ AUDITFLOW_API_KEY: KEY })).toBeNull();
  });
  it('reads a valid configuration with safe defaults', () => {
    expect(loadAuditflowConfig({ AUDITFLOW_URL: 'https://erp.x.tn/', AUDITFLOW_API_KEY: KEY })).toEqual({
      baseUrl: 'https://erp.x.tn', apiKey: KEY, webhookSecret: null, shippingFeeIncludesVat: true, shippingVatRate: 0.19, reconcileMinutes: 30,
    });
    expect(loadAuditflowConfig({ AUDITFLOW_URL: 'http://localhost:3100', AUDITFLOW_API_KEY: KEY, AUDITFLOW_WEBHOOK_SECRET: 'whsec_x', AUDITFLOW_SHIPPING_FEE_INCLUDES_VAT: 'false', AUDITFLOW_RECONCILE_MINUTES: '0' }))
      .toMatchObject({ webhookSecret: 'whsec_x', shippingFeeIncludesVat: false, reconcileMinutes: 0 });
  });
  it('fails loudly on a public key (it cannot place orders), a bad URL, VAT rate or period', () => {
    const base = { AUDITFLOW_URL: 'https://erp.x.tn', AUDITFLOW_API_KEY: KEY };
    expect(() => loadAuditflowConfig({ ...base, AUDITFLOW_API_KEY: 'afk_pub_a1b2c3d4_' + '0'.repeat(32) })).toThrow(/clé secrète/);
    expect(() => loadAuditflowConfig({ ...base, AUDITFLOW_URL: 'erp.x.tn' })).toThrow(/http/);
    expect(() => loadAuditflowConfig({ ...base, AUDITFLOW_SHIPPING_VAT_RATE: '0.2' })).toThrow(/VAT/);
    expect(() => loadAuditflowConfig({ ...base, AUDITFLOW_RECONCILE_MINUTES: '-5' })).toThrow(/RECONCILE/);
  });
});

describe('write guard', () => {
  const run = () => { let status = 0, body: unknown, called = false; blockWhenManagedByAuditflow({} as never, { status(s: number) { status = s; return this; }, json(b: unknown) { body = b; return this; } } as never, () => { called = true; }); return { status, body, called }; };
  it('lets Vanda edit its own catalogue when AuditFlow is not configured', () => {
    delete process.env.AUDITFLOW_URL; delete process.env.AUDITFLOW_API_KEY; resetAuditflowForTests();
    expect(run().called).toBe(true);
  });
  it('refuses product writes with 409 when AuditFlow owns the catalogue', () => {
    process.env.AUDITFLOW_URL = 'https://erp.x.tn'; process.env.AUDITFLOW_API_KEY = KEY; resetAuditflowForTests();
    const r = run();
    expect(r).toMatchObject({ called: false, status: 409, body: { code: 'MANAGED_EXTERNALLY' } });
    delete process.env.AUDITFLOW_URL; delete process.env.AUDITFLOW_API_KEY; resetAuditflowForTests();
  });
});

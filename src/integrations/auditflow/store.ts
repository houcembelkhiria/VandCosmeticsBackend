// Vanda-side persistence used by the integration. An interface so the sync, the
// webhook handler and the order adapter are tested without a database.
import type { VandaOrderStatus, VandaProductRow } from './mapper';

export interface ManagedProduct extends Omit<VandaProductRow, 'featured'> { id: string }

export interface NewOrderRow {
  id: string;
  user_id: string | null;
  customer_email: string;
  customer_name: string;
  items: unknown;
  shipping: unknown;
  subtotal: number;
  discount: number;
  total: number;
  status: VandaOrderStatus;
  auditflow_order_id: string;
  auditflow_number: string;
  auditflow_status: string;
  /** AuditFlow's exact total (3 decimals); `total` is rounded to the 2 decimals of Vanda's column. */
  auditflow_total: number;
}

export interface ProductSkus { auditflowSku: string | null; variantSkus: string[] }

export interface VandaStore {
  /** Products created by the sync (auditflow_id set). */
  listManaged(): Promise<ManagedProduct[]>;
  upsertProduct(row: VandaProductRow, existing: ManagedProduct | undefined): Promise<'created' | 'updated' | 'unchanged'>;
  deleteManaged(auditflowIds: string[]): Promise<number>;
  deleteManagedBySlug(slug: string): Promise<number>;
  /** Orderable SKUs of the given Vanda product ids; absent = product not managed by AuditFlow. */
  skusFor(productIds: string[]): Promise<Map<string, ProductSkus>>;
  insertOrder(row: NewOrderRow): Promise<Record<string, unknown>>;
  getOrder(id: string): Promise<{ id: string; auditflow_order_id: string | null; status: string } | null>;
  setOrderStatusByAuditflowId(auditflowOrderId: string, status: VandaOrderStatus, auditflowStatus: string): Promise<number>;
  /** false when this event id was already recorded (duplicate delivery). */
  recordEvent(id: string, type: string): Promise<boolean>;
  forgetEvent(id: string): Promise<void>;
}

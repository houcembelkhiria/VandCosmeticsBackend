import { randomBytes } from 'node:crypto';
import { AuditFlowError, createClient, type NewOrder } from './client';
import type { AuditflowConfig } from './config';
import { mapOrderStatus, shippingFeeHt } from './mapper';
import type { VandaStore } from './store';

type Client = ReturnType<typeof createClient>;

export interface OrderInput {
  userId: string | null;
  customerEmail: string;
  customerName: string;
  items: { productId: string; variantId?: string; quantity: number; unitPrice: number; title: string; image?: string }[];
  shipping: { fullName: string; email: string; phone: string; address: string; city: string; state: string; zipCode: string; country: string; deliveryFee?: number; isFreeDelivery?: boolean };
  subtotal: number;
  discount?: number;
  total: number;
}

/** A refusal Vanda can show its customer as is. `body` keeps the shape the frontend already understands. */
export class OrderRejected extends Error {
  constructor(public status: number, public body: { error: string; details?: unknown }) {
    super(body.error);
  }
}

export const generateOrderId = () => `VANDA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;

/**
 * Place the order in AuditFlow (stock reservation, the single source of truth)
 * BEFORE recording it in Vanda: a refused order leaves nothing behind to clean up.
 * If recording in Vanda fails afterwards, the AuditFlow order is cancelled.
 */
export async function placeOrder(
  deps: { client: Pick<Client, 'createOrder' | 'cancelOrder'>; store: VandaStore; config: Pick<AuditflowConfig, 'shippingFeeIncludesVat' | 'shippingVatRate'> },
  input: OrderInput,
  orderId = generateOrderId(),
) {
  const skus = await deps.store.skusFor([...new Set(input.items.map((i) => i.productId))]);
  const lines: NewOrder['lines'] = [];
  for (const item of input.items) {
    const p = skus.get(item.productId);
    const sku = item.variantId && p?.variantSkus.includes(item.variantId) ? item.variantId : !item.variantId ? p?.auditflowSku : null;
    if (!p || !sku) throw new OrderRejected(400, { error: 'Product not available for online ordering', details: [`${item.title}`] });
    lines.push({ sku, qty: item.quantity });
  }

  const sh = input.shipping;
  const order: NewOrder = {
    externalRef: orderId,
    paymentMethod: 'COD',
    customer: { name: sh.fullName || input.customerName, phone: sh.phone, email: input.customerEmail, address: sh.address, city: sh.city, governorate: sh.state },
    lines,
    shippingFee: sh.isFreeDelivery ? 0 : shippingFeeHt(sh.deliveryFee ?? 0, deps.config.shippingFeeIncludesVat, deps.config.shippingVatRate),
  };

  let af;
  try {
    af = await deps.client.createOrder(order, { idempotencyKey: orderId });
  } catch (e) {
    if (e instanceof AuditFlowError) {
      if (e.status === 409 && e.code === 'out_of_stock') {
        const details = Array.isArray(e.details)
          ? (e.details as { name?: string; requested?: string; available?: string }[]).map((d) => `Insufficient stock for "${d.name}". Available: ${Number(d.available)}, Required: ${Number(d.requested)}`)
          : [e.message];
        throw new OrderRejected(400, { error: 'Insufficient stock', details });
      }
      if (e.status === 422) throw new OrderRejected(400, { error: e.message });
      if (e.status === 429) throw new OrderRejected(429, { error: 'Too many orders for this phone number. Please contact the shop.' });
    }
    console.error('AuditFlow order failed:', e);
    throw new OrderRejected(502, { error: 'Order service temporarily unavailable, please retry' });
  }

  try {
    const row = await deps.store.insertOrder({
      id: orderId, user_id: input.userId, customer_email: input.customerEmail, customer_name: input.customerName,
      items: input.items, shipping: input.shipping, subtotal: input.subtotal, discount: input.discount ?? 0,
      // AuditFlow's total is the amount actually charged (it adds the fiscal stamp and rounds on 3 decimals).
      total: Number(af.total), status: mapOrderStatus(af.status), auditflow_order_id: af.id, auditflow_number: af.number, auditflow_status: af.status, auditflow_total: Number(af.total),
    });
    return { order: row, auditflow: af };
  } catch (e) {
    await deps.client.cancelOrder(af.id, 'Vanda n\'a pas pu enregistrer la commande').catch((ce) => console.error('Compensation failed — cancel order manually in AuditFlow:', af.number, ce));
    throw e;
  }
}

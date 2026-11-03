# AuditFlow integration (pilot)

AuditFlow becomes the single source of truth for **catalogue, prices, stock, and the order pipeline**.
Vanda keeps everything the customer sees: its frontend, cart, accounts, delivery-fee rules and emails.
The integration is **off unless `AUDITFLOW_URL` and `AUDITFLOW_API_KEY` are set**: with them unset, this backend behaves exactly as before.

## What changes when it is on

| | Before | With AuditFlow |
|---|---|---|
| Products, prices, stock, images | edited in Vanda's admin | edited in AuditFlow; copied into Vanda's `products` by a sync (webhook + periodic reconcile). Vanda's product write routes answer `409 MANAGED_EXTERNALLY` |
| Prices shown | as typed | AuditFlow price **TTC**, rounded to 2 decimals |
| Stock | `products.stock`, decremented in code (race-prone) | what AuditFlow can sell now (physical − reservations − channel buffer); per variant in `variants[].stock` |
| New order | stock check then decrement in Vanda | AuditFlow reserves the stock first (atomic); Vanda records the order only if that succeeded. Out of stock → `400 Insufficient stock` with the same shape as before |
| Order status | edited by the admin | follows AuditFlow (confirm → `processing`, ship → `shipped`, delivered, cancelled/expired/returned → `cancelled`). The admin can still cancel (it cancels in AuditFlow too) |
| Invoice | none | AuditFlow issues the fiscal invoice when the order ships |

Variants: a Vanda variant `id` is the AuditFlow **SKU**, so the cart's existing `variantId` is what is ordered. A product with a single plain item has no variants and is ordered by its stored `auditflow_sku`.

## Pieces
- `src/integrations/auditflow/` — client (copy of AuditFlow's `sdk/auditflow.ts`), mapper, sync, order adapter, webhook handler, config.
- `POST /api/webhooks/auditflow` — signed webhook (raw body, HMAC, replay window, de-duplicated in `auditflow_events`, exempt from the IP rate limiter).
- `npm run sync:auditflow` — full sync on demand (`--allow-empty` lets it delete everything when AuditFlow really has no products).
- `POST /api/admin/auditflow/sync`, `GET /api/admin/auditflow/status` — admin only.
- `add-auditflow-columns.sql` — new columns and table (idempotent). **Run it before enabling the integration.**
- `dev/local-stack/` — throwaway Postgres + PostgREST replica of the Supabase stack for local end-to-end runs (dev secrets, never for real use).

## Cut-over plan (production)
1. Provision the AuditFlow instance (`ops/provision.ts vanda` in auditflow-app) and check `ops/fleet.ts status`.
2. Back up Vanda's database (the `ecommerce_ecom-db-data` volume is **not** in the VPS backup script yet: add it first, and test a restore).
3. Run `add-auditflow-columns.sql` on Vanda's database.
4. Enter the catalogue and opening stock in AuditFlow (there is no import tool yet), publish the products on the `web` channel.
5. In AuditFlow: create a **secret** key (catalog:read, stock:read, orders:read, orders:write) and a webhook to `https://<vanda backend>/api/webhooks/auditflow`; note both secrets in Notion.
6. Put the three `AUDITFLOW_*` variables in `ecommerce-deploy/backend.env`, redeploy the backend, run `npm run sync:auditflow` once, compare the shop with AuditFlow.
7. Place a test order end to end (COD), confirm and ship it in AuditFlow, watch the status follow.

**Rollback:** remove `AUDITFLOW_URL` / `AUDITFLOW_API_KEY` and redeploy. Vanda goes back to its own stock logic and product admin; products keep their last synced values; orders already placed stay in both systems.

## Things to know
- `orders.total` has 2 decimals, AuditFlow works in 3 (dinars): the exact amount charged is stored in `orders.auditflow_total`; `total` is the rounded value.
- AuditFlow adds the 1.000 TND **timbre fiscal** to a consumer invoice. Vanda's checkout does not show it, so the customer pays 1 TND more than the cart total unless the frontend is changed to include it (decision pending).
- The delivery fee is converted from TTC to HT before sending so AuditFlow's total matches (`AUDITFLOW_SHIPPING_FEE_INCLUDES_VAT`).
- The repo's `supabase-schema.sql` declares only `products.category_id` while the controllers read/write a text `category` column; the sync writes both (`category_id` when a `categories` row can be made).
- Products created by hand in Vanda (no `auditflow_id`) are never touched by the sync, but cannot be ordered while the integration is on.

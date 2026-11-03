import { supabaseAdmin } from '../../config/supabase';
import { productUnchanged, type VandaOrderStatus, type VandaProductRow } from './mapper';
import type { ManagedProduct, NewOrderRow, ProductSkus, VandaStore } from './store';

const COLS = 'id, auditflow_id, auditflow_sku, title, slug, description, price, compare_at_price, images, variants, attributes, category, stock';

export class SupabaseStore implements VandaStore {
  private categoryIds = new Map<string, string | null>();

  async listManaged(): Promise<ManagedProduct[]> {
    const { data, error } = await supabaseAdmin.from('products').select(COLS).not('auditflow_id', 'is', null);
    if (error) throw error;
    return (data ?? []) as ManagedProduct[];
  }

  /** categories.name -> id, creating it on first use. Null when the categories table is not there. */
  private async categoryId(name: string | null): Promise<string | null> {
    if (!name) return null;
    if (this.categoryIds.has(name)) return this.categoryIds.get(name)!;
    let id: string | null = null;
    try {
      const found = await supabaseAdmin.from('categories').select('id').eq('name', name).maybeSingle();
      if (found.error) throw found.error;
      if (found.data) id = found.data.id;
      else {
        const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'categorie';
        // Older schemas have no slug column on categories: retry with the name only.
        let made = await supabaseAdmin.from('categories').insert({ name, slug }).select('id').single();
        if (made.error) made = await supabaseAdmin.from('categories').insert({ name }).select('id').single();
        if (made.error) throw made.error;
        id = made.data.id;
      }
    } catch {
      id = null; // legacy schema without categories: the text column is enough
    }
    this.categoryIds.set(name, id);
    return id;
  }

  async upsertProduct(row: VandaProductRow, existing: ManagedProduct | undefined) {
    if (existing) {
      const unchanged = productUnchanged(existing, row);
      if (unchanged) return 'unchanged' as const;
      const { error } = await supabaseAdmin.from('products').update(await this.withCategory(row)).eq('id', existing.id);
      if (error) throw error;
      return 'updated' as const;
    }
    const payload = await this.withCategory(row);
    let { error } = await supabaseAdmin.from('products').insert(payload);
    if (error?.code === '23505' && /slug/.test(error.message + (error.details ?? ''))) {
      // A hand-made Vanda product already uses this slug: keep both.
      ({ error } = await supabaseAdmin.from('products').insert({ ...payload, slug: `${row.slug}-af` }));
    }
    if (error) throw error;
    return 'created' as const;
  }

  private async withCategory(row: VandaProductRow) {
    const category_id = await this.categoryId(row.category);
    return { ...row, ...(category_id ? { category_id } : {}), updated_at: new Date().toISOString() };
  }

  async deleteManaged(auditflowIds: string[]): Promise<number> {
    if (auditflowIds.length === 0) return 0;
    const { data, error } = await supabaseAdmin.from('products').delete().in('auditflow_id', auditflowIds).select('id');
    if (error) throw error;
    return data?.length ?? 0;
  }

  async deleteManagedBySlug(slug: string): Promise<number> {
    const { data, error } = await supabaseAdmin.from('products').delete().eq('slug', slug).not('auditflow_id', 'is', null).select('id');
    if (error) throw error;
    return data?.length ?? 0;
  }

  async skusFor(productIds: string[]): Promise<Map<string, ProductSkus>> {
    const out = new Map<string, ProductSkus>();
    if (productIds.length === 0) return out;
    const { data, error } = await supabaseAdmin.from('products').select('id, auditflow_id, auditflow_sku, variants').in('id', productIds);
    if (error) throw error;
    for (const p of data ?? []) {
      if (!p.auditflow_id) continue;
      out.set(p.id, { auditflowSku: p.auditflow_sku ?? null, variantSkus: ((p.variants ?? []) as { sku?: string }[]).map((v) => v.sku).filter((s): s is string => !!s) });
    }
    return out;
  }

  async insertOrder(row: NewOrderRow) {
    const { data, error } = await supabaseAdmin.from('orders').insert({ ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single();
    if (error) throw error;
    return data as Record<string, unknown>;
  }

  async getOrder(id: string) {
    const { data, error } = await supabaseAdmin.from('orders').select('id, auditflow_order_id, status').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async setOrderStatusByAuditflowId(auditflowOrderId: string, status: VandaOrderStatus, auditflowStatus: string) {
    const { data, error } = await supabaseAdmin.from('orders').update({ status, auditflow_status: auditflowStatus, updated_at: new Date().toISOString() }).eq('auditflow_order_id', auditflowOrderId).select('id');
    if (error) throw error;
    return data?.length ?? 0;
  }

  async recordEvent(id: string, type: string) {
    const { error } = await supabaseAdmin.from('auditflow_events').insert({ id, type });
    if (!error) return true;
    if (error.code === '23505') return false;
    throw error;
  }

  async forgetEvent(id: string) {
    await supabaseAdmin.from('auditflow_events').delete().eq('id', id);
  }
}

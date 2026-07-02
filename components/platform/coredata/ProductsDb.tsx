'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { useToast, RowActionsMenu } from '@/components/platform/orderflow/ui';
import { logActivity } from '@/lib/platform/orderflow-activity';
import { zar2 } from '@/lib/platform/orderflow';
import { PRODUCT_UNIT_TYPES, type CdProduct, type ProductKind } from '@/lib/platform/coredata';
import type { CoreData } from '@/lib/platform/coredata-data';
import type { CsvField } from '@/lib/platform/csv';
import { downloadCsv } from '@/lib/platform/csv';
import {
  Field,
  Modal,
  PrimaryBtn,
  SecondaryBtn,
  ConfirmDialog,
  EmptyState,
  SearchInput,
  Pill,
  inputClass,
} from './ui';
import { CsvImportModal } from './CsvImportModal';

interface Draft {
  name: string;
  sku: string;
  category: string;
  subcategory: string;
  unit: string;
  kind: ProductKind;
  avg_unit_price: string;
  vat_rate: string;
  notes: string;
}

const EMPTY: Draft = {
  name: '',
  sku: '',
  category: '',
  subcategory: '',
  unit: 'each',
  kind: 'product',
  avg_unit_price: '',
  vat_rate: '',
  notes: '',
};

const CSV_FIELDS: CsvField[] = [
  { key: 'name', label: 'Name', required: true, aliases: ['product', 'item', 'description', 'product name', 'item name'] },
  { key: 'sku', label: 'SKU', aliases: ['code', 'product code', 'item code'] },
  { key: 'category', label: 'Category', aliases: ['group', 'type'] },
  { key: 'subcategory', label: 'Sub-category', aliases: ['sub category', 'subgroup'] },
  { key: 'unit', label: 'Unit', aliases: ['uom', 'unit of measure', 'measure'] },
  { key: 'price', label: 'Default price', type: 'number', aliases: ['unit price', 'rate', 'sales price', 'price', 'amount', 'avg price'] },
  { key: 'kind', label: 'Kind', aliases: ['product or service', 'type of item'] },
];

function unitList(products: CdProduct[]): string[] {
  const set = new Set<string>(PRODUCT_UNIT_TYPES as readonly string[]);
  for (const p of products) if (p.unit) set.add(p.unit);
  return Array.from(set);
}

export function ProductsDb({ data }: { data: CoreData }) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CdProduct | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const products = data.products;
  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter((c): c is string => !!c))).sort(),
    [products],
  );
  const units = useMemo(() => unitList(products), [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const active = p.active !== false;
      if (activeFilter === 'active' && !active) return false;
      if (activeFilter === 'archived' && active) return false;
      if (categoryFilter !== 'all' && (p.category ?? '') !== categoryFilter) return false;
      if (kindFilter !== 'all' && (p.kind ?? 'product') !== kindFilter) return false;
      if (q && !`${p.name} ${p.sku ?? ''} ${p.category ?? ''} ${p.subcategory ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, categoryFilter, kindFilter, activeFilter]);

  function startNew() {
    setDraft(EMPTY);
    setError(null);
    setEditing('new');
  }
  function startEdit(p: CdProduct) {
    setDraft({
      name: p.name ?? '',
      sku: p.sku ?? '',
      category: p.category ?? '',
      subcategory: p.subcategory ?? '',
      unit: p.unit ?? 'each',
      kind: (p.kind as ProductKind) ?? 'product',
      avg_unit_price: p.avg_unit_price != null ? String(p.avg_unit_price) : '',
      vat_rate: p.vat_rate != null ? String(p.vat_rate) : '',
      notes: p.notes ?? '',
    });
    setError(null);
    setEditing(p.id);
  }

  async function save() {
    if (!draft.name.trim()) {
      setError('Name is required.');
      return;
    }
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const priceNum = draft.avg_unit_price.trim() === '' ? null : Number(draft.avg_unit_price.replace(/[R\s,]/g, ''));
    const vatNum = draft.vat_rate.trim() === '' ? null : Number(draft.vat_rate.replace(/[%\s]/g, ''));
    const payload = {
      name: draft.name.trim(),
      sku: draft.sku.trim() || null,
      category: draft.category.trim() || null,
      subcategory: draft.subcategory.trim() || null,
      unit: draft.unit.trim() || 'each',
      kind: draft.kind,
      avg_unit_price: priceNum != null && Number.isFinite(priceNum) ? priceNum : null,
      vat_rate: vatNum != null && Number.isFinite(vatNum) ? vatNum : null,
      notes: draft.notes.trim() || null,
    };
    if (editing === 'new') {
      const { data: inserted, error: err } = await supabase
        .from('pp_stock_items')
        .insert({ org_id: org.id, active: true, ...payload })
        .select('id')
        .single();
      setBusy(false);
      if (err) {
        setError(err.message.includes('column') ? 'Run supabase/core-data.sql to enable products.' : err.message);
        return;
      }
      logActivity(supabase, { orgId: org.id, actorEmail: email, entityType: 'product', entityId: inserted?.id ?? null, event: 'product_created', description: payload.name });
      setEditing(null);
      toast('Product added');
      router.refresh();
    } else if (editing) {
      const { error: err } = await supabase.from('pp_stock_items').update(payload).eq('id', editing);
      setBusy(false);
      if (err) {
        setError(err.message);
        return;
      }
      logActivity(supabase, { orgId: org.id, actorEmail: email, entityType: 'product', entityId: editing, event: 'product_updated', description: payload.name });
      setEditing(null);
      toast('Product updated');
      router.refresh();
    }
  }

  async function archive(p: CdProduct) {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    const next = !(p.active !== false); // toggle: archived → restore, active → archive
    const { error: err } = await supabase.from('pp_stock_items').update({ active: next }).eq('id', p.id);
    if (err) {
      toast(err.message);
      return;
    }
    logActivity(supabase, { orgId: org.id, actorEmail: email, entityType: 'product', entityId: p.id, event: 'product_updated', description: `${next ? 'Restored' : 'Archived'} ${p.name}` });
    setArchiveTarget(null);
    toast(next ? 'Product restored' : 'Product archived');
    router.refresh();
  }

  async function importRows(records: Record<string, string | number | boolean | null>[]): Promise<{ inserted: number; error?: string }> {
    const supabase = createClient();
    if (!supabase || !org) return { inserted: 0, error: 'Not connected.' };
    const rows = records
      .filter((r) => String(r.name ?? '').trim() !== '')
      .map((r) => {
        const kindRaw = String(r.kind ?? '').trim().toLowerCase();
        return {
          org_id: org.id,
          name: String(r.name).trim(),
          sku: r.sku ? String(r.sku).trim() : null,
          category: r.category ? String(r.category).trim() : null,
          subcategory: r.subcategory ? String(r.subcategory).trim() : null,
          unit: r.unit ? String(r.unit).trim() : 'each',
          avg_unit_price: typeof r.price === 'number' && Number.isFinite(r.price) ? r.price : null,
          kind: kindRaw === 'service' ? 'service' : 'product',
          active: true,
        };
      });
    if (rows.length === 0) return { inserted: 0, error: 'No valid rows (name is required).' };
    const { error: err } = await supabase.from('pp_stock_items').insert(rows);
    if (err) return { inserted: 0, error: err.message };
    logActivity(supabase, { orgId: org.id, actorEmail: email, entityType: 'product', event: 'product_created', description: `Imported ${rows.length} products` });
    router.refresh();
    return { inserted: rows.length };
  }

  function exportCsv() {
    const headers = ['Name', 'SKU', 'Category', 'Sub-category', 'Unit', 'Default price', 'VAT rate', 'Kind', 'Active'];
    const rows = filtered.map((p) => [
      p.name,
      p.sku ?? '',
      p.category ?? '',
      p.subcategory ?? '',
      p.unit ?? '',
      p.avg_unit_price != null ? p.avg_unit_price : '',
      p.vat_rate != null ? p.vat_rate : '',
      p.kind ?? 'product',
      p.active !== false ? 'Yes' : 'No',
    ]);
    downloadCsv('products.csv', headers, rows);
  }

  const hasAny = products.length > 0;

  return (
    <div className="space-y-4">
      {toastNode}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search products…" />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
          <option value="all">All kinds</option>
          <option value="product">Products</option>
          <option value="service">Services</option>
        </select>
        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)} className={`${inputClass} sm:w-auto`}>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SecondaryBtn onClick={() => setImportOpen(true)}>Import CSV</SecondaryBtn>
          <SecondaryBtn onClick={exportCsv} disabled={filtered.length === 0}>Export CSV</SecondaryBtn>
          <PrimaryBtn onClick={startNew}>Add product</PrimaryBtn>
        </div>
      </div>

      {!hasAny ? (
        <EmptyState
          title="No products or services yet"
          body="Everything you sell — with units, categories, SKUs and default prices. Add your first, or import a CSV from QuickBooks or Excel."
          action={<PrimaryBtn onClick={startNew}>Add product</PrimaryBtn>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" body="No products match your search and filters." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#E7E7E2] bg-white">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E7E7E2] text-left text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">SKU</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Unit</th>
                <th className="px-4 py-3 text-right font-semibold">Default price</th>
                <th className="px-4 py-3 font-semibold">VAT</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const active = p.active !== false;
                return (
                  <tr key={p.id} className="border-b border-[#F0F0EC] last:border-0 hover:bg-[#FBFBF9]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1A1C1E]">{p.name}</div>
                      {p.kind === 'service' ? <div className="text-[11px] text-[#9A9DA1]">Service</div> : null}
                    </td>
                    <td className="px-4 py-3 text-[#5F6368]">{p.sku || '—'}</td>
                    <td className="px-4 py-3 text-[#5F6368]">
                      {p.category || '—'}
                      {p.subcategory ? <span className="text-[#9A9DA1]"> · {p.subcategory}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-[#5F6368]">{p.unit || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#1A1C1E]">{p.avg_unit_price != null ? zar2(p.avg_unit_price) : '—'}</td>
                    <td className="px-4 py-3 text-[#5F6368]">{p.vat_rate != null ? `${p.vat_rate}%` : 'Default'}</td>
                    <td className="px-4 py-3">
                      {active ? <Pill label="Active" bg="#E1F5EE" fg="#0F6E56" /> : <Pill label="Archived" bg="#F0F0EC" fg="#5F6368" />}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActionsMenu
                        actions={[
                          { label: 'Edit', onClick: () => startEdit(p) },
                          { label: active ? 'Archive' : 'Restore', onClick: () => (active ? setArchiveTarget(p) : archive(p)), danger: active },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add product' : 'Edit product'}
        subtitle="Saved to your Products & services catalogue (pp_stock_items)."
        width={560}
        footer={
          <>
            <SecondaryBtn onClick={() => setEditing(null)} disabled={busy}>Cancel</SecondaryBtn>
            <PrimaryBtn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</PrimaryBtn>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Tomatoes — Roma" className={inputClass} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="SKU" hint="(optional)">
              <input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} placeholder="TOM-ROM" className={inputClass} />
            </Field>
            <Field label="Kind">
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ProductKind })} className={inputClass}>
                <option value="product">Product</option>
                <option value="service">Service</option>
              </select>
            </Field>
            <Field label="Category" hint="(optional)">
              <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Vegetables" className={inputClass} list="cd-product-categories" />
              <datalist id="cd-product-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Sub-category" hint="(optional)">
              <input value={draft.subcategory} onChange={(e) => setDraft({ ...draft, subcategory: e.target.value })} placeholder="Salad" className={inputClass} />
            </Field>
            <Field label="Unit">
              <input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="kg" className={inputClass} list="cd-product-units" />
              <datalist id="cd-product-units">
                {units.map((u) => <option key={u} value={u} />)}
              </datalist>
            </Field>
            <Field label="Default price" hint="(ex VAT)">
              <input value={draft.avg_unit_price} onChange={(e) => setDraft({ ...draft, avg_unit_price: e.target.value })} placeholder="0.00" inputMode="decimal" className={inputClass} />
            </Field>
            <Field label="VAT rate %" hint="(optional — blank = org default)">
              <input value={draft.vat_rate} onChange={(e) => setDraft({ ...draft, vat_rate: e.target.value })} placeholder="15" inputMode="decimal" className={inputClass} />
            </Field>
          </div>
          <Field label="Notes" hint="(optional)">
            <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Internal notes" className={`${inputClass} h-16 py-2`} />
          </Field>
          {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive product?"
        body={archiveTarget ? `"${archiveTarget.name}" will be hidden from pickers but kept on past documents. You can restore it later.` : undefined}
        confirmLabel="Archive"
        danger
        onConfirm={() => archiveTarget && archive(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
      />

      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import products"
        fields={CSV_FIELDS}
        existingValues={{ fieldKey: 'name', values: products.map((p) => p.name) }}
        onImport={importRows}
      />
    </div>
  );
}

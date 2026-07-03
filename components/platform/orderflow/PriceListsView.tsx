'use client';

/**
 * OrderFlow Price lists manager — the full editor for customer pricing.
 *
 * Left: the lists table (name, customer or "All customers", default margin,
 * validity window, status pill, overrides count) with create/edit and duplicate
 * actions. Selecting a list opens the editor Drawer (~760px): one row per
 * override showing the product, base cost, margin %, custom price and the
 * computed sell price. Base cost resolves to the latest MARKET-STATEMENT price
 * (from Doc-U statement docs) if known, else the product's catalogue price; when
 * neither exists the cost is editable inline and flagged for review. Sell price
 * is derived from that base (custom price wins outright; clear it to fall back to
 * margin). Add products one-by-one via catalogue search, or one-click "Fill from
 * catalogue" to add every product; remove overrides, bulk-update all margins /
 * bump all custom prices, and import/export CSV.
 *
 * Every write is org-scoped, writes to Core Data (pl_price_lists / pl_overrides
 * — never a module-private copy), logs a price_list_updated activity event, then
 * toasts + refreshes. Migration-safe: if core-data.sql hasn't been run yet the
 * custom_price / validity columns are missing and writes surface a quiet inline
 * note instead of crashing.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { logActivity } from '@/lib/platform/orderflow-activity';
import {
  priceListStatus,
  PRICE_LIST_STATUS_STYLE,
  type CdPriceList,
  type CdPriceOverride,
  type CdProduct,
} from '@/lib/platform/coredata';
import { zar2 } from '@/lib/platform/pricepilot';
import type { PriceCadence } from '@/lib/platform/pricepilot';
import type { OfCustomer } from '@/lib/platform/orderflow';
import { downloadCsv, type CsvField } from '@/lib/platform/csv';
import { Kpi, RowActionsMenu, Drawer, useToast } from './ui';
import {
  Field,
  Modal,
  PrimaryBtn,
  SecondaryBtn,
  DangerBtn,
  EmptyState,
  SearchInput,
  Pill,
  inputClass,
} from '@/components/platform/coredata/ui';
import { CsvImportModal } from '@/components/platform/coredata/CsvImportModal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The latest market-statement price for a product, from Doc-U statement docs. */
export interface StatementPrice {
  price: number;
  date: string | null;
  source: string | null;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The base cost a price list should use for a product: the latest market
 *  statement price if known, else the product's catalogue price, else null. */
function baseCostFor(
  product: { id: string; avg_unit_price: number | null } | null | undefined,
  statementPrices: Record<string, StatementPrice>,
): { cost: number | null; source: 'statement' | 'catalogue' | 'none'; label: string | null } {
  if (!product) return { cost: null, source: 'none', label: null };
  const sp = statementPrices[product.id];
  if (sp && sp.price > 0) return { cost: sp.price, source: 'statement', label: sp.date ? `Statement · ${sp.date}` : 'Statement' };
  const avg = Number(product.avg_unit_price);
  if (Number.isFinite(avg) && avg > 0) return { cost: avg, source: 'catalogue', label: 'Catalogue' };
  return { cost: null, source: 'none', label: null };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

const MISSING_COLUMN_RE = /column|schema cache|could not find|does not exist/i;

/** The column PostgREST reports missing, e.g. PGRST204
 *  "Could not find the 'notes' column of 'pl_price_lists' in the schema cache". */
function missingColumnName(msg: string): string | null {
  const m = /'([^']+)' column/i.exec(msg) ?? /column "?([a-zA-Z0-9_]+)"?/.exec(msg);
  return m ? m[1] : null;
}

/** A migration-not-run error → a clear, actionable note; anything else → the raw message. */
function migrationMessage(msg: string): string {
  return MISSING_COLUMN_RE.test(msg) || /relation/i.test(msg)
    ? 'This needs the Core Data migration — run supabase/core-data.sql in your Supabase SQL editor.'
    : msg;
}

// Friendly names for the optional Core Data columns that only exist once
// core-data.sql has been run (used to tell the user what didn't persist).
const COL_LABEL: Record<string, string> = {
  notes: 'notes',
  valid_from: 'validity dates',
  valid_until: 'validity dates',
  custom_price: 'custom prices',
};

/** A "saved, but X wasn't persisted" note when we had to drop columns, else null. */
function droppedNote(dropped: string[]): string | null {
  if (dropped.length === 0) return null;
  const labels = [...new Set(dropped.map((c) => COL_LABEL[c] ?? c))];
  return `Saved — ${labels.join(' & ')} need the core-data.sql migration`;
}

/**
 * Write a single row, transparently dropping any columns the database doesn't
 * have yet (a not-yet-run / partial core-data.sql migration). `build` must
 * construct a fresh query from the working row on every call. Returns the
 * response plus which columns were dropped, so callers can tell the user what
 * didn't persist. Base columns always exist, so they're never reported missing —
 * only the optional Core Data extras (notes, valid_from/until, custom_price)
 * can ever be dropped, and the row is still created with everything else.
 */
async function writeDroppingMissing<T = any>(
  build: (row: Record<string, any>) => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  row: Record<string, any>,
): Promise<{ data: T | null; error: { message: string } | null; dropped: string[] }> {
  const working: Record<string, any> = { ...row };
  const dropped: string[] = [];
  for (let i = 0; i < 8; i++) {
    const res = await build(working);
    if (!res.error) return { data: res.data ?? null, error: null, dropped };
    const col = missingColumnName(res.error.message);
    if (!col || !(col in working)) return { data: (res.data as T | null) ?? null, error: res.error, dropped };
    delete working[col];
    dropped.push(col);
  }
  return { data: null, error: { message: 'Too many missing columns — run supabase/core-data.sql.' }, dropped };
}

/** Array variant of writeDroppingMissing — drops a missing column from every row. */
async function writeArrayDroppingMissing(
  build: (rows: Record<string, any>[]) => PromiseLike<{ error: { message: string } | null }>,
  rows: Record<string, any>[],
): Promise<{ error: { message: string } | null; dropped: string[] }> {
  let working = rows.map((r) => ({ ...r }));
  const dropped: string[] = [];
  for (let i = 0; i < 8; i++) {
    const res = await build(working);
    if (!res.error) return { error: null, dropped };
    const col = missingColumnName(res.error.message);
    if (!col || !working.some((r) => col in r)) return { error: res.error, dropped };
    working = working.map((r) => {
      const c = { ...r };
      delete c[col];
      return c;
    });
    dropped.push(col);
  }
  return { error: { message: 'Too many missing columns — run supabase/core-data.sql.' }, dropped };
}

const CADENCES: { value: PriceCadence; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const filterSel =
  'h-9 rounded-lg border border-[#D7DAD8] bg-white px-2.5 text-[13px] text-[#5F6368] outline-none focus:border-[#1E5E54]';

interface ListDraft {
  name: string;
  customer_id: string;
  default_margin_pct: string;
  valid_from: string;
  valid_until: string;
  cadence: PriceCadence;
  notes: string;
}

const EMPTY_LIST: ListDraft = {
  name: '',
  customer_id: '',
  default_margin_pct: '',
  valid_from: '',
  valid_until: '',
  cadence: 'standard',
  notes: '',
};

type ImportRecord = Record<string, string | number | boolean | null>;

// CSV import fields — product matched by name against the catalogue.
const CSV_FIELDS: CsvField[] = [
  { key: 'product', label: 'Product', required: true, aliases: ['name', 'item', 'description', 'stock item'] },
  { key: 'margin_pct', label: 'Margin %', type: 'number', aliases: ['margin', 'markup', 'markup %'] },
  { key: 'custom_price', label: 'Custom price', type: 'number', aliases: ['price', 'sell price', 'selling price', 'unit price'] },
];

export function PriceListsView({
  priceLists,
  overrides,
  products,
  customers,
  latestStatementPrices = {},
}: {
  priceLists: CdPriceList[];
  overrides: CdPriceOverride[];
  products: CdProduct[];
  customers: OfCustomer[];
  latestStatementPrices?: Record<string, StatementPrice>;
}) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // List create/edit modal.
  const [editingList, setEditingList] = useState<string | 'new' | null>(null);
  const [listDraft, setListDraft] = useState<ListDraft>(EMPTY_LIST);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Editor drawer — which list is open.
  const [openListId, setOpenListId] = useState<string | null>(null);

  const customerName = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const overrideCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of overrides) m.set(o.price_list_id, (m.get(o.price_list_id) ?? 0) + 1);
    return m;
  }, [overrides]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return priceLists.filter((l) => {
      if (statusFilter !== 'all' && priceListStatus(l) !== statusFilter) return false;
      const cName = l.customer_id ? customerName.get(l.customer_id) ?? '' : 'all customers';
      if (q && !`${l.name} ${cName} ${l.notes ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [priceLists, search, statusFilter, customerName]);

  const kpis = useMemo(() => {
    const total = priceLists.length;
    const active = priceLists.filter((l) => priceListStatus(l) === 'active').length;
    const customerSpecific = priceLists.filter((l) => l.customer_id).length;
    const totalOverrides = overrides.length;
    return { total, active, customerSpecific, totalOverrides };
  }, [priceLists, overrides]);

  const openList = useMemo(() => priceLists.find((l) => l.id === openListId) ?? null, [priceLists, openListId]);

  // ---------------------------------------------------------------------------
  // List CRUD
  // ---------------------------------------------------------------------------

  function startNew() {
    setListDraft(EMPTY_LIST);
    setListError(null);
    setEditingList('new');
  }

  function startEdit(l: CdPriceList) {
    setListDraft({
      name: l.name ?? '',
      customer_id: l.customer_id ?? '',
      default_margin_pct: l.default_margin_pct != null ? String(l.default_margin_pct) : '',
      valid_from: l.valid_from ?? '',
      valid_until: l.valid_until ?? '',
      cadence: (l.cadence as PriceCadence) ?? 'standard',
      notes: l.notes ?? '',
    });
    setListError(null);
    setEditingList(l.id);
  }

  async function saveList() {
    if (!listDraft.name.trim()) {
      setListError('Name is required.');
      return;
    }
    const supabase = createClient();
    if (!supabase || !org) {
      setListError('Not connected.');
      return;
    }
    setListBusy(true);
    setListError(null);
    const marginNum = listDraft.default_margin_pct.trim() === '' ? 0 : Number(listDraft.default_margin_pct.replace(/[%\s]/g, ''));
    const payload = {
      name: listDraft.name.trim(),
      customer_id: listDraft.customer_id || null,
      default_margin_pct: Number.isFinite(marginNum) ? marginNum : 0,
      valid_from: listDraft.valid_from || null,
      valid_until: listDraft.valid_until || null,
      cadence: listDraft.cadence,
      notes: listDraft.notes.trim() || null,
    };
    if (editingList === 'new') {
      const { data: inserted, error: err, dropped } = await writeDroppingMissing<{ id: string }>(
        (row) => supabase.from('pl_price_lists').insert({ org_id: org.id, ...row }).select('id').single(),
        payload,
      );
      setListBusy(false);
      if (err || !inserted) {
        setListError(migrationMessage(err?.message ?? 'Could not create the price list.'));
        return;
      }
      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'price_list',
        entityId: inserted.id,
        customerId: payload.customer_id,
        event: 'price_list_updated',
        description: `Created ${payload.name}`,
      });
      setEditingList(null);
      toast(droppedNote(dropped) ?? 'Price list created');
      router.refresh();
      setOpenListId(inserted.id);
    } else if (editingList) {
      const listId = editingList;
      const { error: err, dropped } = await writeDroppingMissing(
        (row) => supabase.from('pl_price_lists').update(row).eq('id', listId).eq('org_id', org.id),
        payload,
      );
      setListBusy(false);
      if (err) {
        setListError(migrationMessage(err.message));
        return;
      }
      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'price_list',
        entityId: listId,
        customerId: payload.customer_id,
        event: 'price_list_updated',
        description: `Updated ${payload.name}`,
      });
      setEditingList(null);
      toast(droppedNote(dropped) ?? 'Price list updated');
      router.refresh();
    }
  }

  // Duplicate: copy the list + all its overrides into a new "(copy)" list.
  async function duplicateList(l: CdPriceList) {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    const { data: inserted, error: err } = await writeDroppingMissing<{ id: string }>(
      (row) => supabase.from('pl_price_lists').insert({ org_id: org.id, ...row }).select('id').single(),
      {
        name: `${l.name} (copy)`,
        customer_id: l.customer_id ?? null,
        default_margin_pct: l.default_margin_pct ?? 0,
        valid_from: l.valid_from ?? null,
        valid_until: l.valid_until ?? null,
        cadence: l.cadence ?? 'standard',
        notes: l.notes ?? null,
      },
    );
    if (err || !inserted) {
      toast(migrationMessage(err?.message ?? 'Could not duplicate the price list.'));
      return;
    }
    const rows = overrides
      .filter((o) => o.price_list_id === l.id)
      .map((o) => ({
        org_id: org.id,
        price_list_id: inserted.id,
        stock_item_id: o.stock_item_id,
        margin_pct: Number(o.margin_pct) || 0,
        custom_price: o.custom_price ?? null,
      }));
    if (rows.length > 0) {
      const { error: ovErr } = await writeArrayDroppingMissing((w) => supabase.from('pl_overrides').insert(w), rows);
      if (ovErr) {
        toast(migrationMessage(ovErr.message));
        // The list itself copied — refresh so it appears; overrides just didn't.
        router.refresh();
        return;
      }
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'price_list',
      entityId: inserted.id,
      customerId: l.customer_id ?? null,
      event: 'price_list_updated',
      description: `Duplicated ${l.name}`,
    });
    toast('Price list duplicated');
    router.refresh();
    setOpenListId(inserted.id);
  }

  const hasAny = priceLists.length > 0;

  return (
    <div>
      {toastNode}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#1A1C1E]">Price lists</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">
            Customer pricing with margins and custom prices — the source quotes, orders and invoices price from
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/docu/databases/price-lists"
            className="inline-flex h-10 items-center rounded-xl border border-[#D7DAD8] bg-white px-4 text-[14px] font-medium text-[#5F6368] transition-colors hover:bg-[#F0F0EC]"
          >
            Governance view
          </Link>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex h-10 items-center rounded-xl bg-[#1E5E54] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#184D45]"
          >
            + New price list
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Price lists" value={String(kpis.total)} />
        <Kpi label="Active" value={String(kpis.active)} accent={kpis.active > 0 ? '#0F6E56' : undefined} />
        <Kpi label="Customer-specific" value={String(kpis.customerSpecific)} />
        <Kpi label="Item overrides" value={String(kpis.totalOverrides)} />
      </div>

      {/* Search + filter */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search price lists…" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterSel}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="scheduled">Scheduled</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-2 py-2.5 text-left font-medium">Customer</th>
                <th className="px-2 py-2.5 text-right font-medium">Default margin</th>
                <th className="px-2 py-2.5 text-left font-medium">Validity</th>
                <th className="px-2 py-2.5 text-left font-medium">Status</th>
                <th className="px-2 py-2.5 text-right font-medium">Items priced</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {!hasAny ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <div className="px-4 py-8">
                      <EmptyState
                        title="No price lists yet"
                        body="Create customer-specific pricing with margins and custom prices, then quotes, orders and invoices will price from it. Custom prices need supabase/core-data.sql to be run."
                        action={<PrimaryBtn onClick={startNew}>+ New price list</PrimaryBtn>}
                      />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[14px] text-[#9A9DA1]">
                    No price lists match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => {
                  const st = priceListStatus(l);
                  const style = PRICE_LIST_STATUS_STYLE[st];
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setOpenListId(l.id)}
                      className="cursor-pointer border-b border-[#F6F6F2] last:border-0 hover:bg-[#FAFAF8]"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#1A1C1E]">{l.name}</div>
                        {l.notes ? <div className="max-w-[260px] truncate text-[11px] text-[#9A9DA1]">{l.notes}</div> : null}
                      </td>
                      <td className="px-2 py-3 text-[#5F6368]">
                        {l.customer_id ? customerName.get(l.customer_id) ?? 'Unknown' : 'All customers'}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums text-[#1A1C1E]">
                        {l.default_margin_pct != null ? `${l.default_margin_pct}%` : '—'}
                      </td>
                      <td className="px-2 py-3 text-[#5F6368]">
                        {l.valid_from || l.valid_until ? `${fmtDate(l.valid_from)} → ${fmtDate(l.valid_until)}` : 'Always'}
                      </td>
                      <td className="px-2 py-3">
                        <Pill label={style.label} bg={style.bg} fg={style.fg} />
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums text-[#5F6368]">{overrideCount.get(l.id) ?? 0}</td>
                      <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu
                          actions={[
                            { label: 'Open editor', onClick: () => setOpenListId(l.id) },
                            { label: 'Edit settings', onClick: () => startEdit(l) },
                            { label: 'Duplicate list', onClick: () => void duplicateList(l) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* List create/edit modal */}
      <Modal
        open={editingList !== null}
        onClose={() => setEditingList(null)}
        title={editingList === 'new' ? 'New price list' : 'Edit price list'}
        subtitle="List-level settings. Per-item margins and custom prices are set in the editor."
        width={540}
        footer={
          <>
            <SecondaryBtn onClick={() => setEditingList(null)} disabled={listBusy}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn onClick={saveList} disabled={listBusy}>
              {listBusy ? 'Saving…' : 'Save'}
            </PrimaryBtn>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name">
            <input
              value={listDraft.name}
              onChange={(e) => setListDraft({ ...listDraft, name: e.target.value })}
              placeholder="e.g. Wholesale — Q3"
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Customer" hint="(blank = all customers)">
              <select
                value={listDraft.customer_id}
                onChange={(e) => setListDraft({ ...listDraft, customer_id: e.target.value })}
                className={inputClass}
              >
                <option value="">All customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Default margin %">
              <input
                value={listDraft.default_margin_pct}
                onChange={(e) => setListDraft({ ...listDraft, default_margin_pct: e.target.value })}
                placeholder="25"
                inputMode="decimal"
                className={inputClass}
              />
            </Field>
            <Field label="Valid from" hint="(optional)">
              <input
                type="date"
                value={listDraft.valid_from}
                onChange={(e) => setListDraft({ ...listDraft, valid_from: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Valid until" hint="(optional)">
              <input
                type="date"
                value={listDraft.valid_until}
                onChange={(e) => setListDraft({ ...listDraft, valid_until: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Cadence">
              <select
                value={listDraft.cadence}
                onChange={(e) => setListDraft({ ...listDraft, cadence: e.target.value as PriceCadence })}
                className={inputClass}
              >
                {CADENCES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Notes" hint="(optional)">
            <textarea
              value={listDraft.notes}
              onChange={(e) => setListDraft({ ...listDraft, notes: e.target.value })}
              placeholder="Internal notes"
              className={`${inputClass} h-16 py-2`}
            />
          </Field>
          {listError ? <p className="text-[12px] text-[#A32D2D]">{listError}</p> : null}
        </div>
      </Modal>

      {/* Per-list editor drawer */}
      {openList ? (
        <PriceListEditor
          key={openList.id}
          list={openList}
          allOverrides={overrides}
          products={products}
          latestStatementPrices={latestStatementPrices}
          customerName={openList.customer_id ? customerName.get(openList.customer_id) ?? null : null}
          onClose={() => setOpenListId(null)}
          toast={toast}
        />
      ) : null}
    </div>
  );
}

// ===========================================================================
// Per-list editor — override rows, add products, bulk update, CSV import/export
// ===========================================================================

function PriceListEditor({
  list,
  allOverrides,
  products,
  latestStatementPrices,
  customerName,
  onClose,
  toast,
}: {
  list: CdPriceList;
  allOverrides: CdPriceOverride[];
  products: CdProduct[];
  latestStatementPrices: Record<string, StatementPrice>;
  customerName: string | null;
  onClose: () => void;
  toast: (m: string) => void;
}) {
  const router = useRouter();
  const { org, email } = usePlatform();

  const rows = useMemo(
    () => allOverrides.filter((o) => o.price_list_id === list.id),
    [allOverrides, list.id],
  );

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Add-product search.
  const [addQuery, setAddQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bulk update bar.
  const [bulkMargin, setBulkMargin] = useState('');
  const [bulkIncrease, setBulkIncrease] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  // Fill from catalogue.
  const [fillBusy, setFillBusy] = useState(false);
  const [confirmFill, setConfirmFill] = useState(false);

  // "Only needs review" filter — rows whose base cost is unknown.
  const [onlyReview, setOnlyReview] = useState(false);

  // CSV import.
  const [importing, setImporting] = useState(false);

  // Delete confirmation.
  const [removeId, setRemoveId] = useState<string | null>(null);

  const style = PRICE_LIST_STATUS_STYLE[priceListStatus(list)];

  // Active catalogue products not yet on this list — the fill-from-catalogue set.
  const missingProducts = useMemo(() => {
    const onList = new Set(rows.map((r) => r.stock_item_id));
    return products.filter((p) => (p.active ?? true) !== false && !onList.has(p.id));
  }, [products, rows]);

  // Products not yet on the list, matching the search.
  const addable = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    return missingProducts
      .filter((p) => (q ? `${p.name} ${p.sku ?? ''} ${p.category ?? ''}`.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [missingProducts, addQuery]);

  function db() {
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      toast('Not connected.');
      return null;
    }
    return supabase;
  }

  function logEdit(entityId: string, description: string) {
    const supabase = createClient();
    if (!supabase || !org) return;
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'price_list',
      entityId,
      customerId: list.customer_id ?? null,
      event: 'price_list_updated',
      description,
    });
  }

  // Add a product to the list at the list's default margin.
  async function addProduct(product: CdProduct) {
    const supabase = db();
    if (!supabase || !org) return;
    setBusyId(product.id);
    setError(null);
    // custom_price only exists post-migration; drop it if missing so a product
    // can still be added at the list's margin before core-data.sql is run.
    const { error: err } = await writeDroppingMissing((row) => supabase.from('pl_overrides').insert(row), {
      org_id: org.id,
      price_list_id: list.id,
      stock_item_id: product.id,
      margin_pct: Number(list.default_margin_pct) || 0,
      custom_price: null,
    });
    setBusyId(null);
    if (err) {
      setError(migrationMessage(err.message));
      return;
    }
    logEdit(list.id, `Added ${product.name} to ${list.name}`);
    setAddQuery('');
    toast('Product added');
    router.refresh();
  }

  // Bulk-add every active catalogue product not already on the list, at the
  // list's default margin. Base cost is resolved (statement → catalogue) at
  // display time, so no cost is stored on the override itself.
  async function fillFromCatalogue() {
    setConfirmFill(false);
    const supabase = db();
    if (!supabase || !org) return;
    if (missingProducts.length === 0) {
      toast(products.length === 0 ? 'No products in the catalogue yet.' : 'Every product is already on this list.');
      return;
    }
    setFillBusy(true);
    setError(null);
    const margin = Number(list.default_margin_pct) || 0;
    const newRows = missingProducts.map((p) => ({
      org_id: org.id,
      price_list_id: list.id,
      stock_item_id: p.id,
      margin_pct: margin,
      custom_price: null,
    }));
    const { error: err } = await writeArrayDroppingMissing((w) => supabase.from('pl_overrides').insert(w), newRows);
    setFillBusy(false);
    if (err) {
      setError(migrationMessage(err.message));
      return;
    }
    logEdit(list.id, `Filled ${list.name} with ${newRows.length} products from the catalogue`);
    toast(`Added ${newRows.length} products`);
    router.refresh();
  }

  // Set a product's catalogue cost (avg_unit_price) for a row with no known
  // base cost — the amber "Review" input. Only positive values persist.
  async function setBaseCost(product: CdProduct, value: string) {
    const supabase = db();
    if (!supabase || !org) return;
    const trimmed = value.trim();
    if (trimmed === '') return;
    const n = Number(trimmed.replace(/[R\s,]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return;
    setBusyId(product.id);
    setError(null);
    const { error: err } = await supabase
      .from('pp_stock_items')
      .update({ avg_unit_price: n })
      .eq('id', product.id)
      .eq('org_id', org.id);
    setBusyId(null);
    if (err) {
      setError(migrationMessage(err.message));
      return;
    }
    logEdit(list.id, `Set cost on ${product.name} to ${zar2(n)}`);
    toast('Cost set');
    router.refresh();
  }

  // Update a row's margin (%) — leaves custom_price as-is (custom still wins if set).
  async function updateMargin(row: CdPriceOverride, value: string) {
    const supabase = db();
    if (!supabase || !org) return;
    const num = value.trim() === '' ? 0 : Number(value.replace(/[%\s]/g, ''));
    if (!Number.isFinite(num)) return;
    setBusyId(row.id);
    setError(null);
    const { error: err } = await supabase.from('pl_overrides').update({ margin_pct: num }).eq('id', row.id).eq('org_id', org.id);
    setBusyId(null);
    if (err) {
      setError(migrationMessage(err.message));
      return;
    }
    logEdit(list.id, `Set margin on ${productById.get(row.stock_item_id)?.name ?? 'item'} to ${num}%`);
    toast('Margin updated');
    router.refresh();
  }

  // Update a row's custom price — clearing it (empty), or entering 0/negative,
  // falls back to margin pricing (only custom_price > 0 counts in resolvePrice).
  async function updateCustomPrice(row: CdPriceOverride, value: string) {
    const supabase = db();
    if (!supabase || !org) return;
    const trimmed = value.trim();
    const parsed = trimmed === '' ? null : Number(trimmed.replace(/[R\s,]/g, ''));
    if (parsed != null && !Number.isFinite(parsed)) return;
    // A 0 or negative price means "no custom price" — store null so it cleanly
    // falls back to margin pricing rather than pinning the sell price to zero.
    const num = parsed != null && parsed > 0 ? parsed : null;
    setBusyId(row.id);
    setError(null);
    const { error: err } = await supabase
      .from('pl_overrides')
      .update({ custom_price: num })
      .eq('id', row.id)
      .eq('org_id', org.id);
    setBusyId(null);
    if (err) {
      setError(migrationMessage(err.message));
      return;
    }
    const name = productById.get(row.stock_item_id)?.name ?? 'item';
    logEdit(list.id, num == null ? `Cleared custom price on ${name}` : `Set custom price on ${name} to ${zar2(num)}`);
    toast(num == null ? 'Custom price cleared' : 'Custom price set');
    router.refresh();
  }

  async function removeOverride(id: string) {
    const supabase = db();
    if (!supabase || !org) return;
    const name = productById.get(rows.find((r) => r.id === id)?.stock_item_id ?? '')?.name ?? 'item';
    const { error: err } = await supabase.from('pl_overrides').delete().eq('id', id).eq('org_id', org.id);
    setRemoveId(null);
    if (err) {
      setError(migrationMessage(err.message));
      toast(migrationMessage(err.message));
      return;
    }
    logEdit(list.id, `Removed ${name} from ${list.name}`);
    toast('Product removed');
    router.refresh();
  }

  // Bulk: set the same margin on every override in this list.
  async function bulkSetMargin() {
    const supabase = db();
    if (!supabase || !org) return;
    const num = Number(bulkMargin.replace(/[%\s]/g, ''));
    if (!Number.isFinite(num) || rows.length === 0) return;
    setBulkBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from('pl_overrides')
      .update({ margin_pct: num })
      .eq('price_list_id', list.id)
      .eq('org_id', org.id);
    setBulkBusy(false);
    if (err) {
      setError(migrationMessage(err.message));
      return;
    }
    logEdit(list.id, `Set margin to ${num}% on all ${rows.length} items in ${list.name}`);
    setBulkMargin('');
    toast(`Margin set on ${rows.length} items`);
    router.refresh();
  }

  // Bulk: apply a % increase to every set custom price (rows with no custom price untouched).
  async function bulkBumpPrices() {
    const supabase = db();
    if (!supabase || !org) return;
    const pct = Number(bulkIncrease.replace(/[%\s]/g, ''));
    if (!Number.isFinite(pct)) return;
    const withCustom = rows.filter((r) => r.custom_price != null);
    if (withCustom.length === 0) {
      setError('No custom prices to bump — set custom prices first, or use the margin bulk action.');
      return;
    }
    setBulkBusy(true);
    setError(null);
    const factor = 1 + pct / 100;
    // No single-statement multiply via PostgREST, so update each custom-price row.
    const results = await Promise.all(
      withCustom.map((r) =>
        supabase
          .from('pl_overrides')
          .update({ custom_price: Math.round(Number(r.custom_price) * factor * 100) / 100 })
          .eq('id', r.id)
          .eq('org_id', org.id),
      ),
    );
    setBulkBusy(false);
    const firstErr = results.find((res) => res.error)?.error;
    if (firstErr) {
      setError(migrationMessage(firstErr.message));
      return;
    }
    logEdit(list.id, `Applied ${pct}% to ${withCustom.length} custom prices in ${list.name}`);
    setBulkIncrease('');
    toast(`Bumped ${withCustom.length} custom prices`);
    router.refresh();
  }

  // CSV import — match product by name (case-insensitive) against the catalogue,
  // skip + count unmatched, upsert overrides onConflict price_list_id,stock_item_id.
  async function importOverrides(records: ImportRecord[]): Promise<{ inserted: number; error?: string }> {
    const supabase = createClient();
    if (!supabase || !org) return { inserted: 0, error: 'Not connected.' };
    const byName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p]));
    const upserts: { org_id: string; price_list_id: string; stock_item_id: string; margin_pct: number; custom_price: number | null }[] = [];
    let unmatched = 0;
    let clearedCustom = 0;
    for (const rec of records) {
      const name = String(rec.product ?? '').trim().toLowerCase();
      const product = name ? byName.get(name) : undefined;
      if (!product) {
        unmatched++;
        continue;
      }
      const marginRaw = rec.margin_pct;
      const customRaw = rec.custom_price;
      const margin = typeof marginRaw === 'number' ? marginRaw : Number(list.default_margin_pct) || 0;
      // A 0 or negative custom_price cell means "no custom price" — store null so
      // it falls back to margin pricing (only custom_price > 0 counts).
      let custom: number | null = null;
      if (typeof customRaw === 'number') {
        if (customRaw > 0) custom = customRaw;
        else clearedCustom++;
      }
      upserts.push({
        org_id: org.id,
        price_list_id: list.id,
        stock_item_id: product.id,
        margin_pct: Number.isFinite(margin) ? margin : Number(list.default_margin_pct) || 0,
        custom_price: custom,
      });
    }
    if (upserts.length === 0) {
      return { inserted: 0, error: unmatched > 0 ? `No products matched — ${unmatched} row(s) had no matching product name.` : 'No rows to import.' };
    }
    const { error: err, dropped } = await writeArrayDroppingMissing(
      (w) => supabase.from('pl_overrides').upsert(w, { onConflict: 'price_list_id,stock_item_id' }),
      upserts,
    );
    if (err) return { inserted: 0, error: migrationMessage(err.message) };
    logEdit(list.id, `Imported ${upserts.length} prices into ${list.name}`);
    router.refresh();
    const notes = [
      unmatched > 0 ? `${unmatched} row(s) skipped — no matching product name.` : null,
      dropped.includes('custom_price')
        ? 'Custom prices need the core-data.sql migration — margins imported only.'
        : clearedCustom > 0
          ? `${clearedCustom} row(s) had a 0 or negative custom price → margin pricing used.`
          : null,
    ].filter(Boolean);
    return { inserted: upserts.length, error: notes.length > 0 ? notes.join(' ') : undefined };
  }

  function exportCsv() {
    const headers = ['product', 'unit', 'base cost', 'margin', 'custom price', 'sell price'];
    const csvRows = rows.map((r) => {
      const product = productById.get(r.stock_item_id);
      const { cost } = baseCostFor(product, latestStatementPrices);
      const margin = Number(r.margin_pct ?? list.default_margin_pct) || 0;
      const custom = r.custom_price != null && Number(r.custom_price) > 0 ? Number(r.custom_price) : null;
      const sell = custom != null ? custom : cost != null ? round2(cost * (1 + margin / 100)) : null;
      return [
        product?.name ?? 'Unknown product',
        product?.unit ?? '',
        cost != null ? cost.toFixed(2) : '',
        r.margin_pct != null ? String(r.margin_pct) : '',
        r.custom_price != null ? Number(r.custom_price).toFixed(2) : '',
        sell != null ? sell.toFixed(2) : '',
      ];
    });
    const slug = list.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'price-list';
    downloadCsv(`${slug}-prices`, headers, csvRows);
    toast('CSV exported');
  }

  // Rows enriched for display, joined to their product. Base cost resolves to
  // the latest market-statement price (else catalogue, else unknown), and the
  // sell price is derived from that base so it tracks the market — a custom
  // price still wins outright. Rows with an unknown cost are flagged for review.
  const displayRows = useMemo(() => {
    return rows
      .map((r) => {
        const product = productById.get(r.stock_item_id) ?? null;
        const base = baseCostFor(product, latestStatementPrices);
        const margin = Number(r.margin_pct ?? list.default_margin_pct) || 0;
        const custom = r.custom_price != null && Number(r.custom_price) > 0 ? Number(r.custom_price) : null;
        const sell = custom != null ? custom : base.cost != null ? round2(base.cost * (1 + margin / 100)) : null;
        const isCustom = custom != null;
        const needsReview = base.cost == null;
        return { row: r, product, base, sell, isCustom, needsReview };
      })
      .sort((a, b) => (a.product?.name ?? '').localeCompare(b.product?.name ?? ''));
  }, [rows, productById, list, latestStatementPrices]);

  const reviewCount = useMemo(() => displayRows.filter((d) => d.needsReview).length, [displayRows]);
  const visibleRows = useMemo(
    () => (onlyReview ? displayRows.filter((d) => d.needsReview) : displayRows),
    [displayRows, onlyReview],
  );

  return (
    <Drawer
      open
      onClose={onClose}
      width={760}
      title={list.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <Pill label={style.label} bg={style.bg} fg={style.fg} />
          <span>{customerName ?? 'All customers'}</span>
          <span className="text-[#C9CCCA]">·</span>
          <span>Default margin {list.default_margin_pct != null ? `${list.default_margin_pct}%` : '—'}</span>
          <span className="text-[#C9CCCA]">·</span>
          <span>{rows.length} priced</span>
        </span>
      }
      right={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (missingProducts.length > 40 ? setConfirmFill(true) : void fillFromCatalogue())}
            disabled={fillBusy || missingProducts.length === 0}
            className="inline-flex h-8 items-center rounded-lg bg-[#1E5E54] px-3 text-[12px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-50"
          >
            {fillBusy ? 'Adding…' : `Fill from catalogue · ${missingProducts.length}`}
          </button>
          <SecondaryBtn onClick={() => setImporting(true)} className="h-8 px-3 text-[12px]">
            Import CSV
          </SecondaryBtn>
          <SecondaryBtn onClick={exportCsv} className="h-8 px-3 text-[12px]" disabled={rows.length === 0}>
            Export CSV
          </SecondaryBtn>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-[#E7C9C9] bg-[#F9F0F0] px-3 py-2 text-[12px] text-[#A32D2D]">{error}</div>
      ) : null}

      {/* Review summary — items with no known base cost can't be priced yet */}
      {reviewCount > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#EBD9B0] bg-[#FBF3E4] px-3 py-2.5 text-[12px] text-[#854F0B]">
          <span>
            {reviewCount} item{reviewCount === 1 ? '' : 's'} {reviewCount === 1 ? 'needs' : 'need'} a cost — enter it to price {reviewCount === 1 ? 'it' : 'them'}.
          </span>
          <button
            type="button"
            onClick={() => setOnlyReview((v) => !v)}
            className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              onlyReview
                ? 'border-[#854F0B] bg-[#854F0B] text-white'
                : 'border-[#EBD9B0] bg-white text-[#854F0B] hover:bg-[#FDF8EF]'
            }`}
          >
            {onlyReview ? 'Show all' : 'Only needs review'}
          </button>
        </div>
      ) : null}

      {/* Add products */}
      <div className="mb-4">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9A9DA1]">Add products</div>
        <SearchInput value={addQuery} onChange={setAddQuery} placeholder="Search the catalogue to add a product…" />
        {addQuery.trim() ? (
          <div className="mt-2 overflow-hidden rounded-xl border border-[#E7E7E2]">
            {addable.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-[#9A9DA1]">
                {products.length === 0 ? 'No products in the catalogue yet — add them in Databases → Products.' : 'No matching products (or all already on this list).'}
              </div>
            ) : (
              addable.map((p) => {
                const { cost } = baseCostFor(p, latestStatementPrices);
                const margin = Number(list.default_margin_pct) || 0;
                const sell = cost != null ? round2(cost * (1 + margin / 100)) : null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void addProduct(p)}
                    disabled={busyId === p.id}
                    className="flex w-full items-center justify-between gap-3 border-b border-[#F0F0EC] px-3 py-2.5 text-left last:border-0 transition-colors hover:bg-[#FBFBF9] disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-[#1A1C1E]">{p.name}</div>
                      <div className="truncate text-[11px] text-[#9A9DA1]">
                        {p.category ? `${p.category} · ` : ''}base {cost != null ? zar2(cost) : '—'} → {sell != null ? zar2(sell) : '—'}
                      </div>
                    </div>
                    <span className="shrink-0 text-[12px] font-medium text-[#1E5E54]">Add</span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      {/* Bulk update bar */}
      {rows.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[#E7E7E2] bg-[#FBFBF9] px-3 py-3">
          <div className="min-w-[150px] flex-1">
            <div className="mb-1 text-[11px] font-medium text-[#5F6368]">Set margin on all items</div>
            <div className="flex items-center gap-2">
              <input
                value={bulkMargin}
                onChange={(e) => setBulkMargin(e.target.value)}
                placeholder="e.g. 25"
                inputMode="decimal"
                className={`${inputClass} h-9`}
              />
              <SecondaryBtn onClick={() => void bulkSetMargin()} disabled={bulkBusy || bulkMargin.trim() === ''} className="shrink-0">
                Apply
              </SecondaryBtn>
            </div>
          </div>
          <div className="min-w-[150px] flex-1">
            <div className="mb-1 text-[11px] font-medium text-[#5F6368]">Bump all custom prices by %</div>
            <div className="flex items-center gap-2">
              <input
                value={bulkIncrease}
                onChange={(e) => setBulkIncrease(e.target.value)}
                placeholder="e.g. 5"
                inputMode="decimal"
                className={`${inputClass} h-9`}
              />
              <SecondaryBtn onClick={() => void bulkBumpPrices()} disabled={bulkBusy || bulkIncrease.trim() === ''} className="shrink-0">
                Apply
              </SecondaryBtn>
            </div>
          </div>
        </div>
      ) : null}

      {/* Override rows */}
      {rows.length === 0 ? (
        <EmptyState
          title="No item pricing yet"
          body="Fill from the catalogue to add every product at this list's default margin, or search above to add them one by one. Base cost uses the latest market-statement price where known. Custom prices need supabase/core-data.sql to be run."
          action={
            missingProducts.length > 0 ? (
              <PrimaryBtn
                onClick={() => (missingProducts.length > 40 ? setConfirmFill(true) : void fillFromCatalogue())}
                disabled={fillBusy}
              >
                {fillBusy ? 'Adding…' : `Fill from catalogue · ${missingProducts.length} products`}
              </PrimaryBtn>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E7E7E2]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-3 py-2.5 text-left font-medium">Product</th>
                <th className="px-2 py-2.5 text-right font-medium">Base cost</th>
                <th className="px-2 py-2.5 text-right font-medium">Margin %</th>
                <th className="px-2 py-2.5 text-right font-medium">Custom price</th>
                <th className="px-2 py-2.5 text-right font-medium">Sell price</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ row, product, base, sell, isCustom }) => (
                <tr key={row.id} className="border-b border-[#F6F6F2] last:border-0">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-[#1A1C1E]">{product?.name ?? 'Unknown product'}</div>
                    {product?.unit ? <div className="text-[11px] text-[#9A9DA1]">per {product.unit}</div> : null}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {base.cost != null ? (
                      <div className="tabular-nums text-[#5F6368]">
                        {zar2(base.cost)}
                        {base.label ? <div className="text-[11px] font-normal text-[#9A9DA1]">{base.label}</div> : null}
                      </div>
                    ) : product ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-[#FBF3E4] px-1.5 py-0.5 text-[10px] font-medium text-[#854F0B]">
                          Review
                        </span>
                        <input
                          defaultValue=""
                          placeholder="Enter cost"
                          onBlur={(e) => void setBaseCost(product, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          disabled={busyId === product.id}
                          inputMode="decimal"
                          className="h-8 w-[92px] rounded-lg border border-[#E7C9A0] bg-white px-2 text-right text-[13px] text-[#1A1C1E] tabular-nums placeholder:text-[#C9A876] focus:border-[#854F0B] focus:outline-none disabled:opacity-50"
                        />
                      </div>
                    ) : (
                      <span className="tabular-nums text-[#9A9DA1]">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <input
                      defaultValue={row.margin_pct != null ? String(row.margin_pct) : ''}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v.replace(/[%\s]/g, '') !== String(row.margin_pct ?? '')) void updateMargin(row, v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      disabled={busyId === row.id}
                      inputMode="decimal"
                      className="h-8 w-[68px] rounded-lg border border-[#D7DAD8] bg-white px-2 text-right text-[13px] text-[#1A1C1E] tabular-nums focus:border-[#1E5E54]/50 focus:outline-none disabled:opacity-50"
                    />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <input
                      defaultValue={row.custom_price != null ? String(row.custom_price) : ''}
                      placeholder="—"
                      onBlur={(e) => {
                        const v = e.target.value;
                        const current = row.custom_price != null ? String(row.custom_price) : '';
                        if (v.replace(/[R\s,]/g, '') !== current) void updateCustomPrice(row, v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      disabled={busyId === row.id}
                      inputMode="decimal"
                      className="h-8 w-[90px] rounded-lg border border-[#D7DAD8] bg-white px-2 text-right text-[13px] text-[#1A1C1E] tabular-nums placeholder:text-[#C9CCCA] focus:border-[#1E5E54]/50 focus:outline-none disabled:opacity-50"
                    />
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums font-medium text-[#1A1C1E]">
                    {sell != null ? zar2(sell) : <span className="font-normal text-[#9A9DA1]">—</span>}
                    {sell != null && isCustom ? (
                      <span className="ml-1 text-[10px] font-normal text-[#854F0B]">custom</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setRemoveId(row.id)}
                      aria-label="Remove"
                      className="rounded-lg px-2 py-1 text-[12px] text-[#9A9DA1] transition-colors hover:bg-[#F3E7E7] hover:text-[#A32D2D]"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[13px] text-[#9A9DA1]">
                    No items need review — every product has a cost.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[11px] text-[#9A9DA1]">
        Custom price wins over margin. Clear a custom price to fall back to the margin. Custom prices need
        supabase/core-data.sql to be run.
      </p>

      {/* Remove confirmation */}
      {removeId ? (
        <ConfirmRemove
          productName={productById.get(rows.find((r) => r.id === removeId)?.stock_item_id ?? '')?.name ?? 'this product'}
          onCancel={() => setRemoveId(null)}
          onConfirm={() => void removeOverride(removeId)}
        />
      ) : null}

      {/* Fill-from-catalogue confirmation (only when adding a lot at once) */}
      <Modal
        open={confirmFill}
        onClose={() => setConfirmFill(false)}
        title={`Add all ${missingProducts.length} products to this list?`}
        subtitle={`Every active catalogue product not already priced will be added at the ${
          list.default_margin_pct != null ? `${list.default_margin_pct}%` : 'default'
        } margin. You can adjust each afterwards.`}
        width={420}
        footer={
          <>
            <SecondaryBtn onClick={() => setConfirmFill(false)} disabled={fillBusy}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn onClick={() => void fillFromCatalogue()} disabled={fillBusy}>
              {fillBusy ? 'Adding…' : `Add ${missingProducts.length} products`}
            </PrimaryBtn>
          </>
        }
      >
        <span className="sr-only">Confirm fill from catalogue</span>
      </Modal>

      {/* CSV import */}
      <CsvImportModal
        open={importing}
        onClose={() => setImporting(false)}
        title={`Import prices — ${list.name}`}
        fields={CSV_FIELDS}
        onImport={importOverrides}
      />
    </Drawer>
  );
}

function ConfirmRemove({
  productName,
  onCancel,
  onConfirm,
}: {
  productName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open
      onClose={onCancel}
      title="Remove product from list?"
      subtitle={`${productName} will use the list's default margin (or the base price) again.`}
      width={400}
      footer={
        <>
          <SecondaryBtn onClick={onCancel}>Cancel</SecondaryBtn>
          <DangerBtn
            onClick={onConfirm}
            className="border border-[#E7C9C9] bg-white hover:bg-[#F3E7E7]"
          >
            Remove
          </DangerBtn>
        </>
      }
    >
      <span className="sr-only">Remove {productName}</span>
    </Modal>
  );
}

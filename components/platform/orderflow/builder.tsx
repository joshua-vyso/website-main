'use client';

/**
 * Document builder foundation — the shared pieces every OrderFlow "new
 * document" page (quote / order / invoice / credit note / delivery note)
 * composes: customer selection (with inline quick-create), line-item editing
 * with price-list resolution, atomic document numbering and the transactional
 * create helpers. Prices are ALWAYS resolved through resolvePrice() from Core
 * Data — a manual override away from the resolved price requires a reason.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { logActivity } from '@/lib/platform/orderflow-activity';
import {
  resolvePrice,
  type CdPriceList,
  type CdPriceOverride,
  type CdProduct,
  type PriceSource,
} from '@/lib/platform/coredata';
import { docTotals, zar2, type OfCustomer } from '@/lib/platform/orderflow';
import { inputClass } from '@/components/platform/coredata/ui';

// ---------------------------------------------------------------------------
// Line model
// ---------------------------------------------------------------------------

export interface BuilderLine {
  key: string;
  stock_item_id: string | null;
  name: string;
  qty: number;
  unit: string | null;
  unit_price: number;
  source: PriceSource;
  override_note: string | null;
}

let keySeq = 0;
const newKey = () => `bl${keySeq++}_${Date.now().toString(36)}`;

// ---------------------------------------------------------------------------
// Customer combobox (searchable, optional inline quick-create)
// ---------------------------------------------------------------------------

interface CustomerOption {
  id: string;
  name: string;
  sub: string | null;
}

export function CustomerSelect({
  customers,
  value,
  onChange,
  allowCreate,
  allLabel,
}: {
  customers: OfCustomer[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowCreate?: boolean;
  /** When set, null is a real choice shown as this label (e.g. "All customers"). */
  allLabel?: string;
}) {
  const { org, email } = usePlatform();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Customers quick-created this session (not yet in the server-fetched prop). */
  const [created, setCreated] = useState<CustomerOption[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const options = useMemo<CustomerOption[]>(() => {
    const opts: CustomerOption[] = customers.map((c) => ({
      id: c.id,
      name: c.name,
      sub: c.trading_name || c.email || null,
    }));
    for (const c of created) if (!opts.some((o) => o.id === c.id)) opts.push(c);
    return opts;
  }, [customers, created]);

  const selected = options.find((o) => o.id === value) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.name.toLowerCase().includes(q) || (o.sub ?? '').toLowerCase().includes(q))
    : options;
  const exactMatch = q.length > 0 && options.some((o) => o.name.trim().toLowerCase() === q);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDown);
      clearTimeout(t);
    };
  }, [open]);

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
    setQuery('');
    setError(null);
  }

  async function quickCreate() {
    const name = query.trim();
    if (!name || creating) return;
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setCreating(true);
    setError(null);
    const { data, error: insErr } = await supabase
      .from('of_customers')
      .insert({ org_id: org.id, name })
      .select('id, name')
      .single();
    setCreating(false);
    if (insErr || !data) {
      setError(insErr?.message ?? 'Could not add the customer.');
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'customer',
      entityId: data.id,
      customerId: data.id,
      event: 'customer_created',
      description: `${data.name} — added from the document builder`,
    });
    setCreated((prev) => [...prev, { id: data.id, name: data.name, sub: null }]);
    pick(data.id);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${selected || allLabel ? 'text-[#171A17]' : 'text-[#8A8E86]'}`}>
          {selected ? selected.name : allLabel ?? 'Select customer…'}
        </span>
        <span className="shrink-0 text-[10px] text-[#8A8E86]">▾</span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-[#EAEDF2] bg-white shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
          <div className="border-b border-[#EEF1F5] p-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filtered[0]) pick(filtered[0].id);
                  else if (allowCreate && q) void quickCreate();
                }
              }}
              placeholder="Search customers…"
              className="h-8 w-full rounded-lg border border-[#E2E6EC] bg-white px-2.5 text-[13px] focus:border-[#3E7BC4]/50 focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {allLabel ? (
              <button
                type="button"
                onClick={() => pick(null)}
                className={`block w-full px-3 py-2 text-left transition-colors hover:bg-[#F5F9FE] ${value === null ? 'bg-[#F2F7F5]' : ''}`}
              >
                <span className="block truncate text-[13px] text-[#171A17]">{allLabel}</span>
              </button>
            ) : value ? (
              <button
                type="button"
                onClick={() => pick(null)}
                className="block w-full px-3 py-1.5 text-left text-[12px] text-[#8A8E86] transition-colors hover:bg-[#F5F9FE]"
              >
                Clear selection
              </button>
            ) : null}
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => pick(o.id)}
                className={`block w-full px-3 py-2 text-left transition-colors hover:bg-[#F5F9FE] ${
                  o.id === value ? 'bg-[#F2F7F5]' : ''
                }`}
              >
                <span className="block truncate text-[13px] text-[#171A17]">{o.name}</span>
                {o.sub ? <span className="block truncate text-[11px] text-[#8A8E86]">{o.sub}</span> : null}
              </button>
            ))}
            {filtered.length === 0 && !(allowCreate && q) ? (
              <p className="px-3 py-3 text-[12px] text-[#8A8E86]">
                {options.length === 0
                  ? allowCreate
                    ? 'No customers yet — type a name to add one.'
                    : 'No customers yet.'
                  : 'No customers match.'}
              </p>
            ) : null}
            {allowCreate && q && !exactMatch ? (
              <button
                type="button"
                onClick={() => void quickCreate()}
                disabled={creating}
                className="block w-full px-3 py-2 text-left text-[13px] font-medium text-[#1F5FA8] transition-colors hover:bg-[#F2F7F5] disabled:opacity-50"
              >
                {creating ? 'Adding…' : `+ Add “${query.trim()}”`}
              </button>
            ) : null}
          </div>
          {error ? <p className="border-t border-[#EEF1F5] px-3 py-2 text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line items editor — product picker + custom lines + price override w/ reason
// ---------------------------------------------------------------------------

const SOURCE_HINT: Record<PriceSource, string> = {
  custom: 'Custom price',
  override_margin: 'Override margin',
  list_margin: 'Price list',
  base: 'Base price',
  none: '',
};

const numCell =
  'h-8 w-full rounded-md border border-[#EAEDF2] px-1.5 text-right text-[13px] tabular-nums text-[#171A17] focus:border-[#3E7BC4]/50 focus:outline-none';

export function LineItemsEditor({
  products,
  priceList,
  overrides,
  lines,
  onChange,
}: {
  products: CdProduct[];
  priceList: CdPriceList | null;
  overrides: CdPriceOverride[];
  lines: BuilderLine[];
  onChange: (l: BuilderLine[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const resolvedById = useMemo(() => {
    const m = new Map<string, { price: number; source: PriceSource; listName: string | null }>();
    for (const p of products) {
      const r = resolvePrice(p, priceList, overrides);
      m.set(p.id, { price: r.price, source: r.source, listName: r.listName });
    }
    return m;
  }, [products, priceList, overrides]);

  const q = query.trim().toLowerCase();
  const matches = (q
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category ?? '').toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q),
      )
    : products
  ).slice(0, 8);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  /** True when a product line's price no longer matches its resolved price. */
  function isOverridden(l: BuilderLine): boolean {
    if (!l.stock_item_id) return false;
    const r = resolvedById.get(l.stock_item_id);
    if (!r) return false;
    return Math.abs((Number(l.unit_price) || 0) - r.price) > 0.005;
  }

  function addProduct(p: CdProduct) {
    const r = resolvedById.get(p.id) ?? { price: 0, source: 'none' as PriceSource, listName: null };
    onChange([
      ...lines,
      {
        key: newKey(),
        stock_item_id: p.id,
        name: p.name,
        qty: 1,
        unit: p.unit ?? null,
        unit_price: r.price,
        source: r.source,
        override_note: null,
      },
    ]);
    setQuery('');
    searchRef.current?.focus();
  }

  function addCustom() {
    onChange([
      ...lines,
      { key: newKey(), stock_item_id: null, name: '', qty: 1, unit: null, unit_price: 0, source: 'none', override_note: null },
    ]);
  }

  function update(key: string, patch: Partial<BuilderLine>) {
    onChange(
      lines.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // Returning the price to its resolved value clears the override reason.
        if (next.stock_item_id) {
          const r = resolvedById.get(next.stock_item_id);
          if (r && Math.abs((Number(next.unit_price) || 0) - r.price) <= 0.005) next.override_note = null;
        }
        return next;
      }),
    );
  }

  function remove(key: string) {
    onChange(lines.filter((l) => l.key !== key));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-2">
        <div ref={pickerRef} className="relative min-w-[220px] flex-1">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'Enter') {
                e.preventDefault();
                if (matches[0]) addProduct(matches[0]);
              }
            }}
            placeholder="Search products to add…"
            className={inputClass}
          />
          {open ? (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-[#EAEDF2] bg-white py-1 shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
              {matches.map((p) => {
                const r = resolvedById.get(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-[#F5F9FE]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-[#171A17]">{p.name}</span>
                      <span className="block truncate text-[11px] text-[#8A8E86]">
                        {[p.category, p.unit].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] tabular-nums text-[#6B6F68]">{zar2(r?.price ?? 0)}</span>
                  </button>
                );
              })}
              {matches.length === 0 ? (
                <p className="px-3 py-3 text-[12px] text-[#8A8E86]">
                  {products.length === 0
                    ? 'No products yet — add them in Doc-U → Databases → Products, or use a custom line.'
                    : 'No products match.'}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={addCustom}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-[#E2E6EC] bg-white px-3 text-[13px] text-[#6B6F68] transition-colors hover:border-[#3E7BC4]/50 hover:text-[#171A17]"
        >
          + Custom line
        </button>
      </div>

      {priceList ? (
        <p className="text-[12px] text-[#8A8E86]">
          Pricing from <span className="font-medium text-[#6B6F68]">{priceList.name}</span>
        </p>
      ) : null}

      {lines.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[#EAEDF2]">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-wide text-[#8A8E86]">
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="w-[72px] px-2 py-2 text-right font-medium">Qty</th>
                <th className="w-[84px] px-2 py-2 text-left font-medium">Unit</th>
                <th className="w-[116px] px-2 py-2 text-right font-medium">Unit price</th>
                <th className="w-[110px] px-3 py-2 text-right font-medium">Amount</th>
                <th className="w-[40px] px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const overridden = isOverridden(l);
                const resolved = l.stock_item_id ? resolvedById.get(l.stock_item_id) : undefined;
                return (
                  <FragmentRow
                    key={l.key}
                    line={l}
                    overridden={overridden}
                    resolvedPrice={resolved?.price}
                    listName={resolved?.listName ?? null}
                    onUpdate={(patch) => update(l.key, patch)}
                    onRemove={() => remove(l.key)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[#EAEDF2] bg-[#FBFCFE] px-4 py-6 text-center text-[13px] text-[#8A8E86]">
          Search a product above or add a custom line.
        </p>
      )}
    </div>
  );
}

function FragmentRow({
  line: l,
  overridden,
  resolvedPrice,
  listName,
  onUpdate,
  onRemove,
}: {
  line: BuilderLine;
  overridden: boolean;
  resolvedPrice: number | undefined;
  listName: string | null;
  onUpdate: (patch: Partial<BuilderLine>) => void;
  onRemove: () => void;
}) {
  const custom = l.stock_item_id === null;
  const hint = custom ? null : [SOURCE_HINT[l.source], listName].filter(Boolean).join(' · ');
  const reasonMissing = overridden && !(l.override_note ?? '').trim();
  return (
    <>
      <tr className={`border-b ${overridden ? 'border-transparent' : 'border-[#F5F9FE]'} last:border-0`}>
        <td className="px-3 py-2">
          {custom ? (
            <input
              value={l.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="Description"
              className="h-8 w-full rounded-md border border-transparent bg-transparent px-1 text-[13px] text-[#171A17] focus:border-[#EAEDF2] focus:outline-none"
            />
          ) : (
            <div className="min-w-0">
              <span className="block truncate text-[#171A17]">{l.name}</span>
              {hint ? <span className="block text-[11px] text-[#8A8E86]">{hint}</span> : null}
            </div>
          )}
        </td>
        <td className="px-2 py-2">
          <input
            value={String(l.qty)}
            onChange={(e) => onUpdate({ qty: Number(e.target.value) || 0 })}
            inputMode="decimal"
            className={numCell}
          />
        </td>
        <td className="px-2 py-2">
          {custom ? (
            <input
              value={l.unit ?? ''}
              onChange={(e) => onUpdate({ unit: e.target.value || null })}
              placeholder="unit"
              className="h-8 w-full rounded-md border border-[#EAEDF2] px-1.5 text-[13px] text-[#171A17] focus:border-[#3E7BC4]/50 focus:outline-none"
            />
          ) : (
            <span className="text-[#6B6F68]">{l.unit ?? '—'}</span>
          )}
        </td>
        <td className="px-2 py-2">
          <input
            value={String(l.unit_price)}
            onChange={(e) => onUpdate({ unit_price: Number(e.target.value) || 0 })}
            inputMode="decimal"
            className={`${numCell} ${overridden ? 'border-[#D9A441] bg-[#FFFDF5]' : ''}`}
          />
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-[#171A17]">
          {zar2((Number(l.qty) || 0) * (Number(l.unit_price) || 0))}
        </td>
        <td className="px-2 py-2 text-right">
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove line"
            className="text-[#8A8E86] transition-colors hover:text-[#A32D2D]"
          >
            ✕
          </button>
        </td>
      </tr>
      {overridden ? (
        <tr className="border-b border-[#F5F9FE] bg-[#FFFDF5] last:border-0">
          <td colSpan={6} className="px-3 pb-2.5 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-[#854F0B]">
                Price changed from {zar2(resolvedPrice ?? 0)} — reason required
              </span>
              <input
                value={l.override_note ?? ''}
                onChange={(e) => onUpdate({ override_note: e.target.value ? e.target.value : null })}
                placeholder="Why is this price different?"
                className={`h-7 min-w-[220px] flex-1 rounded-md border px-2 text-[12px] text-[#171A17] focus:outline-none ${
                  reasonMissing ? 'border-[#D9A441] bg-white' : 'border-[#EAEDF2] bg-white focus:border-[#3E7BC4]/50'
                }`}
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Atomic document numbering (rpc + client-side fallback when migration not run)
// ---------------------------------------------------------------------------

type DocKind = 'invoice' | 'quote' | 'order' | 'credit_note' | 'delivery_note';

const FALLBACK_PREFIX: Record<DocKind, string> = {
  invoice: 'INV-',
  quote: 'QTE-',
  order: 'ORD-',
  credit_note: 'CN-',
  delivery_note: 'DN-',
};

export async function nextDocNumber(supabase: SupabaseClient, kind: DocKind): Promise<string> {
  const { data, error } = await supabase.rpc('of_next_number', { p_kind: kind });
  if (!error && typeof data === 'string' && data.length > 0) return data;
  // Migration not run yet (or rpc unavailable) — time-derived fallback keeps
  // numbers unique without the of_settings counters.
  return FALLBACK_PREFIX[kind] + String(Date.now()).slice(-6);
}

// ---------------------------------------------------------------------------
// Transactional create helpers — every "new document" page calls these.
// They throw on error; the calling page toasts the message.
// ---------------------------------------------------------------------------

/**
 * True when a PostgREST error is a missing-column error for `col` — used to make
 * a write migration-safe by dropping that one key and retrying (e.g. rebate_pct
 * before supabase/rebates.sql is run). Matches the PGRST204 phrasing
 * "Could not find the 'rebate_pct' column of 'of_invoices' in the schema cache".
 */
function isMissingColumn(msg: string | null | undefined, col: string): boolean {
  if (!msg) return false;
  // The column name appears anywhere in a schema-cache / missing-column error;
  // requiring both the name AND the missing-column wording avoids swallowing
  // unrelated errors (e.g. a not-null violation on a different column).
  const nameRe = new RegExp(col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return nameRe.test(msg) && /column|schema cache|could not find/i.test(msg);
}

function itemRows(lines: BuilderLine[]) {
  return lines.map((l, i) => ({
    stock_item_id: l.stock_item_id,
    name: l.name.trim(),
    qty: Number(l.qty) || 0,
    unit: l.unit,
    unit_price: Number(l.unit_price) || 0,
    override_note: l.override_note?.trim() || null,
    sort_order: i,
  }));
}

export async function createInvoice(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    actorEmail: string | null;
    customer: OfCustomer | null;
    customerId: string | null;
    lines: BuilderLine[];
    vatRate: number;
    discount?: number;
    rebatePct?: number;
    issueDate: string;
    dueDate: string | null;
    customerPo?: string | null;
    billingAddress?: string | null;
    deliveryAddress?: string | null;
    deliveryInstructions?: string | null;
    notes?: string | null;
    terms?: string | null;
    orderId?: string | null;
    quoteId?: string | null;
    status?: 'draft' | 'sent';
  },
): Promise<{ id: string; number: string }> {
  const status = args.status ?? 'draft';
  const number = await nextDocNumber(supabase, 'invoice');

  const invoiceRow: Record<string, unknown> = {
    org_id: args.orgId,
    customer_id: args.customerId,
    order_id: args.orderId ?? null,
    invoice_number: number,
    status,
    issue_date: args.issueDate,
    due_date: args.dueDate,
    vat_rate: args.vatRate,
    discount: args.discount ?? 0,
    rebate_pct: args.rebatePct ?? 0,
    customer_po: args.customerPo ?? null,
    billing_address: args.billingAddress ?? args.customer?.billing_address ?? null,
    delivery_address: args.deliveryAddress ?? null,
    delivery_instructions: args.deliveryInstructions ?? null,
    notes: args.notes ?? null,
    terms: args.terms ?? null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  };
  let { data: inv, error: invErr } = await supabase.from('of_invoices').insert(invoiceRow).select('id').single();
  // Migration-safe: rebate_pct only exists once supabase/rebates.sql is run. When
  // PostgREST reports it missing, drop just that key and retry so invoicing works
  // before the migration (the rebate simply isn't snapshotted yet).
  if (invErr && isMissingColumn(invErr.message, 'rebate_pct')) {
    delete invoiceRow.rebate_pct;
    ({ data: inv, error: invErr } = await supabase.from('of_invoices').insert(invoiceRow).select('id').single());
  }
  if (invErr || !inv) throw new Error(invErr?.message ?? 'Could not create the invoice.');

  if (args.lines.length > 0) {
    const { error: itemErr } = await supabase
      .from('of_invoice_items')
      .insert(itemRows(args.lines).map((r) => ({ ...r, org_id: args.orgId, invoice_id: inv.id })));
    if (itemErr) {
      await supabase.from('of_invoices').delete().eq('id', inv.id);
      throw new Error(itemErr.message);
    }
  }

  // Conversion side-effects — best-effort: the invoice already exists, so a
  // failed link update must not surface as "invoice creation failed".
  if (args.orderId) {
    const { error } = await supabase
      .from('of_orders')
      .update({ status: 'invoiced', invoice_number: number, invoice_id: inv.id, updated_at: new Date().toISOString() })
      .eq('id', args.orderId);
    if (error) console.warn('order → invoiced link failed:', error.message);
  }
  if (args.quoteId) {
    const { error } = await supabase
      .from('of_quotes')
      .update({ converted_invoice_id: inv.id, status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', args.quoteId);
    if (error) console.warn('quote → invoice link failed:', error.message);
  }

  const total = docTotals(args.lines, args.vatRate, args.discount ?? 0, args.rebatePct ?? 0).total;
  logActivity(supabase, {
    orgId: args.orgId,
    actorEmail: args.actorEmail,
    entityType: 'invoice',
    entityId: inv.id,
    customerId: args.customerId,
    event: 'invoice_created',
    description: `${number} · ${zar2(total)}${args.customer ? ` for ${args.customer.name}` : ''}`,
  });

  return { id: inv.id, number };
}

export async function createOrder(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    actorEmail: string | null;
    customerId: string | null;
    lines: BuilderLine[];
    notes?: string | null;
    deliveryAddress?: string | null;
    deliveryInstructions?: string | null;
    deliveryDate?: string | null;
    customerPo?: string | null;
    quoteId?: string | null;
    status?: 'draft' | 'confirmed';
  },
): Promise<{ id: string; number: string }> {
  const number = await nextDocNumber(supabase, 'order');

  const { data: ord, error: ordErr } = await supabase
    .from('of_orders')
    .insert({
      org_id: args.orgId,
      customer_id: args.customerId,
      status: args.status ?? 'draft',
      order_number: number,
      notes: args.notes ?? null,
      delivery_address: args.deliveryAddress ?? null,
      delivery_instructions: args.deliveryInstructions ?? null,
      delivery_date: args.deliveryDate ?? null,
      customer_po: args.customerPo ?? null,
      quote_id: args.quoteId ?? null,
    })
    .select('id')
    .single();
  if (ordErr || !ord) throw new Error(ordErr?.message ?? 'Could not create the order.');

  if (args.lines.length > 0) {
    const { error: itemErr } = await supabase.from('of_order_items').insert(
      args.lines.map((l) => ({
        org_id: args.orgId,
        order_id: ord.id,
        stock_item_id: l.stock_item_id,
        name: l.name.trim(),
        qty: Number(l.qty) || 0,
        unit: l.unit,
        unit_price: Number(l.unit_price) || 0,
      })),
    );
    if (itemErr) {
      await supabase.from('of_orders').delete().eq('id', ord.id);
      throw new Error(itemErr.message);
    }
  }

  if (args.quoteId) {
    const { error } = await supabase
      .from('of_quotes')
      .update({ converted_order_id: ord.id, status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', args.quoteId);
    if (error) console.warn('quote → order link failed:', error.message);
  }

  logActivity(supabase, {
    orgId: args.orgId,
    actorEmail: args.actorEmail,
    entityType: 'order',
    entityId: ord.id,
    customerId: args.customerId,
    event: 'order_created',
    description: `${number} · ${args.lines.length} line${args.lines.length === 1 ? '' : 's'}`,
  });

  return { id: ord.id, number };
}

export async function createDeliveryNote(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    actorEmail: string | null;
    customerId: string | null;
    orderId?: string | null;
    invoiceId?: string | null;
    deliveryAddress?: string | null;
    instructions?: string | null;
    lines: { name: string; qty: number; unit: string | null }[];
  },
): Promise<{ id: string; number: string }> {
  const number = await nextDocNumber(supabase, 'delivery_note');

  const { data: dn, error: dnErr } = await supabase
    .from('of_delivery_notes')
    .insert({
      org_id: args.orgId,
      customer_id: args.customerId,
      order_id: args.orderId ?? null,
      invoice_id: args.invoiceId ?? null,
      dn_number: number,
      status: 'draft',
      delivery_address: args.deliveryAddress ?? null,
      instructions: args.instructions ?? null,
    })
    .select('id')
    .single();
  if (dnErr || !dn) throw new Error(dnErr?.message ?? 'Could not create the delivery note.');

  if (args.lines.length > 0) {
    const { error: itemErr } = await supabase.from('of_delivery_note_items').insert(
      args.lines.map((l) => ({
        org_id: args.orgId,
        delivery_note_id: dn.id,
        name: l.name.trim(),
        qty: Number(l.qty) || 0,
        unit: l.unit,
      })),
    );
    if (itemErr) {
      await supabase.from('of_delivery_notes').delete().eq('id', dn.id);
      throw new Error(itemErr.message);
    }
  }

  logActivity(supabase, {
    orgId: args.orgId,
    actorEmail: args.actorEmail,
    entityType: 'delivery_note',
    entityId: dn.id,
    customerId: args.customerId,
    event: 'delivery_note_created',
    description: `${number} · ${args.lines.length} item${args.lines.length === 1 ? '' : 's'}`,
  });

  return { id: dn.id, number };
}

'use client';

/**
 * Per-customer AI invoicing — the params + order-mapping editor rendered on the
 * customer profile. Two SectionCards:
 *
 *   1. "AI invoicing" — an editable form over the customer's rectification
 *      parameters (account code, VAT treatment, price/quantity basis, prefix
 *      stripping, automation thresholds, terms, notes, free-text AI rules).
 *      Saves the new of_customers columns in one write.
 *   2. "Order mappings" — CRUD over cd_customer_item_aliases: one row per quirky
 *      order name the customer uses ("FF - NAARTJIES Box"), mapping it to a
 *      catalogue item and a clean invoice name + billing unit.
 *
 * Every write is org-scoped and sets an explicit org_id; on success it toasts,
 * logs a customer_updated activity event, and refreshes. Migration-safe: the
 * columns/table only exist once supabase/customer-ai-invoicing.sql has been run,
 * so a missing-column / missing-table error surfaces a quiet inline note
 * ("Run supabase/customer-ai-invoicing.sql …") instead of a raw PostgREST error
 * — mirroring PriceListsView's migrationMessage pattern.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { logActivity } from '@/lib/platform/orderflow-activity';
import {
  INVOICE_PRICE_BASES,
  INVOICE_QUANTITY_BASES,
  VAT_TREATMENTS,
  type InvoicePriceBasis,
  type InvoiceQuantityBasis,
  type OfCustomer,
  type VatTreatment,
} from '@/lib/platform/orderflow';
import type { CdCustomerItemAlias, CdProduct } from '@/lib/platform/coredata';
import { useToast } from './ui';
import {
  ConfirmDialog,
  Field,
  Modal,
  PrimaryBtn,
  SecondaryBtn,
  inputClass,
} from '@/components/platform/coredata/ui';

// ---------------------------------------------------------------------------
// Migration-safe write helpers (mirror PriceListsView)
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

const MISSING_COLUMN_RE = /column|schema cache|could not find|does not exist/i;

/** The column PostgREST reports missing, e.g. PGRST204
 *  "Could not find the 'account_code' column of 'of_customers' in the schema cache". */
function missingColumnName(msg: string): string | null {
  const m = /'([^']+)' column/i.exec(msg) ?? /column "?([a-zA-Z0-9_]+)"?/.exec(msg);
  return m ? m[1] : null;
}

/** A migration-not-run error → a clear, actionable note; anything else → the raw message. */
function migrationMessage(msg: string): string {
  return MISSING_COLUMN_RE.test(msg) || /relation/i.test(msg)
    ? 'This needs the AI-invoicing migration — run supabase/customer-ai-invoicing.sql in your Supabase SQL editor.'
    : msg;
}

/**
 * Write a single row, transparently dropping any columns the database doesn't
 * have yet (the customer-ai-invoicing.sql migration not run / partially run).
 * `build` must construct a fresh query from the working row on every call.
 * Returns the response plus which columns were dropped, so callers can tell the
 * user what didn't persist.
 */
async function writeDroppingMissing(
  build: (row: Record<string, any>) => PromiseLike<{ error: { message: string } | null }>,
  row: Record<string, any>,
): Promise<{ error: { message: string } | null; dropped: string[] }> {
  const working: Record<string, any> = { ...row };
  const dropped: string[] = [];
  for (let i = 0; i < 16; i++) {
    const res = await build(working);
    if (!res.error) return { error: null, dropped };
    const col = missingColumnName(res.error.message);
    if (!col || !(col in working)) return { error: res.error, dropped };
    delete working[col];
    dropped.push(col);
  }
  return { error: { message: 'Too many missing columns — run supabase/customer-ai-invoicing.sql.' }, dropped };
}

// ---------------------------------------------------------------------------
// Section card (matches CustomerProfile's SectionCard)
// ---------------------------------------------------------------------------

const sectionCls = 'rounded-2xl border border-[#E7E7E2] bg-white p-5';
const sectionTitle = 'text-[13px] font-semibold text-[#1A1C1E]';

function SectionCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={sectionCls}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={sectionTitle}>{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[12px] text-[#9A9DA1]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-[#1E5E54]" />
      <span>
        <span className="font-medium text-[#1A1C1E]">{label}</span>
        {hint ? <span className="mt-0.5 block text-[12px] font-normal text-[#9A9DA1]">{hint}</span> : null}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Params draft
// ---------------------------------------------------------------------------

interface ParamsDraft {
  account_code: string;
  vat_treatment: VatTreatment;
  invoice_price_basis: InvoicePriceBasis;
  invoice_quantity_basis: InvoiceQuantityBasis;
  strip_order_prefixes: boolean;
  ai_auto_invoice_confidence: string;
  ai_allow_unpriced: boolean;
  invoice_terms_days_override: string;
  invoice_terms_text: string;
  invoice_note: string;
  ai_invoice_instructions: string;
}

function draftFromCustomer(c: OfCustomer): ParamsDraft {
  return {
    account_code: c.account_code ?? '',
    vat_treatment: (c.vat_treatment ?? 'zero_rated') as VatTreatment,
    invoice_price_basis: (c.invoice_price_basis ?? 'price_list') as InvoicePriceBasis,
    invoice_quantity_basis: (c.invoice_quantity_basis ?? 'auto') as InvoiceQuantityBasis,
    strip_order_prefixes: c.strip_order_prefixes !== false,
    ai_auto_invoice_confidence: c.ai_auto_invoice_confidence == null ? '80' : String(c.ai_auto_invoice_confidence),
    ai_allow_unpriced: c.ai_allow_unpriced === true,
    invoice_terms_days_override: c.invoice_terms_days_override == null ? '' : String(c.invoice_terms_days_override),
    invoice_terms_text: c.invoice_terms_text ?? '',
    invoice_note: c.invoice_note ?? '',
    ai_invoice_instructions: c.ai_invoice_instructions ?? '',
  };
}

const AI_INSTRUCTIONS_PLACEHOLDER =
  'e.g. Orders come from their POS with coded names like "FF - NAARTJIES Box" and "VEG - BABY GERMS PKT" (means "Baby Gems"). Strip the category prefix, correct spelling to our catalogue name, bill per box/punnet, and always re-price from our list. "PSAL - GARLIC CRUSHED BUCCKET" = "Garlic — Crushed".';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CustomerAiInvoicing({
  customer,
  products,
  aliases,
}: {
  customer: OfCustomer;
  products: CdProduct[];
  aliases: CdCustomerItemAlias[];
}) {
  return (
    <>
      <AiInvoicingParams customer={customer} />
      <OrderMappings customerId={customer.id} products={products} aliases={aliases} />
    </>
  );
}

// ---------------------------------------------------------------------------
// 1. AI invoicing params form
// ---------------------------------------------------------------------------

function AiInvoicingParams({ customer }: { customer: OfCustomer }) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [draft, setDraft] = useState<ParamsDraft>(() => draftFromCustomer(customer));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);

    const confidenceRaw = draft.ai_auto_invoice_confidence.trim();
    let confidence = confidenceRaw === '' ? 80 : Number(confidenceRaw);
    if (!Number.isFinite(confidence)) confidence = 80;
    confidence = Math.min(100, Math.max(0, Math.round(confidence)));

    const termsRaw = draft.invoice_terms_days_override.trim();
    const termsOverride = termsRaw === '' ? null : Number(termsRaw);

    const payload = {
      account_code: draft.account_code.trim() || null,
      vat_treatment: draft.vat_treatment,
      invoice_price_basis: draft.invoice_price_basis,
      invoice_quantity_basis: draft.invoice_quantity_basis,
      strip_order_prefixes: draft.strip_order_prefixes,
      ai_auto_invoice_confidence: confidence,
      ai_allow_unpriced: draft.ai_allow_unpriced,
      invoice_terms_days_override: termsOverride != null && Number.isFinite(termsOverride) ? Math.round(termsOverride) : null,
      invoice_terms_text: draft.invoice_terms_text.trim() || null,
      invoice_note: draft.invoice_note.trim() || null,
      ai_invoice_instructions: draft.ai_invoice_instructions.trim() || null,
    };

    const { error: upErr, dropped } = await writeDroppingMissing(
      (row) => supabase.from('of_customers').update(row).eq('id', customer.id).eq('org_id', org.id),
      payload,
    );
    setBusy(false);
    if (upErr) {
      setError(migrationMessage(upErr.message));
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'customer',
      entityId: customer.id,
      customerId: customer.id,
      event: 'customer_updated',
      description: 'AI invoicing settings updated',
    });
    // If every AI-invoicing column was dropped, nothing persisted — tell the user
    // to run the migration rather than claiming success.
    if (dropped.length >= Object.keys(payload).length) {
      setError(migrationMessage("Could not find the 'account_code' column of 'of_customers'."));
      return;
    }
    toast(dropped.length > 0 ? 'Saved — some settings need supabase/customer-ai-invoicing.sql' : 'AI invoicing settings saved');
    router.refresh();
  }

  return (
    <SectionCard
      title="AI invoicing"
      subtitle="How uploaded orders become this customer's invoice."
    >
      {toastNode}
      <div className="space-y-3.5">
        <Field label="Account code" hint="e.g. BAK001">
          <input
            className={inputClass}
            value={draft.account_code}
            onChange={(e) => setDraft({ ...draft, account_code: e.target.value })}
            placeholder="BAK001"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="VAT treatment">
            <select
              className={inputClass}
              value={draft.vat_treatment}
              onChange={(e) => setDraft({ ...draft, vat_treatment: e.target.value as VatTreatment })}
            >
              {VAT_TREATMENTS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity basis">
            <select
              className={inputClass}
              value={draft.invoice_quantity_basis}
              onChange={(e) => setDraft({ ...draft, invoice_quantity_basis: e.target.value as InvoiceQuantityBasis })}
            >
              {INVOICE_QUANTITY_BASES.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Invoice price basis" hint="Our price list re-prices every line">
          <select
            className={inputClass}
            value={draft.invoice_price_basis}
            onChange={(e) => setDraft({ ...draft, invoice_price_basis: e.target.value as InvoicePriceBasis })}
          >
            {INVOICE_PRICE_BASES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="rounded-xl border border-[#F0F0EC] bg-[#FCFCFB] px-3.5 py-3">
          <Toggle
            checked={draft.strip_order_prefixes}
            onChange={(v) => setDraft({ ...draft, strip_order_prefixes: v })}
            label="Strip order prefixes"
            hint={'Removes "FF - ", "VEG - " etc. from order names before matching.'}
          />
        </div>

        {/* Automation */}
        <div className="rounded-xl border border-[#F0F0EC] bg-[#FCFCFB] px-3.5 py-3">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#9A9DA1]">Automation</div>
          <div className="space-y-3">
            <Field label="Auto-invoice confidence" hint="0–100 · match ≥ this auto-invoices">
              <input
                className={inputClass}
                type="number"
                min={0}
                max={100}
                value={draft.ai_auto_invoice_confidence}
                onChange={(e) => setDraft({ ...draft, ai_auto_invoice_confidence: e.target.value })}
                placeholder="80"
              />
            </Field>
            <Toggle
              checked={draft.ai_allow_unpriced}
              onChange={(v) => setDraft({ ...draft, ai_allow_unpriced: v })}
              label="Allow unpriced lines"
              hint="Auto-invoice even when some lines couldn't be priced (else it holds for review)."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Payment terms override" hint="days · blank = default">
            <input
              className={inputClass}
              type="number"
              value={draft.invoice_terms_days_override}
              onChange={(e) => setDraft({ ...draft, invoice_terms_days_override: e.target.value })}
              placeholder="30"
            />
          </Field>
          <Field label="Terms text" hint='prints as "Terms:"'>
            <input
              className={inputClass}
              value={draft.invoice_terms_text}
              onChange={(e) => setDraft({ ...draft, invoice_terms_text: e.target.value })}
              placeholder="30 days"
            />
          </Field>
        </div>

        <Field label="Invoice note" hint="printed on every invoice">
          <textarea
            className={`${inputClass} h-auto py-2`}
            rows={2}
            value={draft.invoice_note}
            onChange={(e) => setDraft({ ...draft, invoice_note: e.target.value })}
          />
        </Field>

        <Field
          label="AI instructions"
          hint="How this customer orders and how to rectify it. The mapping table below handles exact renames; this captures the fuzzy rules."
        >
          <textarea
            className={`${inputClass} h-auto py-2`}
            rows={5}
            value={draft.ai_invoice_instructions}
            onChange={(e) => setDraft({ ...draft, ai_invoice_instructions: e.target.value })}
            placeholder={AI_INSTRUCTIONS_PLACEHOLDER}
          />
        </Field>

        {error ? <div className="rounded-xl bg-[#FCEBEB] px-3 py-2.5 text-[13px] text-[#A32D2D]">{error}</div> : null}

        <div className="flex justify-end pt-1">
          <PrimaryBtn onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </PrimaryBtn>
        </div>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// 2. Order mappings — CRUD over cd_customer_item_aliases
// ---------------------------------------------------------------------------

interface AliasDraft {
  raw_name: string;
  stock_item_id: string;
  invoice_name: string;
  unit: string;
  quantity_basis: string;
}
const EMPTY_ALIAS: AliasDraft = { raw_name: '', stock_item_id: '', invoice_name: '', unit: '', quantity_basis: 'auto' };

const ALIAS_QUANTITY_BASES: { value: string; label: string }[] = [
  { value: 'auto', label: 'Auto (use customer default)' },
  { value: 'bulk', label: 'Bulk quantity' },
  { value: 'order_unit', label: 'Order unit quantity' },
];

function OrderMappings({
  customerId,
  products,
  aliases,
}: {
  customerId: string;
  products: CdProduct[];
  aliases: CdCustomerItemAlias[];
}) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AliasDraft>(EMPTY_ALIAS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const matchingProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 60);
    return products
      .filter((p) => `${p.name} ${p.sku ?? ''} ${p.category ?? ''}`.toLowerCase().includes(q))
      .slice(0, 60);
  }, [products, productQuery]);

  function startNew() {
    setEditId(null);
    setDraft(EMPTY_ALIAS);
    setProductQuery('');
    setError(null);
    setOpen(true);
  }
  function startEdit(a: CdCustomerItemAlias) {
    setEditId(a.id);
    setDraft({
      raw_name: a.raw_name,
      stock_item_id: a.stock_item_id ?? '',
      invoice_name: a.invoice_name ?? '',
      unit: a.unit ?? '',
      quantity_basis: a.quantity_basis ?? 'auto',
    });
    setProductQuery(a.stock_item_id ? productById.get(a.stock_item_id)?.name ?? '' : '');
    setError(null);
    setOpen(true);
  }

  // Picking a catalogue item prefills the clean invoice name + unit when blank.
  function pickProduct(p: CdProduct) {
    setDraft((d) => ({
      ...d,
      stock_item_id: p.id,
      invoice_name: d.invoice_name.trim() === '' ? p.name : d.invoice_name,
      unit: d.unit.trim() === '' ? p.unit ?? '' : d.unit,
    }));
    setProductQuery(p.name);
  }

  async function save() {
    const raw = draft.raw_name.trim();
    if (!raw || busy) return;
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      raw_name: raw,
      stock_item_id: draft.stock_item_id || null,
      invoice_name: draft.invoice_name.trim() || null,
      unit: draft.unit.trim() || null,
      quantity_basis: draft.quantity_basis === 'auto' ? null : draft.quantity_basis,
    };

    if (editId) {
      const { error: upErr } = await supabase.from('cd_customer_item_aliases').update(payload).eq('id', editId).eq('org_id', org.id);
      if (upErr) {
        setBusy(false);
        setError(isConflict(upErr.message) ? 'A mapping for that name already exists.' : migrationMessage(upErr.message));
        return;
      }
    } else {
      const { error: insErr } = await supabase
        .from('cd_customer_item_aliases')
        .insert({ org_id: org.id, customer_id: customerId, ...payload });
      if (insErr) {
        setBusy(false);
        setError(isConflict(insErr.message) ? 'A mapping for that name already exists.' : migrationMessage(insErr.message));
        return;
      }
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'customer',
      entityId: customerId,
      customerId,
      event: 'customer_updated',
      description: `Order mapping ${editId ? 'updated' : 'added'}: ${raw}`,
    });
    setBusy(false);
    setOpen(false);
    toast(editId ? 'Mapping updated' : 'Mapping added');
    router.refresh();
  }

  async function remove(id: string) {
    const supabase = createClient();
    if (!supabase || !org) return;
    setConfirmDel(null);
    const { error: delErr } = await supabase.from('cd_customer_item_aliases').delete().eq('id', id).eq('org_id', org.id);
    if (delErr) {
      toast(migrationMessage(delErr.message));
      return;
    }
    toast('Mapping removed');
    router.refresh();
  }

  return (
    <SectionCard
      title="Order mappings"
      subtitle="Their order name → your catalogue item."
      action={
        <button type="button" onClick={startNew} className="shrink-0 text-[12px] font-medium text-[#1E5E54] hover:underline">
          + Add mapping
        </button>
      }
    >
      {toastNode}
      {aliases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-4 py-6 text-center">
          <p className="text-[13px] font-medium text-[#1A1C1E]">No order mappings yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[12px] text-[#5F6368]">
            Map a customer&apos;s exact order name to your catalogue. E.g. Bakubung sends &ldquo;FF - NAARTJIES Box&rdquo; — map it to
            &ldquo;Naartjies&rdquo; billed per box, and every future order rectifies automatically.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#F0F0EC] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="py-1.5 pr-2 text-left font-medium">Their name</th>
                <th className="px-2 py-1.5 text-left font-medium">Catalogue item</th>
                <th className="px-2 py-1.5 text-left font-medium">Invoice name</th>
                <th className="px-2 py-1.5 text-left font-medium">Unit</th>
                <th className="py-1.5 pl-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {aliases.map((a) => {
                const product = a.stock_item_id ? productById.get(a.stock_item_id) : null;
                const basisLabel =
                  a.quantity_basis && a.quantity_basis !== 'auto'
                    ? ALIAS_QUANTITY_BASES.find((q) => q.value === a.quantity_basis)?.label ?? a.quantity_basis
                    : null;
                return (
                  <tr key={a.id} className="border-b border-[#F6F6F2] last:border-0 align-top">
                    <td className="py-2 pr-2 font-medium text-[#1A1C1E]">{a.raw_name}</td>
                    <td className="px-2 py-2 text-[#5F6368]">{product ? product.name : a.stock_item_id ? 'Unknown item' : '—'}</td>
                    <td className="px-2 py-2 text-[#5F6368]">
                      {a.invoice_name || '—'}
                      {basisLabel ? <span className="ml-1 text-[11px] text-[#9A9DA1]">· {basisLabel}</span> : null}
                    </td>
                    <td className="px-2 py-2 text-[#5F6368]">{a.unit || '—'}</td>
                    <td className="py-2 pl-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => startEdit(a)} className="text-[12px] text-[#5F6368] hover:text-[#1A1C1E]">
                          Edit
                        </button>
                        <button type="button" onClick={() => setConfirmDel(a.id)} className="text-[12px] text-[#A32D2D] hover:underline">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? 'Edit order mapping' : 'Add order mapping'}
        subtitle="Written to Core Data — steers how this customer's orders rectify into invoices."
        width={520}
        footer={
          <>
            <SecondaryBtn onClick={() => setOpen(false)}>Cancel</SecondaryBtn>
            <PrimaryBtn onClick={() => void save()} disabled={busy || !draft.raw_name.trim()}>
              {busy ? 'Saving…' : editId ? 'Save' : 'Add mapping'}
            </PrimaryBtn>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Their item name" hint="exactly as it appears on their order">
            <input
              className={inputClass}
              value={draft.raw_name}
              onChange={(e) => setDraft({ ...draft, raw_name: e.target.value })}
              placeholder="Their item name, e.g. FF - NAARTJIES Box"
            />
          </Field>

          <Field label="Catalogue item" hint="search your products">
            <input
              className={inputClass}
              value={productQuery}
              onChange={(e) => {
                setProductQuery(e.target.value);
                // Typing a new query un-pins the selection until they pick again.
                if (draft.stock_item_id) setDraft((d) => ({ ...d, stock_item_id: '' }));
              }}
              placeholder="Search the catalogue…"
            />
            {draft.stock_item_id ? (
              <div className="mt-1.5 flex items-center gap-2 text-[12px] text-[#0F6E56]">
                <span className="inline-flex items-center rounded-full bg-[#E1F5EE] px-2 py-0.5 font-medium">
                  {productById.get(draft.stock_item_id)?.name ?? 'Selected'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDraft((d) => ({ ...d, stock_item_id: '' }));
                    setProductQuery('');
                  }}
                  className="text-[#9A9DA1] hover:text-[#1A1C1E]"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="mt-1.5 max-h-44 overflow-y-auto overflow-hidden rounded-xl border border-[#E7E7E2]">
                {products.length === 0 ? (
                  <div className="px-3 py-3 text-[12px] text-[#9A9DA1]">
                    No products in the catalogue yet — add them in Databases → Products.
                  </div>
                ) : matchingProducts.length === 0 ? (
                  <div className="px-3 py-3 text-[12px] text-[#9A9DA1]">No matching products.</div>
                ) : (
                  matchingProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickProduct(p)}
                      className="flex w-full items-center justify-between gap-3 border-b border-[#F0F0EC] px-3 py-2 text-left last:border-0 transition-colors hover:bg-[#FBFBF9]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-[#1A1C1E]">{p.name}</span>
                        {p.category || p.unit ? (
                          <span className="block truncate text-[11px] text-[#9A9DA1]">
                            {[p.category, p.unit ? `per ${p.unit}` : null].filter(Boolean).join(' · ')}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[12px] font-medium text-[#1E5E54]">Select</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Invoice name" hint="clean name on the invoice">
              <input
                className={inputClass}
                value={draft.invoice_name}
                onChange={(e) => setDraft({ ...draft, invoice_name: e.target.value })}
                placeholder="Naartjies"
              />
            </Field>
            <Field label="Unit" hint="billing unit">
              <input
                className={inputClass}
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                placeholder="box"
              />
            </Field>
          </div>

          <Field label="Quantity basis">
            <select
              className={inputClass}
              value={draft.quantity_basis}
              onChange={(e) => setDraft({ ...draft, quantity_basis: e.target.value })}
            >
              {ALIAS_QUANTITY_BASES.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </Field>

          {error ? <div className="rounded-xl bg-[#FCEBEB] px-3 py-2.5 text-[13px] text-[#A32D2D]">{error}</div> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="Delete order mapping?"
        body="Future orders using that name will fall back to fuzzy matching."
        confirmLabel="Delete"
        danger
        onConfirm={() => confirmDel && void remove(confirmDel)}
        onClose={() => setConfirmDel(null)}
      />
    </SectionCard>
  );
}

/** A duplicate raw_name violates unique(org_id, customer_id, raw_name). */
function isConflict(msg: string): boolean {
  return /duplicate key|unique constraint|already exists|23505/i.test(msg);
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { useToast } from '@/components/platform/orderflow/ui';
import { downloadCsv, type CsvField } from '@/lib/platform/csv';
import { logActivity } from '@/lib/platform/orderflow-activity';
import { isUniqueViolation } from '@/lib/platform/db-errors';
import type { CoreData } from '@/lib/platform/coredata-data';
import {
  ACCOUNT_STATUS_STYLE,
  CUSTOMER_TYPES,
  type AccountStatus,
  type CustomerType,
  type OfCustomer,
} from '@/lib/platform/orderflow';
import {
  Field,
  Modal,
  PrimaryBtn,
  SecondaryBtn,
  SearchInput,
  Pill,
  ConfirmDialog,
  EmptyState,
  inputClass,
} from './ui';
import { CsvImportModal } from './CsvImportModal';

// ---------------------------------------------------------------------------
// Customers — full Core Data customer management (of_customers).
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | AccountStatus;
type TypeFilter = 'all' | CustomerType;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'inactive', label: 'Inactive' },
];

interface Form {
  name: string;
  trading_name: string;
  email: string;
  phone: string;
  vat_number: string;
  registration_number: string;
  customer_type: CustomerType;
  account_status: AccountStatus;
  payment_terms_days: string;
  credit_limit: string;
  billing_address: string;
  tags: string;
  notes: string;
}

const BLANK: Form = {
  name: '',
  trading_name: '',
  email: '',
  phone: '',
  vat_number: '',
  registration_number: '',
  customer_type: 'other',
  account_status: 'active',
  payment_terms_days: '',
  credit_limit: '',
  billing_address: '',
  tags: '',
  notes: '',
};

function toForm(c: OfCustomer): Form {
  return {
    name: c.name,
    trading_name: c.trading_name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    vat_number: c.vat_number ?? '',
    registration_number: c.registration_number ?? '',
    customer_type: (c.customer_type ?? 'other') as CustomerType,
    account_status: (c.account_status ?? 'active') as AccountStatus,
    payment_terms_days: c.payment_terms_days != null ? String(c.payment_terms_days) : '',
    credit_limit: c.credit_limit != null ? String(c.credit_limit) : '',
    billing_address: c.billing_address ?? '',
    tags: (c.tags ?? []).join(', '),
    notes: c.notes ?? '',
  };
}

const IMPORT_FIELDS: CsvField[] = [
  { key: 'name', label: 'Company name', required: true, aliases: ['name', 'customer', 'company', 'business name', 'account'] },
  { key: 'trading_name', label: 'Trading name', aliases: ['trading as', 'dba'] },
  { key: 'email', label: 'Email', aliases: ['e-mail', 'email address'] },
  { key: 'phone', label: 'Phone', aliases: ['telephone', 'tel', 'mobile', 'cell', 'contact number'] },
  { key: 'vat_number', label: 'VAT number', aliases: ['vat', 'vat no', 'tax number', 'tax id'] },
  { key: 'registration_number', label: 'Registration number', aliases: ['reg no', 'registration', 'company reg'] },
  { key: 'billing_address', label: 'Billing address', aliases: ['address', 'bill to', 'billing'] },
  { key: 'payment_terms_days', label: 'Payment terms (days)', type: 'number', aliases: ['terms', 'terms days', 'payment terms'] },
  { key: 'credit_limit', label: 'Credit limit', type: 'number', aliases: ['limit'] },
];

export function CustomersDb({ data }: { data: CoreData }) {
  const customers = data.customers;
  const { org, email } = usePlatform();
  const router = useRouter();
  const { node, show } = useToast();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OfCustomer | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [archiving, setArchiving] = useState<OfCustomer | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (statusFilter !== 'all' && (c.account_status ?? 'active') !== statusFilter) return false;
      if (typeFilter !== 'all' && (c.customer_type ?? 'other') !== typeFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.trading_name ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.vat_number ?? '').toLowerCase().includes(q)
      );
    });
  }, [customers, query, statusFilter, typeFilter]);

  function openAdd() {
    setEditing(null);
    setForm(BLANK);
    setError(null);
    setModalOpen(true);
  }
  function openEdit(c: OfCustomer) {
    setEditing(c);
    setForm(toForm(c));
    setError(null);
    setModalOpen(true);
  }

  async function save() {
    const name = form.name.trim();
    if (!name) {
      setError('Give the customer a company name.');
      return;
    }
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const tags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = {
      org_id: org.id,
      name,
      trading_name: form.trading_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      vat_number: form.vat_number.trim() || null,
      registration_number: form.registration_number.trim() || null,
      customer_type: form.customer_type,
      account_status: form.account_status,
      payment_terms_days: form.payment_terms_days.trim() === '' ? null : Number(form.payment_terms_days),
      credit_limit: form.credit_limit.trim() === '' ? null : Number(form.credit_limit),
      billing_address: form.billing_address.trim() || null,
      tags,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error: err } = editing
      ? await supabase.from('of_customers').update(payload).eq('id', editing.id).select('id').maybeSingle()
      : await supabase.from('of_customers').insert(payload).select('id').maybeSingle();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const customerId = editing?.id ?? (saved as { id: string } | null)?.id ?? null;
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'customer',
      entityId: customerId,
      customerId,
      event: editing ? 'customer_updated' : 'customer_created',
      description: name,
    });
    setModalOpen(false);
    show(editing ? 'Customer updated' : `${name} added`);
    router.refresh();
  }

  async function archive(c: OfCustomer) {
    setArchiving(null);
    const supabase = createClient();
    if (!supabase || !org) {
      show('Not connected.');
      return;
    }
    const { error: err } = await supabase
      .from('of_customers')
      .update({ account_status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', c.id);
    if (err) {
      show(`Couldn't archive: ${err.message}`);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'customer',
      entityId: c.id,
      customerId: c.id,
      event: 'customer_updated',
      description: `Archived ${c.name}`,
    });
    show(`${c.name} archived`);
    router.refresh();
  }

  function exportCsv() {
    downloadCsv(
      'customers',
      [
        'name',
        'trading_name',
        'email',
        'phone',
        'vat_number',
        'registration_number',
        'customer_type',
        'account_status',
        'payment_terms_days',
        'credit_limit',
        'billing_address',
        'tags',
        'notes',
      ],
      customers.map((c) => [
        c.name,
        c.trading_name ?? '',
        c.email ?? '',
        c.phone ?? '',
        c.vat_number ?? '',
        c.registration_number ?? '',
        c.customer_type ?? 'other',
        c.account_status ?? 'active',
        c.payment_terms_days ?? '',
        c.credit_limit ?? '',
        c.billing_address ?? '',
        (c.tags ?? []).join('; '),
        c.notes ?? '',
      ]),
    );
    show(`Exported ${customers.length} customers`);
  }

  async function importRows(records: Record<string, string | number | boolean | null>[]) {
    const supabase = createClient();
    if (!supabase || !org) return { inserted: 0, error: 'Not connected.' };
    const rows = records.map((r) => ({
      org_id: org.id,
      name: String(r.name ?? '').trim(),
      trading_name: r.trading_name != null ? String(r.trading_name).trim() : null,
      email: r.email != null ? String(r.email).trim() : null,
      phone: r.phone != null ? String(r.phone).trim() : null,
      vat_number: r.vat_number != null ? String(r.vat_number).trim() : null,
      registration_number: r.registration_number != null ? String(r.registration_number).trim() : null,
      billing_address: r.billing_address != null ? String(r.billing_address).trim() : null,
      payment_terms_days: typeof r.payment_terms_days === 'number' ? r.payment_terms_days : null,
      credit_limit: typeof r.credit_limit === 'number' ? r.credit_limit : null,
    }));
    const valid = rows.filter((r) => r.name);
    if (valid.length === 0) return { inserted: 0, error: 'No rows had a company name.' };

    // Skip names already on file or repeated within the file — the
    // (org_id, lower(name)) unique index would otherwise reject the whole batch.
    const { data: existingRows } = await supabase.from('of_customers').select('name').eq('org_id', org.id);
    const seen = new Set((existingRows ?? []).map((r) => String((r as { name: string }).name ?? '').trim().toLowerCase()));
    const deduped: typeof valid = [];
    for (const r of valid) {
      const key = r.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(r);
    }
    const skipped = valid.length - deduped.length;
    if (deduped.length === 0) {
      return { inserted: 0, error: `All ${skipped} row${skipped === 1 ? '' : 's'} already exist.` };
    }
    const { error: err } = await supabase.from('of_customers').insert(deduped);
    if (err) {
      return {
        inserted: 0,
        error: isUniqueViolation(err) ? 'Some customer names already exist — remove duplicates and try again.' : err.message,
      };
    }
    show(`Imported ${deduped.length} customers${skipped ? ` (skipped ${skipped} already on file)` : ''}`);
    router.refresh();
    return { inserted: deduped.length };
  }

  return (
    <div className="space-y-4">
      {node}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search customers…" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-9 rounded-lg border border-[#D7DAD8] bg-white px-3 text-[13px] text-[#1A1C1E] focus:border-[#3E7BC4]/50 focus:outline-none"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="h-9 rounded-lg border border-[#D7DAD8] bg-white px-3 text-[13px] text-[#1A1C1E] focus:border-[#3E7BC4]/50 focus:outline-none"
        >
          <option value="all">All types</option>
          {CUSTOMER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/app/docu/databases/import?entity=customers"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#D7DAD8] bg-white px-4 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:bg-[#F0F0EC]"
          >
            Import Excel/CSV
          </Link>
          <SecondaryBtn onClick={() => setImportOpen(true)}>Import CSV</SecondaryBtn>
          <SecondaryBtn onClick={exportCsv} disabled={customers.length === 0}>
            Export CSV
          </SecondaryBtn>
          <PrimaryBtn onClick={openAdd}>+ Add customer</PrimaryBtn>
        </div>
      </div>

      {/* Table */}
      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          body="Add the companies you sell to, or import them from a QuickBooks or Excel export."
          action={<PrimaryBtn onClick={openAdd}>+ Add customer</PrimaryBtn>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matching customers" body="Try a different search or clear the filters." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#E7E7E2] bg-white">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E7E7E2] text-left text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Trading name</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Terms</th>
                <th className="px-4 py-3 font-semibold">VAT no.</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const status = (c.account_status ?? 'active') as AccountStatus;
                const s = ACCOUNT_STATUS_STYLE[status];
                const typeLabel = CUSTOMER_TYPES.find((t) => t.value === (c.customer_type ?? 'other'))?.label ?? '—';
                return (
                  <tr key={c.id} className="border-b border-[#F0F0EC] last:border-0 hover:bg-[#FBFBF9]">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="text-left font-medium text-[#1A1C1E] transition-colors hover:text-[#174C87] hover:underline"
                      >
                        {c.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[#5F6368]">{c.trading_name || '—'}</td>
                    <td className="px-4 py-3 text-[#5F6368]">{typeLabel}</td>
                    <td className="px-4 py-3">
                      <Pill label={s.label} bg={s.bg} fg={s.fg} />
                    </td>
                    <td className="px-4 py-3 text-[#5F6368]">
                      {c.payment_terms_days != null ? `${c.payment_terms_days} days` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#5F6368]">{c.vat_number || '—'}</td>
                    <td className="px-4 py-3 text-[#9A9DA1]">
                      {c.updated_at ? new Date(c.updated_at).toLocaleDateString('en-ZA') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#1F5FA8] transition-colors hover:bg-[#EAF3F0]"
                        >
                          Edit
                        </button>
                        {status !== 'inactive' ? (
                          <button
                            type="button"
                            onClick={() => setArchiving(c)}
                            className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#A32D2D] transition-colors hover:bg-[#F3E7E7]"
                          >
                            Archive
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit customer' : 'Add customer'}
        subtitle={editing ? undefined : 'A company you sell to. All fields flow through to invoices and quotes.'}
        width={640}
        footer={
          <>
            <SecondaryBtn onClick={() => setModalOpen(false)} disabled={busy}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add customer'}
            </PrimaryBtn>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Company name">
              <input
                autoFocus
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (error) setError(null);
                }}
                placeholder="e.g. Turn 'n Slice"
                className={inputClass}
              />
            </Field>
            <Field label="Trading name" hint="(optional)">
              <input
                value={form.trading_name}
                onChange={(e) => setForm({ ...form, trading_name: e.target.value })}
                placeholder="Trading as…"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email">
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="accounts@company.co.za"
                className={inputClass}
              />
            </Field>
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="011 …"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="VAT number" hint="(optional)">
              <input
                value={form.vat_number}
                onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
                placeholder="4XXXXXXXXX"
                className={inputClass}
              />
            </Field>
            <Field label="Registration number" hint="(optional)">
              <input
                value={form.registration_number}
                onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                placeholder="2020/XXXXXX/07"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Customer type">
              <select
                value={form.customer_type}
                onChange={(e) => setForm({ ...form, customer_type: e.target.value as CustomerType })}
                className={inputClass}
              >
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Account status">
              <select
                value={form.account_status}
                onChange={(e) => setForm({ ...form, account_status: e.target.value as AccountStatus })}
                className={inputClass}
              >
                <option value="active">Active</option>
                <option value="on_hold">On hold</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Payment terms (days)" hint="(optional)">
              <input
                type="number"
                min={0}
                value={form.payment_terms_days}
                onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })}
                placeholder="30"
                className={inputClass}
              />
            </Field>
            <Field label="Credit limit" hint="(optional, in rands)">
              <input
                type="number"
                min={0}
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                placeholder="50000"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Billing address" hint="(optional)">
            <textarea
              value={form.billing_address}
              onChange={(e) => setForm({ ...form, billing_address: e.target.value })}
              placeholder="Street, suburb, city, postal code"
              className={`${inputClass} h-16 py-2`}
            />
          </Field>

          <Field label="Tags" hint="(comma-separated)">
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="e.g. key account, weekly"
              className={inputClass}
            />
          </Field>

          <Field label="Notes" hint="(optional)">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={`${inputClass} h-16 py-2`}
            />
          </Field>

          {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>
      </Modal>

      {/* Archive confirmation */}
      <ConfirmDialog
        open={!!archiving}
        title={`Archive ${archiving?.name ?? 'customer'}?`}
        body="This sets the account status to inactive. History and documents are kept — you can reactivate by editing the customer."
        confirmLabel="Archive"
        danger
        onConfirm={() => archiving && void archive(archiving)}
        onClose={() => setArchiving(null)}
      />

      {/* CSV import */}
      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import customers"
        fields={IMPORT_FIELDS}
        existingValues={{ fieldKey: 'name', values: customers.map((c) => c.name) }}
        onImport={importRows}
      />
    </div>
  );
}

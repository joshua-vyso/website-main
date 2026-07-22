'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { useToast } from '@/components/platform/orderflow/ui';
import { downloadCsv, type CsvField } from '@/lib/platform/csv';
import { logActivity } from '@/lib/platform/orderflow-activity';
import type { CoreData } from '@/lib/platform/coredata-data';
import { formatAddress, type CdDeliveryAddress } from '@/lib/platform/coredata';
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
// Delivery addresses — where each customer receives goods (cd_delivery_addresses).
// ---------------------------------------------------------------------------

interface Form {
  customer_id: string;
  nickname: string;
  street: string;
  suburb: string;
  city: string;
  province: string;
  postal_code: string;
  instructions: string;
  is_default: boolean;
}

const BLANK: Form = {
  customer_id: '',
  nickname: '',
  street: '',
  suburb: '',
  city: '',
  province: '',
  postal_code: '',
  instructions: '',
  is_default: false,
};

function toForm(a: CdDeliveryAddress): Form {
  return {
    customer_id: a.customer_id,
    nickname: a.nickname ?? '',
    street: a.street ?? '',
    suburb: a.suburb ?? '',
    city: a.city ?? '',
    province: a.province ?? '',
    postal_code: a.postal_code ?? '',
    instructions: a.instructions ?? '',
    is_default: a.is_default,
  };
}

const IMPORT_FIELDS: CsvField[] = [
  { key: 'customer', label: 'Customer (company name)', required: true, aliases: ['company', 'customer name', 'account', 'business'] },
  { key: 'nickname', label: 'Nickname', aliases: ['label', 'name', 'site'] },
  { key: 'street', label: 'Street', required: true, aliases: ['address', 'street address', 'line 1'] },
  { key: 'suburb', label: 'Suburb', aliases: ['area', 'line 2'] },
  { key: 'city', label: 'City', aliases: ['town'] },
  { key: 'province', label: 'Province', aliases: ['state', 'region'] },
  { key: 'postal_code', label: 'Postal code', aliases: ['zip', 'postcode', 'post code'] },
  { key: 'instructions', label: 'Instructions', aliases: ['delivery instructions', 'notes'] },
];

export function AddressesDb({ data }: { data: CoreData }) {
  const addresses = data.addresses;
  const customers = data.customers;
  const { org, email } = usePlatform();
  const router = useRouter();
  const { node, show } = useToast();

  const customerName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) map.set(c.id, c.name);
    return map;
  }, [customers]);

  const [query, setQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CdDeliveryAddress | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<CdDeliveryAddress | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return addresses.filter((a) => {
      if (customerFilter !== 'all' && a.customer_id !== customerFilter) return false;
      if (!q) return true;
      return (
        (a.nickname ?? '').toLowerCase().includes(q) ||
        formatAddress(a).toLowerCase().includes(q) ||
        (customerName.get(a.customer_id) ?? '').toLowerCase().includes(q)
      );
    });
  }, [addresses, query, customerFilter, customerName]);

  function openAdd() {
    setEditing(null);
    setForm(BLANK);
    setError(null);
    setModalOpen(true);
  }
  function openEdit(a: CdDeliveryAddress) {
    setEditing(a);
    setForm(toForm(a));
    setError(null);
    setModalOpen(true);
  }

  async function save() {
    if (!form.customer_id) {
      setError('Pick which customer this address belongs to.');
      return;
    }
    if (!form.street.trim()) {
      setError('Add at least a street address.');
      return;
    }
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      org_id: org.id,
      customer_id: form.customer_id,
      nickname: form.nickname.trim() || null,
      street: form.street.trim() || null,
      suburb: form.suburb.trim() || null,
      city: form.city.trim() || null,
      province: form.province.trim() || null,
      postal_code: form.postal_code.trim() || null,
      instructions: form.instructions.trim() || null,
      is_default: form.is_default,
    };
    // Only one default per customer.
    if (form.is_default) {
      await supabase
        .from('cd_delivery_addresses')
        .update({ is_default: false })
        .eq('customer_id', form.customer_id)
        .neq('id', editing?.id ?? '00000000-0000-0000-0000-000000000000');
    }
    const { data: saved, error: err } = editing
      ? await supabase.from('cd_delivery_addresses').update(payload).eq('id', editing.id).select('id').maybeSingle()
      : await supabase.from('cd_delivery_addresses').insert(payload).select('id').maybeSingle();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'customer',
      entityId: editing?.id ?? (saved as { id: string } | null)?.id ?? null,
      customerId: form.customer_id,
      event: 'address_added',
      description: `${form.nickname.trim() || formatAddress(payload)}${
        customerName.get(form.customer_id) ? ` @ ${customerName.get(form.customer_id)}` : ''
      }`,
    });
    setModalOpen(false);
    show(editing ? 'Address updated' : 'Address added');
    router.refresh();
  }

  async function remove(a: CdDeliveryAddress) {
    setDeleting(null);
    const supabase = createClient();
    if (!supabase) {
      show('Not connected.');
      return;
    }
    const { error: err } = await supabase.from('cd_delivery_addresses').delete().eq('id', a.id);
    if (err) {
      show(`Couldn't delete: ${err.message}`);
      return;
    }
    show('Address removed');
    router.refresh();
  }

  function exportCsv() {
    downloadCsv(
      'delivery-addresses',
      ['customer', 'nickname', 'street', 'suburb', 'city', 'province', 'postal_code', 'instructions', 'is_default'],
      addresses.map((a) => [
        customerName.get(a.customer_id) ?? '',
        a.nickname ?? '',
        a.street ?? '',
        a.suburb ?? '',
        a.city ?? '',
        a.province ?? '',
        a.postal_code ?? '',
        a.instructions ?? '',
        a.is_default ? 'yes' : 'no',
      ]),
    );
    show(`Exported ${addresses.length} addresses`);
  }

  async function importRows(records: Record<string, string | number | boolean | null>[]) {
    const supabase = createClient();
    if (!supabase || !org) return { inserted: 0, error: 'Not connected.' };
    const byName = new Map<string, string>();
    for (const c of customers) byName.set(c.name.trim().toLowerCase(), c.id);
    const rows: Record<string, unknown>[] = [];
    let unmatched = 0;
    for (const r of records) {
      const street = String(r.street ?? '').trim();
      const companyRaw = String(r.customer ?? '').trim();
      const customerId = byName.get(companyRaw.toLowerCase());
      if (!street) continue;
      if (!customerId) {
        unmatched++;
        continue;
      }
      rows.push({
        org_id: org.id,
        customer_id: customerId,
        nickname: r.nickname != null ? String(r.nickname).trim() : null,
        street,
        suburb: r.suburb != null ? String(r.suburb).trim() : null,
        city: r.city != null ? String(r.city).trim() : null,
        province: r.province != null ? String(r.province).trim() : null,
        postal_code: r.postal_code != null ? String(r.postal_code).trim() : null,
        instructions: r.instructions != null ? String(r.instructions).trim() : null,
        is_default: false,
      });
    }
    if (rows.length === 0) {
      return {
        inserted: 0,
        error:
          unmatched > 0
            ? `No rows imported — ${unmatched} address${unmatched === 1 ? '' : 'es'} didn't match an existing customer name. Add the customers first, then re-import.`
            : 'No valid addresses found (each needs a customer and a street).',
      };
    }
    const { error: err } = await supabase.from('cd_delivery_addresses').insert(rows);
    if (err) return { inserted: 0, error: err.message };
    show(`Imported ${rows.length} addresses${unmatched > 0 ? `, skipped ${unmatched} unmatched` : ''}`);
    router.refresh();
    return {
      inserted: rows.length,
      error:
        unmatched > 0
          ? `Skipped ${unmatched} address${unmatched === 1 ? '' : 'es'} whose customer name didn't match an existing customer.`
          : undefined,
    };
  }

  const noCustomers = customers.length === 0;

  return (
    <div className="space-y-4">
      {node}

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search addresses…" />
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="h-9 max-w-[220px] rounded-lg border border-[#D7DAD8] bg-white px-3 text-[13px] text-[#1A1C1E] focus:border-[#3E7BC4]/50 focus:outline-none"
        >
          <option value="all">All customers</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <SecondaryBtn onClick={() => setImportOpen(true)} disabled={noCustomers}>
            Import CSV
          </SecondaryBtn>
          <SecondaryBtn onClick={exportCsv} disabled={addresses.length === 0}>
            Export CSV
          </SecondaryBtn>
          <PrimaryBtn onClick={openAdd} disabled={noCustomers}>
            + Add address
          </PrimaryBtn>
        </div>
      </div>

      {noCustomers ? (
        <EmptyState
          title="Add a customer first"
          body="Delivery addresses belong to a customer. Create a customer, then add where they receive goods."
        />
      ) : addresses.length === 0 ? (
        <EmptyState
          title="No delivery addresses yet"
          body="Add drop-off points and delivery instructions so orders and delivery notes ship to the right place."
          action={<PrimaryBtn onClick={openAdd}>+ Add address</PrimaryBtn>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matching addresses" body="Try a different search or clear the filters." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#E7E7E2] bg-white">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E7E7E2] text-left text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-4 py-3 font-semibold">Nickname</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Address</th>
                <th className="px-4 py-3 font-semibold">Instructions</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-[#F0F0EC] last:border-0 hover:bg-[#FBFBF9]">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      className="inline-flex items-center gap-2 text-left font-medium text-[#1A1C1E] transition-colors hover:text-[#174C87] hover:underline"
                    >
                      {a.nickname || 'Address'}
                      {a.is_default ? <Pill label="Default" bg="#E1F5EE" fg="#0F6E56" /> : null}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-[#5F6368]">{customerName.get(a.customer_id) ?? '—'}</td>
                  <td className="px-4 py-3 text-[#5F6368]">{formatAddress(a) || '—'}</td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-[#9A9DA1]">{a.instructions || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(a)}
                        className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#1F5FA8] transition-colors hover:bg-[#EAF3F0]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(a)}
                        className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#A32D2D] transition-colors hover:bg-[#F3E7E7]"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit address' : 'Add delivery address'}
        subtitle={editing ? undefined : 'Where a customer receives goods.'}
        width={560}
        footer={
          <>
            <SecondaryBtn onClick={() => setModalOpen(false)} disabled={busy}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add address'}
            </PrimaryBtn>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Customer">
            <select
              value={form.customer_id}
              onChange={(e) => {
                setForm({ ...form, customer_id: e.target.value });
                if (error) setError(null);
              }}
              className={inputClass}
            >
              <option value="">— Select a customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nickname" hint="(optional, e.g. Main store)">
            <input
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              placeholder="Main store"
              className={inputClass}
            />
          </Field>

          <Field label="Street">
            <input
              value={form.street}
              onChange={(e) => {
                setForm({ ...form, street: e.target.value });
                if (error) setError(null);
              }}
              placeholder="12 Market Street"
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Suburb" hint="(optional)">
              <input
                value={form.suburb}
                onChange={(e) => setForm({ ...form, suburb: e.target.value })}
                placeholder="Newtown"
                className={inputClass}
              />
            </Field>
            <Field label="City" hint="(optional)">
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Johannesburg"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Province" hint="(optional)">
              <input
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                placeholder="Gauteng"
                className={inputClass}
              />
            </Field>
            <Field label="Postal code" hint="(optional)">
              <input
                value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                placeholder="2001"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Delivery instructions" hint="(optional)">
            <textarea
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="Deliver to the back gate, ask for receiving."
              className={`${inputClass} h-16 py-2`}
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#E7E7E2] bg-[#FBFBF9] px-3 py-2.5">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              className="h-4 w-4 accent-[#3E7BC4]"
            />
            <span className="text-[13px] text-[#1A1C1E]">
              Default delivery address
              <span className="ml-1.5 text-[12px] text-[#9A9DA1]">— pre-filled on new orders</span>
            </span>
          </label>

          {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this address?"
        body="This permanently removes the delivery address. It won't affect existing documents."
        confirmLabel="Delete"
        danger
        onConfirm={() => deleting && void remove(deleting)}
        onClose={() => setDeleting(null)}
      />

      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import delivery addresses"
        fields={IMPORT_FIELDS}
        onImport={importRows}
      />
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { useToast } from '@/components/platform/orderflow/ui';
import { downloadCsv, type CsvField } from '@/lib/platform/csv';
import { logActivity } from '@/lib/platform/orderflow-activity';
import type { CoreData } from '@/lib/platform/coredata-data';
import type { CdContact } from '@/lib/platform/coredata';
import type { OfCustomer } from '@/lib/platform/orderflow';
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
// Contacts — people at each customer (cd_contacts).
// ---------------------------------------------------------------------------

interface Form {
  customer_id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  whatsapp: string;
  is_primary: boolean;
}

const BLANK: Form = {
  customer_id: '',
  name: '',
  role: '',
  email: '',
  phone: '',
  whatsapp: '',
  is_primary: false,
};

function toForm(c: CdContact): Form {
  return {
    customer_id: c.customer_id,
    name: c.name,
    role: c.role ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    whatsapp: c.whatsapp ?? '',
    is_primary: c.is_primary,
  };
}

const IMPORT_FIELDS: CsvField[] = [
  { key: 'customer', label: 'Customer (company name)', required: true, aliases: ['company', 'customer name', 'account', 'business'] },
  { key: 'name', label: 'Contact name', required: true, aliases: ['name', 'contact', 'full name', 'person'] },
  { key: 'role', label: 'Role', aliases: ['title', 'position', 'job title'] },
  { key: 'email', label: 'Email', aliases: ['e-mail', 'email address'] },
  { key: 'phone', label: 'Phone', aliases: ['telephone', 'tel', 'mobile', 'cell'] },
  { key: 'whatsapp', label: 'WhatsApp', aliases: ['whatsapp number', 'wa'] },
];

export function ContactsDb({ data }: { data: CoreData }) {
  const contacts = data.contacts;
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
  const [editing, setEditing] = useState<CdContact | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<CdContact | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (customerFilter !== 'all' && c.customer_id !== customerFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.role ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (customerName.get(c.customer_id) ?? '').toLowerCase().includes(q)
      );
    });
  }, [contacts, query, customerFilter, customerName]);

  function openAdd() {
    setEditing(null);
    setForm(BLANK);
    setError(null);
    setModalOpen(true);
  }
  function openEdit(c: CdContact) {
    setEditing(c);
    setForm(toForm(c));
    setError(null);
    setModalOpen(true);
  }

  async function save() {
    const name = form.name.trim();
    if (!name) {
      setError('Give the contact a name.');
      return;
    }
    if (!form.customer_id) {
      setError('Pick which customer this contact works for.');
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
      name,
      role: form.role.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      is_primary: form.is_primary,
    };
    // Only one primary per customer — demote the others when this one is primary.
    if (form.is_primary) {
      const { error: demoteErr } = await supabase
        .from('cd_contacts')
        .update({ is_primary: false })
        .eq('org_id', org.id)
        .eq('customer_id', form.customer_id)
        .neq('id', editing?.id ?? '00000000-0000-0000-0000-000000000000');
      if (demoteErr) {
        setBusy(false);
        setError(demoteErr.message);
        return;
      }
    }
    const { data: saved, error: err } = editing
      ? await supabase.from('cd_contacts').update(payload).eq('id', editing.id).select('id').maybeSingle()
      : await supabase.from('cd_contacts').insert(payload).select('id').maybeSingle();
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
      event: 'contact_added',
      description: `${name}${customerName.get(form.customer_id) ? ` @ ${customerName.get(form.customer_id)}` : ''}`,
    });
    setModalOpen(false);
    show(editing ? 'Contact updated' : `${name} added`);
    router.refresh();
  }

  async function remove(c: CdContact) {
    setDeleting(null);
    const supabase = createClient();
    if (!supabase) {
      show('Not connected.');
      return;
    }
    const { error: err } = await supabase.from('cd_contacts').delete().eq('id', c.id);
    if (err) {
      show(`Couldn't delete: ${err.message}`);
      return;
    }
    show(`${c.name} removed`);
    router.refresh();
  }

  function exportCsv() {
    downloadCsv(
      'contacts',
      ['customer', 'name', 'role', 'email', 'phone', 'whatsapp', 'is_primary'],
      contacts.map((c) => [
        customerName.get(c.customer_id) ?? '',
        c.name,
        c.role ?? '',
        c.email ?? '',
        c.phone ?? '',
        c.whatsapp ?? '',
        c.is_primary ? 'yes' : 'no',
      ]),
    );
    show(`Exported ${contacts.length} contacts`);
  }

  async function importRows(records: Record<string, string | number | boolean | null>[]) {
    const supabase = createClient();
    if (!supabase || !org) return { inserted: 0, error: 'Not connected.' };
    // Match the "customer" column to an existing customer by name (case-insensitive).
    const byName = new Map<string, string>();
    for (const c of customers) byName.set(c.name.trim().toLowerCase(), c.id);
    const rows: Record<string, unknown>[] = [];
    let unmatched = 0;
    for (const r of records) {
      const name = String(r.name ?? '').trim();
      const companyRaw = String(r.customer ?? '').trim();
      const customerId = byName.get(companyRaw.toLowerCase());
      if (!name) continue;
      if (!customerId) {
        unmatched++;
        continue;
      }
      rows.push({
        org_id: org.id,
        customer_id: customerId,
        name,
        role: r.role != null ? String(r.role).trim() : null,
        email: r.email != null ? String(r.email).trim() : null,
        phone: r.phone != null ? String(r.phone).trim() : null,
        whatsapp: r.whatsapp != null ? String(r.whatsapp).trim() : null,
        is_primary: false,
      });
    }
    if (rows.length === 0) {
      return {
        inserted: 0,
        error:
          unmatched > 0
            ? `No rows imported — ${unmatched} contact${unmatched === 1 ? '' : 's'} didn't match an existing customer name. Add the customers first, then re-import.`
            : 'No valid contacts found.',
      };
    }
    const { error: err } = await supabase.from('cd_contacts').insert(rows);
    if (err) return { inserted: 0, error: err.message };
    show(`Imported ${rows.length} contacts${unmatched > 0 ? `, skipped ${unmatched} unmatched` : ''}`);
    router.refresh();
    return {
      inserted: rows.length,
      error:
        unmatched > 0
          ? `Skipped ${unmatched} contact${unmatched === 1 ? '' : 's'} whose customer name didn't match an existing customer.`
          : undefined,
    };
  }

  const noCustomers = customers.length === 0;

  return (
    <div className="space-y-4">
      {node}

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search contacts…" />
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="h-9 max-w-[220px] rounded-lg border border-[#D7DAD8] bg-white px-3 text-[13px] text-[#1A1C1E] focus:border-[#1E5E54]/50 focus:outline-none"
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
          <SecondaryBtn onClick={exportCsv} disabled={contacts.length === 0}>
            Export CSV
          </SecondaryBtn>
          <PrimaryBtn onClick={openAdd} disabled={noCustomers}>
            + Add contact
          </PrimaryBtn>
        </div>
      </div>

      {noCustomers ? (
        <EmptyState
          title="Add a customer first"
          body="Contacts belong to a customer. Create a customer, then come back to add the people you deal with."
        />
      ) : contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          body="Add buyers, accounts staff and WhatsApp numbers so the right person is on every document."
          action={<PrimaryBtn onClick={openAdd}>+ Add contact</PrimaryBtn>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matching contacts" body="Try a different search or clear the filters." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#E7E7E2] bg-white">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E7E7E2] text-left text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">WhatsApp</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-[#F0F0EC] last:border-0 hover:bg-[#FBFBF9]">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="inline-flex items-center gap-2 text-left font-medium text-[#1A1C1E] transition-colors hover:text-[#1E5E54] hover:underline"
                    >
                      {c.name}
                      {c.is_primary ? <Pill label="Primary" bg="#E1F5EE" fg="#0F6E56" /> : null}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-[#5F6368]">{customerName.get(c.customer_id) ?? '—'}</td>
                  <td className="px-4 py-3 text-[#5F6368]">{c.role || '—'}</td>
                  <td className="px-4 py-3 text-[#5F6368]">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-[#5F6368]">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-[#5F6368]">{c.whatsapp || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#1E5E54] transition-colors hover:bg-[#EAF3F0]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(c)}
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
        title={editing ? 'Edit contact' : 'Add contact'}
        subtitle={editing ? undefined : 'A person at one of your customers.'}
        width={560}
        footer={
          <>
            <SecondaryBtn onClick={() => setModalOpen(false)} disabled={busy}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add contact'}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Contact name">
              <input
                autoFocus
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (error) setError(null);
                }}
                placeholder="e.g. Sipho Dlamini"
                className={inputClass}
              />
            </Field>
            <Field label="Role" hint="(optional)">
              <input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="e.g. Buyer"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email">
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@company.co.za"
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

          <Field label="WhatsApp" hint="(optional)">
            <input
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="082 …"
              className={inputClass}
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#E7E7E2] bg-[#FBFBF9] px-3 py-2.5">
            <input
              type="checkbox"
              checked={form.is_primary}
              onChange={(e) => setForm({ ...form, is_primary: e.target.checked })}
              className="h-4 w-4 accent-[#1E5E54]"
            />
            <span className="text-[13px] text-[#1A1C1E]">
              Primary contact
              <span className="ml-1.5 text-[12px] text-[#9A9DA1]">— the main person for this customer</span>
            </span>
          </label>

          {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name ?? 'contact'}?`}
        body="This permanently removes the contact. It won't affect existing documents."
        confirmLabel="Delete"
        danger
        onConfirm={() => deleting && void remove(deleting)}
        onClose={() => setDeleting(null)}
      />

      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import contacts"
        fields={IMPORT_FIELDS}
        existingValues={{ fieldKey: 'name', values: contacts.map((c) => c.name) }}
        onImport={importRows}
      />
    </div>
  );
}

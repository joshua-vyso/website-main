'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { useToast, RowActionsMenu } from '@/components/platform/orderflow/ui';
import { DataTable, Kpi } from '@/components/platform/module-ui';
import type { SdCustomer } from '@/lib/platform/serviceden';
import { useServiceDen } from './context';
import { Modal, Field, ModalButtons, SdPrimary, inputClass } from './ui';

const BLANK = { name: '', company: '', email: '', phone: '', address: '', notes: '' };

export function CustomersView() {
  const { customers } = useServiceDen();
  const { org } = usePlatform();
  const router = useRouter();
  const { node, show } = useToast();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SdCustomer | null>(null);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setForm(BLANK);
    setError(null);
    setOpen(true);
  }
  function openEdit(c: SdCustomer) {
    setEditing(c);
    setForm({ name: c.name, company: c.company ?? '', email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '', notes: c.notes ?? '' });
    setError(null);
    setOpen(true);
  }

  async function save() {
    const name = form.name.trim();
    if (!name) { setError('Give the customer a name.'); return; }
    const supabase = createClient();
    if (!supabase || !org) { setError('Not connected.'); return; }
    setBusy(true);
    setError(null);
    const payload = {
      org_id: org.id,
      name,
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error: err } = editing
      ? await supabase.from('sd_customers').update(payload).eq('id', editing.id)
      : await supabase.from('sd_customers').insert(payload);
    setBusy(false);
    if (err) { setError(err.message); return; }
    setOpen(false);
    show(editing ? 'Customer updated' : `${name} added`);
    router.refresh();
  }

  async function remove(c: SdCustomer) {
    const supabase = createClient();
    if (!supabase) return;
    show(`Removed ${c.name}`);
    const { error: err } = await supabase.from('sd_customers').delete().eq('id', c.id);
    if (err) { show(`Couldn't remove: ${err.message}`); return; }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="Customers" value={String(customers.length)} />
          <Kpi label="With email" value={String(customers.filter((c) => c.email).length)} accent="#1F5FA8" sub="reachable" />
        </div>
        <SdPrimary onClick={openAdd}>+ Add customer</SdPrimary>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8DFE8] bg-white px-6 py-12 text-center">
          <p className="of-display text-[18px] font-semibold text-[#171A17]">No customers yet</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[#6B6F68]">Add the people and businesses you invoice — you&rsquo;ll pick them when creating an invoice.</p>
        </div>
      ) : (
        <DataTable
          columns={[{ label: 'Name' }, { label: 'Company' }, { label: 'Email' }, { label: 'Phone' }, { label: '', align: 'right' }]}
          rows={customers.map((c) => [
            <button key="n" type="button" onClick={() => openEdit(c)} className="text-left font-semibold text-[#171A17] transition-colors hover:text-[#1F5FA8] hover:underline">{c.name}</button>,
            c.company ?? '—',
            c.email ?? '—',
            <span key="p" className="of-num">{c.phone ?? '—'}</span>,
            <RowActionsMenu key="a" actions={[{ label: 'Edit', onClick: () => openEdit(c) }, { label: 'Delete', onClick: () => void remove(c), danger: true }]} />,
          ])}
          empty="No customers."
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit customer' : 'Add customer'}
        subtitle={editing ? undefined : 'Someone you invoice for services.'}
        busy={busy}
        footer={<ModalButtons onCancel={() => setOpen(false)} onSave={save} busy={busy} saveLabel={editing ? 'Save changes' : 'Add customer'} />}
      >
        <Field label="Name">
          <input autoFocus value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); if (error) setError(null); }} placeholder="e.g. Sarah Ndlovu" className={inputClass} />
        </Field>
        <Field label="Company" hint="(optional)">
          <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="e.g. Bright Interiors" className={inputClass} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.co.za" className={inputClass} /></Field>
          <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="082 …" className={inputClass} /></Field>
        </div>
        <Field label="Address" hint="(optional)">
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Billing address" className={inputClass} />
        </Field>
        <Field label="Notes" hint="(optional)">
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${inputClass} h-20 py-2`} />
        </Field>
        {error ? <p className="text-[13px] text-[#A32D2D]">{error}</p> : null}
      </Modal>
    </div>
  );
}

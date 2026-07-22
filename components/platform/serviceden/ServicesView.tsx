'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { useToast, RowActionsMenu } from '@/components/platform/orderflow/ui';
import { DataTable, Kpi, Badge } from '@/components/platform/module-ui';
import { SERVICE_UNITS, unitLabel, type SdService, type SdServiceUnit } from '@/lib/platform/serviceden';
import { useServiceDen } from './context';
import { Modal, Field, ModalButtons, SdPrimary, inputClass, zar } from './ui';

const BLANK = { name: '', description: '', unit: 'fixed' as SdServiceUnit, unitPrice: '', active: true };

export function ServicesView() {
  const { services } = useServiceDen();
  const { org } = usePlatform();
  const router = useRouter();
  const { node, show } = useToast();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SdService | null>(null);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setForm(BLANK);
    setError(null);
    setOpen(true);
  }
  function openEdit(s: SdService) {
    setEditing(s);
    setForm({ name: s.name, description: s.description ?? '', unit: s.unit, unitPrice: String(s.unitPrice), active: s.active });
    setError(null);
    setOpen(true);
  }

  async function save() {
    const name = form.name.trim();
    if (!name) { setError('Give the service a name.'); return; }
    if (!(Number(form.unitPrice) >= 0) || form.unitPrice.trim() === '') { setError('Set a price (0 or more).'); return; }
    const supabase = createClient();
    if (!supabase || !org) { setError('Not connected.'); return; }
    setBusy(true);
    setError(null);
    const payload = {
      org_id: org.id,
      name,
      description: form.description.trim() || null,
      unit: form.unit,
      unit_price: Number(form.unitPrice) || 0,
      active: form.active,
      sort_order: editing ? undefined : services.length,
    };
    const { error: err } = editing
      ? await supabase.from('sd_services').update(payload).eq('id', editing.id)
      : await supabase.from('sd_services').insert(payload);
    setBusy(false);
    if (err) { setError(err.message); return; }
    setOpen(false);
    show(editing ? 'Service updated' : `${name} added`);
    router.refresh();
  }

  async function remove(s: SdService) {
    const supabase = createClient();
    if (!supabase) return;
    show(`Removed ${s.name}`);
    const { error: err } = await supabase.from('sd_services').delete().eq('id', s.id);
    if (err) { show(`Couldn't remove: ${err.message}`); return; }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="Services" value={String(services.length)} />
          <Kpi label="Active" value={String(services.filter((s) => s.active).length)} accent="#0F6E56" sub="on the price book" />
        </div>
        <SdPrimary onClick={openAdd}>+ Add service</SdPrimary>
      </div>

      {services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8DFE8] bg-white px-6 py-12 text-center">
          <p className="of-display text-[18px] font-semibold text-[#171A17]">No services yet</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[#6B6F68]">Add the services you offer and their prices. You&rsquo;ll pick from these when building an invoice.</p>
        </div>
      ) : (
        <DataTable
          columns={[{ label: 'Service' }, { label: 'Billing' }, { label: 'Price', align: 'right' }, { label: 'Status' }, { label: '', align: 'right' }]}
          rows={services.map((s) => [
            <div key="n">
              <button type="button" onClick={() => openEdit(s)} className="text-left font-semibold text-[#171A17] transition-colors hover:text-[#1F5FA8] hover:underline">{s.name}</button>
              {s.description ? <div className="mt-0.5 text-[12px] font-normal text-[#A0A49C]">{s.description}</div> : null}
            </div>,
            unitLabel(s.unit),
            zar(s.unitPrice),
            <Badge key="st" label={s.active ? 'Active' : 'Inactive'} tone={s.active ? 'positive' : 'neutral'} />,
            <RowActionsMenu key="a" actions={[{ label: 'Edit', onClick: () => openEdit(s) }, { label: 'Delete', onClick: () => void remove(s), danger: true }]} />,
          ])}
          empty="No services."
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit service' : 'Add service'}
        subtitle={editing ? undefined : 'A service you offer, with its price.'}
        busy={busy}
        footer={<ModalButtons onCancel={() => setOpen(false)} onSave={save} busy={busy} saveLabel={editing ? 'Save changes' : 'Add service'} />}
      >
        <Field label="Name">
          <input autoFocus value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); if (error) setError(null); }} placeholder="e.g. Website design" className={inputClass} />
        </Field>
        <Field label="Description" hint="(optional)">
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's included" className={inputClass} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Billing">
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as SdServiceUnit })} className={inputClass}>
              {SERVICE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </Field>
          <Field label="Price (R)">
            <input value={form.unitPrice} onChange={(e) => { setForm({ ...form, unitPrice: e.target.value }); if (error) setError(null); }} inputMode="decimal" placeholder="0.00" className={inputClass} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-[#171A17]">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-[#1F5FA8]" />
          Active (available to add to invoices)
        </label>
        {error ? <p className="text-[13px] text-[#A32D2D]">{error}</p> : null}
      </Modal>
    </div>
  );
}

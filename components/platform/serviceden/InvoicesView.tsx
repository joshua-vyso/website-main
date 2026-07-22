'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { useToast, Drawer, RowActionsMenu, type RowAction } from '@/components/platform/orderflow/ui';
import { DataTable, Kpi, Badge } from '@/components/platform/module-ui';
import {
  INVOICE_STATUS_META,
  invoiceSubtotal,
  invoiceTax,
  invoiceTotal,
  lineAmount,
  nextInvoiceNumber,
  type SdInvoice,
} from '@/lib/platform/serviceden';
import { useServiceDen } from './context';
import { Field, SdPrimary, inputClass, zar } from './ui';

interface DraftLine {
  key: string;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

let lineSeq = 0;
const newKey = () => `l${lineSeq++}`;

export function InvoicesView() {
  const { invoices, customers, services, customerById } = useServiceDen();
  const router = useRouter();
  const { node, show } = useToast();
  const [building, setBuilding] = useState(false);

  const totals = useMemo(() => {
    const outstanding = invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + invoiceTotal(i.items, i.taxRate), 0);
    const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + invoiceTotal(i.items, i.taxRate), 0);
    return { outstanding, paid };
  }, [invoices]);

  async function setStatus(inv: SdInvoice, status: SdInvoice['status']) {
    const supabase = createClient();
    if (!supabase) return;
    show(status === 'sent' ? 'Marked as sent' : status === 'paid' ? 'Marked as paid' : 'Moved to draft');
    const { error } = await supabase.from('sd_invoices').update({ status }).eq('id', inv.id);
    if (error) { show(`Couldn't update: ${error.message}`); return; }
    router.refresh();
  }
  async function remove(inv: SdInvoice) {
    const supabase = createClient();
    if (!supabase) return;
    show(`Deleted ${inv.invoiceNumber}`);
    const { error } = await supabase.from('sd_invoices').delete().eq('id', inv.id);
    if (error) { show(`Couldn't delete: ${error.message}`); return; }
    router.refresh();
  }

  const canBuild = customers.length > 0 && services.length > 0;

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="Invoices" value={String(invoices.length)} />
          <Kpi label="Outstanding" value={zar(totals.outstanding)} accent="#854F0B" sub="not paid" />
          <Kpi label="Paid" value={zar(totals.paid)} accent="#0F6E56" />
        </div>
        <SdPrimary onClick={() => setBuilding(true)} disabled={!canBuild}>+ New invoice</SdPrimary>
      </div>

      {!canBuild ? (
        <div className="rounded-2xl border border-dashed border-[#D8DFE8] bg-white px-6 py-12 text-center">
          <p className="of-display text-[18px] font-semibold text-[#171A17]">Add a customer and a service first</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[#6B6F68]">Invoices are built from your customers and the services on your price book — add at least one of each, then create an invoice here.</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8DFE8] bg-white px-6 py-12 text-center">
          <p className="of-display text-[18px] font-semibold text-[#171A17]">No invoices yet</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[#6B6F68]">Create an invoice, pick the services on it, and export it to PDF.</p>
        </div>
      ) : (
        <DataTable
          columns={[{ label: 'Invoice' }, { label: 'Customer' }, { label: 'Issued' }, { label: 'Status' }, { label: 'Total', align: 'right' }, { label: '', align: 'right' }]}
          rows={invoices.map((inv) => {
            const m = INVOICE_STATUS_META[inv.status];
            const actions: RowAction[] = [{ label: 'View / export', onClick: () => router.push(`/app/serviceden/invoices/${inv.id}`) }];
            if (inv.status === 'draft') actions.push({ label: 'Mark sent', onClick: () => void setStatus(inv, 'sent') });
            if (inv.status !== 'paid') actions.push({ label: 'Mark paid', onClick: () => void setStatus(inv, 'paid') });
            else actions.push({ label: 'Move to draft', onClick: () => void setStatus(inv, 'draft') });
            actions.push({ label: 'Delete', onClick: () => void remove(inv), danger: true });
            return [
              <Link key="n" href={`/app/serviceden/invoices/${inv.id}`} className="of-num font-semibold text-[#171A17] transition-colors hover:text-[#1F5FA8] hover:underline">{inv.invoiceNumber}</Link>,
              customerById(inv.customerId)?.name ?? '—',
              <span key="d" className="of-num text-[#6B6F68]">{inv.issueDate}</span>,
              <Badge key="st" label={m.label} tone={m.tone} />,
              zar(invoiceTotal(inv.items, inv.taxRate)),
              <RowActionsMenu key="a" actions={actions} />,
            ];
          })}
          empty="No invoices."
        />
      )}

      {building ? (
        <InvoiceBuilder show={show} onClose={() => setBuilding(false)} onCreated={(id) => { setBuilding(false); router.refresh(); router.push(`/app/serviceden/invoices/${id}`); }} />
      ) : null}
    </div>
  );
}

function InvoiceBuilder({ show, onClose, onCreated }: { show: (m: string) => void; onClose: () => void; onCreated: (id: string) => void }) {
  const { invoices, customers, services } = useServiceDen();
  const { org } = usePlatform();

  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState(nextInvoiceNumber(invoices));
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [taxRate, setTaxRate] = useState('15');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeServices = services.filter((s) => s.active);
  const rate = Number(taxRate) || 0;
  const sub = invoiceSubtotal(lines);
  const vat = invoiceTax(sub, rate);
  const total = sub + vat;

  function addService(serviceId: string) {
    const s = services.find((x) => x.id === serviceId);
    if (!s) return;
    setLines((prev) => [...prev, { key: newKey(), serviceId: s.id, description: s.name, quantity: 1, unitPrice: s.unitPrice }]);
  }
  function addCustom() {
    setLines((prev) => [...prev, { key: newKey(), serviceId: null, description: '', quantity: 1, unitPrice: 0 }]);
  }
  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function create() {
    if (lines.length === 0) { setError('Add at least one service or line.'); return; }
    if (lines.some((l) => !l.description.trim())) { setError('Every line needs a description.'); return; }
    const supabase = createClient();
    if (!supabase || !org) { setError('Not connected.'); return; }
    setBusy(true);
    setError(null);
    const { data: invRow, error: invErr } = await supabase
      .from('sd_invoices')
      .insert({
        org_id: org.id,
        customer_id: customerId || null,
        invoice_number: invoiceNumber.trim() || nextInvoiceNumber(invoices),
        status: 'draft',
        issue_date: issueDate,
        due_date: dueDate || null,
        tax_rate: rate,
        notes: notes.trim() || null,
      })
      .select('id')
      .single();
    if (invErr || !invRow) { setBusy(false); setError(invErr?.message ?? 'Could not create the invoice.'); return; }
    const { error: itemErr } = await supabase.from('sd_invoice_items').insert(
      lines.map((l, i) => ({
        org_id: org.id,
        invoice_id: invRow.id,
        service_id: l.serviceId,
        description: l.description.trim(),
        quantity: l.quantity || 0,
        unit_price: l.unitPrice || 0,
        sort_order: i,
      })),
    );
    setBusy(false);
    if (itemErr) { setError(itemErr.message); return; }
    show(`${invoiceNumber} created`);
    onCreated(invRow.id);
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="New invoice"
      subtitle="Pick the services on this invoice, then export it to PDF."
      width={720}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[#6B6F68]">Total <span className="of-num text-[16px] font-semibold tracking-[-0.02em] text-[#171A17]">{zar(total)}</span></span>
          <div className="flex items-center gap-2.5">
            {error ? <span className="text-[13px] text-[#A32D2D]">{error}</span> : null}
            <button type="button" onClick={onClose} disabled={busy} className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-50">Cancel</button>
            <button type="button" onClick={create} disabled={busy} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-50">{busy ? 'Creating…' : 'Create & view'}</button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Customer">
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass}>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
            </select>
          </Field>
          <Field label="Invoice number">
            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Issue date"><input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} /></Field>
          <Field label="Due date" hint="(optional)"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} /></Field>
        </div>

        <div>
          <div className="mb-2 text-[13px] font-medium text-[#3E4A57]">Add services</div>
          <div className="flex flex-wrap gap-2">
            {activeServices.map((s) => (
              <button key={s.id} type="button" onClick={() => addService(s.id)} className="inline-flex items-center gap-1.5 rounded-[11px] border border-[#E2E6EC] bg-white px-3.5 py-2 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">
                <span className="text-[#1F5FA8]">+</span>{s.name} <span className="of-num text-[#A0A49C]">{zar(s.unitPrice)}</span>
              </button>
            ))}
            <button type="button" onClick={addCustom} className="inline-flex items-center gap-1.5 rounded-[11px] border border-dashed border-[#D8DFE8] bg-white px-3.5 py-2 text-[13px] font-medium text-[#6B6F68] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">+ Custom line</button>
          </div>
        </div>

        {lines.length > 0 ? (
          <div className="overflow-x-auto rounded-[14px] border border-[#EAEDF2]">
            <table className="w-full min-w-[440px] text-[14px]">
              <thead>
                <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                  <th className="px-3 py-2 text-left font-medium">Description</th>
                  <th className="w-[70px] px-2 py-2 text-right font-medium">Qty</th>
                  <th className="w-[110px] px-2 py-2 text-right font-medium">Unit price</th>
                  <th className="w-[110px] px-3 py-2 text-right font-medium">Amount</th>
                  <th className="w-[40px] px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key} className="border-b border-[#F4F5F7] last:border-0">
                    <td className="px-3 py-2"><input value={l.description} onChange={(e) => updateLine(l.key, { description: e.target.value })} placeholder="Description" className="h-9 w-full rounded-[9px] border border-transparent bg-transparent px-1.5 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]" /></td>
                    <td className="px-2 py-2"><input value={String(l.quantity)} onChange={(e) => updateLine(l.key, { quantity: Number(e.target.value) || 0 })} inputMode="decimal" className="of-num h-9 w-full rounded-[9px] border border-[#E4E9F0] px-1.5 text-right text-[14px] text-[#171A17] outline-none focus:border-[#3E7BC4]" /></td>
                    <td className="px-2 py-2"><input value={String(l.unitPrice)} onChange={(e) => updateLine(l.key, { unitPrice: Number(e.target.value) || 0 })} inputMode="decimal" className="of-num h-9 w-full rounded-[9px] border border-[#E4E9F0] px-1.5 text-right text-[14px] text-[#171A17] outline-none focus:border-[#3E7BC4]" /></td>
                    <td className="of-num px-3 py-2 text-right font-semibold text-[#171A17]">{zar(lineAmount(l))}</td>
                    <td className="px-2 py-2 text-right"><button type="button" onClick={() => removeLine(l.key)} aria-label="Remove line" className="text-[#A0A49C] transition-colors hover:text-[#A32D2D]">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-[14px] border border-dashed border-[#D8DFE8] bg-white px-4 py-6 text-center text-[13px] text-[#A0A49C]">Click a service above to add it to the invoice.</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Notes" hint="(optional)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, thank-you note…" className={`${inputClass} h-24 py-2`} />
          </Field>
          <div className="space-y-2 rounded-[14px] border border-[#EEF1F5] bg-white p-4 text-[13px]">
            <div className="flex items-center justify-between"><span className="text-[#6B6F68]">Subtotal</span><span className="of-num text-[14px] text-[#171A17]">{zar(sub)}</span></div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[#6B6F68]">VAT
                <input value={taxRate} onChange={(e) => setTaxRate(e.target.value)} inputMode="decimal" className="of-num h-8 w-14 rounded-[9px] border border-[#E4E9F0] px-1.5 text-right text-[13px] outline-none focus:border-[#3E7BC4]" />%
              </span>
              <span className="of-num text-[14px] text-[#171A17]">{zar(vat)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[#EEF1F5] pt-2.5"><span className="text-[14px] font-semibold text-[#171A17]">Total</span><span className="of-num text-[22px] font-semibold tracking-[-0.02em] text-[#171A17]">{zar(total)}</span></div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

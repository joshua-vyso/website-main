'use client';

/**
 * Delivery notes list — table + search + status filter, plus a "New delivery
 * note" modal that builds a note from an existing order OR invoice: the user
 * picks a source, its line items and delivery address are fetched client-side
 * and mapped into a new of_delivery_notes row via builder.createDeliveryNote.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { createDeliveryNote } from '@/components/platform/orderflow/builder';
import { useToast } from '@/components/platform/orderflow/ui';
import {
  EmptyState,
  Modal,
  Pill,
  PrimaryBtn,
  SearchInput,
  SecondaryBtn,
} from '@/components/platform/coredata/ui';
import type { DeliveryNotesData } from '@/lib/platform/orderflow-data';
import {
  DELIVERY_NOTE_STATUS_STYLE,
  type DeliveryNoteStatus,
  type OfCustomer,
  type OfDeliveryNote,
  type OfInvoice,
  type OfOrder,
} from '@/lib/platform/orderflow';

const STATUS_FILTERS: { value: 'all' | DeliveryNoteStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
];

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function DeliveryNotesView({ data }: { data: DeliveryNotesData }) {
  const { deliveryNotes, customers, orders, invoices } = data;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | DeliveryNoteStatus>('all');
  const [creating, setCreating] = useState(false);

  const custName = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const orderNo = useMemo(
    () => new Map(orders.map((o) => [o.id, o.order_number || 'Order'])),
    [orders],
  );
  const invoiceNo = useMemo(
    () => new Map(invoices.map((i) => [i.id, i.invoice_number])),
    [invoices],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deliveryNotes.filter((dn) => {
      if (status !== 'all' && dn.status !== status) return false;
      if (!q) return true;
      const name = (dn.customer_id && custName.get(dn.customer_id)) || '';
      const src =
        (dn.order_id && orderNo.get(dn.order_id)) ||
        (dn.invoice_id && invoiceNo.get(dn.invoice_id)) ||
        '';
      return (
        dn.dn_number.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        String(src).toLowerCase().includes(q)
      );
    });
  }, [deliveryNotes, status, query, custName, orderNo, invoiceNo]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1C1E]">Delivery notes</h1>
          <p className="mt-0.5 text-[13px] text-[#5F6368]">
            Picking slips and proof-of-delivery for orders and invoices.
          </p>
        </div>
        <PrimaryBtn onClick={() => setCreating(true)}>+ New delivery note</PrimaryBtn>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search notes, customer, source…" />
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              className={`h-8 rounded-lg border px-3 text-[12px] font-medium transition-colors ${
                status === f.value
                  ? 'border-[#1E5E54] bg-[#1E5E54] text-white'
                  : 'border-[#D7DAD8] bg-white text-[#5F6368] hover:border-[#1E5E54]/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {deliveryNotes.length === 0 ? (
          <EmptyState
            title="No delivery notes yet"
            body="Create a delivery note from an order or invoice to pick, dispatch and capture proof of delivery."
            action={<PrimaryBtn onClick={() => setCreating(true)}>+ New delivery note</PrimaryBtn>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matching delivery notes" body="Try a different search or status filter." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E7E7E2] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                  <th className="px-4 py-3 text-left font-medium">Number</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Source</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Delivered</th>
                  <th className="px-4 py-3 text-left font-medium">POD</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((dn) => {
                  const s = DELIVERY_NOTE_STATUS_STYLE[dn.status] ?? DELIVERY_NOTE_STATUS_STYLE.draft;
                  const src =
                    (dn.order_id && orderNo.get(dn.order_id)) ||
                    (dn.invoice_id && invoiceNo.get(dn.invoice_id)) ||
                    null;
                  const srcHref = dn.order_id
                    ? `/app/orderflow/orders/${dn.order_id}`
                    : dn.invoice_id
                      ? `/app/orderflow/invoices/${dn.invoice_id}`
                      : null;
                  return (
                    <tr key={dn.id} className="border-b border-[#F0F0EC] transition-colors last:border-0 hover:bg-[#FAFAF8]">
                      <td className="px-4 py-3">
                        <Link href={`/app/orderflow/delivery-notes/${dn.id}`} className="font-medium text-[#1E5E54] hover:text-[#174A42]">
                          {dn.dn_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[#1A1C1E]">
                        {(dn.customer_id && custName.get(dn.customer_id)) || 'No customer'}
                      </td>
                      <td className="px-4 py-3">
                        {src && srcHref ? (
                          <Link href={srcHref} className="text-[#1E5E54] hover:text-[#174A42]">
                            {src}
                          </Link>
                        ) : (
                          <span className="text-[#9A9DA1]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Pill label={s.label} bg={s.bg} fg={s.fg} />
                      </td>
                      <td className="px-4 py-3 text-[#5F6368]">{fmtDate(dn.delivered_at)}</td>
                      <td className="px-4 py-3">
                        {dn.pod_document_id ? (
                          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0F6E56]">✓ Uploaded</span>
                        ) : (
                          <span className="text-[12px] text-[#9A9DA1]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewDeliveryNoteModal
        open={creating}
        onClose={() => setCreating(false)}
        orders={orders}
        invoices={invoices}
        customers={customers}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// New delivery note — pick an order OR invoice, then build from its items.
// ---------------------------------------------------------------------------

type SourceKind = 'order' | 'invoice';

function NewDeliveryNoteModal({
  open,
  onClose,
  orders,
  invoices,
  customers,
}: {
  open: boolean;
  onClose: () => void;
  orders: OfOrder[];
  invoices: OfInvoice[];
  customers: OfCustomer[];
}) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();
  const [kind, setKind] = useState<SourceKind>('order');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const custName = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (kind === 'order') {
      // Delivery notes fulfil real orders — exclude cancelled ones.
      return orders
        .filter((o) => o.status !== 'cancelled')
        .filter((o) => {
          if (!q) return true;
          const name = (o.customer_id && custName.get(o.customer_id)) || '';
          return (o.order_number || '').toLowerCase().includes(q) || name.toLowerCase().includes(q);
        })
        .slice(0, 40)
        .map((o) => ({
          id: o.id,
          number: o.order_number || 'Order',
          customerId: o.customer_id,
          customerName: (o.customer_id && custName.get(o.customer_id)) || 'No customer',
        }));
    }
    return invoices
      .filter((i) => i.status !== 'cancelled')
      .filter((i) => {
        if (!q) return true;
        const name = (i.customer_id && custName.get(i.customer_id)) || '';
        return i.invoice_number.toLowerCase().includes(q) || name.toLowerCase().includes(q);
      })
      .slice(0, 40)
      .map((i) => ({
        id: i.id,
        number: i.invoice_number,
        customerId: i.customer_id,
        customerName: (i.customer_id && custName.get(i.customer_id)) || 'No customer',
      }));
  }, [kind, search, orders, invoices, custName]);

  function reset() {
    setKind('order');
    setSearch('');
    setSelected(null);
    setError(null);
    setBusy(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function create() {
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    if (!selected) {
      setError('Pick an order or invoice first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Fetch the source's line items + delivery address client-side, mapped to
      // delivery-note lines (name/qty/unit only — delivery notes hide prices).
      let customerId: string | null = null;
      let deliveryAddress: string | null = null;
      let instructions: string | null = null;
      let lines: { name: string; qty: number; unit: string | null }[] = [];

      if (kind === 'order') {
        const { data: order, error: oErr } = await supabase
          .from('of_orders')
          .select('customer_id, delivery_address, delivery_instructions')
          .eq('id', selected)
          .maybeSingle();
        if (oErr) throw new Error(oErr.message);
        customerId = (order as { customer_id: string | null } | null)?.customer_id ?? null;
        deliveryAddress = (order as { delivery_address: string | null } | null)?.delivery_address ?? null;
        instructions = (order as { delivery_instructions: string | null } | null)?.delivery_instructions ?? null;
        const { data: items, error: iErr } = await supabase
          .from('of_order_items')
          .select('name, qty, unit')
          .eq('order_id', selected)
          .order('created_at', { ascending: true });
        if (iErr) throw new Error(iErr.message);
        lines = ((items as { name: string; qty: number; unit: string | null }[] | null) ?? []).map((r) => ({
          name: r.name,
          qty: Number(r.qty) || 0,
          unit: r.unit,
        }));
      } else {
        const { data: invoice, error: iErr } = await supabase
          .from('of_invoices')
          .select('customer_id, delivery_address, delivery_instructions')
          .eq('id', selected)
          .maybeSingle();
        if (iErr) throw new Error(iErr.message);
        customerId = (invoice as { customer_id: string | null } | null)?.customer_id ?? null;
        deliveryAddress = (invoice as { delivery_address: string | null } | null)?.delivery_address ?? null;
        instructions = (invoice as { delivery_instructions: string | null } | null)?.delivery_instructions ?? null;
        const { data: items, error: liErr } = await supabase
          .from('of_invoice_items')
          .select('name, qty, unit, sort_order')
          .eq('invoice_id', selected)
          .order('sort_order', { ascending: true });
        if (liErr) throw new Error(liErr.message);
        lines = ((items as { name: string; qty: number; unit: string | null }[] | null) ?? []).map((r) => ({
          name: r.name,
          qty: Number(r.qty) || 0,
          unit: r.unit,
        }));
      }

      const { id } = await createDeliveryNote(supabase, {
        orgId: org.id,
        actorEmail: email,
        customerId,
        orderId: kind === 'order' ? selected : null,
        invoiceId: kind === 'invoice' ? selected : null,
        deliveryAddress,
        instructions,
        lines,
      });

      toast('Delivery note created');
      close();
      router.refresh();
      router.push(`/app/orderflow/delivery-notes/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the delivery note.');
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={close}
        title="New delivery note"
        subtitle="Build a picking slip from an existing order or invoice."
        width={520}
        footer={
          <>
            <SecondaryBtn onClick={close} disabled={busy}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn onClick={create} disabled={busy || !selected}>
              {busy ? 'Creating…' : 'Create delivery note'}
            </PrimaryBtn>
          </>
        }
      >
        <div className="flex items-center gap-1.5">
          {(['order', 'invoice'] as SourceKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setSelected(null);
              }}
              className={`h-8 rounded-lg border px-3 text-[12px] font-medium capitalize transition-colors ${
                kind === k
                  ? 'border-[#1E5E54] bg-[#1E5E54] text-white'
                  : 'border-[#D7DAD8] bg-white text-[#5F6368] hover:border-[#1E5E54]/40'
              }`}
            >
              From {k}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={kind === 'order' ? 'Search orders…' : 'Search invoices…'}
          />
        </div>

        <div className="mt-3 max-h-[280px] overflow-y-auto rounded-xl border border-[#E7E7E2]">
          {results.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-[13px] text-[#9A9DA1]">
              No {kind === 'order' ? 'orders' : 'invoices'} found.
            </p>
          ) : (
            <ul className="divide-y divide-[#F0F0EC]">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.id)}
                    className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[#FAFAF8] ${
                      selected === r.id ? 'bg-[#EAF4F0]' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-[#1A1C1E]">{r.number}</div>
                      <div className="truncate text-[12px] text-[#5F6368]">{r.customerName}</div>
                    </div>
                    {selected === r.id ? <span className="shrink-0 text-[13px] text-[#1E5E54]">✓</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? (
          <div className="mt-3 rounded-xl bg-[#FCEBEB] px-3 py-2.5 text-[13px] text-[#A32D2D]">{error}</div>
        ) : null}
      </Modal>
      {toastNode}
    </>
  );
}

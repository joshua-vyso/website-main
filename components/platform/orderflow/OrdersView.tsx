'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import {
  ORDER_STATUSES,
  ORDER_STATUS_STYLE,
  paymentStatusOf,
  withVat,
  zar,
  type OrderStatus,
  type PaymentStatus,
} from '@/lib/platform/orderflow';
import { mockDeliveryDate, orderAttention, orderActivity, compareOrders, type OrderLite } from '@/lib/platform/orderflow-crm';
import { Kpi, OrderStatusBadge, PaymentStatusBadge, RowActionsMenu, Drawer, useToast } from './ui';
import { PublishOrderButton } from './PublishOrderButton';

export interface OrderItemLite {
  name: string;
  qty: number;
  unit: string | null;
  unit_price: number;
}
export interface OrderRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  status: OrderStatus;
  invoice_number: string | null;
  notes: string | null;
  total: number;
  item_count: number;
  created_at: string;
}
interface CustomerLite {
  id: string;
  name: string;
}
interface ProductLite {
  id: string;
  name: string;
  unit: string | null;
  avg_unit_price: number | null;
}
interface Line {
  key: string;
  stock_item_id: string | null;
  name: string;
  qty: string;
  unit: string;
  unit_price: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function isSameDay(a: number, b: number) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
function orderRef(o: OrderRow) {
  return o.invoice_number ?? `#${o.id.slice(0, 6).toUpperCase()}`;
}

export function OrdersView({
  orders,
  items,
  customers,
  products,
  orgUnits = [],
}: {
  orders: OrderRow[];
  items: Record<string, OrderItemLite[]>;
  customers: CustomerLite[];
  products: ProductLite[];
  orgUnits?: string[];
}) {
  const router = useRouter();
  const { org } = usePlatform();
  const { node: toastNode, show: toast } = useToast();
  const now = Date.now();

  // ---- Filters + selection + drawer ----
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);

  // ---- New-order builder (preserved) ----
  const unitOptions = (current?: string): string[] => {
    const cur = (current ?? '').trim();
    if (cur && !orgUnits.some((u) => u.toLowerCase() === cur.toLowerCase())) return [...orgUnits, cur];
    return orgUnits;
  };
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerList, setCustomerList] = useState<CustomerLite[]>(customers);
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const tempRef = useState(() => ({ n: 0 }))[0];

  const custMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const base = q ? customerList.filter((c) => c.name.toLowerCase().includes(q)) : customerList;
    return base.slice(0, 8);
  }, [customerList, customerQuery]);
  const custExact = customerList.some((c) => c.name.trim().toLowerCase() === customerQuery.trim().toLowerCase());

  // Duplicate-order warning: same customer already has an order created today.
  const dupToday = useMemo(() => {
    if (!customerId) return false;
    return orders.some((o) => o.customer_id === customerId && o.status !== 'cancelled' && isSameDay(new Date(o.created_at).getTime(), now));
  }, [customerId, orders, now]);

  function pickCustomer(c: CustomerLite) {
    setCustomerId(c.id);
    setCustomerQuery(c.name);
    setCustomerOpen(false);
  }
  async function createCustomer(name: string) {
    const n = name.trim();
    if (!n || creatingCustomer) return;
    const supabase = createClient();
    if (!supabase || !org?.id) return;
    setCreatingCustomer(true);
    const { data, error } = await supabase.from('of_customers').insert({ org_id: org.id, name: n }).select('id, name').single();
    setCreatingCustomer(false);
    if (error || !data) return;
    const c = data as CustomerLite;
    setCustomerList((prev) => [...prev, c]);
    setCustomerId(c.id);
    setCustomerQuery(c.name);
    setCustomerOpen(false);
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [products, query]);

  function addLine(p?: ProductLite) {
    const key = `l-${tempRef.n++}`;
    setLines((prev) => [
      ...prev,
      {
        key,
        stock_item_id: p?.id ?? null,
        name: p?.name ?? query.trim(),
        qty: '1',
        unit: p?.unit ?? '',
        unit_price: p?.avg_unit_price != null ? String(p.avg_unit_price) : '',
      },
    ]);
    setQuery('');
  }
  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  // Quick-start: load the chosen customer's most recent order into the builder.
  function repeatLastOrder() {
    if (!customerId) {
      toast('Pick a customer first.');
      return;
    }
    const prev = orders
      .filter((o) => o.customer_id === customerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const its = prev ? items[prev.id] ?? [] : [];
    if (!its.length) {
      toast('No previous order for this customer.');
      return;
    }
    setLines(
      its.map((it) => ({
        key: `l-${tempRef.n++}`,
        stock_item_id: null,
        name: it.name,
        qty: String(it.qty),
        unit: it.unit ?? '',
        unit_price: String(it.unit_price),
      })),
    );
    toast(`Loaded ${its.length} items from the last order.`);
  }

  const builderTotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
  const canSave = customerId && lines.some((l) => l.name.trim() && Number(l.qty) > 0);

  function resetBuilder() {
    setOpen(false);
    setCustomerId('');
    setCustomerQuery('');
    setCustomerOpen(false);
    setLines([]);
    setQuery('');
    setDeliveryDate('');
    setOrderNotes('');
  }

  async function saveOrder() {
    if (!canSave || busy) return;
    const supabase = createClient();
    if (!supabase || !org?.id) return;
    setBusy(true);
    const noteParts = [orderNotes.trim(), deliveryDate ? `Delivery: ${fmtDate(deliveryDate)}` : ''].filter(Boolean);
    const { data: order, error } = await supabase
      .from('of_orders')
      .insert({ org_id: org.id, customer_id: customerId, status: 'draft', notes: noteParts.join(' · ') || null })
      .select('id')
      .single();
    if (error || !order?.id) {
      setBusy(false);
      toast('Could not create the order.');
      return;
    }
    const rows = lines
      .filter((l) => l.name.trim() && Number(l.qty) > 0)
      .map((l) => ({
        org_id: org.id,
        order_id: order.id as string,
        stock_item_id: l.stock_item_id,
        name: l.name.trim(),
        qty: Number(l.qty) || 0,
        unit: l.unit.trim() || null,
        unit_price: Number(l.unit_price) || 0,
      }));
    if (rows.length) {
      await supabase.from('of_order_items').insert(rows);
      await fetch('/api/orderflow/order-stock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, action: 'apply' }),
      }).catch(() => {});
    }
    setBusy(false);
    resetBuilder();
    router.refresh();
  }

  // ---- KPIs ----
  const kpi = useMemo(() => {
    const active = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'draft');
    const outstanding = orders
      .filter((o) => o.status === 'invoiced' || o.status === 'partially_paid')
      .reduce((s, o) => s + (o.status === 'partially_paid' ? o.total * 0.6 : o.total), 0);
    return {
      today: orders.filter((o) => isSameDay(new Date(o.created_at).getTime(), now)).length,
      pending: orders.filter((o) => o.status === 'draft').length,
      readyToInvoice: orders.filter((o) => o.status === 'confirmed' || o.status === 'packed' || o.status === 'delivered').length,
      deliveredToday: orders.filter((o) => o.status === 'delivered' && isSameDay(new Date(mockDeliveryDate(o)).getTime(), now)).length,
      outstanding,
      aov: active.length ? active.reduce((s, o) => s + o.total, 0) / active.length : 0,
    };
  }, [orders, now]);

  // ---- Filtering ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 86_400_000 : null;
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (customerFilter !== 'all' && o.customer_id !== customerFilter) return false;
      if (paymentFilter !== 'all' && paymentStatusOf(o.status) !== paymentFilter) return false;
      const ts = new Date(o.created_at).getTime();
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts >= toTs) return false;
      if (q) {
        const inItems = (items[o.id] ?? []).some((it) => it.name.toLowerCase().includes(q));
        const hay = `${o.customer_name} ${o.invoice_number ?? ''} ${orderRef(o)}`.toLowerCase();
        if (!hay.includes(q) && !inItems) return false;
      }
      return true;
    });
  }, [orders, items, search, statusFilter, customerFilter, paymentFilter, from, to]);

  const attention = useMemo(
    () =>
      orderAttention(
        orders.map((o) => ({ ...o } as OrderLite & { customer_name: string })),
        now,
      ),
    [orders, now],
  );

  // ---- Selection / bulk ----
  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.id));
  function toggleAll() {
    setSelected((prev) => {
      if (allFilteredSelected) return new Set();
      return new Set(filtered.map((o) => o.id));
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function exportCsv(rows: OrderRow[]) {
    const header = ['Order', 'Customer', 'Status', 'Payment', 'Items', 'Total', 'Created'];
    const lines2 = [header.join(',')];
    for (const o of rows) {
      lines2.push(
        [orderRef(o), `"${o.customer_name.replace(/"/g, '""')}"`, o.status, paymentStatusOf(o.status), o.item_count, Math.round(o.total), fmtDate(o.created_at)].join(','),
      );
    }
    const blob = new Blob([lines2.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const drawerOrder = drawerId ? orders.find((o) => o.id === drawerId) ?? null : null;
  const selectedRows = orders.filter((o) => selected.has(o.id));

  const cell = 'h-9 rounded-lg border border-[#E7E7E2] bg-white px-2.5 text-[13px] text-[#1A1C1E] focus:border-[#1E5E54]/40 focus:outline-none';
  const filterSel = 'h-9 rounded-lg border border-[#D7DAD8] bg-white px-2.5 text-[13px] text-[#5F6368] outline-none focus:border-[#1E5E54]';

  return (
    <div>
      {toastNode}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#1A1C1E]">Orders</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">Manage customer orders from draft to delivery and invoicing</p>
        </div>
        <div className="flex items-center gap-2.5">
          <PublishOrderButton />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 items-center rounded-xl bg-[#1E5E54] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#184D45]"
          >
            + New order
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Today's orders" value={String(kpi.today)} />
        <Kpi label="Pending confirmation" value={String(kpi.pending)} accent={kpi.pending > 0 ? '#854F0B' : undefined} />
        <Kpi label="Ready to invoice" value={String(kpi.readyToInvoice)} accent={kpi.readyToInvoice > 0 ? '#0C447C' : undefined} />
        <Kpi label="Delivered today" value={String(kpi.deliveredToday)} accent={kpi.deliveredToday > 0 ? '#0F6E56' : undefined} />
        <Kpi label="Outstanding value" value={zar(kpi.outstanding)} accent={kpi.outstanding > 0 ? '#A32D2D' : undefined} />
        <Kpi label="Avg order value" value={zar(kpi.aov)} />
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer, order #, invoice #, or product…"
          className="h-9 min-w-[260px] flex-1 rounded-lg border border-[#D7DAD8] bg-white px-3 text-[13px] text-[#1A1C1E] outline-none placeholder:text-[#9A9DA1] focus:border-[#1E5E54]"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderStatus)} className={filterSel}>
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{ORDER_STATUS_STYLE[s].label}</option>
          ))}
        </select>
        <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className={filterSel}>
          <option value="all">All customers</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as 'all' | PaymentStatus)} className={filterSel}>
          <option value="all">Any payment</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={filterSel} aria-label="From date" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={filterSel} aria-label="To date" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        {/* Orders table */}
        <div className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
          {selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-[#F0F0EC] bg-[#F6FAF8] px-4 py-2.5 text-[13px]">
              <span className="font-medium text-[#1A1C1E]">{selected.size} selected</span>
              <span className="flex-1" />
              <BulkBtn onClick={() => toast(`Generating ${selected.size} invoices… (demo)`)}>Generate invoices</BulkBtn>
              <BulkBtn onClick={() => exportCsv(selectedRows)}>Export CSV</BulkBtn>
              <BulkBtn onClick={() => toast(`Marked ${selected.size} delivered (demo)`)}>Mark delivered</BulkBtn>
              <BulkBtn onClick={() => toast(`Archived ${selected.size} orders (demo)`)} danger>Archive</BulkBtn>
              <button type="button" onClick={() => setSelected(new Set())} className="text-[12px] text-[#9A9DA1] hover:text-[#5F6368]">Clear</button>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                  <th className="w-9 px-3 py-2.5">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} aria-label="Select all" className="accent-[#1E5E54]" />
                  </th>
                  <th className="px-2 py-2.5 text-left font-medium">Order #</th>
                  <th className="px-2 py-2.5 text-left font-medium">Customer</th>
                  <th className="px-2 py-2.5 text-left font-medium">Status</th>
                  <th className="px-2 py-2.5 text-left font-medium">Payment</th>
                  <th className="px-2 py-2.5 text-right font-medium">Items</th>
                  <th className="px-2 py-2.5 text-left font-medium">Delivery</th>
                  <th className="px-2 py-2.5 text-right font-medium">Total</th>
                  <th className="px-2 py-2.5 text-left font-medium">Created</th>
                  <th className="w-10 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-[14px] text-[#9A9DA1]">
                      {orders.length === 0 ? 'No orders yet — create your first.' : 'No orders match your filters.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => setDrawerId(o.id)}
                      className="cursor-pointer border-b border-[#F6F6F2] last:border-0 hover:bg-[#FAFAF8]"
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOne(o.id)} aria-label="Select" className="accent-[#1E5E54]" />
                      </td>
                      <td className="px-2 py-3 font-medium text-[#1A1C1E]">{orderRef(o)}</td>
                      <td className="px-2 py-3 text-[#1A1C1E]">{o.customer_name}</td>
                      <td className="px-2 py-3"><OrderStatusBadge status={o.status} /></td>
                      <td className="px-2 py-3"><PaymentStatusBadge status={paymentStatusOf(o.status)} /></td>
                      <td className="px-2 py-3 text-right tabular-nums text-[#5F6368]">{o.item_count}</td>
                      <td className="px-2 py-3 text-[#5F6368]">{fmtDate(mockDeliveryDate(o))}</td>
                      <td className="px-2 py-3 text-right font-medium tabular-nums text-[#1A1C1E]">{zar(o.total)}</td>
                      <td className="px-2 py-3 text-[#9A9DA1]">{fmtDate(o.created_at)}</td>
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu
                          actions={[
                            { label: 'View', onClick: () => setDrawerId(o.id) },
                            { label: 'Edit', onClick: () => router.push(`/app/orderflow/orders/${o.id}`) },
                            { label: 'Generate invoice', onClick: () => toast('Invoice generated (demo)') },
                            { label: 'Duplicate', onClick: () => toast('Order duplicated (demo)') },
                            { label: 'Download PDF', onClick: () => toast('PDF downloaded (demo)') },
                            { label: 'Archive', onClick: () => toast('Order archived (demo)'), danger: true },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Attention */}
        <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
          <h2 className="text-[14px] font-semibold text-[#1A1C1E]">Orders needing attention</h2>
          {attention.length === 0 ? (
            <p className="mt-3 text-[13px] text-[#9A9DA1]">Nothing needs attention — orders and invoices are on track.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2.5">
              {attention.map((a) => (
                <Link key={a.id} href={a.href} className="flex items-start gap-2.5 text-[13px] transition-colors hover:opacity-80">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: a.severity === 'high' ? '#A32D2D' : a.severity === 'medium' ? '#854F0B' : '#9A9DA1' }}
                  />
                  <span className="text-[#5F6368]">{a.text}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order detail drawer */}
      <Drawer
        open={!!drawerOrder}
        onClose={() => setDrawerId(null)}
        title={drawerOrder ? orderRef(drawerOrder) : ''}
        subtitle={drawerOrder ? drawerOrder.customer_name : undefined}
        right={drawerOrder ? <OrderStatusBadge status={drawerOrder.status} /> : undefined}
        width={520}
        footer={
          drawerOrder ? (
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => toast('PDF downloaded (demo)')} className="text-[13px] font-medium text-[#5F6368] hover:text-[#1A1C1E]">
                Download PDF
              </button>
              <div className="flex gap-2">
                <Link href={`/app/orderflow/orders/${drawerOrder.id}`} className="rounded-lg border border-[#D7DAD8] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1A1C1E] hover:border-[#1E5E54]/40">
                  Open full page
                </Link>
                <button type="button" onClick={() => toast('Invoice generated (demo)')} className="rounded-lg bg-[#1E5E54] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#184D45]">
                  Generate invoice
                </button>
              </div>
            </div>
          ) : undefined
        }
      >
        {drawerOrder ? <OrderDrawerBody order={drawerOrder} items={items} allOrders={orders} /> : null}
      </Drawer>

      {/* New order builder */}
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[7vh]">
          <button type="button" aria-label="Close" onClick={resetBuilder} className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 w-full max-w-[640px] rounded-2xl border border-[#E7E7E2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.5)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#1A1C1E]">New order</h3>
              <button type="button" onClick={resetBuilder} aria-label="Close" className="text-[#9A9DA1] hover:text-[#1A1C1E]">✕</button>
            </div>

            {/* Quick-start */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              <QuickStart onClick={repeatLastOrder}>↻ Repeat last order</QuickStart>
              <QuickStart onClick={() => toast('Last week’s order loaded (demo)')}>Repeat last week</QuickStart>
              <QuickStart onClick={() => toast('Templates coming soon (demo)')}>Use template</QuickStart>
              <QuickStart onClick={() => toast('Use the Upload order button to import a document.')}>Upload order</QuickStart>
            </div>

            <label className="mb-1 block text-[12px] text-[#5F6368]">Customer</label>
            <div className="relative mb-3">
              <input
                className={`${cell} h-10 w-full`}
                value={customerQuery}
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  setCustomerId('');
                  setCustomerOpen(true);
                }}
                onFocus={() => setCustomerOpen(true)}
                onBlur={() => setTimeout(() => setCustomerOpen(false), 150)}
                placeholder="Search customers or type a new name…"
              />
              {customerOpen && (custMatches.length > 0 || (customerQuery.trim() && !custExact)) ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[200px] overflow-y-auto rounded-xl border border-[#E7E7E2] bg-white py-1 shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
                  {custMatches.map((c) => (
                    <button key={c.id} type="button" onMouseDown={(e) => { e.preventDefault(); pickCustomer(c); }} className="block w-full truncate px-3 py-2 text-left text-[13px] text-[#1A1C1E] transition-colors hover:bg-[#FAFAF8]">
                      {c.name}
                    </button>
                  ))}
                  {customerQuery.trim() && !custExact ? (
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); void createCustomer(customerQuery); }} disabled={creatingCustomer} className="block w-full truncate border-t border-[#F0F0EC] px-3 py-2 text-left text-[13px] font-medium text-[#1E5E54] transition-colors hover:bg-[#FAFAF8] disabled:opacity-50">
                      {creatingCustomer ? 'Creating…' : `+ Create “${customerQuery.trim()}”`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {dupToday ? (
              <div className="mb-3 rounded-lg border border-[#FBEEDA] bg-[#FFFBF4] px-3 py-2 text-[12px] text-[#854F0B]">
                This customer already has an open order today. You can still continue.
              </div>
            ) : null}

            <label className="mb-1 block text-[12px] text-[#5F6368]">Line items</label>
            <div className="relative mb-2">
              <input
                className={`${cell} h-10 w-full`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) addLine(matches[0]); }}
                placeholder="Search a product to add (or type a new name + Enter)…"
              />
              {matches.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[180px] overflow-y-auto rounded-xl border border-[#E7E7E2] bg-white shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
                  {matches.map((p) => (
                    <button key={p.id} type="button" onClick={() => addLine(p)} className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-[#1A1C1E] transition-colors hover:bg-[#FAFAF8]">
                      <span className="truncate">{p.name}</span>
                      <span className="text-[12px] text-[#9A9DA1]">{p.avg_unit_price != null ? zar(p.avg_unit_price) : ''}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {lines.length > 0 ? (
              <div className="mb-3 space-y-2">
                {lines.map((l) => (
                  <div key={l.key} className="grid grid-cols-[1fr_64px_64px_84px_28px] items-center gap-2">
                    <input className={cell} value={l.name} onChange={(e) => updateLine(l.key, { name: e.target.value })} />
                    <input className={`${cell} text-right`} value={l.qty} inputMode="decimal" onChange={(e) => updateLine(l.key, { qty: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="qty" />
                    <select className={`${cell} cursor-pointer pr-1`} value={l.unit} onChange={(e) => updateLine(l.key, { unit: e.target.value })} aria-label="Unit">
                      <option value="">unit</option>
                      {unitOptions(l.unit).map((u) => (<option key={u} value={u}>{u}</option>))}
                    </select>
                    <input className={`${cell} text-right`} value={l.unit_price} inputMode="decimal" onChange={(e) => updateLine(l.key, { unit_price: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="price" />
                    <button type="button" onClick={() => removeLine(l.key)} aria-label="Remove line" className="flex h-9 w-7 items-center justify-center rounded-lg text-[#9A9DA1] hover:bg-[#FCEBEB] hover:text-[#A32D2D]">✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-[12px] text-[#9A9DA1]">No items yet — search above to add products.</p>
            )}

            {/* Delivery + notes */}
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] text-[#5F6368]">Delivery date</label>
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={`${cell} h-10 w-full`} />
              </div>
              <div>
                <label className="mb-1 block text-[12px] text-[#5F6368]">Notes</label>
                <input value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Delivery / order notes…" className={`${cell} h-10 w-full`} />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#F0F0EC] pt-3">
              <span className="text-[14px] font-semibold text-[#1A1C1E]">Total {zar(builderTotal)}</span>
              <div className="flex gap-2">
                <button type="button" onClick={resetBuilder} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">Cancel</button>
                <button type="button" onClick={() => void saveOrder()} disabled={!canSave || busy} className="rounded-lg bg-[#1E5E54] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-40">
                  {busy ? 'Creating…' : 'Create order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BulkBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-white px-3 py-1.5 text-[12px] font-medium transition-colors ${
        danger ? 'border-[#F0D9D9] text-[#A32D2D] hover:bg-[#FCEBEB]' : 'border-[#D7DAD8] text-[#1A1C1E] hover:border-[#1E5E54]/40'
      }`}
    >
      {children}
    </button>
  );
}

function QuickStart({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full border border-[#E7E7E2] bg-white px-3 py-1.5 text-[12px] font-medium text-[#5F6368] transition-colors hover:border-[#1E5E54]/40 hover:text-[#1A1C1E]">
      {children}
    </button>
  );
}

function OrderDrawerBody({ order, items, allOrders }: { order: OrderRow; items: Record<string, OrderItemLite[]>; allOrders: OrderRow[] }) {
  const its = items[order.id] ?? [];
  const subtotal = its.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0);
  const v = withVat(subtotal);
  const activity = orderActivity({ ...order } as OrderLite, order.customer_name);

  const prevOrder = allOrders
    .filter((o) => o.customer_id === order.customer_id && new Date(o.created_at).getTime() < new Date(order.created_at).getTime())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  const comparison = prevOrder ? compareOrders(its, items[prevOrder.id] ?? []) : [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 text-[13px]">
        <Field label="Payment"><PaymentStatusBadge status={paymentStatusOf(order.status)} /></Field>
        <Field label="Invoice">{order.invoice_number ?? '—'}</Field>
        <Field label="Created">{fmtDate(order.created_at)}</Field>
        <Field label="Delivery">{fmtDate(mockDeliveryDate(order))}</Field>
      </div>
      {order.notes ? (
        <div className="rounded-xl border border-[#F0F0EC] bg-[#FCFCFB] px-3.5 py-2.5 text-[13px] text-[#5F6368]">{order.notes}</div>
      ) : null}

      <Section title="Items">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#F0F0EC] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
              <th className="py-1.5 pr-2 text-left font-medium">Item</th>
              <th className="px-2 py-1.5 text-right font-medium">Qty</th>
              <th className="px-2 py-1.5 text-right font-medium">Price</th>
              <th className="py-1.5 pl-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {its.length === 0 ? (
              <tr><td colSpan={4} className="py-4 text-center text-[#9A9DA1]">No items.</td></tr>
            ) : (
              its.map((i, idx) => (
                <tr key={idx} className="border-b border-[#F6F6F2] last:border-0">
                  <td className="py-2 pr-2 text-[#1A1C1E]">{i.name}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#5F6368]">{i.qty}{i.unit ? ` ${i.unit}` : ''}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#5F6368]">{zar(i.unit_price)}</td>
                  <td className="py-2 pl-2 text-right tabular-nums font-medium text-[#1A1C1E]">{zar((Number(i.qty) || 0) * (Number(i.unit_price) || 0))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="mt-3 space-y-1 border-t border-[#F0F0EC] pt-3 text-[13px]">
          <Row label="Subtotal" value={zar(v.subtotal)} />
          <Row label="VAT (15%)" value={zar(v.vat)} muted />
          <Row label="Total" value={zar(v.total)} bold />
        </div>
      </Section>

      {comparison.length > 0 ? (
        <Section title={`Compared to previous order (${orderRef(prevOrder!)})`}>
          <div className="flex flex-col gap-1.5 text-[13px]">
            {comparison.slice(0, 8).map((c) => (
              <div key={c.name} className="flex items-center justify-between">
                <span className="text-[#5F6368]">{c.name}</span>
                <span className="tabular-nums text-[#1A1C1E]">
                  {c.from ?? 0}{c.unit ? ` ${c.unit}` : ''} → {c.to ?? 0}{c.unit ? ` ${c.unit}` : ''}{' '}
                  <span className="font-medium" style={{ color: c.delta > 0 ? '#0F6E56' : '#A32D2D' }}>
                    ({c.delta > 0 ? '+' : ''}{c.delta})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Activity">
        <div className="flex flex-col gap-3">
          {activity.map((a) => (
            <div key={a.id} className="flex gap-3 text-[13px]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1E5E54]" />
              <div className="min-w-0">
                <div className="text-[#1A1C1E]">{a.label}{a.detail ? <span className="text-[#9A9DA1]"> · {a.detail}</span> : null}</div>
                <div className="text-[11px] text-[#9A9DA1]">{fmtDate(a.date)}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Attachments">
        <p className="rounded-xl border border-dashed border-[#E7E7E2] px-3.5 py-4 text-center text-[12px] text-[#9A9DA1]">
          No attachments yet — signed delivery notes and POs will appear here.
        </p>
      </Section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">{label}</div>
      <div className="mt-1 text-[#1A1C1E]">{children}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-semibold text-[#1A1C1E]">{title}</h3>
      {children}
    </div>
  );
}
function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-[#9A9DA1]' : 'text-[#5F6368]'}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold text-[#1A1C1E]' : 'text-[#1A1C1E]'}`}>{value}</span>
    </div>
  );
}

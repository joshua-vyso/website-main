'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRealtimeRefresh } from '@/lib/platform/useRealtimeRefresh';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { logActivity } from '@/lib/platform/orderflow-activity';
import { isUniqueViolation } from '@/lib/platform/db-errors';
import {
  ORDER_STATUSES,
  ORDER_STATUS_STYLE,
  docTotals,
  isoDatePlusDays,
  paymentStatusOf,
  zar,
  zar2,
  type OfCustomer,
  type OfSettings,
  type OrderStatus,
  type PaymentStatus,
} from '@/lib/platform/orderflow';
import { orderAttention, compareOrders, type OrderLite } from '@/lib/platform/orderflow-crm';
import { customerPriceList, formatAddress, resolvePrice } from '@/lib/platform/coredata';
import type { BuilderContext } from '@/lib/platform/orderflow-data';
import {
  CustomerSelect,
  LineItemsEditor,
  createDeliveryNote,
  createInvoice,
  createOrder,
  type BuilderLine,
} from './builder';
import { Field as FormField, PrimaryBtn, SecondaryBtn, ConfirmDialog, inputClass } from '@/components/platform/coredata/ui';
import { Kpi, OrderStatusBadge, PaymentStatusBadge, RowActionsMenu, Drawer, useToast } from './ui';
import { PublishOrderButton } from './PublishOrderButton';
import { FinchOrderPrefill } from '@/components/platform/finch/FinchOrderPrefill';
import { matchByName } from '@/lib/ai/finch/name-match';
import type { ParsedOrder } from '@/lib/ai/finch/order-handoff';

export interface OrderItemLite {
  stock_item_id?: string | null;
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
  order_number: string | null;
  invoice_number: string | null;
  invoice_id: string | null;
  delivery_date: string | null;
  delivery_address: string | null;
  delivery_instructions: string | null;
  customer_po: string | null;
  notes: string | null;
  total: number;
  item_count: number;
  created_at: string;
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

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  // Bare dates (yyyy-mm-dd) are anchored to noon so the local calendar day holds.
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function isSameDay(a: number, b: number) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
function orderRef(o: Pick<OrderRow, 'id' | 'order_number' | 'invoice_number'>) {
  return o.order_number ?? o.invoice_number ?? `#${o.id.slice(0, 6).toUpperCase()}`;
}
/** Order lines → builder lines for createInvoice / createOrder (source 'base', no override note). */
function toBuilderLines(items: OrderItemLite[]): BuilderLine[] {
  return items.map((it, i) => ({
    key: `ol${i}`,
    stock_item_id: it.stock_item_id ?? null,
    name: it.name,
    qty: Number(it.qty) || 0,
    unit: it.unit,
    unit_price: Number(it.unit_price) || 0,
    source: 'base' as const,
    override_note: null,
  }));
}
/** Reflect a sale in ProcurePulse stock — the same call this module has always made. */
async function syncOrderStock(orderId: string, action: 'apply' | 'reverse') {
  await fetch('/api/orderflow/order-stock', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderId, action }),
  }).catch(() => {});
}

const INVOICED_STATUSES: OrderStatus[] = ['invoiced', 'partially_paid', 'paid'];
const PIPELINE_STATUSES: OrderStatus[] = ['draft', 'confirmed', 'picking', 'packed', 'out_for_delivery', 'delivered'];

export function OrdersView({
  orders,
  items,
  customers,
  products,
  settings,
  orgUnits = [],
}: {
  orders: OrderRow[];
  items: Record<string, OrderItemLite[]>;
  customers: OfCustomer[];
  products: ProductLite[];
  settings: OfSettings;
  orgUnits?: string[];
}) {
  const router = useRouter();
  useRealtimeRefresh('of_orders');
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();
  const now = Date.now();
  const vatRate = Number(settings.default_vat_rate) || 15;

  // ---- Filters + selection + drawer ----
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [cancelIds, setCancelIds] = useState<string[] | null>(null);
  const selectedRows = orders.filter((o) => selected.has(o.id));

  // ---- Quick-order modal builder (preserved) ----
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
  const [customerList, setCustomerList] = useState<OfCustomer[]>(customers);
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

  function pickCustomer(c: Pick<OfCustomer, 'id' | 'name'>) {
    setCustomerId(c.id);
    setCustomerQuery(c.name);
    setCustomerOpen(false);
  }
  async function createCustomer(name: string) {
    const n = name.trim();
    if (!n || creatingCustomer) return;
    const supabase = createClient();
    if (!supabase || !org?.id) return;
    const orgId = org.id;
    setCreatingCustomer(true);
    const { data, error } = await supabase.from('of_customers').insert({ org_id: orgId, name: n }).select('*').single();
    if (data) {
      const c = data as OfCustomer;
      logActivity(supabase, {
        orgId,
        actorEmail: email,
        entityType: 'customer',
        entityId: c.id,
        customerId: c.id,
        event: 'customer_created',
        description: `${c.name} — added from the order builder`,
      });
      setCustomerList((prev) => (prev.some((p) => p.id === c.id) ? prev : [...prev, c]));
      pickCustomer(c);
      setCreatingCustomer(false);
      return;
    }
    // Name already exists (unique index) — reuse the existing customer instead of failing.
    if (isUniqueViolation(error)) {
      const { data: found } = await supabase
        .from('of_customers')
        .select('*')
        .eq('org_id', orgId)
        .ilike('name', n)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (found) {
        const c = found as OfCustomer;
        setCustomerList((prev) => (prev.some((p) => p.id === c.id) ? prev : [...prev, c]));
        pickCustomer(c);
      }
    }
    setCreatingCustomer(false);
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
        stock_item_id: it.stock_item_id ?? null,
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
    if (!supabase || !org?.id) {
      toast('Not connected.');
      return;
    }
    setBusy(true);
    const builderLines: BuilderLine[] = lines
      .filter((l) => l.name.trim() && Number(l.qty) > 0)
      .map((l) => ({
        key: l.key,
        stock_item_id: l.stock_item_id,
        name: l.name.trim(),
        qty: Number(l.qty) || 0,
        unit: l.unit.trim() || null,
        unit_price: Number(l.unit_price) || 0,
        source: l.stock_item_id ? ('base' as const) : ('none' as const),
        override_note: null,
      }));
    let orderId: string | null = null;
    try {
      const res = await createOrder(supabase, {
        orgId: org.id,
        actorEmail: email,
        customerId,
        lines: builderLines,
        notes: orderNotes.trim() || null,
        deliveryDate: deliveryDate || null,
        status: 'draft',
      });
      orderId = res.id;
    } catch {
      // core-data migration not applied yet (new of_orders columns missing) —
      // fall back to the original minimal insert so quick orders keep working.
      const noteParts = [orderNotes.trim(), deliveryDate ? `Delivery: ${fmtDate(deliveryDate)}` : ''].filter(Boolean);
      const { data: order, error } = await supabase
        .from('of_orders')
        .insert({ org_id: org.id, customer_id: customerId, status: 'draft', notes: noteParts.join(' · ') || null })
        .select('id')
        .single();
      if (error || !order?.id) {
        setBusy(false);
        toast(error?.message ?? 'Could not create the order.');
        return;
      }
      orderId = order.id as string;
      if (builderLines.length) {
        await supabase.from('of_order_items').insert(
          builderLines.map((l) => ({
            org_id: org.id,
            order_id: orderId,
            stock_item_id: l.stock_item_id,
            name: l.name,
            qty: l.qty,
            unit: l.unit,
            unit_price: l.unit_price,
          })),
        );
      }
      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'order',
        entityId: orderId,
        customerId,
        event: 'order_created',
        description: `${builderLines.length} line${builderLines.length === 1 ? '' : 's'} (quick order)`,
      });
    }
    if (orderId && builderLines.length) await syncOrderStock(orderId, 'apply');
    setBusy(false);
    resetBuilder();
    toast('Order created');
    router.refresh();
  }

  // ---- Real actions: invoice / delivery note / status / cancel / duplicate ----

  function canInvoice(o: OrderRow): boolean {
    return !o.invoice_id && !INVOICED_STATUSES.includes(o.status) && o.status !== 'cancelled' && (items[o.id] ?? []).length > 0;
  }

  async function generateInvoiceFor(o: OrderRow): Promise<{ ok: boolean; msg: string }> {
    const supabase = createClient();
    if (!supabase || !org) return { ok: false, msg: 'Not connected.' };
    if (o.invoice_id || INVOICED_STATUSES.includes(o.status)) return { ok: false, msg: `${orderRef(o)} is already invoiced.` };
    if (o.status === 'cancelled') return { ok: false, msg: `${orderRef(o)} is cancelled.` };
    const its = items[o.id] ?? [];
    if (!its.length) return { ok: false, msg: `${orderRef(o)} has no line items.` };
    const customer = customers.find((c) => c.id === o.customer_id) ?? null;
    const today = new Date().toISOString().slice(0, 10);
    try {
      const res = await createInvoice(supabase, {
        orgId: org.id,
        actorEmail: email,
        customer,
        customerId: o.customer_id,
        lines: toBuilderLines(its),
        vatRate,
        issueDate: today,
        dueDate: isoDatePlusDays(today, customer?.payment_terms_days ?? settings.default_payment_terms_days),
        customerPo: o.customer_po,
        deliveryAddress: o.delivery_address,
        deliveryInstructions: o.delivery_instructions,
        orderId: o.id,
      });
      await syncOrderStock(o.id, 'apply');
      return { ok: true, msg: `Invoice ${res.number} created` };
    } catch (err) {
      return { ok: false, msg: err instanceof Error ? err.message : 'Could not create the invoice.' };
    }
  }

  async function invoiceOne(o: OrderRow) {
    if (actionBusy) return;
    setActionBusy(true);
    const res = await generateInvoiceFor(o);
    setActionBusy(false);
    toast(res.msg);
    if (res.ok) router.refresh();
  }

  async function invoiceSelected() {
    if (actionBusy) return;
    setActionBusy(true);
    let ok = 0;
    let firstErr: string | null = null;
    for (const o of selectedRows) {
      if (!canInvoice(o)) continue;
      const res = await generateInvoiceFor(o);
      if (res.ok) ok += 1;
      else firstErr ??= res.msg;
    }
    setActionBusy(false);
    setSelected(new Set());
    toast(ok > 0 ? `${ok} invoice${ok === 1 ? '' : 's'} created${firstErr ? ` · ${firstErr}` : ''}` : firstErr ?? 'Nothing to invoice in the selection.');
    if (ok > 0) router.refresh();
  }

  async function deliveryNoteFor(o: OrderRow) {
    if (actionBusy) return;
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    const its = items[o.id] ?? [];
    if (!its.length) {
      toast(`${orderRef(o)} has no line items.`);
      return;
    }
    setActionBusy(true);
    try {
      const res = await createDeliveryNote(supabase, {
        orgId: org.id,
        actorEmail: email,
        customerId: o.customer_id,
        orderId: o.id,
        deliveryAddress: o.delivery_address,
        instructions: o.delivery_instructions,
        lines: its.map((i) => ({ name: i.name, qty: Number(i.qty) || 0, unit: i.unit })),
      });
      toast(`Delivery note ${res.number} created`);
      router.refresh();
      router.push(`/app/orderflow/delivery-notes/${res.id}`);
    } catch (err) {
      setActionBusy(false);
      toast(err instanceof Error ? err.message : 'Could not create the delivery note.');
    }
  }

  async function duplicateOrder(o: OrderRow) {
    if (actionBusy) return;
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    const its = items[o.id] ?? [];
    if (!its.length) {
      toast(`${orderRef(o)} has no line items to duplicate.`);
      return;
    }
    setActionBusy(true);
    try {
      const res = await createOrder(supabase, {
        orgId: org.id,
        actorEmail: email,
        customerId: o.customer_id,
        lines: toBuilderLines(its),
        notes: `Duplicated from ${orderRef(o)}`,
        deliveryAddress: o.delivery_address,
        deliveryInstructions: o.delivery_instructions,
        customerPo: o.customer_po,
        status: 'draft',
      });
      await syncOrderStock(res.id, 'apply');
      toast(`Order ${res.number} created`);
      router.refresh();
      router.push(`/app/orderflow/orders/${res.id}`);
    } catch (err) {
      setActionBusy(false);
      toast(err instanceof Error ? err.message : 'Could not duplicate the order.');
    }
  }

  async function markDeliveredSelected() {
    if (actionBusy) return;
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    const eligible = selectedRows.filter((o) => PIPELINE_STATUSES.includes(o.status) && o.status !== 'delivered');
    if (!eligible.length) {
      toast('No selected orders can be marked delivered.');
      return;
    }
    setActionBusy(true);
    let ok = 0;
    for (const o of eligible) {
      const { error } = await supabase.from('of_orders').update({ status: 'delivered' }).eq('id', o.id);
      if (error) continue;
      ok += 1;
      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'order',
        entityId: o.id,
        customerId: o.customer_id,
        event: 'order_status_changed',
        description: `${orderRef(o)}: ${ORDER_STATUS_STYLE[o.status].label} → Delivered`,
      });
    }
    setActionBusy(false);
    setSelected(new Set());
    toast(ok > 0 ? `${ok} order${ok === 1 ? '' : 's'} marked delivered` : 'Could not update the selection.');
    if (ok > 0) router.refresh();
  }

  async function cancelOrders(ids: string[]) {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    setActionBusy(true);
    let ok = 0;
    for (const id of ids) {
      const o = orders.find((x) => x.id === id);
      if (!o || INVOICED_STATUSES.includes(o.status) || o.status === 'cancelled') continue;
      const { error } = await supabase.from('of_orders').update({ status: 'cancelled' }).eq('id', id);
      if (error) continue;
      ok += 1;
      // Put any sold stock back — cancelled orders must not keep a decrement.
      await syncOrderStock(id, 'reverse');
      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'order',
        entityId: id,
        customerId: o.customer_id,
        event: 'order_status_changed',
        description: `${orderRef(o)}: ${ORDER_STATUS_STYLE[o.status].label} → Cancelled`,
      });
    }
    setActionBusy(false);
    setSelected(new Set());
    setCancelIds(null);
    toast(ok > 0 ? `${ok} order${ok === 1 ? '' : 's'} cancelled` : 'Invoiced orders can’t be cancelled here.');
    if (ok > 0) router.refresh();
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
      readyToInvoice: orders.filter((o) => PIPELINE_STATUSES.includes(o.status) && o.status !== 'draft' && !o.invoice_id).length,
      deliveredToday: orders.filter(
        (o) => o.status === 'delivered' && o.delivery_date && isSameDay(new Date(`${o.delivery_date}T12:00:00`).getTime(), now),
      ).length,
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
        const hay = `${o.customer_name} ${o.invoice_number ?? ''} ${o.order_number ?? ''} ${orderRef(o)}`.toLowerCase();
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
    setSelected(() => {
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
    const header = ['Order', 'Customer', 'Status', 'Payment', 'Items', 'Total', 'Delivery', 'Created'];
    const lines2 = [header.join(',')];
    for (const o of rows) {
      lines2.push(
        [
          orderRef(o),
          `"${o.customer_name.replace(/"/g, '""')}"`,
          o.status,
          paymentStatusOf(o.status),
          o.item_count,
          Math.round(o.total),
          o.delivery_date ?? '',
          fmtDate(o.created_at),
        ].join(','),
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

  const cell = 'h-9 rounded-lg border border-[#EAEDF2] bg-white px-2.5 text-[13px] text-[#171A17] focus:border-[#3E7BC4]/40 focus:outline-none';
  const filterSel = 'h-9 rounded-lg border border-[#E2E6EC] bg-white px-2.5 text-[13px] text-[#6B6F68] outline-none focus:border-[#3E7BC4]';

  return (
    <div>
      {toastNode}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#171A17]">Orders</h1>
          <p className="mt-1 text-[14px] text-[#6B6F68]">Manage customer orders from draft to delivery and invoicing</p>
        </div>
        <div className="flex items-center gap-2.5">
          <PublishOrderButton />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 items-center rounded-xl border border-[#E2E6EC] bg-white px-4 text-[14px] font-medium text-[#171A17] transition-colors hover:border-[#3E7BC4]/40"
          >
            Quick order
          </button>
          <Link
            href="/app/orderflow/orders/new"
            className="inline-flex h-10 items-center rounded-xl bg-[#1F5FA8] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#174C87]"
          >
            + New order
          </Link>
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
          className="h-9 min-w-[260px] flex-1 rounded-lg border border-[#E2E6EC] bg-white px-3 text-[13px] text-[#171A17] outline-none placeholder:text-[#8A8E86] focus:border-[#3E7BC4]"
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
        <div className="overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white">
          {selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-[#EEF1F5] bg-[#F5F9FE] px-4 py-2.5 text-[13px]">
              <span className="font-medium text-[#171A17]">{selected.size} selected</span>
              <span className="flex-1" />
              <BulkBtn onClick={() => void invoiceSelected()} disabled={actionBusy}>Generate invoices</BulkBtn>
              <BulkBtn onClick={() => exportCsv(selectedRows)} disabled={actionBusy}>Export CSV</BulkBtn>
              <BulkBtn onClick={() => void markDeliveredSelected()} disabled={actionBusy}>Mark delivered</BulkBtn>
              <BulkBtn onClick={() => setCancelIds([...selected])} disabled={actionBusy} danger>Cancel orders</BulkBtn>
              <button type="button" onClick={() => setSelected(new Set())} className="text-[12px] text-[#8A8E86] hover:text-[#6B6F68]">Clear</button>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-wide text-[#8A8E86]">
                  <th className="w-9 px-3 py-2.5">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} aria-label="Select all" className="accent-[#3E7BC4]" />
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
                    <td colSpan={10} className="px-5 py-12 text-center text-[14px] text-[#8A8E86]">
                      {orders.length === 0 ? 'No orders yet — create your first.' : 'No orders match your filters.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => setDrawerId(o.id)}
                      className="cursor-pointer border-b border-[#F5F9FE] last:border-0 hover:bg-[#F5F9FE]"
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOne(o.id)} aria-label="Select" className="accent-[#3E7BC4]" />
                      </td>
                      <td className="px-2 py-3 font-medium text-[#171A17]">{orderRef(o)}</td>
                      <td className="px-2 py-3 text-[#171A17]">{o.customer_name}</td>
                      <td className="px-2 py-3"><OrderStatusBadge status={o.status} /></td>
                      <td className="px-2 py-3"><PaymentStatusBadge status={paymentStatusOf(o.status)} /></td>
                      <td className="px-2 py-3 text-right tabular-nums text-[#6B6F68]">{o.item_count}</td>
                      <td className="px-2 py-3 text-[#6B6F68]">{fmtDate(o.delivery_date)}</td>
                      <td className="px-2 py-3 text-right font-medium tabular-nums text-[#171A17]">{zar(o.total)}</td>
                      <td className="px-2 py-3 text-[#8A8E86]">{fmtDate(o.created_at)}</td>
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu
                          actions={[
                            { label: 'View', onClick: () => setDrawerId(o.id) },
                            { label: 'Open', onClick: () => router.push(`/app/orderflow/orders/${o.id}`) },
                            ...(canInvoice(o) ? [{ label: 'Generate invoice', onClick: () => void invoiceOne(o) }] : []),
                            { label: 'Create delivery note', onClick: () => void deliveryNoteFor(o) },
                            { label: 'Duplicate', onClick: () => void duplicateOrder(o) },
                            ...(!INVOICED_STATUSES.includes(o.status) && o.status !== 'cancelled'
                              ? [{ label: 'Cancel order', onClick: () => setCancelIds([o.id]), danger: true }]
                              : []),
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
        <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5">
          <h2 className="text-[14px] font-semibold text-[#171A17]">Orders needing attention</h2>
          {attention.length === 0 ? (
            <p className="mt-3 text-[13px] text-[#8A8E86]">Nothing needs attention — orders and invoices are on track.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2.5">
              {attention.map((a) => (
                <Link key={a.id} href={a.href} className="flex items-start gap-2.5 text-[13px] transition-colors hover:opacity-80">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: a.severity === 'high' ? '#A32D2D' : a.severity === 'medium' ? '#854F0B' : '#8A8E86' }}
                  />
                  <span className="text-[#6B6F68]">{a.text}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={cancelIds != null}
        title={cancelIds && cancelIds.length > 1 ? `Cancel ${cancelIds.length} orders?` : 'Cancel this order?'}
        body="Cancelled orders keep their history but reverse any stock movements. Invoiced orders are skipped."
        confirmLabel="Cancel orders"
        danger
        onConfirm={() => cancelIds && void cancelOrders(cancelIds)}
        onClose={() => setCancelIds(null)}
      />

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
            <div className="flex items-center justify-end gap-2">
              <Link href={`/app/orderflow/orders/${drawerOrder.id}`} className="rounded-lg border border-[#E2E6EC] bg-white px-3.5 py-2 text-[13px] font-medium text-[#171A17] hover:border-[#3E7BC4]/40">
                Open full page
              </Link>
              {canInvoice(drawerOrder) ? (
                <button
                  type="button"
                  onClick={() => void invoiceOne(drawerOrder)}
                  disabled={actionBusy}
                  className="rounded-lg bg-[#1F5FA8] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#174C87] disabled:opacity-40"
                >
                  Generate invoice
                </button>
              ) : null}
            </div>
          ) : undefined
        }
      >
        {drawerOrder ? <OrderDrawerBody order={drawerOrder} items={items} allOrders={orders} vatRate={vatRate} /> : null}
      </Drawer>

      {/* Quick-order builder (modal) */}
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[7vh]" style={{ fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties}>
          <button type="button" aria-label="Close" onClick={resetBuilder} className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 w-full max-w-[640px] rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.5)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#171A17]">Quick order</h3>
              <button type="button" onClick={resetBuilder} aria-label="Close" className="text-[#8A8E86] hover:text-[#171A17]">✕</button>
            </div>

            {/* Quick-start */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              <QuickStart onClick={repeatLastOrder}>↻ Repeat last order</QuickStart>
              <QuickStart onClick={() => { resetBuilder(); router.push('/app/orderflow/orders/new'); }}>Open full builder</QuickStart>
              <QuickStart onClick={() => toast('Use the Upload order button to import a document.')}>Upload order</QuickStart>
            </div>

            <label className="mb-1 block text-[12px] text-[#6B6F68]">Customer</label>
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
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[200px] overflow-y-auto rounded-xl border border-[#EAEDF2] bg-white py-1 shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
                  {custMatches.map((c) => (
                    <button key={c.id} type="button" onMouseDown={(e) => { e.preventDefault(); pickCustomer(c); }} className="block w-full truncate px-3 py-2 text-left text-[13px] text-[#171A17] transition-colors hover:bg-[#F5F9FE]">
                      {c.name}
                    </button>
                  ))}
                  {customerQuery.trim() && !custExact ? (
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); void createCustomer(customerQuery); }} disabled={creatingCustomer} className="block w-full truncate border-t border-[#EEF1F5] px-3 py-2 text-left text-[13px] font-medium text-[#1F5FA8] transition-colors hover:bg-[#F5F9FE] disabled:opacity-50">
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

            <label className="mb-1 block text-[12px] text-[#6B6F68]">Line items</label>
            <div className="relative mb-2">
              <input
                className={`${cell} h-10 w-full`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) addLine(matches[0]); }}
                placeholder="Search a product to add (or type a new name + Enter)…"
              />
              {matches.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[180px] overflow-y-auto rounded-xl border border-[#EAEDF2] bg-white shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
                  {matches.map((p) => (
                    <button key={p.id} type="button" onClick={() => addLine(p)} className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-[#171A17] transition-colors hover:bg-[#F5F9FE]">
                      <span className="truncate">{p.name}</span>
                      <span className="text-[12px] text-[#8A8E86]">{p.avg_unit_price != null ? zar(p.avg_unit_price) : ''}</span>
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
                    <button type="button" onClick={() => removeLine(l.key)} aria-label="Remove line" className="flex h-9 w-7 items-center justify-center rounded-lg text-[#8A8E86] hover:bg-[#FCEBEB] hover:text-[#A32D2D]">✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-[12px] text-[#8A8E86]">No items yet — search above to add products.</p>
            )}

            {/* Delivery + notes */}
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] text-[#6B6F68]">Delivery date</label>
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={`${cell} h-10 w-full`} />
              </div>
              <div>
                <label className="mb-1 block text-[12px] text-[#6B6F68]">Notes</label>
                <input value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Delivery / order notes…" className={`${cell} h-10 w-full`} />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#EEF1F5] pt-3">
              <span className="text-[14px] font-semibold text-[#171A17]">Total {zar(builderTotal)}</span>
              <div className="flex gap-2">
                <button type="button" onClick={resetBuilder} className="rounded-lg px-3.5 py-2 text-[13px] text-[#6B6F68] hover:bg-black/[0.03]">Cancel</button>
                <button type="button" onClick={() => void saveOrder()} disabled={!canSave || busy} className="rounded-lg bg-[#1F5FA8] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87] disabled:opacity-40">
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

function BulkBtn({ children, onClick, danger, disabled }: { children: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border bg-white px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50 ${
        danger ? 'border-[#F0D9D9] text-[#A32D2D] hover:bg-[#FCEBEB]' : 'border-[#E2E6EC] text-[#171A17] hover:border-[#3E7BC4]/40'
      }`}
    >
      {children}
    </button>
  );
}

function QuickStart({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full border border-[#EAEDF2] bg-white px-3 py-1.5 text-[12px] font-medium text-[#6B6F68] transition-colors hover:border-[#3E7BC4]/40 hover:text-[#171A17]">
      {children}
    </button>
  );
}

function OrderDrawerBody({ order, items, allOrders, vatRate }: { order: OrderRow; items: Record<string, OrderItemLite[]>; allOrders: OrderRow[]; vatRate: number }) {
  const its = items[order.id] ?? [];
  const totals = docTotals(its, vatRate);

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
        <Field label="Delivery">{fmtDate(order.delivery_date)}</Field>
      </div>
      {order.delivery_address ? (
        <Field label="Deliver to">
          <span className="text-[13px] text-[#6B6F68]">{order.delivery_address}</span>
        </Field>
      ) : null}
      {order.notes ? (
        <div className="rounded-xl border border-[#EEF1F5] bg-[#FCFCFB] px-3.5 py-2.5 text-[13px] text-[#6B6F68]">{order.notes}</div>
      ) : null}

      <Section title="Items">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#EEF1F5] text-[11px] uppercase tracking-wide text-[#8A8E86]">
              <th className="py-1.5 pr-2 text-left font-medium">Item</th>
              <th className="px-2 py-1.5 text-right font-medium">Qty</th>
              <th className="px-2 py-1.5 text-right font-medium">Price</th>
              <th className="py-1.5 pl-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {its.length === 0 ? (
              <tr><td colSpan={4} className="py-4 text-center text-[#8A8E86]">No items.</td></tr>
            ) : (
              its.map((i, idx) => (
                <tr key={idx} className="border-b border-[#F5F9FE] last:border-0">
                  <td className="py-2 pr-2 text-[#171A17]">{i.name}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#6B6F68]">{i.qty}{i.unit ? ` ${i.unit}` : ''}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#6B6F68]">{zar(i.unit_price)}</td>
                  <td className="py-2 pl-2 text-right tabular-nums font-medium text-[#171A17]">{zar((Number(i.qty) || 0) * (Number(i.unit_price) || 0))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="mt-3 space-y-1 border-t border-[#EEF1F5] pt-3 text-[13px]">
          <Row label="Subtotal" value={zar2(totals.subtotal)} />
          <Row label={`VAT (${vatRate}%)`} value={zar2(totals.vat)} muted />
          <Row label="Total" value={zar2(totals.total)} bold />
        </div>
      </Section>

      {comparison.length > 0 ? (
        <Section title={`Compared to previous order (${orderRef(prevOrder!)})`}>
          <div className="flex flex-col gap-1.5 text-[13px]">
            {comparison.slice(0, 8).map((c) => (
              <div key={c.name} className="flex items-center justify-between">
                <span className="text-[#6B6F68]">{c.name}</span>
                <span className="tabular-nums text-[#171A17]">
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
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[#8A8E86]">{label}</div>
      <div className="mt-1 text-[#171A17]">{children}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-semibold text-[#171A17]">{title}</h3>
      {children}
    </div>
  );
}
function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-[#8A8E86]' : 'text-[#6B6F68]'}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold text-[#171A17]' : 'text-[#171A17]'}`}>{value}</span>
    </div>
  );
}

// ===========================================================================
// Full-page new-order builder (rendered by /app/orderflow/orders/new). Mirrors
// the quote builder: CustomerSelect + delivery address (customer's saved
// cd_delivery_addresses or a free-text override) + delivery date/instructions/
// customer PO + LineItemsEditor with price-list resolution → builder.createOrder.
// ===========================================================================

export function NewOrderBuilder({ context, defaultCustomerId }: { context: BuilderContext; defaultCustomerId?: string | null }) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [customerId, setCustomerId] = useState<string | null>(defaultCustomerId ?? null);
  const [blines, setBlines] = useState<BuilderLine[]>([]);
  const initialAddress = defaultCustomerId
    ? context.addresses
        .filter((a) => a.customer_id === defaultCustomerId)
        .sort((a, b) => Number(b.is_default) - Number(a.is_default))[0] ?? null
    : null;
  /** '' = no address, 'custom' = free text, otherwise a cd_delivery_addresses id. */
  const [addressChoice, setAddressChoice] = useState<string>(initialAddress?.id ?? '');
  const [customAddress, setCustomAddress] = useState('');
  const [instructions, setInstructions] = useState(initialAddress?.instructions ?? '');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [customerPo, setCustomerPo] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vatRate = Number(context.settings.default_vat_rate) || 15;
  const customer = context.customers.find((c) => c.id === customerId) ?? null;
  const priceList = useMemo(() => customerPriceList(customer, context.priceLists), [customer, context.priceLists]);
  const customerAddresses = useMemo(
    () =>
      context.addresses
        .filter((a) => a.customer_id === customerId)
        .sort((a, b) => Number(b.is_default) - Number(a.is_default)),
    [context.addresses, customerId],
  );

  function pickCustomer(id: string | null) {
    setCustomerId(id);
    // Re-price product-linked lines (that haven't been manually overridden) to
    // the new customer's price list. This is what lets a Finch-loaded order
    // fill in prices when the customer is picked after loading — and also keeps
    // an already-built order correct when the customer is switched.
    const nextCustomer = context.customers.find((c) => c.id === id) ?? null;
    const nextList = customerPriceList(nextCustomer, context.priceLists);
    setBlines((prev) =>
      prev.map((l) => {
        if (!l.stock_item_id || (l.override_note ?? '').trim()) return l;
        const p = context.products.find((x) => x.id === l.stock_item_id);
        if (!p) return l;
        const r = resolvePrice(p, nextList, context.overrides);
        return { ...l, unit_price: r.price, source: r.source };
      }),
    );
    const def = context.addresses
      .filter((a) => a.customer_id === id)
      .sort((a, b) => Number(b.is_default) - Number(a.is_default))[0];
    setAddressChoice(def ? def.id : '');
    setCustomAddress('');
    setInstructions(def?.instructions ?? '');
  }

  const chosenAddress = customerAddresses.find((a) => a.id === addressChoice) ?? null;
  const deliveryAddress = addressChoice === 'custom' ? customAddress.trim() || null : chosenAddress ? formatAddress(chosenAddress) : null;

  /** A product line priced away from its resolved price needs a reason (override_note). */
  const missingReason = useMemo(
    () =>
      blines.some((l) => {
        if (!l.stock_item_id) return false;
        const p = context.products.find((x) => x.id === l.stock_item_id);
        if (!p) return false;
        const r = resolvePrice(p, priceList, context.overrides);
        return Math.abs((Number(l.unit_price) || 0) - r.price) > 0.005 && !(l.override_note ?? '').trim();
      }),
    [blines, context.products, priceList, context.overrides],
  );

  const validLines = blines.filter((l) => l.name.trim() && Number(l.qty) > 0);
  const totals = docTotals(validLines, vatRate);
  const canSave = !!customerId && validLines.length > 0 && !missingReason && !busy;

  async function save(status: 'draft' | 'confirmed') {
    if (busy) return;
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    if (!customerId) {
      setError('Pick a customer first.');
      return;
    }
    if (!validLines.length) {
      setError('Add at least one line item.');
      return;
    }
    if (missingReason) {
      setError('Every changed price needs a reason before saving.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createOrder(supabase, {
        orgId: org.id,
        actorEmail: email,
        customerId,
        lines: validLines,
        notes: notes.trim() || null,
        deliveryAddress,
        deliveryInstructions: instructions.trim() || null,
        deliveryDate: deliveryDate || null,
        customerPo: customerPo.trim() || null,
        status,
      });
      // Reflect the sale in ProcurePulse stock — same behaviour as the quick-order modal.
      await syncOrderStock(res.id, 'apply');
      toast(`Order ${res.number} created`);
      router.refresh();
      router.push(`/app/orderflow/orders/${res.id}`);
    } catch (err) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : 'Could not create the order.';
      setError(/column|relation|schema/i.test(msg) ? `${msg} — run supabase/core-data.sql to enable the full order builder.` : msg);
    }
  }

  /** Load an order Finch parsed in chat: match the customer, match each line
   *  to a catalogue product so it prices from the customer's price list (just
   *  like adding it by hand), and drop the lines in for review. Lines with no
   *  confident product match stay free-text at whatever price the doc carried. */
  function handleFinchLoad(order: ParsedOrder) {
    // Prefer an exact match; else exactly one unambiguous ≥4-char substring — an
    // ambiguous or short match would risk silently invoicing the wrong account,
    // so we leave the customer unset for the user to pick instead. Shared with
    // the server order-draft resolver so narration can't drift from the builder.
    const matched = order.customerName ? matchByName(context.customers, order.customerName, (c) => c.name) : null;

    // Resolve prices against whichever list applies now — the matched customer's,
    // or (if the customer didn't auto-match) the default list. Product lines get
    // linked regardless of the customer, and pickCustomer re-prices them, so the
    // user picking the customer manually still fills in the right prices.
    const pl = customerPriceList(matched, context.priceLists);
    const stamp = Date.now().toString(36);

    let pricedCount = 0;
    const lines: BuilderLine[] = order.items
      .filter((it) => (it.name ?? '').trim())
      .map((it, i) => {
        const key = `vai_${i}_${stamp}`;
        const qty = Number(it.qty) > 0 ? Number(it.qty) : 1;

        // Match to a catalogue product (same rule). Product matching is NOT gated
        // on the customer — an unmatched customer must not leave lines unpriced.
        const product = matchByName(context.products, it.name, (p) => p.name);

        if (product) {
          const r = resolvePrice(product, pl, context.overrides);
          pricedCount += 1;
          return {
            key,
            stock_item_id: product.id,
            name: product.name,
            qty,
            unit: product.unit ?? null,
            unit_price: r.price,
            source: r.source,
            override_note: null,
          };
        }

        // No confident match → free-text line at whatever price the doc carried.
        return {
          key,
          stock_item_id: null,
          name: it.name.trim(),
          qty,
          unit: null,
          unit_price: Number(it.unit_price) || 0,
          source: 'none' as const,
          override_note: null,
        };
      });

    // Set the lines first, then the customer: pickCustomer re-prices linked
    // lines off `blines`, so the lines must already be in state when it runs.
    setBlines(lines);
    if (matched) pickCustomer(matched.id);
    const suffix = pricedCount ? ` · ${pricedCount} priced from ${pl?.name ?? 'price list'}` : '';
    toast(`Loaded ${lines.length} item${lines.length === 1 ? '' : 's'} from Finch${suffix}`);
  }

  return (
    <div>
      {toastNode}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/app/orderflow/orders"
            className="inline-flex h-8 items-center gap-1 rounded-full border border-[#EAEDF2] bg-white px-3 text-[13px] text-[#6B6F68] transition-colors hover:border-[#3E7BC4]/30 hover:text-[#171A17]"
          >
            <span aria-hidden>‹</span> Orders
          </Link>
          <h1 className="text-[22px] font-bold text-[#171A17]">New order</h1>
        </div>
        <div className="flex items-center gap-2">
          <SecondaryBtn onClick={() => void save('draft')} disabled={!canSave}>
            {busy ? 'Saving…' : 'Save draft'}
          </SecondaryBtn>
          <PrimaryBtn onClick={() => void save('confirmed')} disabled={!canSave}>
            {busy ? 'Saving…' : 'Create & confirm'}
          </PrimaryBtn>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-[#F0D9D9] bg-[#FCEBEB] px-4 py-2.5 text-[13px] text-[#A32D2D]">{error}</div>
      ) : null}

      <div className="mt-5">
        <FinchOrderPrefill onLoad={handleFinchLoad} />
      </div>

      <div className="mt-1 grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
        {/* Customer + delivery */}
        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-[#EAEDF2] bg-white p-5">
            <h2 className="text-[14px] font-semibold text-[#171A17]">Customer</h2>
            <FormField label="Customer">
              <CustomerSelect customers={context.customers} value={customerId} onChange={pickCustomer} allowCreate />
            </FormField>
            <FormField label="Customer PO" hint="optional">
              <input value={customerPo} onChange={(e) => setCustomerPo(e.target.value)} placeholder="PO number on their order" className={inputClass} />
            </FormField>
          </div>

          <div className="space-y-4 rounded-2xl border border-[#EAEDF2] bg-white p-5">
            <h2 className="text-[14px] font-semibold text-[#171A17]">Delivery</h2>
            <FormField label="Deliver to">
              <select
                value={addressChoice}
                onChange={(e) => {
                  const v = e.target.value;
                  setAddressChoice(v);
                  const a = customerAddresses.find((x) => x.id === v);
                  if (a && a.instructions && !instructions.trim()) setInstructions(a.instructions);
                }}
                className={inputClass}
              >
                <option value="">No delivery address</option>
                {customerAddresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nickname ? `${a.nickname} — ` : ''}{formatAddress(a) || 'Saved address'}
                  </option>
                ))}
                <option value="custom">Custom address…</option>
              </select>
            </FormField>
            {addressChoice === 'custom' ? (
              <FormField label="Address">
                <textarea
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  rows={2}
                  placeholder="Street, suburb, city…"
                  className="w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-[13px] text-[#171A17] placeholder:text-[#8A8E86] focus:border-[#3E7BC4]/50 focus:outline-none"
                />
              </FormField>
            ) : chosenAddress ? (
              <p className="rounded-xl border border-[#EEF1F5] bg-[#FBFCFE] px-3 py-2 text-[12px] text-[#6B6F68]">{formatAddress(chosenAddress) || '—'}</p>
            ) : null}
            <FormField label="Delivery date">
              <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Delivery instructions" hint="optional">
              <input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Gate code, receiving hours…" className={inputClass} />
            </FormField>
          </div>

          <div className="space-y-4 rounded-2xl border border-[#EAEDF2] bg-white p-5">
            <h2 className="text-[14px] font-semibold text-[#171A17]">Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal order notes…"
              className="w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-[13px] text-[#171A17] placeholder:text-[#8A8E86] focus:border-[#3E7BC4]/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Line items + totals */}
        <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5">
          <h2 className="text-[14px] font-semibold text-[#171A17]">Line items</h2>
          <div className="mt-3">
            <LineItemsEditor
              products={context.products}
              priceList={priceList}
              overrides={context.overrides}
              lines={blines}
              onChange={setBlines}
            />
          </div>
          <div className="mt-4 ml-auto w-full max-w-[280px] space-y-1.5 border-t border-[#EEF1F5] pt-3 text-[13px]">
            <Row label="Subtotal" value={zar2(totals.subtotal)} />
            <Row label={`VAT (${vatRate}%) if invoiced`} value={zar2(totals.vat)} muted />
            <Row label="Total" value={zar2(totals.total)} bold />
          </div>
        </div>
      </div>
    </div>
  );
}

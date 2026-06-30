'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import {
  PRICING_STATUSES,
  PRICING_STATUS_LABEL,
  paymentStatusOf,
  zar,
  type CustomerHealth,
  type OfCustomer,
  type PricingStatus,
} from '@/lib/platform/orderflow';
import {
  deriveCustomerMetrics,
  customerHealth,
  deriveInvoice,
  customerTag,
  mockPaymentTermsDays,
  mockContacts,
  mockDelivery,
  mockNotes,
  mockFavourites,
  customerTimeline,
  type CustomerMetrics,
  type OrderLite,
} from '@/lib/platform/orderflow-crm';
import { Kpi, CustomerHealthBadge, OrderStatusBadge, PaymentStatusBadge, InvoiceStatusBadge, RowActionsMenu, Drawer, useToast } from './ui';

interface Enriched {
  c: OfCustomer;
  ords: OrderLite[];
  metrics: CustomerMetrics;
  health: CustomerHealth;
  reasons: string[];
  tag: string;
  terms: number;
  contact: string;
}
interface Draft {
  name: string;
  email: string;
  phone: string;
  pricing_status: PricingStatus;
  notes: string;
}
const EMPTY: Draft = { name: '', email: '', phone: '', pricing_status: 'standard', notes: '' };

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function freqLabel(f: number) {
  if (f <= 0) return '—';
  if (f >= 0.85) return `${f.toFixed(1)}/wk`;
  return `${(f * 4.33).toFixed(1)}/mo`;
}

export function CustomersView({ customers, ordersByCustomer }: { customers: OfCustomer[]; ordersByCustomer: Record<string, OrderLite[]> }) {
  const router = useRouter();
  const { org } = usePlatform();
  const { node: toastNode, show: toast } = useToast();
  const now = Date.now();

  const [search, setSearch] = useState('');
  const [healthFilter, setHealthFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [termsFilter, setTermsFilter] = useState('all');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const enriched: Enriched[] = useMemo(
    () =>
      customers.map((c) => {
        const ords = ordersByCustomer[c.id] ?? [];
        const metrics = deriveCustomerMetrics(ords, now);
        const { health, reasons } = customerHealth(metrics);
        return { c, ords, metrics, health, reasons, tag: customerTag(c), terms: mockPaymentTermsDays(c.id), contact: mockContacts(c)[0].name };
      }),
    [customers, ordersByCustomer, now],
  );
  const byId = useMemo(() => new Map(enriched.map((e) => [e.c.id, e])), [enriched]);
  const tags = useMemo(() => Array.from(new Set(enriched.map((e) => e.tag))).sort(), [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((e) => {
      if (healthFilter !== 'all' && e.health !== healthFilter) return false;
      if (tagFilter !== 'all' && e.tag !== tagFilter) return false;
      if (termsFilter !== 'all' && String(e.terms) !== termsFilter) return false;
      if (q && !`${e.c.name} ${e.contact} ${e.c.email ?? ''} ${e.c.phone ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enriched, search, healthFilter, tagFilter, termsFilter]);

  // CRUD (preserved)
  function startNew() {
    setDraft(EMPTY);
    setEditing('new');
  }
  function startEdit(c: OfCustomer) {
    setDraft({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', pricing_status: c.pricing_status, notes: c.notes ?? '' });
    setEditing(c.id);
  }
  async function save() {
    if (!draft.name.trim() || busy) return;
    const supabase = createClient();
    if (!supabase || !org?.id) return;
    setBusy(true);
    const payload = {
      name: draft.name.trim(),
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      pricing_status: draft.pricing_status,
      notes: draft.notes.trim() || null,
    };
    if (editing === 'new') await supabase.from('of_customers').insert({ org_id: org.id, ...payload });
    else if (editing) await supabase.from('of_customers').update(payload).eq('id', editing);
    setBusy(false);
    setEditing(null);
    router.refresh();
  }
  async function remove(id: string) {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    await supabase.from('of_customers').delete().eq('id', id);
    setBusy(false);
    setConfirmDel(null);
    setProfileId(null);
    router.refresh();
  }

  const profile = profileId ? byId.get(profileId) ?? null : null;
  const filterSel = 'h-9 rounded-lg border border-[#D7DAD8] bg-white px-2.5 text-[13px] text-[#5F6368] outline-none focus:border-[#1E5E54]';
  const field = 'h-10 w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none';

  return (
    <div>
      {toastNode}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#1A1C1E]">Customers</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">Your customer book — health, history, contacts and pricing</p>
        </div>
        <button type="button" onClick={startNew} className="inline-flex h-10 items-center rounded-xl bg-[#1E5E54] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#184D45]">
          + New customer
        </button>
      </div>

      <InsightsPanel enriched={enriched} onOpen={setProfileId} />

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer or contact…"
          className="h-9 min-w-[240px] flex-1 rounded-lg border border-[#D7DAD8] bg-white px-3 text-[13px] text-[#1A1C1E] outline-none placeholder:text-[#9A9DA1] focus:border-[#1E5E54]"
        />
        <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value)} className={filterSel}>
          <option value="all">All health</option>
          <option value="excellent">Excellent</option>
          <option value="stable">Stable</option>
          <option value="at_risk">At risk</option>
          <option value="needs_attention">Needs attention</option>
        </select>
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={filterSel}>
          <option value="all">All types</option>
          {tags.map((t) => (<option key={t} value={t}>{t}</option>))}
        </select>
        <select value={termsFilter} onChange={(e) => setTermsFilter(e.target.value)} className={filterSel}>
          <option value="all">All terms</option>
          {[7, 14, 30, 45].map((t) => (<option key={t} value={String(t)}>{t} days</option>))}
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-3 py-2.5 text-left font-medium">Customer</th>
                <th className="px-2 py-2.5 text-left font-medium">Type</th>
                <th className="px-2 py-2.5 text-left font-medium">Main contact</th>
                <th className="px-2 py-2.5 text-right font-medium">Lifetime</th>
                <th className="px-2 py-2.5 text-right font-medium">Outstanding</th>
                <th className="px-2 py-2.5 text-left font-medium">Last order</th>
                <th className="px-2 py-2.5 text-right font-medium">Frequency</th>
                <th className="px-2 py-2.5 text-left font-medium">Terms</th>
                <th className="px-2 py-2.5 text-left font-medium">Health</th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-5 py-12 text-center text-[14px] text-[#9A9DA1]">{customers.length === 0 ? 'No customers yet — add your first.' : 'No customers match.'}</td></tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.c.id} onClick={() => setProfileId(e.c.id)} className="cursor-pointer border-b border-[#F6F6F2] last:border-0 hover:bg-[#FAFAF8]">
                    <td className="px-3 py-3 font-medium text-[#1A1C1E]">{e.c.name}</td>
                    <td className="px-2 py-3 text-[#5F6368]">{e.tag}</td>
                    <td className="px-2 py-3 text-[#5F6368]">{e.contact}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-[#1A1C1E]">{zar(e.metrics.lifetimeRevenue)}</td>
                    <td className="px-2 py-3 text-right tabular-nums" style={{ color: e.metrics.outstanding > 0 ? '#A32D2D' : '#9A9DA1' }}>{e.metrics.outstanding > 0 ? zar(e.metrics.outstanding) : '—'}</td>
                    <td className="px-2 py-3 text-[#5F6368]">{fmtDate(e.metrics.lastOrder)}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-[#5F6368]">{freqLabel(e.metrics.frequencyPerWeek)}</td>
                    <td className="px-2 py-3 text-[#5F6368]">{e.terms}d</td>
                    <td className="px-2 py-3"><CustomerHealthBadge health={e.health} /></td>
                    <td className="px-2 py-3" onClick={(ev) => ev.stopPropagation()}>
                      <RowActionsMenu
                        actions={[
                          { label: 'View profile', onClick: () => setProfileId(e.c.id) },
                          { label: 'Edit', onClick: () => startEdit(e.c) },
                          { label: 'New order', onClick: () => router.push('/app/orderflow/orders') },
                          { label: 'View invoices', onClick: () => setProfileId(e.c.id) },
                          { label: 'Delete', onClick: () => setConfirmDel(e.c.id), danger: true },
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

      {/* Profile drawer */}
      <Drawer
        open={!!profile}
        onClose={() => setProfileId(null)}
        title={profile ? profile.c.name : ''}
        subtitle={profile ? `${profile.tag} · ${profile.terms}-day terms` : undefined}
        right={profile ? <CustomerHealthBadge health={profile.health} /> : undefined}
        width={560}
        footer={
          profile ? (
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => { startEdit(profile.c); }} className="text-[13px] font-medium text-[#5F6368] hover:text-[#1A1C1E]">Edit details</button>
              <button type="button" onClick={() => router.push('/app/orderflow/orders')} className="rounded-lg bg-[#1E5E54] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#184D45]">New order</button>
            </div>
          ) : undefined
        }
      >
        {profile ? <CustomerProfile e={profile} now={now} /> : null}
      </Drawer>

      {/* Create / edit modal */}
      {editing ? (
        <div className="fixed inset-0 z-[95] flex items-start justify-center p-4 pt-[10vh]">
          <button type="button" aria-label="Close" onClick={() => setEditing(null)} className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 w-full max-w-[560px] rounded-2xl border border-[#E7E7E2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.5)]">
            <h3 className="mb-4 text-[16px] font-semibold text-[#1A1C1E]">{editing === 'new' ? 'New customer' : 'Edit customer'}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input className={field} placeholder="Customer name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <select className={field} value={draft.pricing_status} onChange={(e) => setDraft({ ...draft, pricing_status: e.target.value as PricingStatus })}>
                {PRICING_STATUSES.map((p) => (<option key={p} value={p}>{PRICING_STATUS_LABEL[p]}</option>))}
              </select>
              <input className={field} placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              <input className={field} placeholder="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              <input className={`${field} sm:col-span-2`} placeholder="Notes (e.g. prefers larger avocados)" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">Cancel</button>
              <button type="button" onClick={() => void save()} disabled={busy || !draft.name.trim()} className="rounded-lg bg-[#1E5E54] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-40">
                {busy ? 'Saving…' : editing === 'new' ? 'Add customer' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete confirm */}
      {confirmDel ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <button type="button" aria-label="Close" onClick={() => setConfirmDel(null)} className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 w-full max-w-[360px] rounded-2xl border border-[#E7E7E2] bg-white p-5 text-center shadow-[0_24px_70px_-20px_rgba(26,28,30,0.5)]">
            <p className="text-[15px] font-semibold text-[#1A1C1E]">Delete this customer?</p>
            <p className="mt-1 text-[13px] text-[#5F6368]">Their orders and invoices stay, but the customer record is removed.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={() => setConfirmDel(null)} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">Cancel</button>
              <button type="button" onClick={() => void remove(confirmDel)} disabled={busy} className="rounded-lg bg-[#A32D2D] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#8f2727] disabled:opacity-40">Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InsightsPanel({ enriched, onOpen }: { enriched: Enriched[]; onOpen: (id: string) => void }) {
  const top = [...enriched].sort((a, b) => b.metrics.lifetimeRevenue - a.metrics.lifetimeRevenue).filter((e) => e.metrics.lifetimeRevenue > 0).slice(0, 4);
  const inactive = enriched.filter((e) => (e.metrics.daysSinceLastOrder ?? 0) > 21).sort((a, b) => (b.metrics.daysSinceLastOrder ?? 0) - (a.metrics.daysSinceLastOrder ?? 0)).slice(0, 4);
  const overdue = enriched.filter((e) => e.metrics.outstanding > 0).sort((a, b) => b.metrics.outstanding - a.metrics.outstanding).slice(0, 4);
  const reorder = enriched.filter((e) => e.metrics.frequencyPerWeek >= 0.8 && (e.metrics.daysSinceLastOrder ?? 0) >= 7 && (e.metrics.daysSinceLastOrder ?? 0) <= 20).slice(0, 4);
  if (enriched.length === 0) return null;

  return (
    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <InsightCard title="Top customers" empty="No revenue yet">
        {top.map((e) => (<InsightRow key={e.c.id} name={e.c.name} value={zar(e.metrics.lifetimeRevenue)} onClick={() => onOpen(e.c.id)} />))}
      </InsightCard>
      <InsightCard title="Overdue balances" empty="Nothing overdue" tone="danger">
        {overdue.map((e) => (<InsightRow key={e.c.id} name={e.c.name} value={zar(e.metrics.outstanding)} valueColor="#A32D2D" onClick={() => onOpen(e.c.id)} />))}
      </InsightCard>
      <InsightCard title="Going quiet" empty="Everyone's active" tone="warn">
        {inactive.map((e) => (<InsightRow key={e.c.id} name={e.c.name} value={`${e.metrics.daysSinceLastOrder}d`} onClick={() => onOpen(e.c.id)} />))}
      </InsightCard>
      <InsightCard title="Suggested reorders" empty="No reorders due">
        {reorder.length === 0 ? null : reorder.map((e) => (<InsightRow key={e.c.id} name={e.c.name} value="due" onClick={() => onOpen(e.c.id)} />))}
      </InsightCard>
    </div>
  );
}
function InsightCard({ title, children, empty, tone }: { title: string; children: React.ReactNode; empty: string; tone?: 'danger' | 'warn' }) {
  const hasChildren = Array.isArray(children) ? children.filter(Boolean).length > 0 : !!children;
  const dot = tone === 'danger' ? '#A32D2D' : tone === 'warn' ? '#854F0B' : '#1E5E54';
  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
        <h3 className="text-[13px] font-semibold text-[#1A1C1E]">{title}</h3>
      </div>
      {hasChildren ? <div className="flex flex-col gap-1.5">{children}</div> : <p className="text-[12px] text-[#9A9DA1]">{empty}</p>}
    </div>
  );
}
function InsightRow({ name, value, valueColor, onClick }: { name: string; value: string; valueColor?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center justify-between text-left text-[13px] transition-colors hover:opacity-75">
      <span className="min-w-0 truncate text-[#5F6368]">{name}</span>
      <span className="shrink-0 font-medium tabular-nums" style={{ color: valueColor ?? '#1A1C1E' }}>{value}</span>
    </button>
  );
}

const TABS = ['Overview', 'Orders', 'Invoices', 'Contacts', 'Notes', 'Delivery', 'Timeline', 'Attachments'] as const;
type Tab = (typeof TABS)[number];

function CustomerProfile({ e, now }: { e: Enriched; now: number }) {
  const [tab, setTab] = useState<Tab>('Overview');
  const { c, ords, metrics } = e;
  const contacts = mockContacts(c);
  const delivery = mockDelivery(c);
  const notes = mockNotes(c);
  const favourites = mockFavourites(c);
  const timeline = customerTimeline(ords, c.name, metrics);
  let seq = 1;
  const invoices = ords
    .filter((o) => o.invoice_number || o.status === 'invoiced' || o.status === 'partially_paid' || o.status === 'paid')
    .map((o) => deriveInvoice(o, c.name, seq++, now));
  const sortedOrders = [...ords].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div>
      <div className="-mt-1 mb-4 flex flex-wrap gap-x-4 gap-y-1 border-b border-[#F0F0EC] pb-2">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`-mb-px border-b-2 pb-1.5 pt-1 text-[13px] transition-colors ${tab === t ? 'border-[#1E5E54] font-medium text-[#1A1C1E]' : 'border-transparent text-[#9A9DA1] hover:text-[#5F6368]'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Lifetime revenue" value={zar(metrics.lifetimeRevenue)} />
            <Kpi label="Outstanding" value={zar(metrics.outstanding)} accent={metrics.outstanding > 0 ? '#A32D2D' : undefined} />
            <Kpi label="Avg order" value={zar(metrics.aov)} />
            <Kpi label="Monthly spend" value={zar(metrics.monthlySpend)} />
            <Kpi label="Last order" value={fmtDate(metrics.lastOrder)} />
            <Kpi label="Frequency" value={freqLabel(metrics.frequencyPerWeek)} />
          </div>
          <Section title="Favourite products">
            <div className="flex flex-wrap gap-1.5">
              {favourites.map((f) => (<span key={f} className="rounded-full border border-[#E7E7E2] bg-white px-3 py-1 text-[12px] text-[#5F6368]">{f}</span>))}
            </div>
          </Section>
          {e.reasons.length ? (
            <Section title="Health notes">
              <ul className="list-inside list-disc text-[13px] text-[#5F6368]">{e.reasons.map((r, i) => (<li key={i}>{r}</li>))}</ul>
            </Section>
          ) : null}
        </div>
      ) : null}

      {tab === 'Orders' ? (
        <MiniTable
          head={['Order', 'Status', 'Payment', 'Total', '']}
          rows={sortedOrders.map((o) => [
            o.invoice_number ?? `#${o.id.slice(0, 6).toUpperCase()}`,
            <OrderStatusBadge key="s" status={o.status} />,
            <PaymentStatusBadge key="p" status={paymentStatusOf(o.status)} />,
            zar(o.total),
            <Link key="l" href={`/app/orderflow/orders/${o.id}`} className="text-[12px] font-medium text-[#1E5E54] hover:underline">Open</Link>,
          ])}
          empty="No orders yet."
        />
      ) : null}

      {tab === 'Invoices' ? (
        <MiniTable
          head={['Invoice', 'Status', 'Issued', 'Total', 'Balance']}
          rows={invoices.map((inv) => [
            inv.number,
            <InvoiceStatusBadge key="s" status={inv.status} />,
            fmtDate(inv.issued),
            zar(inv.total),
            <span key="b" style={{ color: inv.balance > 0 ? '#A32D2D' : '#0F6E56' }}>{zar(inv.balance)}</span>,
          ])}
          empty="No invoices yet."
        />
      ) : null}

      {tab === 'Contacts' ? (
        <div className="space-y-2">
          {contacts.map((ct) => (
            <div key={ct.id} className="rounded-xl border border-[#F0F0EC] bg-[#FCFCFB] px-3.5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-[#1A1C1E]">{ct.name}</span>
                <span className="rounded-full bg-[#F0F0EC] px-2 py-0.5 text-[11px] text-[#5F6368]">{ct.role}</span>
                {ct.primary ? <span className="rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[11px] text-[#0F6E56]">Primary</span> : null}
              </div>
              <div className="mt-0.5 text-[13px] text-[#5F6368]">{ct.email} · {ct.phone}</div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'Notes' ? (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-[#F0F0EC] bg-[#FCFCFB] px-3.5 py-2.5">
              <div className="text-[13px] text-[#1A1C1E]">{n.body}</div>
              <div className="mt-0.5 text-[11px] text-[#9A9DA1]">{n.author} · {fmtDate(n.created_at)}</div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'Delivery' ? (
        <div className="space-y-2 text-[13px]">
          <KeyVal k="Address" v={delivery.address} />
          <KeyVal k="Delivery days" v={delivery.days.join(', ')} />
          <KeyVal k="Receiving hours" v={delivery.receivingHours} />
          <KeyVal k="Dock instructions" v={delivery.dock} />
          <KeyVal k="Notes" v={delivery.notes} />
        </div>
      ) : null}

      {tab === 'Timeline' ? (
        <div className="flex flex-col gap-3">
          {timeline.length === 0 ? <p className="text-[13px] text-[#9A9DA1]">No activity yet.</p> : timeline.map((t) => (
            <div key={t.id} className="flex gap-3 text-[13px]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: t.kind === 'warning' ? '#A32D2D' : t.kind === 'payment' ? '#0F6E56' : '#1E5E54' }} />
              <div className="min-w-0">
                <div className="text-[#1A1C1E]">{t.label}{t.detail ? <span className="text-[#9A9DA1]"> · {t.detail}</span> : null}</div>
                <div className="text-[11px] text-[#9A9DA1]">{fmtDate(t.date)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'Attachments' ? (
        <p className="rounded-xl border border-dashed border-[#E7E7E2] px-3.5 py-6 text-center text-[12px] text-[#9A9DA1]">
          No attachments yet — POs, signed delivery notes and account documents will appear here.
        </p>
      ) : null}
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
function KeyVal({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[#9A9DA1]">{k}</span>
      <span className="text-right text-[#1A1C1E]">{v}</span>
    </div>
  );
}
function MiniTable({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-[13px] text-[#9A9DA1]">{empty}</p>;
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-[#F0F0EC] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
          {head.map((h, i) => (<th key={i} className={`py-1.5 ${i === 0 ? 'pr-2 text-left' : i === head.length - 1 ? 'pl-2 text-right' : 'px-2 text-left'} font-medium`}>{h}</th>))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="border-b border-[#F6F6F2] last:border-0">
            {r.map((cell, ci) => (<td key={ci} className={`py-2 ${ci === 0 ? 'pr-2 font-medium text-[#1A1C1E]' : ci === r.length - 1 ? 'pl-2 text-right tabular-nums' : 'px-2 text-[#5F6368]'}`}>{cell}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

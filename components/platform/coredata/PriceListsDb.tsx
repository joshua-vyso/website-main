'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { useToast, RowActionsMenu } from '@/components/platform/orderflow/ui';
import { logActivity } from '@/lib/platform/orderflow-activity';
import { priceListStatus, PRICE_LIST_STATUS_STYLE, type CdPriceList } from '@/lib/platform/coredata';
import type { PriceCadence } from '@/lib/platform/pricepilot';
import type { CoreData } from '@/lib/platform/coredata-data';
import { Field, Modal, PrimaryBtn, SecondaryBtn, EmptyState, SearchInput, Pill, inputClass } from './ui';

interface Draft {
  name: string;
  customer_id: string;
  default_margin_pct: string;
  valid_from: string;
  valid_until: string;
  cadence: PriceCadence;
  notes: string;
}

const EMPTY: Draft = {
  name: '',
  customer_id: '',
  default_margin_pct: '',
  valid_from: '',
  valid_until: '',
  cadence: 'standard',
  notes: '',
};

const CADENCES: { value: PriceCadence; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PriceListsDb({ data }: { data: CoreData }) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customerName = useMemo(() => new Map(data.customers.map((c) => [c.id, c.name])), [data.customers]);
  const overridesByList = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of data.overrides) m.set(o.price_list_id, (m.get(o.price_list_id) ?? 0) + 1);
    return m;
  }, [data.overrides]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.priceLists.filter((l) => {
      if (statusFilter !== 'all' && priceListStatus(l) !== statusFilter) return false;
      const cName = l.customer_id ? customerName.get(l.customer_id) ?? '' : 'all customers';
      if (q && !`${l.name} ${cName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.priceLists, search, statusFilter, customerName]);

  function startNew() {
    setDraft(EMPTY);
    setError(null);
    setEditing('new');
  }
  function startEdit(l: CdPriceList) {
    setDraft({
      name: l.name ?? '',
      customer_id: l.customer_id ?? '',
      default_margin_pct: l.default_margin_pct != null ? String(l.default_margin_pct) : '',
      valid_from: l.valid_from ?? '',
      valid_until: l.valid_until ?? '',
      cadence: (l.cadence as PriceCadence) ?? 'standard',
      notes: l.notes ?? '',
    });
    setError(null);
    setEditing(l.id);
  }

  async function save() {
    if (!draft.name.trim()) {
      setError('Name is required.');
      return;
    }
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const marginNum = draft.default_margin_pct.trim() === '' ? 0 : Number(draft.default_margin_pct.replace(/[%\s]/g, ''));
    const payload = {
      name: draft.name.trim(),
      customer_id: draft.customer_id || null,
      default_margin_pct: Number.isFinite(marginNum) ? marginNum : 0,
      valid_from: draft.valid_from || null,
      valid_until: draft.valid_until || null,
      cadence: draft.cadence,
      notes: draft.notes.trim() || null,
    };
    if (editing === 'new') {
      const { data: inserted, error: err } = await supabase
        .from('pl_price_lists')
        .insert({ org_id: org.id, ...payload })
        .select('id')
        .single();
      setBusy(false);
      if (err) {
        setError(err.message.includes('column') || err.message.includes('relation') ? 'Run supabase/core-data.sql to enable price lists.' : err.message);
        return;
      }
      logActivity(supabase, { orgId: org.id, actorEmail: email, entityType: 'price_list', entityId: inserted?.id ?? null, customerId: payload.customer_id, event: 'price_list_updated', description: `Created ${payload.name}` });
      setEditing(null);
      toast('Price list created');
      router.refresh();
    } else if (editing) {
      const { error: err } = await supabase.from('pl_price_lists').update(payload).eq('id', editing);
      setBusy(false);
      if (err) {
        setError(err.message);
        return;
      }
      logActivity(supabase, { orgId: org.id, actorEmail: email, entityType: 'price_list', entityId: editing, customerId: payload.customer_id, event: 'price_list_updated', description: `Updated ${payload.name}` });
      setEditing(null);
      toast('Price list updated');
      router.refresh();
    }
  }

  const hasAny = data.priceLists.length > 0;

  return (
    <div className="space-y-4">
      {toastNode}

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#E7E7E2] bg-[#FBFBF9] px-4 py-3">
        <p className="max-w-2xl text-[13px] text-[#5F6368]">
          This is the governance view — list settings and validity. To set per-product margins and custom prices, open the full
          editor in OrderFlow.
        </p>
        <Link
          href="/app/orderflow/pricelists"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-[#D7DAD8] bg-white px-4 text-[13px] font-medium text-[#1F5FA8] transition-colors hover:bg-[#F0F0EC]"
        >
          Open the full editor →
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search price lists…" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="scheduled">Scheduled</option>
          <option value="expired">Expired</option>
        </select>
        <div className="ml-auto">
          <PrimaryBtn onClick={startNew}>New price list</PrimaryBtn>
        </div>
      </div>

      {!hasAny ? (
        <EmptyState
          title="No price lists yet"
          body="Customer-specific pricing with margins, custom prices and validity windows. Create one here, then set item pricing in the full editor."
          action={<PrimaryBtn onClick={startNew}>New price list</PrimaryBtn>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" body="No price lists match your search and filters." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#E7E7E2] bg-white">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E7E7E2] text-left text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 text-right font-semibold">Default margin</th>
                <th className="px-4 py-3 font-semibold">Validity</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Overrides</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const st = priceListStatus(l);
                const style = PRICE_LIST_STATUS_STYLE[st];
                return (
                  <tr key={l.id} className="border-b border-[#F0F0EC] last:border-0 hover:bg-[#FBFBF9]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1A1C1E]">{l.name}</div>
                      {l.notes ? <div className="max-w-[280px] truncate text-[11px] text-[#9A9DA1]">{l.notes}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-[#5F6368]">{l.customer_id ? customerName.get(l.customer_id) ?? 'Unknown' : 'All customers'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#1A1C1E]">{l.default_margin_pct != null ? `${l.default_margin_pct}%` : '—'}</td>
                    <td className="px-4 py-3 text-[#5F6368]">
                      {l.valid_from || l.valid_until ? `${fmtDate(l.valid_from)} → ${fmtDate(l.valid_until)}` : 'Always'}
                    </td>
                    <td className="px-4 py-3">
                      <Pill label={style.label} bg={style.bg} fg={style.fg} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#5F6368]">{overridesByList.get(l.id) ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <RowActionsMenu
                        actions={[
                          { label: 'Edit list settings', onClick: () => startEdit(l) },
                          { label: 'Open in editor', onClick: () => router.push('/app/orderflow/pricelists') },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New price list' : 'Edit price list'}
        subtitle="List-level settings. Per-item margins and custom prices are set in the OrderFlow editor."
        width={520}
        footer={
          <>
            <SecondaryBtn onClick={() => setEditing(null)} disabled={busy}>Cancel</SecondaryBtn>
            <PrimaryBtn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</PrimaryBtn>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Wholesale — Q3" className={inputClass} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Customer" hint="(blank = all customers)">
              <select value={draft.customer_id} onChange={(e) => setDraft({ ...draft, customer_id: e.target.value })} className={inputClass}>
                <option value="">All customers</option>
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Default margin %">
              <input value={draft.default_margin_pct} onChange={(e) => setDraft({ ...draft, default_margin_pct: e.target.value })} placeholder="25" inputMode="decimal" className={inputClass} />
            </Field>
            <Field label="Valid from" hint="(optional)">
              <input type="date" value={draft.valid_from} onChange={(e) => setDraft({ ...draft, valid_from: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Valid until" hint="(optional)">
              <input type="date" value={draft.valid_until} onChange={(e) => setDraft({ ...draft, valid_until: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Cadence">
              <select value={draft.cadence} onChange={(e) => setDraft({ ...draft, cadence: e.target.value as PriceCadence })} className={inputClass}>
                {CADENCES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Notes" hint="(optional)">
            <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Internal notes" className={`${inputClass} h-16 py-2`} />
          </Field>
          {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>
      </Modal>
    </div>
  );
}

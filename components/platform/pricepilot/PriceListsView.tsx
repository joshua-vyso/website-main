'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { CADENCES, CADENCE_LABEL, type PriceCadence } from '@/lib/platform/pricepilot';

export interface PriceListRow {
  id: string;
  name: string;
  customer_name: string;
  default_margin_pct: number;
  cadence: PriceCadence;
  created_at: string;
}
interface CustomerLite {
  id: string;
  name: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PriceListsView({ lists, customers }: { lists: PriceListRow[]; customers: CustomerLite[] }) {
  const router = useRouter();
  const { org } = usePlatform();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [margin, setMargin] = useState('25');
  const [cadence, setCadence] = useState<PriceCadence>('standard');
  const [busy, setBusy] = useState(false);

  function reset() {
    setOpen(false);
    setName('');
    setCustomerId('');
    setMargin('25');
    setCadence('standard');
  }

  async function create() {
    if (!name.trim() || busy) return;
    const supabase = createClient();
    if (!supabase || !org?.id) return;
    setBusy(true);
    const { data } = await supabase
      .from('pl_price_lists')
      .insert({
        org_id: org.id,
        name: name.trim(),
        customer_id: customerId || null,
        default_margin_pct: Number(margin) || 0,
        cadence,
      })
      .select('id')
      .single();
    setBusy(false);
    reset();
    if (data?.id) router.push(`/app/pricepilot/price-lists/${data.id}`);
    else router.refresh();
  }

  const field = 'h-10 w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-[14px] text-[#1A1C1E] focus:border-[#3E7BC4]/40 focus:outline-none';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#1A1C1E]">Price lists</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">Sell prices built from ProcurePulse base prices with your margins</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center rounded-xl bg-[#1F5FA8] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#174C87]">
          + New price list
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="flex items-center border-b border-[#F0F0EC] bg-[#FBFBF9] px-5 py-2.5 text-[12px] text-[#5F6368]">
          <div className="flex-1">Name</div>
          <div className="w-[180px]">Customer</div>
          <div className="w-[110px]">Cadence</div>
          <div className="w-[110px] text-right">Margin</div>
          <div className="w-[140px] text-right">Created</div>
        </div>
        {lists.length === 0 ? (
          <div className="px-5 py-12 text-center text-[14px] text-[#9A9DA1]">No price lists yet — create your first.</div>
        ) : (
          lists.map((l) => (
            <Link key={l.id} href={`/app/pricepilot/price-lists/${l.id}`} className="flex items-center border-t border-[#F0F0EC] px-5 py-3.5 text-[13px] text-[#1A1C1E] transition-colors hover:bg-[#FAFAF8]">
              <div className="flex-1 font-medium">{l.name}</div>
              <div className="w-[180px] text-[#5F6368]">{l.customer_name}</div>
              <div className="w-[110px] text-[#5F6368]">{CADENCE_LABEL[l.cadence]}</div>
              <div className="w-[110px] text-right font-medium">{l.default_margin_pct}%</div>
              <div className="w-[140px] text-right text-[#9A9DA1]">{fmtDate(l.created_at)}</div>
            </Link>
          ))
        )}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]">
          <button type="button" aria-label="Close" onClick={reset} className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 w-full max-w-[460px] rounded-2xl border border-[#E7E7E2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.5)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#1A1C1E]">New price list</h3>
              <button type="button" onClick={reset} aria-label="Close" className="text-[#9A9DA1] hover:text-[#1A1C1E]">✕</button>
            </div>
            <div className="space-y-3">
              <input className={field} placeholder="Price list name (e.g. Restaurants — Weekly)" value={name} onChange={(e) => setName(e.target.value)} />
              <select className={field} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">All customers (general list)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-[12px] text-[#5F6368]">Default margin %</label>
                  <input className={field} inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value.replace(/[^0-9.]/g, ''))} />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[12px] text-[#5F6368]">Cadence</label>
                  <select className={field} value={cadence} onChange={(e) => setCadence(e.target.value as PriceCadence)}>
                    {CADENCES.map((c) => (
                      <option key={c} value={c}>{CADENCE_LABEL[c]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={reset} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">Cancel</button>
              <button type="button" onClick={() => void create()} disabled={busy || !name.trim()} className="rounded-lg bg-[#1F5FA8] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87] disabled:opacity-40">
                {busy ? 'Creating…' : 'Create & edit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

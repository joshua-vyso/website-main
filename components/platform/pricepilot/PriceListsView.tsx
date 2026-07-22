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

  const field = 'h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="of-display text-[28px] font-semibold tracking-[-0.015em] text-[#171A17]">Price lists</h1>
          <p className="mt-1 text-[14px] text-[#8A8E86]">Sell prices built from ProcurePulse base prices with your margins</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]">
          + New price list
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="flex items-center border-b border-[#EEF1F5] bg-[#FBFCFE] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
          <div className="flex-1">Name</div>
          <div className="w-[180px]">Customer</div>
          <div className="w-[110px]">Cadence</div>
          <div className="w-[110px] text-right">Margin</div>
          <div className="w-[140px] text-right">Created</div>
        </div>
        {lists.length === 0 ? (
          <div className="px-5 py-12 text-center text-[14px] text-[#8A8E86]">No price lists yet — create your first.</div>
        ) : (
          lists.map((l) => (
            <Link key={l.id} href={`/app/pricepilot/price-lists/${l.id}`} className="flex items-center border-t border-[#F4F5F7] px-5 py-3.5 text-[14px] text-[#171A17] transition-colors hover:bg-[#F5F9FE]">
              <div className="flex-1 font-semibold">{l.name}</div>
              <div className="w-[180px] text-[#2C333B]">{l.customer_name}</div>
              <div className="w-[110px] text-[#6B6F68]">{CADENCE_LABEL[l.cadence]}</div>
              <div className="of-num w-[110px] text-right font-semibold">{l.default_margin_pct}%</div>
              <div className="of-num w-[140px] text-right text-[#A0A49C]">{fmtDate(l.created_at)}</div>
            </Link>
          ))
        )}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]">
          <button type="button" aria-label="Close" onClick={reset} className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 w-full max-w-[460px] rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.5)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="of-display text-[16px] font-semibold text-[#171A17]">New price list</h3>
              <button type="button" onClick={reset} aria-label="Close" className="text-[#A0A49C] transition-colors hover:text-[#171A17]">✕</button>
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
                  <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Default margin %</label>
                  <input className={field} inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value.replace(/[^0-9.]/g, ''))} />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Cadence</label>
                  <select className={field} value={cadence} onChange={(e) => setCadence(e.target.value as PriceCadence)}>
                    {CADENCES.map((c) => (
                      <option key={c} value={c}>{CADENCE_LABEL[c]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={reset} className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">Cancel</button>
              <button type="button" onClick={() => void create()} disabled={busy || !name.trim()} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40">
                {busy ? 'Creating…' : 'Create & edit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

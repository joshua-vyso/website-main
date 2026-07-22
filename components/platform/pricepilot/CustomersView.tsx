'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { KpiCard } from '@/components/platform/procurepulse/ui';
import { VALIDITY_STYLE, CADENCE_LABEL, type Validity, type PriceCadence } from '@/lib/platform/pricepilot';

export interface CustomerListRow {
  id: string;
  name: string;
  margin: number;
  cadence: PriceCadence;
  valid_from: string | null;
  valid_until: string | null;
  validity: Validity;
}

export interface CustomerRow {
  id: string;
  name: string;
  lists: CustomerListRow[];
}

/** Customer pricing — each customer's contract price lists, validity windows and expiry reminders. */
export function CustomersView({
  customers,
  baseMargin,
  target,
}: {
  customers: CustomerRow[];
  baseMargin: number | null;
  target: number;
}) {
  const onContract = customers.filter((c) => c.lists.length > 0).length;
  const allLists = customers.flatMap((c) => c.lists.map((l) => ({ customer: c.name, list: l })));
  const expiring = allLists.filter((x) => x.list.validity.status === 'expiring');
  const expired = allLists.filter((x) => x.list.validity.status === 'expired');
  const reminders = [...expired, ...expiring].sort(
    (a, b) => (a.list.validity.daysUntilExpiry ?? 0) - (b.list.validity.daysUntilExpiry ?? 0),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="of-display text-[28px] font-semibold tracking-[-0.015em] text-[#171A17]">Customers</h1>
          <p className="mt-1 text-[14px] text-[#8A8E86]">Contract and negotiated pricing, with validity and expiry</p>
        </div>
        <Link
          href="/app/pricepilot/price-lists"
          className="inline-flex h-[42px] items-center justify-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]"
        >
          New price list →
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Customers" value={String(customers.length)} />
        <KpiCard label="On contract pricing" value={String(onContract)} accent="#3E7BC4" />
        <KpiCard label="Expiring soon" value={String(expiring.length)} accent={expiring.length > 0 ? '#854F0B' : undefined} />
        <KpiCard label="Expired" value={String(expired.length)} accent={expired.length > 0 ? '#A32D2D' : undefined} />
      </div>

      {reminders.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-[#FBEEDA] bg-[#FFFBF4] p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <h2 className="of-display text-[16px] font-semibold text-[#854F0B]">Expiry reminders</h2>
          <div className="mt-3 flex flex-col gap-2">
            {reminders.map((r) => {
              const vs = VALIDITY_STYLE[r.list.validity.status];
              return (
                <div key={r.list.id} className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
                  <span className="text-[#171A17]">
                    <span className="font-semibold">{r.customer}</span>{' '}
                    <span className="text-[#8A8E86]">· {r.list.name}</span>
                  </span>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: vs.bg, color: vs.fg }}>
                    {r.list.validity.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3">
        {customers.length === 0 ? (
          <div className="rounded-2xl border border-[#EAEDF2] bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
            <p className="of-display text-[16px] font-semibold text-[#171A17]">No customers yet</p>
            <p className="mx-auto mt-2 max-w-md text-[13px] text-[#6B6F68]">
              Customers flow in from OrderFlow. Once you have some, set up their contract pricing here.
            </p>
          </div>
        ) : (
          customers.map((c) => (
            <div key={c.id} className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="of-display text-[16px] font-semibold text-[#171A17]">{c.name}</span>
                {c.lists.length === 0 ? (
                  <span className="of-num text-[12px] text-[#A0A49C]">
                    Standard pricing{baseMargin != null ? ` · ${Math.round(baseMargin)}% margin` : ''}
                  </span>
                ) : null}
              </div>

              {c.lists.length === 0 ? (
                <Link
                  href="/app/pricepilot/price-lists"
                  className="mt-2 inline-block text-[13px] font-semibold text-[#1F5FA8] hover:underline"
                >
                  Set up contract pricing →
                </Link>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {c.lists.map((l) => (
                    <ContractRow key={l.id} list={l} target={target} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ContractRow({ list, target }: { list: CustomerListRow; target: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(list.valid_from ?? '');
  const [until, setUntil] = useState(list.valid_until ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vs = VALIDITY_STYLE[list.validity.status];

  async function save() {
    const supabase = createClient();
    if (!supabase) return;
    if (from && until && until < from) {
      setError('End date must be after the start date.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: upErr } = await supabase
      .from('pl_price_lists')
      .update({ valid_from: from || null, valid_until: until || null })
      .eq('id', list.id);
    if (upErr) {
      setError(/valid_from|valid_until|column/i.test(upErr.message) ? 'Run the pl-validity.sql migration first.' : upErr.message);
      setBusy(false);
      return;
    }
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-[14px] border border-[#EEF1F5] bg-[#FBFCFE] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
          <span className="font-semibold text-[#171A17]">{list.name}</span>
          <span className="text-[#8A8E86]">{CADENCE_LABEL[list.cadence]}</span>
          <span className="of-num text-[#6B6F68]">
            {Math.round(list.margin)}% margin
            <span className="text-[#A0A49C]"> · target {Math.round(target)}%</span>
          </span>
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: vs.bg, color: vs.fg }}>
            {list.validity.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/app/pricepilot/price-lists/${list.id}`} className="text-[13px] font-semibold text-[#1F5FA8] hover:underline">
            Open
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3 text-[12px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
          >
            {open ? 'Close' : 'Edit dates'}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-[#EEF1F5] pt-3">
          <label className="text-[12px] text-[#8A8E86]">
            <span className="mb-1 block">Valid from</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="of-num h-11 rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none focus:border-[#3E7BC4]"
            />
          </label>
          <label className="text-[12px] text-[#8A8E86]">
            <span className="mb-1 block">Valid until</span>
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="of-num h-11 rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none focus:border-[#3E7BC4]"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          {(from || until) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFrom('');
                setUntil('');
              }}
              className="inline-flex h-[42px] items-center rounded-[11px] px-3 text-[14px] font-medium text-[#8A8E86] transition-colors hover:text-[#174C87]"
            >
              Clear
            </button>
          )}
          {error ? <span className="text-[12px] text-[#A32D2D]">{error}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

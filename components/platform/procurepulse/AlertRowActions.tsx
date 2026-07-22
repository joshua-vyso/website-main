'use client';

import { useState } from 'react';

/**
 * Per-row actions on the Low-stock alerts table. "Reorder" files a single open
 * reorder request for this item (so it shows under Stock orders → Your reorder
 * requests, same as "Reorder all"); "Snooze" dismisses the row locally for now.
 */
export function AlertRowActions({
  stockItemId,
  productName,
  qty,
  unit,
  supplier,
}: {
  stockItemId: string;
  productName: string;
  qty: number;
  unit: string | null;
  supplier: string | null;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'added' | 'error'>('idle');
  const [snoozed, setSnoozed] = useState(false);

  async function reorder() {
    if (state === 'busy' || state === 'added') return;
    setState('busy');
    try {
      const res = await fetch('/api/procurepulse/reorder-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ product_name: productName, stock_item_id: stockItemId, qty, unit, supplier }),
      });
      setState(res.ok ? 'added' : 'error');
    } catch {
      setState('error');
    }
  }

  if (snoozed) {
    return <span className="text-[12px] text-[#9A9DA1]">Snoozed</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void reorder()}
        disabled={state === 'busy' || state === 'added'}
        className={`rounded-lg px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors disabled:opacity-70 ${
          state === 'added' ? 'bg-[#0F6E56]' : state === 'error' ? 'bg-[#A32D2D] hover:bg-[#8f2727]' : 'bg-[#1F5FA8] hover:bg-[#174C87]'
        }`}
      >
        {state === 'added' ? 'Added ✓' : state === 'busy' ? '…' : state === 'error' ? 'Retry' : 'Reorder'}
      </button>
      <button
        type="button"
        onClick={() => setSnoozed(true)}
        className="rounded-lg border border-[#D7DAD8] px-3.5 py-1.5 text-[12px] font-medium text-[#5F6368] transition-colors hover:bg-[#FAFAF8]"
      >
        Snooze
      </button>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { usePlatform } from '@/lib/platform/session';
import { readParsedOrder, clearParsedOrder, type ParsedOrder } from '@/lib/ai/finch/order-handoff';

/**
 * "Paste from Finch" — shown on the New Order builder when Finch has parsed
 * an order in chat and handed it over. One click loads the parsed line items
 * (and matches the customer) into the builder for review. Preview-gated + only
 * appears when there's actually a handed-over order.
 */
export function FinchOrderPrefill({ onLoad }: { onLoad: (order: ParsedOrder) => void }) {
  const { email, finchEnabled } = usePlatform();
  const [order, setOrder] = useState<ParsedOrder | null>(null);

  useEffect(() => {
    if (finchEnabled && email) setOrder(readParsedOrder());
  }, [finchEnabled, email]);

  if (!order) return null;

  const count = order.items.length;
  const lowConfidence = typeof order.customerConfidence === 'number' && order.customerConfidence < 60;

  function load() {
    onLoad(order!);
    clearParsedOrder();
    setOrder(null);
  }

  function dismiss() {
    clearParsedOrder();
    setOrder(null);
  }

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-[#BBD9F5] bg-[#F2F8FE]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="finch-gradient flex h-6 w-6 items-center justify-center rounded-full">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3l1.6 4.6L18 9.2l-4.4 1.6L12 15l-1.6-4.2L6 9.2l4.4-1.6L12 3z" fill="#fff" />
            </svg>
          </span>
          <div className="text-[13px] text-[#12324F]">
            <span className="of-display font-semibold">Finch parsed an order</span>
            {' — '}
            <span className="of-num">{count}</span> item{count === 1 ? '' : 's'}
            {order.customerName ? (
              <>
                {' for '}
                <span className="font-medium">{order.customerName}</span>
                {lowConfidence ? <span className="text-[#9A6A00]"> (please confirm the customer)</span> : null}
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#6B6F68] transition-colors hover:bg-[#E4EFFA]"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={load}
            className="finch-gradient rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white"
          >
            Load into this order
          </button>
        </div>
      </div>
    </div>
  );
}

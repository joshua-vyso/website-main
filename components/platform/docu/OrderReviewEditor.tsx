'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { zar } from '@/lib/platform/orderflow';
import type { DocuExtractedData } from '@/lib/platform/docu/types';

export interface CustomerLite {
  id: string;
  name: string;
}
export interface LinkedOrder {
  id: string;
  status: string;
  invoice_number: string | null;
  customer_id: string | null;
}
interface Line {
  key: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
}

let seq = 0;
const newKey = () => `l${++seq}`;

function sanitizeDecimal(s: string): string {
  const cleaned = s.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
}

/**
 * Review screen for an uploaded customer ORDER. Confirm the customer (auto-matched
 * from the WhatsApp/email/handwritten name, or pick/create one), tidy the lines,
 * then "Confirm & invoice" → builds/finalises the OrderFlow order (which PricePilot
 * then sees as a sale).
 */
export function OrderReviewEditor({
  documentId,
  extractedData,
  customers,
  linkedOrder,
  orgUnits = [],
}: {
  documentId: string;
  extractedData: DocuExtractedData | null;
  customers: CustomerLite[];
  linkedOrder: LinkedOrder | null;
  orgUnits?: string[];
}) {
  const router = useRouter();
  const { org } = usePlatform();

  // Unit options for a line: the org's units, plus the line's current value when
  // it isn't one of them (so an extracted unit is never silently dropped).
  const unitOptions = (current?: string): string[] => {
    const cur = (current ?? '').trim();
    if (cur && !orgUnits.some((u) => u.toLowerCase() === cur.toLowerCase())) return [...orgUnits, cur];
    return orgUnits;
  };

  const extractedName = extractedData?.customer_name ?? '';
  const extractedConf = extractedData?.customer_confidence ?? null;
  const initialCustomer =
    (linkedOrder?.customer_id ? customers.find((c) => c.id === linkedOrder.customer_id) : null) ?? null;

  const [customerId, setCustomerId] = useState<string | null>(initialCustomer?.id ?? null);
  const [query, setQuery] = useState(initialCustomer?.name ?? extractedName);
  const [openList, setOpenList] = useState(false);
  const [lines, setLines] = useState<Line[]>(() =>
    (extractedData?.line_items ?? []).map((l) => ({
      key: newKey(),
      description: l.description ?? '',
      quantity: l.quantity ?? '',
      unit: l.unit ?? '',
      unit_price: l.unit_price ?? '',
    })),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [doneInvoice, setDoneInvoice] = useState<string | null>(
    linkedOrder?.status === 'invoiced' ? linkedOrder.invoice_number ?? '—' : null,
  );
  const [orderId, setOrderId] = useState<string | null>(linkedOrder?.id ?? null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    if (customerId && customers.find((c) => c.id === customerId)?.name === query.trim()) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [customers, query, customerId]);

  const exactExists = customers.some((c) => c.name.trim().toLowerCase() === query.trim().toLowerCase());

  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addLine() {
    setLines((prev) => [...prev, { key: newKey(), description: '', quantity: '', unit: '', unit_price: '' }]);
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    if (!supabase || !org?.id) {
      setMsg('You’re not signed in.');
      setBusy(false);
      return;
    }
    try {
      // Resolve the customer: an existing pick, or create one from the typed name.
      let cid = customerId;
      const typed = query.trim();
      if (!cid && typed) {
        const existing = customers.find((c) => c.name.trim().toLowerCase() === typed.toLowerCase());
        if (existing) cid = existing.id;
        else {
          const { data: created, error: cErr } = await supabase
            .from('of_customers')
            .insert({ org_id: org.id, name: typed })
            .select('id')
            .single();
          if (cErr || !created) throw cErr ?? new Error('Could not create the customer.');
          cid = (created as { id: string }).id;
        }
      }
      if (!cid) {
        setMsg('Pick or enter a customer first.');
        setBusy(false);
        return;
      }

      // Persist the (possibly edited) lines + confirmed customer name onto the doc,
      // so the order sync re-reads the corrected data.
      const cleanLines = lines
        .filter((l) => l.description.trim())
        .map((l) => ({
          description: l.description.trim(),
          quantity: l.quantity.trim(),
          unit: l.unit.trim(),
          unit_price: l.unit_price.trim(),
          confidence: 100,
        }));
      await supabase
        .from('documents')
        .update({
          status: 'reviewed',
          extracted_data: { ...(extractedData ?? {}), line_items: cleanLines, customer_name: typed || extractedName },
        })
        .eq('id', documentId);

      const res = await fetch('/api/orderflow/order-from-document', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentId, customerId: cid, finalize: true }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        orderId?: string;
        invoice_number?: string | null;
      };
      if (!res.ok) {
        setMsg(json?.error ?? 'Could not create the order.');
      } else {
        setOrderId(json.orderId ?? null);
        setDoneInvoice(json.invoice_number ?? '—');
        router.refresh();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const cell =
    'h-10 w-full rounded-[10px] border border-[#E4E9F0] bg-white px-3 text-[13px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';

  return (
    <div className="flex flex-col rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="border-b border-[#EEF1F5] px-6 py-5">
        <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Customer order</h2>
        <p className="mt-1 text-[13px] text-[#8A8E86]">Confirm the customer and items, then invoice</p>
      </div>

      <div className="px-6 py-5">
        {/* Customer */}
        <div className="mb-5">
          <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Customer</label>
          <div className="relative max-w-md">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCustomerId(null);
                setOpenList(true);
              }}
              onFocus={() => setOpenList(true)}
              onBlur={() => setTimeout(() => setOpenList(false), 150)}
              placeholder="Search customers or type a new name"
              className="h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
            />
            {openList && (matches.length > 0 || (query.trim() && !exactExists)) ? (
              <div className="absolute left-0 right-0 top-[48px] z-20 max-h-[240px] overflow-auto rounded-[14px] border border-[#EAEDF2] bg-white py-1 shadow-[0_18px_50px_-8px_rgba(26,28,30,0.25)]">
                {matches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCustomerId(c.id);
                      setQuery(c.name);
                      setOpenList(false);
                    }}
                    className="block w-full truncate px-3 py-2 text-left text-[13px] text-[#171A17] hover:bg-[#F5F9FE]"
                  >
                    {c.name}
                  </button>
                ))}
                {query.trim() && !exactExists ? (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCustomerId(null);
                      setOpenList(false);
                    }}
                    className="block w-full truncate border-t border-[#EEF1F5] px-3 py-2 text-left text-[13px] font-medium text-[#1F5FA8] hover:bg-[#F5F9FE]"
                  >
                    + Create “{query.trim()}”
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {extractedName ? (
            <p className="mt-1.5 text-[12px] text-[#A0A49C]">
              Read from the document: <span className="text-[#6B6F68]">{extractedName}</span>
              {extractedConf != null ? ` · ${extractedConf}% sure` : ''}
              {extractedConf != null && extractedConf < 80 ? ' — please confirm' : ''}
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] text-[#854F0B]">No customer name was read — pick or create one.</p>
          )}
        </div>

        {/* Lines */}
        <div className="mb-2 flex items-center justify-between">
          <h3 className="of-display text-[16px] font-semibold text-[#171A17]">Items (<span className="of-num">{lines.length}</span>)</h3>
          <button
            type="button"
            onClick={addLine}
            className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
          >
            + Add item
          </button>
        </div>
        <div className="grid grid-cols-[1fr_64px_72px_84px_24px] gap-2 px-1 pb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
          <span>Product</span>
          <span className="text-right">Qty</span>
          <span>Unit</span>
          <span className="text-right">Unit price</span>
          <span />
        </div>
        {lines.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[#8A8E86]">No items read — add what the customer ordered.</p>
        ) : (
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={l.key} className="grid grid-cols-[1fr_64px_72px_84px_24px] items-center gap-2">
                <input className={cell} value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
                <input className={`${cell} of-num text-right`} inputMode="numeric" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value.replace(/[^0-9.]/g, '') })} />
                <select
                  className={`${cell} cursor-pointer pr-1`}
                  value={l.unit}
                  onChange={(e) => updateLine(i, { unit: e.target.value })}
                  aria-label="Unit"
                >
                  <option value="">unit</option>
                  {unitOptions(l.unit).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <input className={`${cell} of-num text-right`} inputMode="decimal" placeholder="from list" value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: sanitizeDecimal(e.target.value) })} />
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  aria-label="Remove item"
                  className="flex h-10 w-6 items-center justify-center rounded-[10px] text-[#A0A49C] transition-colors hover:bg-[#FCEBEB] hover:text-[#A32D2D]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-[#EEF1F5] pt-3 text-[13px]">
          <span className="text-[#8A8E86]">Subtotal (excl. VAT) · blank prices fill from the price list</span>
          <span className="of-num text-[16px] font-semibold text-[#171A17]">{zar(subtotal)}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-[#EEF1F5] bg-white px-6 py-4">
        {doneInvoice ? (
          <div className="mr-auto flex items-center gap-2 text-[13px] font-medium text-[#0F6E56]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0F6E56]" />
            Invoiced <span className="of-num">{doneInvoice}</span>
            {orderId ? (
              <Link href={`/app/orderflow/orders/${orderId}`} className="ml-1 font-semibold text-[#1F5FA8] hover:underline">
                View order ›
              </Link>
            ) : null}
          </div>
        ) : msg ? (
          <span className="mr-auto text-[13px] text-[#A32D2D]">{msg}</span>
        ) : null}
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={busy}
          className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-60"
        >
          {busy ? 'Working…' : doneInvoice ? 'Re-sync order' : 'Confirm & invoice'}
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import {
  COMPLAINT_STATUSES,
  COMPLAINT_STATUS_STYLE,
  type ComplaintStatus,
} from '@/lib/platform/pricepilot';

export interface ComplaintRow {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  status: ComplaintStatus;
  customer_name: string;
  order_id: string | null;
  order_invoice: string | null;
  created_at: string;
}
interface Lite {
  id: string;
  name: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function ComplaintsManager({
  complaints,
  customers,
  orders,
}: {
  complaints: ComplaintRow[];
  customers: Lite[];
  orders: Lite[];
}) {
  const router = useRouter();
  const { org } = usePlatform();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setTitle('');
    setBody('');
    setCustomerId('');
    setOrderId('');
    setImageUrl('');
  }

  async function create() {
    if (!title.trim() || busy) return;
    const supabase = createClient();
    if (!supabase || !org?.id) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from('pl_complaints').insert({
      org_id: org.id,
      title: title.trim(),
      body: body.trim() || null,
      customer_id: customerId || null,
      order_id: orderId || null,
      image_url: imageUrl.trim() || null,
      status: 'open',
    });
    setBusy(false);
    if (error) {
      setErr('Could not log the complaint — please try again.');
      return;
    }
    reset();
    router.refresh();
  }

  async function setStatus(id: string, status: ComplaintStatus) {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from('pl_complaints').update({ status }).eq('id', id);
    router.refresh();
  }
  async function remove(id: string) {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from('pl_complaints').delete().eq('id', id);
    router.refresh();
  }

  const field = 'h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="of-display text-[28px] font-semibold tracking-[-0.015em] text-[#171A17]">Customer complaints</h1>
          <p className="mt-1 text-[14px] text-[#8A8E86]">Issues raised about orders — notes, photos and status</p>
        </div>
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]">
            + Log complaint
          </button>
        ) : null}
      </div>

      <div className="mt-6 space-y-3">
        {open ? (
          <div className="rounded-2xl border border-[#C9DEF7] bg-[#FBFCFE] p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input className={field} placeholder="What went wrong? (title)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <select className={field} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">No customer</option>
                {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <select className={field} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                <option value="">No order</option>
                {orders.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
              </select>
              <input className={field} placeholder="Image URL (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              <textarea className={`${field} sm:col-span-2 h-20 resize-none py-2`} placeholder="Details…" value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={reset} className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">Cancel</button>
              <button type="button" onClick={() => void create()} disabled={busy || !title.trim()} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40">
                {busy ? 'Saving…' : 'Log complaint'}
              </button>
            </div>
            {err ? <p className="mt-2 text-right text-[12px] text-[#A32D2D]">{err}</p> : null}
          </div>
        ) : null}

        {complaints.length === 0 && !open ? (
          <div className="rounded-2xl border border-dashed border-[#EAEDF2] bg-white px-8 py-14 text-center">
            <h2 className="of-display text-[18px] font-semibold text-[#171A17]">No complaints logged</h2>
            <p className="mx-auto mt-1 max-w-md text-[14px] text-[#8A8E86]">Issues customers raise about their orders will live here.</p>
          </div>
        ) : (
          complaints.map((c) => {
            const s = COMPLAINT_STATUS_STYLE[c.status] ?? COMPLAINT_STATUS_STYLE.open;
            return (
              <div key={c.id} className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="of-display text-[16px] font-semibold text-[#171A17]">{c.title}</span>
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>{s.label}</span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-[#A0A49C]">
                      {c.customer_name}
                      {c.order_invoice ? (
                        <>
                          {' · '}
                          <Link href={`/app/orderflow/orders/${c.order_id}`} className="of-num font-medium text-[#1F5FA8] hover:underline">{c.order_invoice}</Link>
                        </>
                      ) : null}
                      {' · '}
                      <span className="of-num">{fmtDate(c.created_at)}</span>
                    </div>
                    {c.body ? <p className="mt-2 text-[13px] text-[#6B6F68]">{c.body}</p> : null}
                    {c.image_url ? (
                      <a href={c.image_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12px] text-[#1F5FA8] hover:underline">
                        View attached image →
                      </a>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      value={c.status}
                      onChange={(e) => void setStatus(c.id, e.target.value as ComplaintStatus)}
                      className="h-9 rounded-[10px] border border-[#E4E9F0] bg-white px-2.5 text-[12px] text-[#171A17] outline-none focus:border-[#3E7BC4]"
                    >
                      {COMPLAINT_STATUSES.map((st) => (<option key={st} value={st}>{COMPLAINT_STATUS_STYLE[st].label}</option>))}
                    </select>
                    <button type="button" onClick={() => void remove(c.id)} aria-label="Delete" className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#A0A49C] transition-colors hover:bg-[#FCEBEB] hover:text-[#A32D2D]">✕</button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

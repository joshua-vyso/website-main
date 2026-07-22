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

  const field = 'h-10 w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#3E7BC4]/40 focus:outline-none';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#1A1C1E]">Customer complaints</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">Issues raised about orders — notes, photos and status</p>
        </div>
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center rounded-xl bg-[#1F5FA8] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#174C87]">
            + Log complaint
          </button>
        ) : null}
      </div>

      <div className="mt-6 space-y-3">
        {open ? (
          <div className="rounded-2xl border border-[#3E7BC4]/30 bg-[#FBFBF9] p-4">
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
              <button type="button" onClick={reset} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">Cancel</button>
              <button type="button" onClick={() => void create()} disabled={busy || !title.trim()} className="rounded-lg bg-[#1F5FA8] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87] disabled:opacity-40">
                {busy ? 'Saving…' : 'Log complaint'}
              </button>
            </div>
            {err ? <p className="mt-2 text-right text-[12px] text-[#A32D2D]">{err}</p> : null}
          </div>
        ) : null}

        {complaints.length === 0 && !open ? (
          <div className="rounded-2xl border border-dashed border-[#E7E7E2] bg-white px-8 py-14 text-center">
            <h2 className="text-[18px] font-semibold text-[#1A1C1E]">No complaints logged</h2>
            <p className="mx-auto mt-1 max-w-md text-[14px] text-[#5F6368]">Issues customers raise about their orders will live here.</p>
          </div>
        ) : (
          complaints.map((c) => {
            const s = COMPLAINT_STATUS_STYLE[c.status] ?? COMPLAINT_STATUS_STYLE.open;
            return (
              <div key={c.id} className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold text-[#1A1C1E]">{c.title}</span>
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>{s.label}</span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-[#9A9DA1]">
                      {c.customer_name}
                      {c.order_invoice ? (
                        <>
                          {' · '}
                          <Link href={`/app/orderflow/orders/${c.order_id}`} className="text-[#1F5FA8] hover:underline">{c.order_invoice}</Link>
                        </>
                      ) : null}
                      {' · '}
                      {fmtDate(c.created_at)}
                    </div>
                    {c.body ? <p className="mt-2 text-[13px] text-[#3C3F43]">{c.body}</p> : null}
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
                      className="h-8 rounded-lg border border-[#E7E7E2] bg-white px-2 text-[12px] text-[#1A1C1E] focus:outline-none"
                    >
                      {COMPLAINT_STATUSES.map((st) => (<option key={st} value={st}>{COMPLAINT_STATUS_STYLE[st].label}</option>))}
                    </select>
                    <button type="button" onClick={() => void remove(c.id)} aria-label="Delete" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9A9DA1] hover:bg-[#FCEBEB] hover:text-[#A32D2D]">✕</button>
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import {
  PRICING_STATUSES,
  PRICING_STATUS_LABEL,
  type OfCustomer,
  type PricingStatus,
} from '@/lib/platform/orderflow';

interface Draft {
  name: string;
  email: string;
  phone: string;
  pricing_status: PricingStatus;
  notes: string;
}
const EMPTY: Draft = { name: '', email: '', phone: '', pricing_status: 'standard', notes: '' };

const PRICING_BADGE: Record<PricingStatus, { bg: string; fg: string }> = {
  standard: { bg: '#F0F0EC', fg: '#5F6368' },
  daily: { bg: '#FCEBEB', fg: '#A32D2D' },
  weekly: { bg: '#FBEEDA', fg: '#854F0B' },
  monthly: { bg: '#E6F1FB', fg: '#0C447C' },
};

export function CustomersManager({ customers }: { customers: OfCustomer[] }) {
  const router = useRouter();
  const { org } = usePlatform();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  function startNew() {
    setDraft(EMPTY);
    setEditing('new');
  }
  function startEdit(c: OfCustomer) {
    setDraft({
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      pricing_status: c.pricing_status,
      notes: c.notes ?? '',
    });
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
    router.refresh();
  }

  const field = 'h-10 w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none';

  const form = (
    <div className="rounded-2xl border border-[#1E5E54]/30 bg-[#FBFBF9] p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input className={field} placeholder="Customer name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <select
          className={field}
          value={draft.pricing_status}
          onChange={(e) => setDraft({ ...draft, pricing_status: e.target.value as PricingStatus })}
        >
          {PRICING_STATUSES.map((p) => (
            <option key={p} value={p}>
              {PRICING_STATUS_LABEL[p]}
            </option>
          ))}
        </select>
        <input className={field} placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        <input className={field} placeholder="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
        <input
          className={`${field} sm:col-span-2`}
          placeholder="Notes / parameters (e.g. “garlic” means crushed garlic)"
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !draft.name.trim()}
          className="rounded-lg bg-[#1E5E54] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-40"
        >
          {busy ? 'Saving…' : editing === 'new' ? 'Add customer' : 'Save'}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#1A1C1E]">Customers</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">Profiles, pricing agreements and per-customer parameters</p>
        </div>
        {editing === null ? (
          <button
            type="button"
            onClick={startNew}
            className="inline-flex h-10 items-center rounded-xl bg-[#1E5E54] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#184D45]"
          >
            + New customer
          </button>
        ) : null}
      </div>

      <div className="mt-6 space-y-3">
        {editing === 'new' ? form : null}

        {customers.length === 0 && editing !== 'new' ? (
          <div className="rounded-2xl border border-dashed border-[#E7E7E2] bg-white px-8 py-14 text-center">
            <h2 className="text-[18px] font-semibold text-[#1A1C1E]">No customers yet</h2>
            <p className="mx-auto mt-1 max-w-md text-[14px] text-[#5F6368]">Add your first customer to start building orders.</p>
          </div>
        ) : (
          customers.map((c) =>
            editing === c.id ? (
              <div key={c.id}>{form}</div>
            ) : (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7E7E2] bg-white px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-[#1A1C1E]">{c.name}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: PRICING_BADGE[c.pricing_status].bg, color: PRICING_BADGE[c.pricing_status].fg }}
                    >
                      {PRICING_STATUS_LABEL[c.pricing_status]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[13px] text-[#5F6368]">
                    {[c.email, c.phone].filter(Boolean).join(' · ') || 'No contact details'}
                  </div>
                  {c.notes ? <div className="mt-0.5 text-[12px] text-[#9A9DA1]">{c.notes}</div> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {confirmDel === c.id ? (
                    <>
                      <span className="text-[12px] text-[#5F6368]">Delete?</span>
                      <button type="button" onClick={() => setConfirmDel(null)} className="rounded-lg px-2.5 py-1.5 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">
                        No
                      </button>
                      <button type="button" onClick={() => void remove(c.id)} disabled={busy} className="rounded-lg bg-[#A32D2D] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#8f2727] disabled:opacity-40">
                        Yes
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => startEdit(c)} className="rounded-lg border border-[#E7E7E2] bg-white px-3 py-1.5 text-[13px] text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/30">
                        Edit
                      </button>
                      <button type="button" onClick={() => setConfirmDel(c.id)} className="rounded-lg px-2.5 py-1.5 text-[13px] text-[#9A9DA1] transition-colors hover:bg-[#FCEBEB] hover:text-[#A32D2D]">
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';

type Tab = 'document' | 'custom';
interface DocLite {
  id: string;
  filename: string;
  status: string;
  created_at: string;
}
interface ProductLite {
  id: string;
  name: string;
  unit: string;
}

/**
 * "Add stock" — two ways to add to ProcurePulse:
 *  • Choose a document: feed a Doc-U document's line items into stock (recent
 *    files, with "find more" for the full archive).
 *  • Custom: pick an existing product via typeahead (or name a new one) and add
 *    a quantity, recorded as a received movement.
 */
export function AddStockButton() {
  const router = useRouter();
  const { org } = usePlatform();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('document');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Documents
  const [docs, setDocs] = useState<DocLite[]>([]);
  const [showAllDocs, setShowAllDocs] = useState(false);

  // Custom
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<ProductLite | null>(null);
  const [qty, setQty] = useState('');

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    if (!supabase || !org?.id) return;
    void (async () => {
      const [{ data: docRows }, { data: prodRows }] = await Promise.all([
        supabase
          .from('documents')
          .select('id, filename, status, created_at')
          .eq('org_id', org.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('pp_stock_items').select('id, name, unit').eq('org_id', org.id).order('name').limit(2000),
      ]);
      setDocs((docRows ?? []) as DocLite[]);
      setProducts((prodRows ?? []) as ProductLite[]);
    })();
  }, [open, org?.id]);

  function close() {
    setOpen(false);
    setMsg(null);
    setShowAllDocs(false);
    setQuery('');
    setPicked(null);
    setQty('');
  }

  const shownDocs = showAllDocs ? docs : docs.slice(0, 6);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [products, query]);

  async function feedDoc(documentId: string) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/procurepulse/feed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ documentId }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setBusy(false);
    const fed = res?.feed;
    if (fed?.fed) {
      setMsg(`Added ${fed.itemsAffected} item${fed.itemsAffected === 1 ? '' : 's'} to stock.`);
      router.refresh();
      setTimeout(close, 900);
    } else {
      setMsg(fed?.reason ? `Nothing added (${fed.reason}).` : 'Could not add stock from that document.');
    }
  }

  async function addCustom() {
    const name = (picked?.name ?? query).trim();
    const n = Number(qty.replace(/[^0-9.]/g, ''));
    if (!name || !Number.isFinite(n) || n <= 0 || busy) return;
    const supabase = createClient();
    if (!supabase || !org?.id) return;
    setBusy(true);
    setMsg(null);

    let itemId = picked?.id ?? null;
    let unit = picked?.unit ?? 'units';
    if (!itemId) {
      // Targeted lookup (escaped, scoped to org) so we never duplicate a product
      // even if it sorts outside the prefetched page.
      const literal = name.replace(/[\\%_]/g, (c) => `\\${c}`);
      const { data: match } = await supabase
        .from('pp_stock_items')
        .select('id, unit')
        .eq('org_id', org.id)
        .ilike('name', literal)
        .maybeSingle();
      if (match) {
        itemId = (match as { id: string; unit: string }).id;
        unit = (match as { id: string; unit: string }).unit;
      } else {
        const { data, error } = await supabase
          .from('pp_stock_items')
          .insert({ org_id: org.id, name, unit, on_hand: 0, low_threshold: 0, currency: 'ZAR' })
          .select('id')
          .single();
        if (error || !data?.id) {
          setBusy(false);
          setMsg('Could not create that product — try again.');
          return;
        }
        itemId = data.id as string;
      }
    }

    const { error: moveErr } = await supabase.from('pp_movements').insert({
      org_id: org.id,
      stock_item_id: itemId,
      change: n,
      reason: 'received',
      source_label: 'Manual entry',
    });
    if (moveErr) {
      setBusy(false);
      setMsg('Could not add the stock — try again.');
      return;
    }
    const { data: cur } = await supabase.from('pp_stock_items').select('on_hand').eq('id', itemId).maybeSingle();
    const nextOnHand = Math.max(0, Number((cur as { on_hand?: number } | null)?.on_hand ?? 0) + n);
    await supabase.from('pp_stock_items').update({ on_hand: nextOnHand }).eq('id', itemId);

    setBusy(false);
    setMsg(`Added ${n} ${unit} of ${name}.`);
    router.refresh();
    setTimeout(close, 900);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-[42px] items-center gap-1.5 rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]"
      >
        + Add stock
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]">
          <button type="button" aria-label="Close" onClick={close} className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 w-full max-w-[480px] rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.5)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="of-display text-[18px] font-semibold text-[#171A17]">Add stock</h3>
              <button type="button" onClick={close} aria-label="Close" className="text-[#A0A49C] transition-colors hover:text-[#171A17]">
                ✕
              </button>
            </div>

            <div className="mb-4 inline-flex rounded-[11px] bg-[#ECECE8] p-[3px]">
              {(['document', 'custom'] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-[9px] px-3.5 py-1.5 text-[13px] transition-colors ${
                    tab === t ? 'bg-white font-semibold text-[#171A17] shadow-[0_1px_2px_rgba(20,24,20,0.06)]' : 'font-medium text-[#6B6F68] hover:text-[#171A17]'
                  }`}
                >
                  {t === 'document' ? 'Choose a document' : 'Custom'}
                </button>
              ))}
            </div>

            {tab === 'document' ? (
              <div>
                <p className="mb-2 text-[13px] text-[#6B6F68]">Recent Doc-U files — pick one to feed its items into stock.</p>
                <div className="max-h-[320px] overflow-y-auto rounded-[12px] border border-[#EAEDF2]">
                  {docs.length === 0 ? (
                    <div className="px-3 py-10 text-center text-[14px] text-[#8A8E86]">No documents yet.</div>
                  ) : (
                    shownDocs.map((d, i) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => void feedDoc(d.id)}
                        disabled={busy}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#F5F9FE] disabled:opacity-50 ${
                          i > 0 ? 'border-t border-[#F4F5F7]' : ''
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-[#171A17]">{d.filename}</span>
                          <span className="block text-[11px] text-[#A0A49C]">{d.status}</span>
                        </span>
                        <span className="shrink-0 text-[13px] font-semibold text-[#1F5FA8]">Add →</span>
                      </button>
                    ))
                  )}
                </div>
                {!showAllDocs && docs.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllDocs(true)}
                    className="mt-2 text-[13px] font-medium text-[#1F5FA8] hover:underline"
                  >
                    Find more ({docs.length - 6} more)
                  </button>
                ) : null}
              </div>
            ) : (
              <div>
                <p className="mb-2 text-[13px] text-[#6B6F68]">Type a product — pick from your catalogue or add a new one.</p>
                <div className="relative">
                  <input
                    type="text"
                    value={picked ? picked.name : query}
                    onChange={(e) => {
                      setPicked(null);
                      setQuery(e.target.value);
                    }}
                    placeholder="Product name…"
                    className="h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
                  />
                  {!picked && matches.length > 0 ? (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[200px] overflow-y-auto rounded-[12px] border border-[#EAEDF2] bg-white shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
                      {matches.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPicked(p);
                            setQuery('');
                          }}
                          className="flex w-full items-center justify-between px-4 py-2 text-left text-[14px] text-[#171A17] transition-colors hover:bg-[#F5F9FE]"
                        >
                          <span className="truncate">{p.name}</span>
                          <span className="text-[12px] text-[#A0A49C]">{p.unit}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={qty}
                    onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder={`Quantity${picked ? ` (${picked.unit})` : ''}`}
                    className="of-num h-11 w-40 rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
                  />
                  <button
                    type="button"
                    onClick={() => void addCustom()}
                    disabled={busy || (!picked && !query.trim()) || !qty.trim()}
                    className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
                  >
                    {busy ? 'Adding…' : 'Add to stock'}
                  </button>
                </div>
              </div>
            )}

            {msg ? <p className="mt-3 text-center text-[13px] text-[#174C87]">{msg}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

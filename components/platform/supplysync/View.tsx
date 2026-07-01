'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, Kpi, Badge, SectionCard, DataTable, ModuleWidgetCard, type Tone } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { widgetsFor } from '@/lib/platform/module-widgets';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import type { SupplySyncData, Supplier } from '@/lib/platform/supplysync-data';

const M = MODULE_META.supplysync;
const MODAL_STYLE = { fontFamily: 'var(--font-inter)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;
const TABS = ['Suppliers', 'Performance', 'Documents', 'Notes'] as const;
type Tab = (typeof TABS)[number];

const STATUS_LABEL: Record<Supplier['status'], { label: string; tone: Tone }> = {
  preferred: { label: 'Preferred', tone: 'positive' },
  active: { label: 'Active', tone: 'neutral' },
  review: { label: 'On review', tone: 'warning' },
};
const PRICE_LABEL: Record<Supplier['priceTrend'], string> = { stable: 'Stable', rising: 'Rising', volatile: 'Volatile' };

function relTone(n: number): Tone {
  return n >= 85 ? 'positive' : n >= 70 ? 'warning' : 'critical';
}
function docsToAction(s: Supplier): number {
  return s.docs.filter((d) => d.status === 'missing' || d.status === 'expiring').length;
}

export function SupplySyncView({ data }: { data: SupplySyncData }) {
  const { node: toastNode, show: toast } = useToast();
  const [tab, setTab] = useState<Tab>('Suppliers');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const suppliers = data.suppliers;
  const q = search.trim().toLowerCase();
  const list = useMemo(() => suppliers.filter((s) => !q || `${s.name} ${s.category} ${s.contactName ?? ''}`.toLowerCase().includes(q)), [suppliers, q]);

  const kpis = useMemo(() => {
    const n = suppliers.length;
    const preferred = suppliers.filter((s) => s.status === 'preferred').length;
    const highRisk = suppliers.filter((s) => s.risk === 'high').length;
    const avgRel = n ? Math.round(suppliers.reduce((a, s) => a + s.reliability, 0) / n) : 0;
    const docsOutstanding = suppliers.reduce((a, s) => a + docsToAction(s), 0);
    const avgOnTime = n ? Math.round(suppliers.reduce((a, s) => a + s.onTimePct, 0) / n) : 0;
    return { n, preferred, highRisk, avgRel, docsOutstanding, avgOnTime };
  }, [suppliers]);

  const risks = useMemo(() => {
    const out: { text: string; tone: Tone }[] = [];
    for (const s of suppliers) {
      if (s.risk === 'high') out.push({ text: `${s.name} is flagged high supply risk.`, tone: 'critical' });
      const d = docsToAction(s);
      if (d > 0) out.push({ text: `${s.name} has ${d} compliance document${d > 1 ? 's' : ''} outstanding.`, tone: 'warning' });
      else if (s.onTimePct < 80) out.push({ text: `${s.name} on-time delivery dropped to ${s.onTimePct}%.`, tone: 'warning' });
    }
    return out.slice(0, 5);
  }, [suppliers]);

  const notes = useMemo(() => suppliers.flatMap((s) => s.notes.map((nt) => ({ name: s.name, body: nt.body, date: nt.date }))), [suppliers]);

  const empty = suppliers.length === 0;

  return (
    <div>
      {toastNode}
      <ModuleHeader icon={M.icon} title={M.name} description={M.description} actions={<PrimaryAction onClick={() => setAddOpen(true)}>+ Add supplier</PrimaryAction>} />

      <AddSupplierModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={(name) => toast(`${name} added`)} />

      {empty ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
          <p className="text-[15px] font-medium text-[#1A1C1E]">No suppliers yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">Add a supplier, or suppliers extracted from statements in Doc-U will appear here automatically.</p>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi label="Suppliers" value={String(kpis.n)} />
              <Kpi label="Preferred" value={String(kpis.preferred)} accent="#0F6E56" />
              <Kpi label="High risk" value={String(kpis.highRisk)} accent={kpis.highRisk > 0 ? '#A32D2D' : undefined} />
              <Kpi label="Avg reliability" value={`${kpis.avgRel}`} />
              <Kpi label="Docs to action" value={String(kpis.docsOutstanding)} accent={kpis.docsOutstanding > 0 ? '#854F0B' : undefined} />
              <Kpi label="Avg on-time" value={`${kpis.avgOnTime}%`} />
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[#E7E7E2]">
            {TABS.map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`-mb-px border-b-2 pb-2.5 pt-1 text-[14px] transition-colors ${tab === t ? 'border-[#1E5E54] font-medium text-[#1A1C1E]' : 'border-transparent text-[#5F6368] hover:text-[#1A1C1E]'}`}>{t}</button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
            <div>
              {tab !== 'Notes' ? (
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers…" className="mb-3 h-9 w-full max-w-xs rounded-lg border border-[#D7DAD8] bg-white px-3 text-[13px] outline-none focus:border-[#1E5E54]" />
              ) : null}

              {tab === 'Suppliers' ? (
                <DataTable
                  columns={[{ label: 'Supplier' }, { label: 'Category' }, { label: 'Contact' }, { label: 'Status' }, { label: 'Reliability', align: 'right' }, { label: 'Last order' }, { label: 'Docs' }, { label: '', align: 'right' }]}
                  rows={list.map((s) => {
                    const d = docsToAction(s);
                    return [
                      s.name,
                      s.category,
                      <span key="c"><span className="text-[#1A1C1E]">{s.contactName ?? '—'}</span><br /><span className="text-[11px] text-[#9A9DA1]">{s.contactPhone ?? ''}</span></span>,
                      <Badge key="st" label={STATUS_LABEL[s.status].label} tone={STATUS_LABEL[s.status].tone} />,
                      <Badge key="r" label={`${s.reliability}`} tone={relTone(s.reliability)} />,
                      s.lastOrder ?? '—',
                      d === 0 ? <span key="d" className="text-[#0F6E56]">Complete</span> : <span key="d" className="text-[#A32D2D]">{d} to action</span>,
                      <button key="a" type="button" onClick={() => toast('Open supplier (demo)')} className="text-[12px] font-medium text-[#1E5E54] hover:underline">View</button>,
                    ];
                  })}
                  empty="No suppliers match."
                />
              ) : null}

              {tab === 'Performance' ? (
                <DataTable
                  columns={[{ label: 'Supplier' }, { label: 'Reliability', align: 'right' }, { label: 'Quality', align: 'right' }, { label: 'Price' }, { label: 'On-time', align: 'right' }, { label: 'Last issue' }, { label: 'Status' }]}
                  rows={list.map((s) => [
                    s.name,
                    <Badge key="r" label={`${s.reliability}`} tone={relTone(s.reliability)} />,
                    `${s.quality}`,
                    PRICE_LABEL[s.priceTrend],
                    `${s.onTimePct}%`,
                    s.lastIssue ?? '—',
                    <Badge key="st" label={STATUS_LABEL[s.status].label} tone={STATUS_LABEL[s.status].tone} />,
                  ])}
                  empty="No performance data."
                />
              ) : null}

              {tab === 'Documents' ? (
                <div className="space-y-2">
                  {list.map((s) => {
                    const d = docsToAction(s);
                    return (
                      <div key={s.id} className="flex items-center justify-between rounded-xl border border-[#F0F0EC] bg-white px-4 py-3">
                        <div>
                          <div className="text-[13px] font-medium text-[#1A1C1E]">{s.name}</div>
                          <div className="mt-0.5 text-[12px]" style={{ color: d === 0 ? '#0F6E56' : '#A32D2D' }}>
                            {d === 0 ? 'All documents on file' : `${s.docs.filter((x) => x.status !== 'valid').map((x) => x.label).join(', ')}`}
                          </div>
                        </div>
                        <button type="button" onClick={() => toast('Upload document (demo)')} className="rounded-lg border border-[#D7DAD8] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1C1E] hover:border-[#1E5E54]/40">Upload</button>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {tab === 'Notes' ? (
                <div className="space-y-2">
                  {notes.length === 0 ? <p className="text-[13px] text-[#9A9DA1]">No notes yet.</p> : notes.map((n, i) => (
                    <div key={i} className="rounded-xl border border-[#F0F0EC] bg-[#FCFCFB] px-3.5 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-[#1A1C1E]">{n.name}</span>
                        <span className="text-[11px] text-[#9A9DA1]">{n.date}</span>
                      </div>
                      <div className="mt-1 text-[13px] text-[#5F6368]">{n.body}</div>
                    </div>
                  ))}
                  <button type="button" onClick={() => toast('Add note (demo)')} className="text-[13px] font-medium text-[#1E5E54] hover:underline">+ Add note</button>
                </div>
              ) : null}
            </div>

            <SectionCard title="Supplier risk alerts">
              {risks.length === 0 ? (
                <p className="text-[13px] text-[#9A9DA1]">No active risks — supply base looks healthy.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {risks.map((r, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-[13px]">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.tone === 'critical' ? '#A32D2D' : '#854F0B' }} />
                      <span className="text-[#5F6368]">{r.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}

      {!empty ? (
        <div className="mt-5">
          <h2 className="mb-2 text-[13px] font-semibold text-[#9A9DA1]">Mobile snapshot — widgets the companion app will surface</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {widgetsFor('supplysync').map((w) => (<ModuleWidgetCard key={w.id} widget={w} onAction={() => toast(`${w.actionLabel} (demo)`)} />))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AddSupplierModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (name: string) => void }) {
  const { org } = usePlatform();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [status, setStatus] = useState<Supplier['status']>('active');
  const [risk, setRisk] = useState<Supplier['risk']>('low');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setName('');
      setCategory('');
      setContactName('');
      setContactPhone('');
      setStatus('active');
      setRisk('low');
      setError(null);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  async function save() {
    const n = name.trim();
    if (!n) { setError('Give the supplier a name.'); return; }
    const supabase = createClient();
    if (!supabase || !org) { setError('Not connected.'); return; }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('ss_suppliers').insert({
      org_id: org.id,
      name: n,
      category: category.trim() || 'General',
      contact_name: contactName.trim() || null,
      contact_phone: contactPhone.trim() || null,
      status,
      risk,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    onSaved(n);
    onClose();
    router.refresh();
  }

  if (!mounted || !open) return null;
  const input = 'h-10 w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none';
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={MODAL_STYLE}>
      <div className="absolute inset-0 bg-[#1A1C1E]/25 backdrop-blur-[1px]" onClick={() => !busy && onClose()} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-[420px] rounded-2xl border border-[#E7E7E2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1A1C1E]">Add supplier</h2>
            <p className="mt-0.5 text-[13px] text-[#5F6368]">A new entry in your supply base.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[18px] text-[#9A9DA1] transition-colors hover:bg-[#F0F0EC] hover:text-[#1A1C1E]">✕</button>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#1A1C1E]">Name</label>
            <input autoFocus value={name} onChange={(e) => { setName(e.target.value); if (error) setError(null); }} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} placeholder="e.g. Ceres Fruit Growers" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#1A1C1E]">Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Stone fruit, Citrus, Root veg" className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" className={input} />
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone" className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select value={status} onChange={(e) => setStatus(e.target.value as Supplier['status'])} className={input}><option value="active">Active</option><option value="preferred">Preferred</option><option value="review">On review</option></select>
            <select value={risk} onChange={(e) => setRisk(e.target.value as Supplier['risk'])} className={input}><option value="low">Low risk</option><option value="medium">Medium risk</option><option value="high">High risk</option></select>
          </div>
          {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-[#1E5E54] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#184D45] disabled:opacity-60">{busy ? 'Saving…' : 'Add supplier'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

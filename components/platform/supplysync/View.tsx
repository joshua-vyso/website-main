'use client';

import { useMemo, useState } from 'react';
import { useToast } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, KpiStrip, Kpi, Badge, SectionCard, DataTable, ModuleWidgetCard, type Tone } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { widgetsFor } from '@/lib/platform/module-widgets';
import type { SupplySyncData, Supplier } from '@/lib/platform/supplysync-data';

const M = MODULE_META.supplysync;
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
      <ModuleHeader icon={M.icon} title={M.name} description={M.description} actions={<PrimaryAction onClick={() => toast('Add supplier (demo)')}>+ Add supplier</PrimaryAction>} />

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

      <div className="mt-5">
        <h2 className="mb-2 text-[13px] font-semibold text-[#9A9DA1]">Mobile snapshot — widgets the companion app will surface</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {widgetsFor('supplysync').map((w) => (<ModuleWidgetCard key={w.id} widget={w} onAction={() => toast(`${w.actionLabel} (demo)`)} />))}
        </div>
      </div>
    </div>
  );
}

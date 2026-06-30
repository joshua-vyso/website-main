'use client';

import { useState } from 'react';
import { useToast } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, KpiStrip, Kpi, Badge, SectionCard, DataTable, ModuleWidgetCard, type Tone } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { widgetsFor } from '@/lib/platform/module-widgets';

const M = MODULE_META.supplysync;
const TABS = ['Suppliers', 'Performance', 'Documents', 'Notes'] as const;
type Tab = (typeof TABS)[number];

const SUPPLIERS = [
  { name: 'Metro Cash & Carry', cat: 'Wholesale', contact: 'Pieter van der Merwe', email: 'orders@metro.co.za', phone: '021 555 0142', status: 'Preferred', reliability: 92, lastPurchase: '27 Jun', docs: '2 missing', quality: 90, price: 'Stable', delivery: 88, lastIssue: '—' },
  { name: 'Cape Fresh Produce', cat: 'Produce', contact: 'Nomvula Ndlovu', email: 'sales@capefresh.co.za', phone: '021 555 0199', status: 'Active', reliability: 88, lastPurchase: '28 Jun', docs: 'Complete', quality: 86, price: 'Stable', delivery: 91, lastIssue: '—' },
  { name: 'Express Meats', cat: 'Meat', contact: 'Johan Botha', email: 'accounts@expressmeats.co.za', phone: '011 555 0177', status: 'Active', reliability: 74, lastPurchase: '26 Jun', docs: 'Complete', quality: 79, price: 'Volatile', delivery: 68, lastIssue: 'Late delivery' },
  { name: 'RSA Dairy Co', cat: 'Dairy', contact: 'Aisha Patel', email: 'orders@rsadairy.co.za', phone: '031 555 0130', status: 'On hold', reliability: 61, lastPurchase: '18 Jun', docs: '1 missing', quality: 70, price: 'Rising', delivery: 64, lastIssue: 'Short delivery' },
  { name: 'Marco’s Bakery Supply', cat: 'Bakery', contact: 'Marco Rossi', email: 'marco@bakerysupply.co.za', phone: '021 555 0166', status: 'Active', reliability: 80, lastPurchase: '14 May', docs: 'Complete', quality: 82, price: 'Stable', delivery: 83, lastIssue: '—' },
];
const RISKS = [
  { text: 'Metro has 2 missing compliance documents.', tone: 'critical' as Tone },
  { text: 'Express Meats delivery consistency dropped this month.', tone: 'warning' as Tone },
  { text: 'Marco’s Bakery Supply has not been updated in 45 days.', tone: 'warning' as Tone },
];
const NOTES = [
  { name: 'Metro Cash & Carry', body: 'Agreed 30-day terms from July. Awaiting updated tax clearance.', date: '27 Jun' },
  { name: 'Express Meats', body: 'Flagged two late deliveries — escalate if it happens again.', date: '26 Jun' },
  { name: 'Cape Fresh Produce', body: 'Preferred for berries; consistent quality and pricing.', date: '20 Jun' },
];

function relTone(n: number): Tone {
  return n >= 85 ? 'positive' : n >= 70 ? 'warning' : 'critical';
}
function statusTone(s: string): Tone {
  return s === 'Preferred' ? 'positive' : s === 'On hold' ? 'critical' : 'neutral';
}

export function SupplySyncView() {
  const { node: toastNode, show: toast } = useToast();
  const [tab, setTab] = useState<Tab>('Suppliers');
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const list = SUPPLIERS.filter((s) => !q || `${s.name} ${s.cat} ${s.contact}`.toLowerCase().includes(q));

  return (
    <div>
      {toastNode}
      <ModuleHeader
        icon={M.icon}
        title={M.name}
        description={M.description}
        actions={<PrimaryAction onClick={() => toast('Add supplier (demo)')}>+ Add supplier</PrimaryAction>}
      />

      <div className="mt-6">
        <KpiStrip>
          <Kpi label="Active suppliers" value="14" />
          <Kpi label="Preferred suppliers" value="6" accent="#0F6E56" />
          <Kpi label="Supplier risks" value="3" accent="#A32D2D" />
          <Kpi label="Late deliveries" value="2" accent="#854F0B" sub="this month" />
          <Kpi label="Missing documents" value="4" accent="#854F0B" />
          <Kpi label="Recently updated" value="5" />
        </KpiStrip>
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
            <>
              <DataTable
                columns={[{ label: 'Supplier' }, { label: 'Category' }, { label: 'Contact' }, { label: 'Status' }, { label: 'Reliability', align: 'right' }, { label: 'Last purchase' }, { label: 'Docs' }, { label: '', align: 'right' }]}
                rows={list.map((s) => [
                  s.name,
                  s.cat,
                  <span key="c"><span className="text-[#1A1C1E]">{s.contact}</span><br /><span className="text-[11px] text-[#9A9DA1]">{s.phone}</span></span>,
                  <Badge key="st" label={s.status} tone={statusTone(s.status)} />,
                  <Badge key="r" label={`${s.reliability}`} tone={relTone(s.reliability)} />,
                  s.lastPurchase,
                  s.docs === 'Complete' ? <span key="d" className="text-[#0F6E56]">Complete</span> : <span key="d" className="text-[#A32D2D]">{s.docs}</span>,
                  <button key="a" type="button" onClick={() => toast('Open supplier (demo)')} className="text-[12px] font-medium text-[#1E5E54] hover:underline">View</button>,
                ])}
                empty="No suppliers match."
              />
              <p className="mt-2 text-[12px] text-[#9A9DA1]">Market agents extracted from statements in Doc-U will appear here as suppliers, so you can see agent-specific market pricing.</p>
            </>
          ) : null}

          {tab === 'Performance' ? (
            <DataTable
              columns={[{ label: 'Supplier' }, { label: 'Reliability', align: 'right' }, { label: 'Quality', align: 'right' }, { label: 'Price' }, { label: 'Delivery', align: 'right' }, { label: 'Last issue' }, { label: 'Status' }]}
              rows={list.map((s) => [
                s.name,
                <Badge key="r" label={`${s.reliability}`} tone={relTone(s.reliability)} />,
                `${s.quality}`,
                s.price,
                `${s.delivery}%`,
                s.lastIssue,
                <Badge key="st" label={s.status} tone={statusTone(s.status)} />,
              ])}
              empty="No performance data."
            />
          ) : null}

          {tab === 'Documents' ? (
            <div className="space-y-2">
              {list.map((s) => (
                <div key={s.name} className="flex items-center justify-between rounded-xl border border-[#F0F0EC] bg-white px-4 py-3">
                  <div>
                    <div className="text-[13px] font-medium text-[#1A1C1E]">{s.name}</div>
                    <div className="mt-0.5 text-[12px]" style={{ color: s.docs === 'Complete' ? '#0F6E56' : '#A32D2D' }}>{s.docs === 'Complete' ? 'All documents on file' : `${s.docs} — tax clearance / BEE certificate`}</div>
                  </div>
                  <button type="button" onClick={() => toast('Upload document (demo)')} className="rounded-lg border border-[#D7DAD8] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1C1E] hover:border-[#1E5E54]/40">Upload</button>
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'Notes' ? (
            <div className="space-y-2">
              {NOTES.map((n, i) => (
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
          <div className="flex flex-col gap-2.5">
            {RISKS.map((r, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[13px]">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.tone === 'critical' ? '#A32D2D' : '#854F0B' }} />
                <span className="text-[#5F6368]">{r.text}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="mt-5">
        <h2 className="mb-2 text-[13px] font-semibold text-[#9A9DA1]">Mobile snapshot — widgets the companion app will surface</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {widgetsFor('supplysync').map((w) => (<ModuleWidgetCard key={w.id} widget={w} onAction={() => toast(`${w.actionLabel} (demo)`)} />))}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { zar } from '@/lib/platform/orderflow';
import { useToast, Drawer } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, KpiStrip, Kpi, Badge, SectionCard, PlaceholderChart, DataTable, ModuleWidgetCard } from '@/components/platform/module-ui';
import { DonutChart } from '@/components/platform/procurepulse/ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { widgetsFor } from '@/lib/platform/module-widgets';

const M = MODULE_META.wastewatch;

const HISTORY = [
  { date: '29 Jun', item: 'Strawberries', cat: 'Produce', qty: '4 punnets', cost: 320, reason: 'Spoiled', by: 'Thandi M.' },
  { date: '29 Jun', item: 'Baby spinach', cat: 'Produce', qty: '3 kg', cost: 210, reason: 'Wilted', by: 'Sipho D.' },
  { date: '28 Jun', item: 'Rump steak', cat: 'Meat', qty: '2 kg', cost: 540, reason: 'Over-portioned', by: 'Johan B.' },
  { date: '28 Jun', item: 'Full cream milk', cat: 'Dairy', qty: '6 L', cost: 90, reason: 'Expired', by: 'Aisha P.' },
  { date: '27 Jun', item: 'Bread rolls', cat: 'Bakery', qty: '24 units', cost: 120, reason: 'Day-old', by: 'Lerato K.' },
];
const CATEGORIES = [
  { label: 'Produce', value: 41, color: '#0F6E56' },
  { label: 'Meat', value: 27, color: '#A32D2D' },
  { label: 'Dairy', value: 14, color: '#854F0B' },
  { label: 'Bakery', value: 11, color: '#0C447C' },
  { label: 'Other', value: 7, color: '#9A9DA1' },
];

export function WasteWatchView() {
  const { node: toastNode, show: toast } = useToast();
  const [logOpen, setLogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const history = HISTORY.filter((h) => !q || `${h.item} ${h.cat} ${h.reason} ${h.by}`.toLowerCase().includes(q));
  const input = 'h-10 w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none';

  return (
    <div>
      {toastNode}
      <ModuleHeader icon={M.icon} title={M.name} description={M.description} actions={<PrimaryAction onClick={() => setLogOpen(true)}>+ Log waste</PrimaryAction>} />

      <div className="mt-6">
        <KpiStrip>
          <Kpi label="Waste this week" value="38 items" />
          <Kpi label="Waste cost" value={zar(4280)} accent="#A32D2D" sub="+12% vs last week" />
          <Kpi label="Preventable waste" value={zar(1950)} accent="#854F0B" />
          <Kpi label="Top category" value="Produce" sub="41% of waste" />
          <Kpi label="Trend vs last week" value="▲ 12%" accent="#A32D2D" />
        </KpiStrip>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        <SectionCard title="Waste history" right={<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search waste…" className="h-8 w-44 rounded-lg border border-[#D7DAD8] bg-white px-2.5 text-[12px] outline-none focus:border-[#1E5E54]" />}>
          <DataTable
            columns={[{ label: 'Date' }, { label: 'Item' }, { label: 'Category' }, { label: 'Quantity', align: 'right' }, { label: 'Est. cost', align: 'right' }, { label: 'Reason' }, { label: 'Logged by' }]}
            rows={history.map((h) => [h.date, h.item, <Badge key="c" label={h.cat} tone="neutral" />, h.qty, zar(h.cost), h.reason, h.by])}
            empty="No waste matches your search."
          />
        </SectionCard>

        <div className="flex flex-col gap-5">
          <SectionCard title="Category breakdown">
            <div className="flex items-center gap-4">
              <DonutChart segments={CATEGORIES} size={120} thickness={20} centerLabel="R 4.3k" centerSub="this week" />
              <div className="flex flex-1 flex-col gap-1.5 text-[12px]">
                {CATEGORIES.map((c) => (
                  <div key={c.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#5F6368]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />{c.label}</span>
                    <span className="tabular-nums text-[#1A1C1E]">{c.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Waste trend">
            <PlaceholderChart data={[28, 31, 26, 34, 30, 38]} color="#A32D2D" fill="#FCEBEB" caption="Weekly waste cost — illustrative" />
          </SectionCard>
        </div>
      </div>

      <div className="mt-5">
        <h2 className="mb-2 text-[13px] font-semibold text-[#9A9DA1]">Mobile snapshot — widgets the companion app will surface</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {widgetsFor('wastewatch').map((w) => (<ModuleWidgetCard key={w.id} widget={w} onAction={() => setLogOpen(true)} />))}
        </div>
      </div>

      <Drawer
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title="Log waste"
        subtitle="Record an item that was thrown away"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setLogOpen(false)} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">Cancel</button>
            <button type="button" onClick={() => { setLogOpen(false); toast('Waste logged (demo)'); }} className="rounded-lg bg-[#1E5E54] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#184D45]">Log waste</button>
          </div>
        }
      >
        <div className="space-y-3">
          <input className={input} placeholder="Item (e.g. Strawberries)" />
          <div className="grid grid-cols-2 gap-3">
            <input className={input} placeholder="Quantity" />
            <select className={input}><option>Produce</option><option>Meat</option><option>Dairy</option><option>Bakery</option><option>Other</option></select>
          </div>
          <input className={input} placeholder="Estimated cost (R)" />
          <select className={input}><option>Spoiled</option><option>Expired</option><option>Over-portioned</option><option>Damaged</option><option>Other</option></select>
          <textarea className={`${input} h-20 py-2`} placeholder="Notes (optional)" />
        </div>
      </Drawer>
    </div>
  );
}

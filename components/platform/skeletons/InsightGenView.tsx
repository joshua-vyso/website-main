'use client';

import { useState } from 'react';
import { useToast } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, SecondaryAction, KpiStrip, Kpi, Badge, SectionCard, PlaceholderChart, DataTable, type Tone } from '@/components/platform/module-ui';
import { MODULE_META, type VysoModuleKey } from '@/lib/platform/module-meta';

const M = MODULE_META.insightgen;
const AREAS = ['Executive snapshot', 'AI insights', 'Saved reports', 'Anomalies'] as const;
type Area = (typeof AREAS)[number];

interface Insight {
  module: VysoModuleKey;
  text: string;
  tone: Tone;
}
const INSIGHTS: Insight[] = [
  { module: 'orderflow', text: "Sandton Sun's order frequency has dropped 18% this month.", tone: 'warning' },
  { module: 'pricepilot', text: '12 products are priced below target margin.', tone: 'warning' },
  { module: 'docu', text: '8 invoices were processed automatically this week.', tone: 'positive' },
  { module: 'wastewatch', text: 'Waste cost increased 12% compared to last week.', tone: 'critical' },
  { module: 'planwise', text: 'Actual expenses are tracking 9% above plan.', tone: 'warning' },
  { module: 'procurepulse', text: '2 products are out of stock and need reordering.', tone: 'critical' },
  { module: 'supplysync', text: 'Express Meats delivery consistency dropped this month.', tone: 'warning' },
];
const ANOMALIES = INSIGHTS.filter((i) => i.tone === 'critical');

const REPORTS = [
  { name: 'Weekly business brief', scope: 'Company', modules: 'All', updated: '2h ago', owner: 'You', status: 'Ready' as const },
  { name: 'Margin & pricing review', scope: 'Finance', modules: 'PricePilot · OrderFlow', updated: 'Today', owner: 'You', status: 'Ready' as const },
  { name: 'Waste & cost control', scope: 'Operations', modules: 'WasteWatch · PlanWise', updated: 'Yesterday', owner: 'Thandi M.', status: 'Draft' as const },
  { name: 'Supplier scorecard', scope: 'Procurement', modules: 'SupplySync · ProcurePulse', updated: '3 days ago', owner: 'You', status: 'Scheduled' as const },
];

const FILTER_MODULES: VysoModuleKey[] = ['orderflow', 'pricepilot', 'docu', 'procurepulse', 'wastewatch', 'planwise', 'supplysync'];

export function InsightGenView() {
  const { node: toastNode, show: toast } = useToast();
  const [area, setArea] = useState<Area>('Executive snapshot');
  const [moduleFilter, setModuleFilter] = useState<VysoModuleKey | 'all'>('all');
  const insights = moduleFilter === 'all' ? INSIGHTS : INSIGHTS.filter((i) => i.module === moduleFilter);

  return (
    <div>
      {toastNode}
      <ModuleHeader
        icon={M.icon}
        title={M.name}
        description={M.description}
        actions={
          <>
            <SecondaryAction onClick={() => toast('Ask Vyso AI (demo)')}>Ask Vyso AI</SecondaryAction>
            <PrimaryAction onClick={() => toast('Create report (demo)')}>+ Create report</PrimaryAction>
          </>
        }
      />

      <div className="mt-6">
        <KpiStrip>
          <Kpi label="New AI insights" value="7" accent="#0F6E56" />
          <Kpi label="Anomalies detected" value="2" accent="#A32D2D" />
          <Kpi label="Reports updated" value="7" sub="last 24h" />
          <Kpi label="Modules connected" value="9" />
          <Kpi label="Last refresh" value="2m ago" />
        </KpiStrip>
      </div>

      {/* Areas */}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[#E7E7E2]">
        {AREAS.map((a) => (
          <button key={a} type="button" onClick={() => setArea(a)} className={`-mb-px border-b-2 pb-2.5 pt-1 text-[14px] transition-colors ${area === a ? 'border-[#1E5E54] font-medium text-[#1A1C1E]' : 'border-transparent text-[#5F6368] hover:text-[#1A1C1E]'}`}>{a}</button>
        ))}
      </div>

      <div className="mt-5">
        {area === 'Executive snapshot' ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
            <SectionCard title="Business snapshot">
              <p className="text-[14px] leading-relaxed text-[#1A1C1E]">
                Revenue is tracking <span className="font-semibold text-[#0F6E56]">82%</span> toward this month&rsquo;s target, but expenses are{' '}
                <span className="font-semibold text-[#854F0B]">9% above plan</span>, driven by produce costs and a rise in waste. Pricing has{' '}
                <span className="font-semibold text-[#A32D2D]">12 products below target margin</span>. Two suppliers need attention.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <PlaceholderChart data={[410, 430, 425, 460, 480, 470, 500]} caption="Revenue trend — illustrative" height={90} />
                <PlaceholderChart data={[300, 305, 320, 318, 332, 340, 351]} color="#A32D2D" fill="#FCEBEB" caption="Cost trend — illustrative" height={90} />
              </div>
            </SectionCard>
            <SectionCard title="Operational alerts">
              <div className="flex flex-col gap-2.5">
                {ANOMALIES.map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[13px]">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#A32D2D]" />
                    <span className="text-[#5F6368]"><span className="font-medium text-[#1A1C1E]">{MODULE_META[a.module].name}:</span> {a.text}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        ) : null}

        {area === 'AI insights' ? (
          <div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Chip active={moduleFilter === 'all'} onClick={() => setModuleFilter('all')}>All modules</Chip>
              {FILTER_MODULES.map((m) => (
                <Chip key={m} active={moduleFilter === m} onClick={() => setModuleFilter(m)}>{MODULE_META[m].name}</Chip>
              ))}
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
              {insights.map((ins, i) => (
                <div key={i} className={`flex items-start gap-3 px-5 py-3.5 ${i > 0 ? 'border-t border-[#F0F0EC]' : ''}`}>
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ins.tone === 'critical' ? '#A32D2D' : ins.tone === 'warning' ? '#854F0B' : '#0F6E56' }} />
                  <span className="min-w-0 flex-1 text-[14px] text-[#1A1C1E]">{ins.text}</span>
                  <span className="shrink-0"><Badge label={MODULE_META[ins.module].name} tone="info" /></span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {area === 'Saved reports' ? (
          <DataTable
            columns={[{ label: 'Report name' }, { label: 'Scope' }, { label: 'Modules' }, { label: 'Last updated' }, { label: 'Owner' }, { label: 'Status', align: 'right' }]}
            rows={REPORTS.map((r) => [
              r.name,
              r.scope,
              r.modules,
              r.updated,
              r.owner,
              <span key="s" className="inline-flex justify-end"><Badge label={r.status} tone={r.status === 'Ready' ? 'positive' : r.status === 'Scheduled' ? 'info' : 'neutral'} /></span>,
            ])}
            empty="No saved reports yet."
          />
        ) : null}

        {area === 'Anomalies' ? (
          <SectionCard title="Anomalies detected">
            <div className="flex flex-col gap-3">
              {ANOMALIES.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-[#F0F0EC] bg-[#FCFCFB] px-4 py-3">
                  <div className="flex items-start gap-2.5 text-[13px]">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#A32D2D]" />
                    <span className="text-[#5F6368]"><span className="font-medium text-[#1A1C1E]">{MODULE_META[a.module].name}:</span> {a.text}</span>
                  </div>
                  <button type="button" onClick={() => toast('Investigate (demo)')} className="shrink-0 text-[12px] font-medium text-[#1E5E54] hover:underline">Investigate</button>
                </div>
              ))}
            </div>
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${active ? 'bg-[#1A1C1E] text-white' : 'border border-[#E7E7E2] bg-white text-[#5F6368] hover:border-[#1E5E54]/30'}`}>
      {children}
    </button>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useToast } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, SecondaryAction, Kpi, Badge, SectionCard, PlaceholderChart, DataTable, type Tone } from '@/components/platform/module-ui';
import { MODULE_META, VYSO_MODULE_KEYS, type VysoModuleKey } from '@/lib/platform/module-meta';
import type { InsightGenData, GenInsight, InsightSeverity, ReportStatus } from '@/lib/platform/insightgen-data';

const M = MODULE_META.insightgen;
const AREAS = ['Executive snapshot', 'AI insights', 'Saved reports', 'Anomalies'] as const;
type Area = (typeof AREAS)[number];

const SEV_DOT: Record<InsightSeverity, string> = { critical: '#A32D2D', warning: '#854F0B', positive: '#0F6E56', info: '#0C447C' };
const STATUS_TONE: Record<ReportStatus, Tone> = { ready: 'positive', scheduled: 'info', draft: 'neutral' };
const STATUS_LABEL: Record<ReportStatus, string> = { ready: 'Ready', scheduled: 'Scheduled', draft: 'Draft' };

function asKey(s: string): VysoModuleKey | null {
  return (VYSO_MODULE_KEYS as string[]).includes(s) ? (s as VysoModuleKey) : null;
}
function moduleName(s: string): string {
  const k = asKey(s);
  return k ? MODULE_META[k].name : s.charAt(0).toUpperCase() + s.slice(1);
}
function reportModules(mods: string[]): string {
  if (mods.length === 0) return '—';
  if (mods.includes('all')) return 'All modules';
  return mods.map(moduleName).join(' · ');
}
function dateLabel(ts: string | null): string {
  if (!ts) return '—';
  return ts.split('T')[0] ?? '—';
}

export function InsightGenView({ data }: { data: InsightGenData }) {
  const { node: toastNode, show: toast } = useToast();
  const [area, setArea] = useState<Area>('Executive snapshot');
  const [moduleFilter, setModuleFilter] = useState<string | 'all'>('all');

  const { insights, reports } = data;
  const anomalies = useMemo(() => insights.filter((i) => i.isAnomaly || i.severity === 'critical'), [insights]);
  const filterModules = useMemo(() => Array.from(new Set(insights.map((i) => i.sourceModule))).filter(Boolean), [insights]);
  const shown = moduleFilter === 'all' ? insights : insights.filter((i) => i.sourceModule === moduleFilter);
  const empty = insights.length === 0 && reports.length === 0;

  const sevCount = (s: InsightSeverity) => insights.filter((i) => i.severity === s).length;

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

      {empty ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
          <p className="text-[15px] font-medium text-[#1A1C1E]">No insights yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">As your other modules fill with data, Vyso AI will surface cross-module insights, anomalies and reports here.</p>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Kpi label="New AI insights" value={String(insights.length)} accent="#0F6E56" />
              <Kpi label="Anomalies detected" value={String(anomalies.length)} accent={anomalies.length > 0 ? '#A32D2D' : undefined} />
              <Kpi label="Saved reports" value={String(reports.length)} />
              <Kpi label="Modules connected" value="9" />
              <Kpi label="Last refresh" value="2m ago" />
            </div>
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
                    Vyso AI surfaced <span className="font-semibold text-[#1A1C1E]">{insights.length}</span> insight{insights.length === 1 ? '' : 's'} this cycle —{' '}
                    <span className="font-semibold text-[#A32D2D]">{sevCount('critical')} critical</span>,{' '}
                    <span className="font-semibold text-[#854F0B]">{sevCount('warning')} to watch</span> and{' '}
                    <span className="font-semibold text-[#0F6E56]">{sevCount('positive')} positive</span>. {anomalies[0] ? <>Top concern: {anomalies[0].text}</> : null}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <PlaceholderChart data={[410, 430, 425, 460, 480, 470, 500]} caption="Revenue trend — illustrative" height={90} />
                    <PlaceholderChart data={[300, 305, 320, 318, 332, 340, 351]} color="#A32D2D" fill="#FCEBEB" caption="Cost trend — illustrative" height={90} />
                  </div>
                </SectionCard>
                <SectionCard title="Operational alerts">
                  {anomalies.length === 0 ? (
                    <p className="text-[13px] text-[#9A9DA1]">No anomalies right now.</p>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {anomalies.map((a) => (
                        <div key={a.id} className="flex items-start gap-2.5 text-[13px]">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#A32D2D]" />
                          <span className="text-[#5F6368]"><span className="font-medium text-[#1A1C1E]">{moduleName(a.sourceModule)}:</span> {a.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>
            ) : null}

            {area === 'AI insights' ? (
              <div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <Chip active={moduleFilter === 'all'} onClick={() => setModuleFilter('all')}>All modules</Chip>
                  {filterModules.map((m) => (
                    <Chip key={m} active={moduleFilter === m} onClick={() => setModuleFilter(m)}>{moduleName(m)}</Chip>
                  ))}
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
                  {shown.map((ins, i) => (
                    <div key={ins.id} className={`flex items-start gap-3 px-5 py-3.5 ${i > 0 ? 'border-t border-[#F0F0EC]' : ''}`}>
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: SEV_DOT[ins.severity] }} />
                      <span className="min-w-0 flex-1 text-[14px] text-[#1A1C1E]">{ins.text}{ins.metricValue ? <span className="ml-1.5 text-[12px] text-[#9A9DA1]">· {ins.metricLabel ? `${ins.metricLabel} ` : ''}{ins.metricValue}</span> : null}</span>
                      <span className="shrink-0"><Badge label={moduleName(ins.sourceModule)} tone="info" /></span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {area === 'Saved reports' ? (
              <DataTable
                columns={[{ label: 'Report name' }, { label: 'Scope' }, { label: 'Modules' }, { label: 'Schedule' }, { label: 'Last run' }, { label: 'Owner' }, { label: 'Status', align: 'right' }]}
                rows={reports.map((r) => [
                  r.name,
                  r.scope ?? '—',
                  reportModules(r.modules),
                  r.schedule.charAt(0).toUpperCase() + r.schedule.slice(1),
                  dateLabel(r.lastRun),
                  r.owner ?? '—',
                  <span key="s" className="inline-flex justify-end"><Badge label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} /></span>,
                ])}
                empty="No saved reports yet."
              />
            ) : null}

            {area === 'Anomalies' ? (
              <SectionCard title="Anomalies detected">
                {anomalies.length === 0 ? (
                  <p className="text-[13px] text-[#9A9DA1]">No anomalies detected.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {anomalies.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#F0F0EC] bg-[#FCFCFB] px-4 py-3">
                        <div className="flex items-start gap-2.5 text-[13px]">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#A32D2D]" />
                          <span className="text-[#5F6368]"><span className="font-medium text-[#1A1C1E]">{moduleName(a.sourceModule)}:</span> {a.text}</span>
                        </div>
                        <button type="button" onClick={() => toast('Investigate (demo)')} className="shrink-0 text-[12px] font-medium text-[#1E5E54] hover:underline">Investigate</button>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            ) : null}
          </div>
        </>
      )}
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

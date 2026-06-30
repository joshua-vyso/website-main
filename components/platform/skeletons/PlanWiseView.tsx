'use client';

import { zar } from '@/lib/platform/orderflow';
import { useToast } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, KpiStrip, Kpi, Badge, SectionCard, PlaceholderChart, DataTable, ModuleWidgetCard } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { widgetsFor } from '@/lib/platform/module-widgets';

const M = MODULE_META.planwise;

const BUDGET = [
  { cat: 'Staff', budgeted: 180000, actual: 172400 },
  { cat: 'Produce', budgeted: 120000, actual: 131200 },
  { cat: 'Transport', budgeted: 38000, actual: 35600 },
  { cat: 'Utilities', budgeted: 22000, actual: 24100 },
  { cat: 'Marketing', budgeted: 30000, actual: 18900 },
  { cat: 'Other', budgeted: 20000, actual: 22700 },
];

const INSIGHTS = [
  'Produce is tracking 9% over budget — driven by berry prices.',
  'Marketing is underspent; reallocating could lift revenue.',
  'At the current run-rate, you’ll finish the month ~R 18k over plan.',
];

export function PlanWiseView() {
  const { node: toastNode, show: toast } = useToast();
  const totalBudget = BUDGET.reduce((s, b) => s + b.budgeted, 0);
  const totalActual = BUDGET.reduce((s, b) => s + b.actual, 0);
  const used = Math.round((totalActual / totalBudget) * 100);
  const variance = totalActual - totalBudget;

  function statusOf(b: { budgeted: number; actual: number }) {
    if (b.actual > b.budgeted * 1.02) return <Badge label="Over" tone="critical" />;
    if (b.actual < b.budgeted * 0.9) return <Badge label="Under" tone="neutral" />;
    return <Badge label="On track" tone="positive" />;
  }

  return (
    <div>
      {toastNode}
      <ModuleHeader icon={M.icon} title={M.name} description={M.description} actions={<PrimaryAction onClick={() => toast('Create budget (demo)')}>+ Create budget</PrimaryAction>} />

      <div className="mt-6">
        <KpiStrip>
          <Kpi label="Monthly revenue target" value={zar(500000)} />
          <Kpi label="Budget used" value={`${used}%`} accent={used > 95 ? '#A32D2D' : '#854F0B'} sub={`${zar(totalActual)} of ${zar(totalBudget)}`} />
          <Kpi label="Forecast profit" value={zar(96000)} accent="#0F6E56" />
          <Kpi label="Expense variance" value={`${variance >= 0 ? '+' : ''}${zar(variance)}`} accent={variance > 0 ? '#A32D2D' : '#0F6E56'} />
          <Kpi label="Cash runway" value="4.2 mo" />
        </KpiStrip>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        <SectionCard title="Monthly budget" right={<span className="text-[12px] text-[#9A9DA1]">June 2026</span>}>
          <DataTable
            columns={[{ label: 'Category' }, { label: 'Budgeted', align: 'right' }, { label: 'Actual', align: 'right' }, { label: 'Variance', align: 'right' }, { label: 'Status', align: 'right' }]}
            rows={BUDGET.map((b) => {
              const v = b.budgeted - b.actual;
              return [
                b.cat,
                zar(b.budgeted),
                zar(b.actual),
                <span key="v" style={{ color: v < 0 ? '#A32D2D' : '#0F6E56' }}>{v >= 0 ? '+' : ''}{zar(v)}</span>,
                <span key="s" className="inline-flex justify-end">{statusOf(b)}</span>,
              ];
            })}
            empty="No budget set yet."
          />
        </SectionCard>

        <div className="flex flex-col gap-5">
          <SectionCard title="Forecast">
            <PlaceholderChart data={[410, 430, 425, 460, 480, 470, 500]} caption="Projected monthly revenue — illustrative" />
          </SectionCard>
          <SectionCard title="AI planning notes">
            <div className="flex flex-col gap-2.5">
              {INSIGHTS.map((t, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[13px]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1E5E54]" />
                  <span className="text-[#5F6368]">{t}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="mt-5">
        <h2 className="mb-2 text-[13px] font-semibold text-[#9A9DA1]">Mobile snapshot — widgets the companion app will surface</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {widgetsFor('planwise').map((w) => (<ModuleWidgetCard key={w.id} widget={w} onAction={() => toast(`${w.actionLabel} (demo)`)} />))}
        </div>
      </div>
    </div>
  );
}

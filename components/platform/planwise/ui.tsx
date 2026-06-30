'use client';

import Link from 'next/link';
import { zar } from '@/lib/platform/orderflow';
import { SectionCard, Badge, DataTable, PlaceholderChart, type Tone } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import {
  BUDGET,
  GOAL_SUMMARY,
  MONTHLY_GOAL,
  RECOMMENDATIONS,
  FORECASTS,
  FORECAST_COMMENTARY,
  SCENARIOS,
  MOBILE_SNAPSHOT,
  goalProgress,
  goalTone,
  goalToneColor,
  REC_STATUS_LABEL,
  type GoalSummary,
  type RecStatus,
} from '@/lib/platform/planwise';

// ---------------------------------------------------------------------------
// Monthly business goal — headline target vs forecast + progress bar
// ---------------------------------------------------------------------------

export function MonthlyGoalCard() {
  const g = MONTHLY_GOAL;
  const gap = g.currentForecast - g.targetRevenue;
  const pct = Math.round((g.currentForecast / g.targetRevenue) * 100);
  const tone = goalTone(pct);
  const color = goalToneColor(tone);
  return (
    <SectionCard title="Monthly business goal" right={<Badge label={g.label} tone="info" />}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric label="Target revenue" value={zar(g.targetRevenue)} />
        <Metric label="Current forecast" value={zar(g.currentForecast)} />
        <Metric label="Gap" value={`${gap >= 0 ? '+' : '−'}${zar(Math.abs(gap))}`} color={gap >= 0 ? '#0F6E56' : '#A32D2D'} />
        <Metric label="Goal progress" value={`${pct}%`} color={color} />
      </div>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[#F0F0EC]">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
      </div>
    </SectionCard>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[12px] text-[#9A9DA1]">{label}</div>
      <div className="mt-1 text-[20px] font-bold leading-none" style={color ? { color } : { color: '#1A1C1E' }}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal summary cards — target / current / variance / status
// ---------------------------------------------------------------------------

function fmt(g: GoalSummary, n: number) {
  return g.unit === '%' ? `${Math.round(n)}%` : zar(n);
}

export function GoalSummaryCards() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {GOAL_SUMMARY.map((g) => {
        const variance = g.higherIsBetter ? g.current - g.target : g.target - g.current;
        const pct = goalProgress(g);
        const tone = goalTone(pct);
        const color = goalToneColor(tone);
        return (
          <div key={g.id} className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#9A9DA1]">{g.label}</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${color}1A`, color }}>{pct}%</span>
            </div>
            <div className="mt-2 text-[18px] font-bold leading-none text-[#1A1C1E]">{fmt(g, g.target)}</div>
            <div className="mt-2 flex items-center justify-between text-[12px]">
              <span className="text-[#9A9DA1]">now {fmt(g, g.current)}</span>
              <span style={{ color: variance >= 0 ? '#0F6E56' : '#A32D2D' }}>{variance >= 0 ? '+' : '−'}{fmt(g, Math.abs(variance))}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// What needs to change? — cross-module recommendation panel
// ---------------------------------------------------------------------------

const REC_TONE: Record<RecStatus, Tone> = { open: 'warning', in_progress: 'info', done: 'positive' };

export function RecommendationPanel() {
  return (
    <SectionCard title="What needs to change?" right={<span className="text-[12px] text-[#9A9DA1]">Cross-module · auto-generated soon</span>}>
      <div className="flex flex-col">
        {RECOMMENDATIONS.map((r, i) => {
          const m = MODULE_META[r.module];
          return (
            <div key={r.id} className={`flex flex-wrap items-center gap-3 py-3 ${i > 0 ? 'border-t border-[#F0F0EC]' : ''}`}>
              <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: m.accent.bg, color: m.accent.fg }}>{m.name}</span>
              <span className="min-w-0 flex-1 text-[14px] text-[#1A1C1E]">{r.action}</span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums" style={{ color: r.impact.startsWith('−') ? '#A32D2D' : '#0F6E56' }}>{r.impact}</span>
              <Badge label={REC_STATUS_LABEL[r.status]} tone={REC_TONE[r.status]} />
              <Link href={m.route} className="shrink-0 text-[12px] font-medium text-[#1E5E54] hover:underline">Open →</Link>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Budget table — categories + profit impact + suggested action
// ---------------------------------------------------------------------------

export function BudgetTable() {
  return (
    <DataTable
      columns={[
        { label: 'Category' },
        { label: 'Budgeted', align: 'right' },
        { label: 'Actual', align: 'right' },
        { label: 'Variance', align: 'right' },
        { label: 'Profit impact', align: 'right' },
        { label: 'Suggested action' },
        { label: 'Status', align: 'right' },
      ]}
      rows={BUDGET.map((b) => {
        const v = b.budgeted - b.actual;
        const over = b.actual > b.budgeted * 1.02;
        const under = b.actual < b.budgeted * 0.9;
        return [
          b.cat,
          zar(b.budgeted),
          zar(b.actual),
          <span key="v" style={{ color: v < 0 ? '#A32D2D' : '#0F6E56' }}>{v >= 0 ? '+' : '−'}{zar(Math.abs(v))}</span>,
          <span key="p" style={{ color: b.profitImpact < 0 ? '#A32D2D' : '#0F6E56' }}>{b.profitImpact >= 0 ? '+' : '−'}{zar(Math.abs(b.profitImpact))}</span>,
          b.suggestedAction,
          <span key="s" className="inline-flex justify-end"><Badge label={over ? 'Over' : under ? 'Under' : 'On track'} tone={over ? 'critical' : under ? 'neutral' : 'positive'} /></span>,
        ];
      })}
      empty="No budget set yet."
    />
  );
}

// ---------------------------------------------------------------------------
// Forecast cards + commentary
// ---------------------------------------------------------------------------

export function ForecastCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {FORECASTS.map((f) => {
        const color = f.tone === 'positive' ? '#0F6E56' : f.tone === 'critical' ? '#A32D2D' : f.tone === 'warning' ? '#854F0B' : '#1E5E54';
        return (
          <div key={f.id} className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#9A9DA1]">{f.label}</span>
              <span className="text-[12px]" style={{ color }}>{f.vsTarget}</span>
            </div>
            <div className="mt-1.5 text-[24px] font-bold leading-none text-[#1A1C1E]">{zar(f.value)}</div>
            <div className="mt-3">
              <PlaceholderChart data={f.data} color={color} fill={`${color}1A`} height={70} caption="Run-rate projection — illustrative" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ForecastCommentary() {
  return (
    <SectionCard title="Forecast commentary">
      <div className="flex flex-col gap-2.5">
        {FORECAST_COMMENTARY.map((t, i) => (
          <div key={i} className="flex items-start gap-2.5 text-[13px]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1E5E54]" />
            <span className="text-[#5F6368]">{t}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Scenario cards
// ---------------------------------------------------------------------------

export function ScenarioCards() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {SCENARIOS.map((s) => (
        <div key={s.id} className="flex flex-col rounded-2xl border border-[#E7E7E2] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold text-[#1A1C1E]">{s.title}</span>
            <span className="text-[12px] font-medium text-[#0F6E56]">+{zar(s.diffVsCurrent)}</span>
          </div>
          <p className="mt-1 text-[13px] text-[#5F6368]">{s.description}</p>
          <div className="mt-3 rounded-lg bg-[#F6FAF8] px-3 py-2 text-[12px] text-[#5F6368]">Assumes: {s.assumption}</div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#F0F0EC] pt-3">
            <Metric label="Proj. revenue" value={zar(s.projectedRevenue)} />
            <Metric label="Proj. profit" value={zar(s.projectedProfit)} color="#0F6E56" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile snapshot cards (future configurable widgets)
// ---------------------------------------------------------------------------

export function MobileSnapshotCards() {
  const color = (s: string) => (s === 'positive' ? '#0F6E56' : s === 'warning' ? '#854F0B' : s === 'critical' ? '#A32D2D' : '#1A1C1E');
  return (
    <div>
      <h2 className="mb-2 text-[13px] font-semibold text-[#9A9DA1]">Mobile snapshot — widgets the companion app will surface</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MOBILE_SNAPSHOT.map((w) => (
          <div key={w.id} className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
            <div className="text-[12px] text-[#9A9DA1]">{w.label}</div>
            <div className="mt-1.5 text-[22px] font-bold leading-none" style={{ color: color(w.severity) }}>{w.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

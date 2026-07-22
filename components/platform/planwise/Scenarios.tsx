'use client';

import { useState } from 'react';
import { zar } from '@/lib/platform/orderflow';
import { useToast } from '@/components/platform/orderflow/ui';
import { SectionCard, CountUp } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import {
  SCENARIO_SLIDERS,
  RISK_STYLE,
  AI_SCENARIO,
  projectScenario,
  type SliderValues,
} from '@/lib/platform/planwise';
import { usePlanWise } from './context';

const ZERO: SliderValues = { revenueGrowth: 0, expenseReduction: 0, marginImprovement: 0, wasteReduction: 0, invoiceRecovery: 0 };

export function ScenariosWorkspace() {
  const { node, show } = useToast();
  const { scenarios, scenarioBase } = usePlanWise();
  const [values, setValues] = useState<SliderValues>(ZERO);
  const [aiShown, setAiShown] = useState(false);
  const result = projectScenario(values, scenarioBase);
  const dirty = Object.values(values).some((v) => v !== 0);

  function setSlider(id: keyof SliderValues, v: number) {
    setValues((prev) => ({ ...prev, [id]: v }));
  }

  return (
    <div className="space-y-5">
      {node}

      {/* Builder + live results */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
        <SectionCard
          title="Scenario builder"
          right={dirty ? <button type="button" onClick={() => { setValues(ZERO); setAiShown(false); }} className="text-[12px] font-medium text-[#1F5FA8] hover:underline">Reset</button> : <span className="text-[12px] text-[#9A9DA1]">Drag to explore</span>}
        >
          <div className="flex flex-col gap-4">
            {SCENARIO_SLIDERS.map((s) => (
              <div key={s.id}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[13px] text-[#1A1C1E]">
                    {s.label}
                    {s.module ? <span className="ml-1.5 text-[10px] font-medium" style={{ color: MODULE_META[s.module].accent.fg }}>{MODULE_META[s.module].name}</span> : null}
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums text-[#1F5FA8]">{values[s.id]}{s.unit}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={s.max}
                  value={values[s.id]}
                  onChange={(e) => setSlider(s.id, Number(e.target.value))}
                  className="w-full accent-[#3E7BC4]"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-[#F0F0EC] pt-4">
            <button type="button" onClick={() => { setValues(AI_SCENARIO.sliders); setAiShown(true); show('Generated best scenario (demo)'); }} className="inline-flex items-center rounded-lg bg-[#1F5FA8] px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87]">
              ✦ Generate best scenario
            </button>
            <button type="button" onClick={() => show('Scenario saved (demo)')} className="rounded-lg border border-[#D7DAD8] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:border-[#3E7BC4]/40">Save scenario</button>
          </div>
        </SectionCard>

        <SectionCard title="Live results" right={<span className="text-[12px]" style={{ color: result.diffVsCurrent >= 0 ? '#0F6E56' : '#A32D2D' }}>{result.diffVsCurrent >= 0 ? '+' : '−'}{zar(Math.abs(result.diffVsCurrent))} vs current</span>}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Result label="Projected revenue" value={result.revenue} />
            <Result label="Projected expenses" value={result.expenses} />
            <Result label="Projected profit" value={result.profit} color="#0F6E56" />
            <Result label="Cash position" value={result.cash} />
            <Result label="Runway" value={result.runwayMonths} format={(n) => `${n.toFixed(1)} mo`} />
            <Result label="Δ vs current" value={result.diffVsCurrent} color={result.diffVsCurrent >= 0 ? '#0F6E56' : '#A32D2D'} signed />
          </div>
        </SectionCard>
      </div>

      {/* AI scenario card */}
      {aiShown ? (
        <div className="rounded-2xl border border-[#3E7BC4]/30 bg-gradient-to-br from-white to-[#F5F9FE] p-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF2FC] text-[14px] text-[#1F5FA8]">✦</span>
            <span className="text-[13px] font-semibold text-[#1F5FA8]">Best scenario</span>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5">
            {AI_SCENARIO.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#1A1C1E]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F5FA8]" />{s}</li>
            ))}
          </ul>
          <p className="mt-3 text-[14px]">Projected additional monthly profit: <span className="text-[18px] font-bold text-[#0F6E56]">+{zar(projectScenario(AI_SCENARIO.sliders, scenarioBase).diffVsCurrent)}</span></p>
        </div>
      ) : null}

      {/* Comparison table */}
      <SectionCard title="Scenario comparison" right={<span className="text-[12px] text-[#9A9DA1]">Click a row to load it</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#F0F0EC] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="py-2 pr-2 text-left font-medium">Scenario</th>
                <th className="px-2 py-2 text-right font-medium">Revenue</th>
                <th className="px-2 py-2 text-right font-medium">Profit</th>
                <th className="px-2 py-2 text-right font-medium">Cash</th>
                <th className="px-2 py-2 text-right font-medium">Rev. growth</th>
                <th className="px-2 py-2 text-right font-medium">Variance</th>
                <th className="px-2 py-2 text-left font-medium">Risk</th>
                <th className="py-2 pl-2 text-right font-medium">Probability</th>
              </tr>
            </thead>
            <tbody>
              <ComparisonRow name="Current" sliders={ZERO} />
              {scenarios.map((s) => (
                <ComparisonRow key={s.id} name={s.title} sliders={s.sliders} risk={s.risk} probability={s.probability} onLoad={() => { setValues(s.sliders); setAiShown(false); show(`Loaded ${s.title}`); }} />
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function Result({ label, value, color, format, signed }: { label: string; value: number; color?: string; format?: (n: number) => string; signed?: boolean }) {
  const fmt = format ?? ((n: number) => `${signed && n >= 0 ? '+' : signed && n < 0 ? '−' : ''}${zar(Math.abs(n))}`);
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">{label}</div>
      <div className="mt-1 text-[18px] font-bold leading-none" style={{ color: color ?? '#1A1C1E' }}>
        <CountUp value={value} format={fmt} />
      </div>
    </div>
  );
}

function ComparisonRow({ name, sliders, risk, probability, onLoad }: { name: string; sliders: SliderValues; risk?: 'Low' | 'Medium' | 'High'; probability?: number; onLoad?: () => void }) {
  const { scenarioBase } = usePlanWise();
  const r = projectScenario(sliders, scenarioBase);
  const isCurrent = !onLoad;
  return (
    <tr onClick={onLoad} className={`border-b border-[#F6F6F2] last:border-0 ${onLoad ? 'cursor-pointer hover:bg-[#FAFAF8]' : ''}`}>
      <td className="py-2.5 pr-2 font-medium text-[#1A1C1E]">{name}</td>
      <td className="px-2 py-2.5 text-right tabular-nums text-[#5F6368]">{zar(r.revenue)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums font-medium text-[#1A1C1E]">{zar(r.profit)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums text-[#5F6368]">{zar(r.cash)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums text-[#5F6368]">{sliders.revenueGrowth}%</td>
      <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: r.diffVsCurrent > 0 ? '#0F6E56' : r.diffVsCurrent < 0 ? '#A32D2D' : '#9A9DA1' }}>{isCurrent ? '—' : `${r.diffVsCurrent >= 0 ? '+' : '−'}${zar(Math.abs(r.diffVsCurrent))}`}</td>
      <td className="px-2 py-2.5">{risk ? <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: RISK_STYLE[risk].bg, color: RISK_STYLE[risk].fg }}>{risk}</span> : <span className="text-[#C7C9C5]">—</span>}</td>
      <td className="py-2.5 pl-2 text-right tabular-nums text-[#5F6368]">{probability != null ? `${probability}%` : '—'}</td>
    </tr>
  );
}

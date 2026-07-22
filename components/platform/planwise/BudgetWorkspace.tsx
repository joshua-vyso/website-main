'use client';

import { useState } from 'react';
import { zar } from '@/lib/platform/orderflow';
import { Badge } from '@/components/platform/module-ui';
import { budgetStatus } from '@/lib/platform/planwise';
import { usePlanWise } from './context';
import { BudgetTable } from './ui';

const SIZE = 220;
const THICK = 30;
const R = 85; // track radius (inner 70 / outer 100)
const R_OUTER = 100;
const R_INNER = 70;
const START = -Math.PI / 2;
const TAU = Math.PI * 2;
const PAD = 0.018; // tiny gap between segments (radians)

/** Annular-sector path — gap-free, clean doughnut segments (no dash-array seams). */
function sectorPath(cx: number, cy: number, rO: number, rI: number, a0: number, a1: number) {
  const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${pt(rO, a0)} A ${rO} ${rO} 0 ${large} 1 ${pt(rO, a1)} L ${pt(rI, a1)} A ${rI} ${rI} 0 ${large} 0 ${pt(rI, a0)} Z`;
}

export function BudgetWorkspace() {
  const { budget, totalBudget } = usePlanWise();
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const active = hovered ?? selected;
  const activeRow = active ? budget.find((b) => b.cat === active) ?? null : null;

  const segs = budget.map((b, i) => {
    const frac = totalBudget > 0 ? b.budgeted / totalBudget : 0;
    const offset = totalBudget > 0 ? budget.slice(0, i).reduce((s, p) => s + p.budgeted, 0) / totalBudget : 0;
    return { ...b, frac, offset };
  });

  function toggle(cat: string) {
    setSelected((s) => (s === cat ? null : cat));
  }

  if (budget.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-12 text-center">
        <p className="of-display text-[18px] font-semibold text-[#171A17]">No budget set yet</p>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-[#6B6F68]">Add budget categories to see where your money goes and how actuals track against plan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero: doughnut + detail panel */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[auto_1fr]">
        <div className="flex items-center justify-center rounded-2xl border border-[#EAEDF2] bg-white p-6 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <div className="relative" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#F4F4F1" strokeWidth={THICK} />
              {segs.map((s) => {
                const isActive = active === s.cat;
                const dimmed = active != null && !isActive;
                const a0 = START + s.offset * TAU + PAD;
                const a1 = START + (s.offset + s.frac) * TAU - PAD;
                return (
                  <path
                    key={s.cat}
                    d={sectorPath(SIZE / 2, SIZE / 2, isActive ? R_OUTER + 7 : R_OUTER, R_INNER, a0, a1)}
                    fill={s.color}
                    opacity={dimmed ? 0.32 : 1}
                    className="cursor-pointer"
                    style={{ transition: 'opacity 0.22s ease' }}
                    onMouseEnter={() => setHovered(s.cat)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => toggle(s.cat)}
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              {activeRow ? (
                <>
                  <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{activeRow.cat}</span>
                  <span className="of-num mt-1.5 text-[24px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{zar(activeRow.budgeted)}</span>
                  <span className="of-num mt-1.5 text-[12px] text-[#A0A49C]">{totalBudget > 0 ? Math.round((activeRow.budgeted / totalBudget) * 100) : 0}% of budget</span>
                </>
              ) : (
                <>
                  <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Total budget</span>
                  <span className="of-num mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{zar(totalBudget)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Detail panel reflecting hover/selection */}
        <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          {activeRow ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: activeRow.color }} />
                <h3 className="of-display text-[16px] font-semibold text-[#171A17]">{activeRow.cat}</h3>
                <Badge label={budgetStatus(activeRow).label} tone={budgetStatus(activeRow).tone} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Detail label="Budgeted" value={zar(activeRow.budgeted)} />
                <Detail label="Actual" value={zar(activeRow.actual)} />
                <Detail label="Variance" value={`${activeRow.budgeted - activeRow.actual >= 0 ? '+' : '−'}${zar(Math.abs(activeRow.budgeted - activeRow.actual))}`} color={activeRow.actual > activeRow.budgeted ? '#A32D2D' : '#0F6E56'} />
                <Detail label="% of budget" value={`${totalBudget > 0 ? Math.round((activeRow.budgeted / totalBudget) * 100) : 0}%`} />
              </div>
              <p className="mt-4 rounded-[10px] bg-[#F5F9FE] px-3.5 py-2.5 text-[13px] text-[#6B6F68]">{activeRow.suggestedAction}</p>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-center">
              <h3 className="of-display text-[16px] font-semibold text-[#171A17]">Where your budget goes</h3>
              <p className="mt-1.5 text-[13px] text-[#6B6F68]">Hover a segment to inspect it, or click to filter the breakdown below to that category.</p>
            </div>
          )}
        </div>
      </div>

      {/* Breakdown cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {budget.map((b) => {
          const st = budgetStatus(b);
          const isSel = selected === b.cat;
          return (
            <button
              key={b.cat}
              type="button"
              onMouseEnter={() => setHovered(b.cat)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => toggle(b.cat)}
              className={`rounded-[14px] border bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-all hover:shadow-sm ${isSel ? 'border-[#3E7BC4] ring-1 ring-[#3E7BC4]/20' : 'border-[#EEF1F5]'}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
                <span className="truncate text-[12px] font-medium text-[#171A17]">{b.cat}</span>
              </div>
              <div className="of-num mt-2 text-[16px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{zar(b.budgeted)}</div>
              <div className="mt-1.5 text-[12px] text-[#A0A49C]">actual <span className="of-num">{zar(b.actual)}</span></div>
              <div className="mt-2"><Badge label={st.label} tone={st.tone} /></div>
            </button>
          );
        })}
      </div>

      {/* Filtered table */}
      <div>
        {selected ? (
          <div className="mb-2 flex items-center gap-2 text-[13px]">
            <span className="text-[#6B6F68]">Showing <span className="font-medium text-[#171A17]">{selected}</span></span>
            <button type="button" onClick={() => setSelected(null)} className="text-[13px] font-semibold text-[#1F5FA8] hover:underline">Clear filter</button>
          </div>
        ) : null}
        <BudgetTable filter={selected} />
      </div>
    </div>
  );
}

function Detail({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{label}</div>
      <div className="of-num mt-2 text-[18px] font-semibold leading-none tracking-[-0.02em]" style={color ? { color } : { color: '#171A17' }}>{value}</div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { zar } from '@/lib/platform/orderflow';
import { Badge } from '@/components/platform/module-ui';
import { BUDGET, TOTAL_BUDGET, budgetStatus } from '@/lib/platform/planwise';
import { BudgetTable } from './ui';

const SIZE = 220;
const THICK = 30;
const R = 85;
const C = 2 * Math.PI * R;

export function BudgetWorkspace() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const active = hovered ?? selected;
  const activeRow = active ? BUDGET.find((b) => b.cat === active) ?? null : null;

  const segs = BUDGET.map((b, i) => {
    const frac = b.budgeted / TOTAL_BUDGET;
    const offset = BUDGET.slice(0, i).reduce((s, p) => s + p.budgeted, 0) / TOTAL_BUDGET;
    return { ...b, frac, offset };
  });

  function toggle(cat: string) {
    setSelected((s) => (s === cat ? null : cat));
  }

  return (
    <div className="space-y-5">
      {/* Hero: doughnut + detail panel */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[auto_1fr]">
        <div className="flex items-center justify-center rounded-2xl border border-[#E7E7E2] bg-white p-6">
          <div className="relative" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
                <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#F4F4F1" strokeWidth={THICK} />
                {segs.map((s) => {
                  const isActive = active === s.cat;
                  const dimmed = active != null && !isActive;
                  return (
                    <circle
                      key={s.cat}
                      cx={SIZE / 2}
                      cy={SIZE / 2}
                      r={R}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={isActive ? THICK + 8 : THICK}
                      strokeDasharray={`${s.frac * C} ${C - s.frac * C}`}
                      strokeDashoffset={-s.offset * C}
                      opacity={dimmed ? 0.32 : 1}
                      className="cursor-pointer"
                      style={{ transition: 'opacity 0.25s ease, stroke-width 0.25s ease' }}
                      onMouseEnter={() => setHovered(s.cat)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => toggle(s.cat)}
                    />
                  );
                })}
              </g>
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              {activeRow ? (
                <>
                  <span className="text-[12px] text-[#9A9DA1]">{activeRow.cat}</span>
                  <span className="text-[24px] font-bold leading-none text-[#1A1C1E]">{zar(activeRow.budgeted)}</span>
                  <span className="mt-1 text-[11px] text-[#9A9DA1]">{Math.round((activeRow.budgeted / TOTAL_BUDGET) * 100)}% of budget</span>
                </>
              ) : (
                <>
                  <span className="text-[12px] text-[#9A9DA1]">Total budget</span>
                  <span className="text-[26px] font-bold leading-none text-[#1A1C1E]">{zar(TOTAL_BUDGET)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Detail panel reflecting hover/selection */}
        <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
          {activeRow ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: activeRow.color }} />
                <h3 className="text-[16px] font-semibold text-[#1A1C1E]">{activeRow.cat}</h3>
                <Badge label={budgetStatus(activeRow).label} tone={budgetStatus(activeRow).tone} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Detail label="Budgeted" value={zar(activeRow.budgeted)} />
                <Detail label="Actual" value={zar(activeRow.actual)} />
                <Detail label="Variance" value={`${activeRow.budgeted - activeRow.actual >= 0 ? '+' : '−'}${zar(Math.abs(activeRow.budgeted - activeRow.actual))}`} color={activeRow.actual > activeRow.budgeted ? '#A32D2D' : '#0F6E56'} />
                <Detail label="% of budget" value={`${Math.round((activeRow.budgeted / TOTAL_BUDGET) * 100)}%`} />
              </div>
              <p className="mt-4 rounded-lg bg-[#F6FAF8] px-3 py-2 text-[13px] text-[#5F6368]">{activeRow.suggestedAction}</p>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-center">
              <h3 className="text-[16px] font-semibold text-[#1A1C1E]">Where your budget goes</h3>
              <p className="mt-1 text-[13px] text-[#5F6368]">Hover a segment to inspect it, or click to filter the breakdown below to that category.</p>
            </div>
          )}
        </div>
      </div>

      {/* Breakdown cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {BUDGET.map((b) => {
          const st = budgetStatus(b);
          const isSel = selected === b.cat;
          return (
            <button
              key={b.cat}
              type="button"
              onMouseEnter={() => setHovered(b.cat)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => toggle(b.cat)}
              className={`rounded-2xl border bg-white p-3.5 text-left transition-all hover:shadow-sm ${isSel ? 'border-[#1E5E54] ring-1 ring-[#1E5E54]/20' : 'border-[#E7E7E2]'}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
                <span className="truncate text-[12px] font-medium text-[#1A1C1E]">{b.cat}</span>
              </div>
              <div className="mt-2 text-[15px] font-bold leading-none text-[#1A1C1E]">{zar(b.budgeted)}</div>
              <div className="mt-1 text-[11px] text-[#9A9DA1]">actual {zar(b.actual)}</div>
              <div className="mt-2"><Badge label={st.label} tone={st.tone} /></div>
            </button>
          );
        })}
      </div>

      {/* Filtered table */}
      <div>
        {selected ? (
          <div className="mb-2 flex items-center gap-2 text-[13px]">
            <span className="text-[#5F6368]">Showing <span className="font-medium text-[#1A1C1E]">{selected}</span></span>
            <button type="button" onClick={() => setSelected(null)} className="text-[12px] font-medium text-[#1E5E54] hover:underline">Clear filter</button>
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
      <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">{label}</div>
      <div className="mt-1 text-[16px] font-bold leading-none" style={color ? { color } : { color: '#1A1C1E' }}>{value}</div>
    </div>
  );
}

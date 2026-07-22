'use client';

import { useMemo, useState } from 'react';
import { zar } from '@/lib/platform/orderflow';
import { useToast } from '@/components/platform/orderflow/ui';
import { SectionCard, InteractiveDonut, ProgressRing } from '@/components/platform/module-ui';
import { AreaChart, Sparkline } from '@/components/platform/procurepulse/ui';
import { HEATMAP, HEATMAP_DAYS, COST_TIMELINE, TIME_PERIODS, type TimePeriod, type WasteCategoryRow } from '@/lib/platform/wastewatch';
import { TrendArrow } from './shared';
import { useWasteWatch, CategoryModal } from './categories';

export function WasteAnalytics() {
  const { node, show } = useToast();
  const ww = useWasteWatch();
  const { categories, removeCategory } = ww;
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [modal, setModal] = useState<{ open: boolean; mode: 'create' | 'edit'; category: WasteCategoryRow | null }>({ open: false, mode: 'create', category: null });
  const activeKey = hovered ?? selected;

  // Categories carry their own stats (ww_waste_categories). The doughnut shows
  // those with recorded waste; the legend lists all (0-cost → "no waste yet").
  const visible = useMemo(() => categories.filter((c) => c.cost > 0), [categories]);
  const total = visible.reduce((s, c) => s + c.cost, 0);
  const pctOf = (cost: number) => (total ? Math.round((cost / total) * 100) : 0);
  const activeCat = categories.find((c) => c.id === activeKey && c.cost > 0) ?? null;
  const selectedCat = categories.find((c) => c.id === selected && c.cost > 0) ?? null;

  const emp = ww.employeeStats;
  const recipes = ww.recipeStats;
  const maxEmp = Math.max(1, ...emp.map((e) => e.cost));
  const prevTotal = ww.preventable.preventable + ww.preventable.unavoidable;
  const prevPct = prevTotal ? Math.round((ww.preventable.preventable / prevTotal) * 100) : 0;

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Analytics</h1>
          <p className="mt-1.5 text-[14px] text-[#8A8E86]">Patterns by category, employee, recipe and time</p>
        </div>
        {selectedCat ? (
          <button type="button" onClick={() => setSelected(null)} className="text-[13px] font-semibold text-[#1F5FA8] hover:underline">Focus: {selectedCat.name} · clear</button>
        ) : null}
      </div>

      {/* Waste by category */}
      <SectionCard
        title="Waste by category"
        right={
          <button type="button" onClick={() => setModal({ open: true, mode: 'create', category: null })} className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">+ New category</button>
        }
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[auto_1fr]">
          <div className="flex justify-center">
            <InteractiveDonut
              segments={visible.map((c) => ({ key: c.id, value: c.cost, color: c.color }))}
              activeKey={activeKey}
              onHover={setHovered}
              onSelect={(k) => setSelected((s) => (s === k ? null : k))}
              size={200}
              center={
                activeCat ? (
                  <>
                    <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{activeCat.name}</span>
                    <span className="of-num mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{zar(activeCat.cost)}</span>
                    <span className="of-num mt-1 text-[11px] text-[#A0A49C]">{pctOf(activeCat.cost)}%</span>
                  </>
                ) : (
                  <>
                    <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Total waste</span>
                    <span className="of-num mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{zar(total)}</span>
                  </>
                )
              }
            />
          </div>
          <div className="flex flex-col justify-center gap-0.5">
            {categories.map((cat) => {
              const isActive = activeKey === cat.id;
              const has = cat.cost > 0;
              return (
                <div key={cat.id} className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${isActive ? 'bg-[#F5F9FE]' : ''}`}>
                  {has ? (
                    <button type="button" onMouseEnter={() => setHovered(cat.id)} onMouseLeave={() => setHovered(null)} onClick={() => setSelected((s) => (s === cat.id ? null : cat.id))} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                      <span className="flex items-center gap-2 text-[14px] text-[#171A17]"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}</span>
                      <span className="flex items-center gap-3">
                        <Sparkline data={cat.trend} color={cat.color} width={56} height={20} />
                        <span className="of-num w-16 text-right text-[14px] font-semibold text-[#171A17]">{zar(cat.cost)}</span>
                        <span className="of-num w-9 text-right text-[12px] text-[#A0A49C]">{pctOf(cat.cost)}%</span>
                      </span>
                    </button>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-[14px] text-[#171A17]"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}</span>
                      <span className="text-[12px] text-[#A0A49C]">No waste logged yet</span>
                    </div>
                  )}
                  <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                    <button type="button" onClick={() => setModal({ open: true, mode: 'edit', category: cat })} aria-label={`Edit ${cat.name}`} className="flex h-6 w-6 items-center justify-center rounded text-[#8A8E86] hover:text-[#171A17]" title="Edit">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </button>
                    <button type="button" onClick={() => { removeCategory(cat.id); show(`Removed “${cat.name}”`); }} aria-label={`Remove ${cat.name}`} className="flex h-6 w-6 items-center justify-center rounded text-[12px] text-[#8A8E86] hover:text-[#A32D2D]" title="Remove">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Leaderboard */}
        <SectionCard title="Waste by employee" right={<span className="text-[12px] text-[#A0A49C]">highest → lowest</span>}>
          <div className="flex flex-col gap-3">
            {emp.map((e, i) => (
              <div key={e.name} className="flex items-center gap-3">
                <span className="of-num w-5 text-[12px] font-semibold text-[#A0A49C]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="truncate font-medium text-[#171A17]">{e.name}</span>
                    <span className="of-num font-semibold text-[#171A17]">{zar(e.cost)} <span className="text-[11px] font-normal text-[#A0A49C]">· {e.events} events</span></span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#EEF1F5]">
                    <div className="h-full rounded-full" style={{ width: `${(e.cost / maxEmp) * 100}%`, backgroundColor: e.vsTeamPct > 0 ? '#A32D2D' : '#0F6E56', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
                <span className="of-num w-14 text-right text-[12px] font-medium" style={{ color: e.vsTeamPct > 0 ? '#A32D2D' : '#0F6E56' }}><TrendArrow dir={e.trend} /> {e.vsTeamPct > 0 ? '+' : ''}{e.vsTeamPct}%</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Recipe table */}
        <SectionCard title="Waste by recipe" right={<span className="text-[12px] text-[#A0A49C]">optimise portioning</span>}>
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#EEF1F5] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                <th className="py-2 pr-2 text-left font-medium">Recipe</th>
                <th className="px-2 py-2 text-right font-medium">Waste %</th>
                <th className="px-2 py-2 text-right font-medium">Avg cost</th>
                <th className="py-2 pl-2 text-right font-medium">Frequency</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((r) => (
                <tr key={r.recipe} className="border-b border-[#F4F5F7] last:border-0">
                  <td className="py-3 pr-2 font-semibold text-[#171A17]">{r.recipe}</td>
                  <td className="of-num px-2 py-3 text-right font-semibold" style={{ color: r.wastePct >= 18 ? '#A32D2D' : r.wastePct >= 12 ? '#854F0B' : '#0F6E56' }}>{r.wastePct}%</td>
                  <td className="of-num px-2 py-3 text-right text-[#2C333B]">{zar(r.avgCost)}</td>
                  <td className="of-num py-3 pl-2 text-right text-[#A0A49C]">{r.frequency}/mo</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      {/* Time heatmap */}
      <SectionCard title="Waste by time" right={<span className="text-[12px] text-[#A0A49C]">darker = more waste</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                <th className="px-2 py-2 text-left font-medium" />
                {HEATMAP_DAYS.map((d) => (<th key={d} className="px-2 py-2 text-center font-medium">{d}</th>))}
              </tr>
            </thead>
            <tbody>
              {HEATMAP.map((row) => (
                <tr key={row.period}>
                  <td className="px-2 py-1.5 text-[14px] font-medium text-[#171A17]">{row.period}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-1 py-1">
                      <div className="of-num flex h-9 items-center justify-center rounded-[10px] text-[11px] font-semibold" style={{ backgroundColor: `rgba(163,45,45,${(v / 100) * 0.85 + 0.05})`, color: v > 55 ? 'white' : '#6B6F68' }}>{v}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2.5 text-[12px] text-[#A0A49C]">Saturday mornings carry the most waste — worth tightening weekend prep.</p>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Cost trend */}
        <SectionCard title="Cost trend" right={
          <div className="inline-flex rounded-[11px] border border-[#EEF1F5] bg-[#F7F8FA] p-1">
            {TIME_PERIODS.map((p) => (<button key={p.key} type="button" onClick={() => setPeriod(p.key)} className={`rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium transition-colors ${period === p.key ? 'bg-white text-[#171A17] shadow-[0_1px_2px_rgba(20,24,20,0.06)]' : 'text-[#8A8E86] hover:text-[#6B6F68]'}`}>{p.label}</button>))}
          </div>
        }>
          <AreaChart data={COST_TIMELINE[period]} color="#A32D2D" fill="#FCEBEB" height={120} />
        </SectionCard>

        {/* Preventable vs unavoidable */}
        <SectionCard title="Preventable vs unavoidable">
          <div className="flex items-center gap-5">
            <ProgressRing pct={prevPct} color="#854F0B" size={96} thickness={9}>
              <span className="of-num text-[22px] font-semibold tracking-[-0.02em] text-[#854F0B]">{prevPct}%</span>
              <span className="text-[10px] uppercase tracking-[0.05em] text-[#A0A49C]">preventable</span>
            </ProgressRing>
            <div className="flex-1 space-y-3">
              <Bar label="Preventable" value={ww.preventable.preventable} total={prevTotal} color="#854F0B" />
              <Bar label="Unavoidable" value={ww.preventable.unavoidable} total={prevTotal} color="#8A8E86" />
              <p className="text-[12px] text-[#A0A49C]">Nearly half of this week&rsquo;s waste cost is avoidable with tighter prep and ordering.</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <CategoryModal
        open={modal.open}
        mode={modal.mode}
        category={modal.category}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        onSaved={(n) => show(modal.mode === 'edit' ? `Category “${n}” updated` : `Category “${n}” created`)}
      />
    </div>
  );
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[14px]">
        <span className="text-[#6B6F68]">{label}</span>
        <span className="of-num font-semibold text-[#171A17]">{zar(value)}</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#EEF1F5]">
        <div className="h-full rounded-full" style={{ width: `${(value / total) * 100}%`, backgroundColor: color, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

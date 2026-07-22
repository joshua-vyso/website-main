'use client';

import Link from 'next/link';
import { zar } from '@/lib/platform/orderflow';
import { AreaChart } from '@/components/platform/procurepulse/ui';
import { SectionCard, CountUp } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { FORECAST_DRIVERS, FORECAST_COMMENTARY, type ForecastLine } from '@/lib/platform/planwise';
import { usePlanWise } from './context';

function toneColor(t: ForecastLine['tone']) {
  return t === 'positive' ? '#0F6E56' : t === 'critical' ? '#A32D2D' : t === 'warning' ? '#854F0B' : '#3E7BC4';
}
const TREND = { up: '▲', down: '▼', flat: '→' } as const;

export function ForecastCardsRich() {
  const { forecast } = usePlanWise();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {forecast.map((f) => {
        const color = toneColor(f.tone);
        const pctDiff = f.target !== 0 ? Math.round(((f.value - f.target) / f.target) * 100) : 0;
        const overUnder = f.id === 'exp' ? (pctDiff > 0 ? 'over ceiling' : 'under ceiling') : pctDiff >= 0 ? 'above target' : 'below target';
        return (
          <div key={f.id} className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-shadow hover:shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{f.label}</span>
              <span className="of-num text-[12px] font-medium" style={{ color }}>{TREND[f.trend]} {Math.abs(pctDiff)}% {overUnder}</span>
            </div>
            <CountUp value={f.value} format={(n) => zar(n)} className="of-num mt-2 block text-[30px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]" />
            <div className="mt-2 text-[13px] text-[#6B6F68]">Likely range <span className="of-num">{zar(f.rangeLow)}</span> – <span className="of-num">{zar(f.rangeHigh)}</span></div>
            <div className="mt-3">
              <AreaChart data={f.data} color={color} fill={`${color}1A`} height={64} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">Confidence</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEF1F5]">
                <div className="h-full rounded-full" style={{ width: `${f.confidence}%`, backgroundColor: color, transition: 'width 0.7s ease' }} />
              </div>
              <span className="of-num text-[11px] font-medium" style={{ color }}>{f.confidence}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ForecastDrivers() {
  return (
    <SectionCard title="What is driving this forecast?">
      <div className="flex flex-col gap-3">
        {FORECAST_DRIVERS.map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-[13px] text-[#6B6F68]">
              {d.module ? <Link href={MODULE_META[d.module].route} className="hover:text-[#171A17]">{d.label}</Link> : d.label}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#EEF1F5]">
              <div className="h-full rounded-full" style={{ width: `${d.pct}%`, backgroundColor: d.color, transition: 'width 0.7s cubic-bezier(0.22,1,0.36,1)' }} />
            </div>
            <span className="of-num w-10 shrink-0 text-right text-[13px] font-semibold text-[#171A17]">{d.pct}%</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function ForecastInsight() {
  return (
    <SectionCard title="Forecast commentary" right={<span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1F5FA8]">✦ AI insight</span>}>
      <div className="rounded-[14px] border border-[#EEF1F5] bg-gradient-to-br from-white to-[#F5F9FE] p-4">
        <div className="flex flex-col gap-3">
          {FORECAST_COMMENTARY.map((t, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F5FA8]" />
              <span className="text-[#171A17]">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

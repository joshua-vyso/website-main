'use client';

import { useState, type ReactNode } from 'react';
import type { Supplier } from '@/lib/platform/supplysync-data';
import { useSupplySync } from '@/components/platform/supplysync/context';
import {
  EmptyState,
  ScorePill,
  scoreColor,
  GREEN,
  TEAL,
  AMBER,
  RED,
  MUTE,
  FAINT,
  SupplierNameButton,
} from '@/components/platform/supplysync/shared';
import { SectionCard, DataTable, InteractiveDonut } from '@/components/platform/module-ui';
import { AreaChart, Sparkline } from '@/components/platform/procurepulse/ui';

// ---------------------------------------------------------------------------
// Helpers (local, illustrative-only maths over live supplier data)
// ---------------------------------------------------------------------------

/** Element-wise average of a set of equal-length series; falls back gracefully. */
function averageSeries(series: number[][]): number[] {
  const valid = series.filter((s) => s.length > 0);
  if (valid.length === 0) return [];
  const len = Math.max(...valid.map((s) => s.length));
  const out: number[] = [];
  for (let i = 0; i < len; i += 1) {
    let sum = 0;
    let count = 0;
    for (const s of valid) {
      if (i < s.length) {
        sum += s[i];
        count += 1;
      }
    }
    out.push(count > 0 ? Math.round(sum / count) : 0);
  }
  return out;
}

/** Element-wise sum of a set of series (used for the illustrative quality series). */
function sumSeries(series: number[][]): number[] {
  const valid = series.filter((s) => s.length > 0);
  if (valid.length === 0) return [];
  const len = Math.max(...valid.map((s) => s.length));
  const out: number[] = [];
  for (let i = 0; i < len; i += 1) {
    let sum = 0;
    for (const s of valid) if (i < s.length) sum += s[i];
    out.push(sum);
  }
  return out;
}

/** Improvement across a score trend (last minus first). */
function trendDelta(trend: number[]): number {
  if (trend.length < 2) return 0;
  return trend[trend.length - 1] - trend[0];
}

/** argmax over suppliers by a numeric selector; undefined only when list is empty. */
function pickMax(suppliers: Supplier[], value: (s: Supplier) => number): Supplier | undefined {
  if (suppliers.length === 0) return undefined;
  return suppliers.reduce((best, s) => (value(s) > value(best) ? s : best), suppliers[0]);
}

/** argmin over suppliers by a numeric selector. */
function pickMin(suppliers: Supplier[], value: (s: Supplier) => number): Supplier | undefined {
  if (suppliers.length === 0) return undefined;
  return suppliers.reduce((worst, s) => (value(s) < value(worst) ? s : worst), suppliers[0]);
}

const SCORE_BANDS = [
  { key: 'excellent', label: '85+', min: 85, color: GREEN },
  { key: 'good', label: '72–84', min: 72, color: TEAL },
  { key: 'watch', label: '60–71', min: 60, color: AMBER },
  { key: 'weak', label: '<60', min: 0, color: RED },
] as const;

function bandKeyFor(overall: number): (typeof SCORE_BANDS)[number]['key'] {
  for (const b of SCORE_BANDS) if (overall >= b.min) return b.key;
  return 'weak';
}

const CAPTION = 'Illustrative — from live supplier data';

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function ChartCaption() {
  return <p className="mt-2 text-[11px] text-[#9A9DA1]">{CAPTION}</p>;
}

/** One highlight card (Best / Most improved / …). Guards a missing supplier. */
function HighlightCard({
  label,
  supplier,
  metric,
  color,
}: {
  label: string;
  supplier: Supplier | undefined;
  metric: ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">{label}</div>
      {supplier ? (
        <>
          <SupplierNameButton
            id={supplier.id}
            name={supplier.name}
            className="mt-1.5 block max-w-full truncate text-left text-[14px] font-semibold"
          />
          <div className="mt-1 text-[20px] font-bold leading-none tabular-nums" style={{ color }}>
            {metric}
          </div>
        </>
      ) : (
        <p className="mt-1.5 text-[13px] text-[#9A9DA1]">No data yet</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Performance workspace
// ---------------------------------------------------------------------------

export function PerformanceTab() {
  const { suppliers, isEmpty } = useSupplySync();
  const [activeBand, setActiveBand] = useState<string | null>(null);

  if (isEmpty) {
    return (
      <EmptyState
        title="No supplier performance to show yet"
        hint="Add suppliers and log deliveries, quality checks and responses in SupplySync to build scorecards and performance trends here."
      />
    );
  }

  // ---- Section 1: scorecard rows -----------------------------------------
  const scorecardRows: ReactNode[][] = suppliers.map((s) => {
    const sc = s.scorecard;
    const trend = s.performance.scoreTrend;
    return [
      <SupplierNameButton key="name" id={s.id} name={s.name} className="font-medium" />,
      <ScorePill key="overall" value={sc.overall} />,
      <ScorePill key="reliability" value={sc.reliability} />,
      <ScorePill key="quality" value={sc.quality} />,
      <ScorePill key="delivery" value={sc.deliveryConsistency} />,
      <ScorePill key="price" value={sc.priceStability} />,
      <ScorePill key="responsiveness" value={sc.responsiveness} />,
      <ScorePill key="compliance" value={sc.compliance} />,
      trend.length > 0 ? (
        <div key="trend" className="flex justify-end">
          <Sparkline data={trend} color={scoreColor(sc.overall)} width={96} height={32} />
        </div>
      ) : (
        <span key="trend" className="text-[#9A9DA1]">
          —
        </span>
      ),
    ];
  });

  // ---- Section 2: aggregate chart series ---------------------------------
  const reliabilityAvg = averageSeries(suppliers.map((s) => s.performance.reliabilityTrend));
  const deliveryAvg = averageSeries(suppliers.map((s) => s.performance.deliveryTrend));
  // Illustrative quality-issue series: sum each supplier's live delivery-trend shape,
  // weighted by their logged quality-issue count, so the curve reflects real data.
  const qualitySeries = sumSeries(
    suppliers.map((s) => s.performance.deliveryTrend.map((v) => v * (s.performance.qualityIssues || 0))),
  );

  const bandCounts = SCORE_BANDS.map((b) => ({
    ...b,
    count: suppliers.filter((s) => bandKeyFor(s.scorecard.overall) === b.key).length,
  }));
  const donutSegments = bandCounts
    .filter((b) => b.count > 0)
    .map((b) => ({ key: b.key, value: b.count, color: b.color }));

  // ---- Section 3: highlights ---------------------------------------------
  const bestOverall = pickMax(suppliers, (s) => s.scorecard.overall);
  const mostImproved = pickMax(suppliers, (s) => trendDelta(s.performance.scoreTrend));
  const mostRisky = pickMin(suppliers, (s) => s.scorecard.overall);
  const mostReliable = pickMax(suppliers, (s) => s.scorecard.reliability);
  const mostPriceStable = pickMax(suppliers, (s) => s.scorecard.priceStability);

  const improvedDelta = mostImproved ? trendDelta(mostImproved.performance.scoreTrend) : 0;

  return (
    <div className="space-y-5">
      {/* 1 — Supplier scorecards ------------------------------------------- */}
      <SectionCard title="Supplier scorecards">
        <DataTable
          columns={[
            { label: 'Supplier' },
            { label: 'Overall' },
            { label: 'Reliability' },
            { label: 'Quality' },
            { label: 'Delivery' },
            { label: 'Price stability' },
            { label: 'Responsiveness' },
            { label: 'Compliance' },
            { label: 'Trend', align: 'right' },
          ]}
          rows={scorecardRows}
          empty="No scorecards yet."
        />
      </SectionCard>

      {/* 2 — Performance charts -------------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Reliability trend">
          {reliabilityAvg.length > 0 ? (
            <>
              <AreaChart data={reliabilityAvg} color={TEAL} fill="#E3F0ED" height={130} />
              <ChartCaption />
            </>
          ) : (
            <p className="text-[13px] text-[#9A9DA1]">No reliability history yet.</p>
          )}
        </SectionCard>

        <SectionCard title="Delivery consistency">
          {deliveryAvg.length > 0 ? (
            <>
              <AreaChart data={deliveryAvg} color={GREEN} fill="#E4F0EA" height={130} />
              <ChartCaption />
            </>
          ) : (
            <p className="text-[13px] text-[#9A9DA1]">No delivery history yet.</p>
          )}
        </SectionCard>

        <SectionCard title="Supplier score distribution">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            {donutSegments.length > 0 ? (
              <InteractiveDonut
                segments={donutSegments}
                activeKey={activeBand}
                onHover={setActiveBand}
                onSelect={(k) => setActiveBand((cur) => (cur === k ? null : k))}
                size={168}
                thickness={26}
                center={
                  <div className="text-center">
                    <div className="text-[22px] font-bold tabular-nums text-[#1A1C1E]">{suppliers.length}</div>
                    <div className="text-[11px] text-[#9A9DA1]">suppliers</div>
                  </div>
                }
              />
            ) : null}
            <ul className="w-full space-y-1.5">
              {bandCounts.map((b) => (
                <li
                  key={b.key}
                  onMouseEnter={() => setActiveBand(b.key)}
                  onMouseLeave={() => setActiveBand(null)}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5"
                  style={{ backgroundColor: activeBand === b.key ? '#FBFBF9' : 'transparent' }}
                >
                  <span className="flex items-center gap-2 text-[13px] text-[#5F6368]">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                    Overall {b.label}
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: b.color }}>
                    {b.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <ChartCaption />
        </SectionCard>

        <SectionCard title="Quality issue trend">
          {qualitySeries.length > 0 ? (
            <>
              <AreaChart data={qualitySeries} color={AMBER} fill="#F3ECDD" height={130} />
              <ChartCaption />
            </>
          ) : (
            <p className="text-[13px] text-[#9A9DA1]">No quality issues logged.</p>
          )}
        </SectionCard>
      </div>

      {/* 3 — Best / worst highlights --------------------------------------- */}
      <SectionCard title="Performance highlights">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <HighlightCard
            label="Best overall"
            supplier={bestOverall}
            metric={bestOverall ? `${bestOverall.scorecard.overall}` : '—'}
            color={bestOverall ? scoreColor(bestOverall.scorecard.overall) : MUTE}
          />
          <HighlightCard
            label="Most improved"
            supplier={improvedDelta > 0 ? mostImproved : undefined}
            metric={improvedDelta > 0 ? `+${improvedDelta}` : '—'}
            color={GREEN}
          />
          <HighlightCard
            label="Most at risk"
            supplier={mostRisky}
            metric={mostRisky ? `${mostRisky.scorecard.overall}` : '—'}
            color={mostRisky ? scoreColor(mostRisky.scorecard.overall) : FAINT}
          />
          <HighlightCard
            label="Most reliable"
            supplier={mostReliable}
            metric={mostReliable ? `${mostReliable.scorecard.reliability}` : '—'}
            color={TEAL}
          />
          <HighlightCard
            label="Most price-stable"
            supplier={mostPriceStable}
            metric={mostPriceStable ? `${mostPriceStable.scorecard.priceStability}` : '—'}
            color={GREEN}
          />
        </div>
      </SectionCard>
    </div>
  );
}

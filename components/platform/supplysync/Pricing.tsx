'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SectionCard, DataTable, Badge, type Tone } from '@/components/platform/module-ui';
import type {
  SupplierPricingRecord,
  SupplierOpportunity,
  OpportunityKind,
} from '@/lib/platform/supplysync-data';
import { useSupplySync } from './context';
import {
  zar,
  ScorePill,
  SupplierNameButton,
  POSITION_META,
  marketDiffColor,
  EmptyState,
  GREEN,
  RED,
  MUTE,
  INK,
} from './shared';

// ---------------------------------------------------------------------------
// Small helpers (local — no new shared utilities)
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Colour a period-over-period change: rising price = red, falling = green. */
function changeColor(changePct: number): string {
  if (changePct > 0.4) return RED;
  if (changePct < -0.4) return GREEN;
  return MUTE;
}

function signed(pct: number): string {
  const v = Math.round(pct * 10) / 10;
  return `${v > 0 ? '+' : ''}${v}%`;
}

/** Short buy/hold/negotiate recommendation from a pricing record's market gap. */
function pricingRecommendation(p: SupplierPricingRecord): { label: string; tone: Tone } {
  if (p.diffVsMarketPct <= -4) return { label: 'Buy — below market', tone: 'positive' };
  if (p.diffVsMarketPct >= 8) return { label: 'Review / negotiate', tone: 'critical' };
  return { label: 'Stable', tone: 'neutral' };
}

/**
 * Best-value blend for the comparison table: 60% supplier score, 40% price
 * standing vs market (cheaper than market pushes it up). 0–100.
 */
function bestValueScore(overall: number, diffVsMarketPct: number): number {
  const priceScore = clamp(50 - diffVsMarketPct * 2, 0, 100);
  return Math.round(overall * 0.6 + priceScore * 0.4);
}

// ---------------------------------------------------------------------------
// Opportunity kind styling
// ---------------------------------------------------------------------------

const OPP_META: Record<OpportunityKind, { label: string; tone: Tone; accent: string }> = {
  buy_now: { label: 'Buy now', tone: 'positive', accent: GREEN },
  negotiate: { label: 'Negotiate', tone: 'warning', accent: '#854F0B' },
  review: { label: 'Review', tone: 'critical', accent: RED },
  watch: { label: 'Watch', tone: 'neutral', accent: MUTE },
};

const OPP_ORDER: OpportunityKind[] = ['buy_now', 'negotiate', 'review', 'watch'];

// ---------------------------------------------------------------------------
// Pricing intelligence tab
// ---------------------------------------------------------------------------

export function PricingTab() {
  const { pricing, opportunities, suppliers, supplierById, openProfile } = useSupplySync();

  // Distinct pricing categories for the comparison selector.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of pricing) if (p.category) set.add(p.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pricing]);

  const [category, setCategory] = useState<string>('');
  const activeCategory = category || categories[0] || '';

  // Comparison rows for the chosen category, best value first.
  const comparisonRows = useMemo(() => {
    if (!activeCategory) return [];
    return pricing
      .filter((p) => p.category === activeCategory)
      .map((p) => {
        const s = supplierById(p.supplierId);
        const overall = s?.scorecard.overall ?? 0;
        return {
          record: p,
          reliability: s?.scorecard.reliability ?? 0,
          quality: s?.scorecard.quality ?? 0,
          delivery: s?.scorecard.deliveryConsistency ?? 0,
          value: bestValueScore(overall, p.diffVsMarketPct),
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [pricing, activeCategory, supplierById]);

  // Group opportunities by kind, preserving the strongest-signal order.
  const groupedOpps = useMemo(() => {
    const groups = new Map<OpportunityKind, SupplierOpportunity[]>();
    for (const o of opportunities) {
      const arr = groups.get(o.kind) ?? [];
      arr.push(o);
      groups.set(o.kind, arr);
    }
    return OPP_ORDER.map((kind) => ({ kind, items: groups.get(kind) ?? [] })).filter((g) => g.items.length > 0);
  }, [opportunities]);

  if (pricing.length === 0) {
    return (
      <EmptyState
        title="No pricing data yet"
        hint="Once supplier price lists flow in — via Doc-U extraction or ProcurePulse — SupplySync will track how each supplier's prices move versus the market and surface buying opportunities here."
      />
    );
  }

  const hasSuppliers = suppliers.length > 0;

  return (
    <div className="space-y-5">
      {/* ---------------------------------------------------------------- */}
      {/* 1) Price watch                                                    */}
      {/* ---------------------------------------------------------------- */}
      <SectionCard
        title="Price watch"
        right={<span className="text-[12px] text-[#9A9DA1]">{pricing.length} tracked line{pricing.length === 1 ? '' : 's'}</span>}
      >
        <DataTable
          columns={[
            { label: 'Item' },
            { label: 'Supplier' },
            { label: 'Current', align: 'right' },
            { label: 'Previous', align: 'right' },
            { label: 'Change', align: 'right' },
            { label: 'Market avg', align: 'right' },
            { label: 'Vs market', align: 'right' },
            { label: 'Recommendation' },
          ]}
          empty="No tracked price lines."
          rows={pricing.map((p) => {
            const rec = pricingRecommendation(p);
            const pos = POSITION_META[p.position];
            return [
              <div key="item">
                <div className="font-medium text-[#1A1C1E]">{p.item}</div>
                <div className="text-[11px] text-[#9A9DA1]">
                  {p.category}
                  {p.unit ? ` · per ${p.unit}` : ''}
                </div>
              </div>,
              p.supplierId ? (
                <SupplierNameButton key="sup" id={p.supplierId} name={p.supplierName || 'Supplier'} />
              ) : (
                <span key="sup">{p.supplierName || '—'}</span>
              ),
              <span key="cur" className="font-medium text-[#1A1C1E] tabular-nums">{zar(p.currentPrice)}</span>,
              <span key="prev" className="text-[#5F6368] tabular-nums">{zar(p.previousPrice)}</span>,
              <span key="chg" className="font-medium tabular-nums" style={{ color: changeColor(p.changePct) }}>
                {signed(p.changePct)}
              </span>,
              <span key="mkt" className="text-[#5F6368] tabular-nums">{zar(p.marketAvg)}</span>,
              <span key="vs" className="tabular-nums" style={{ color: marketDiffColor(p.diffVsMarketPct) }}>
                <span className="font-medium">{signed(p.diffVsMarketPct)}</span>
                <span className="ml-1 text-[11px]" style={{ color: pos.color }}>{pos.label}</span>
              </span>,
              <Badge key="rec" label={rec.label} tone={rec.tone} />,
            ];
          })}
        />
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      {/* 2) Supplier price comparison                                      */}
      {/* ---------------------------------------------------------------- */}
      <SectionCard
        title="Supplier price comparison"
        right={
          categories.length > 0 ? (
            <label className="flex items-center gap-2 text-[12px] text-[#5F6368]">
              <span className="text-[#9A9DA1]">Category</span>
              <select
                value={activeCategory}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-[#E7E7E2] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#1A1C1E] outline-none focus:border-[#B0466A]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          ) : undefined
        }
      >
        <p className="mb-3 text-[12px] text-[#5F6368]">
          Best value blends supplier score with price standing versus the market — a quick read on who to lean on for{' '}
          <span className="font-medium text-[#1A1C1E]">{activeCategory || 'this category'}</span>. Purchasing stays in ProcurePulse.
        </p>
        <DataTable
          columns={[
            { label: 'Supplier' },
            { label: 'Item' },
            { label: 'Current price', align: 'right' },
            { label: 'Reliability', align: 'right' },
            { label: 'Quality', align: 'right' },
            { label: 'Delivery', align: 'right' },
            { label: 'Best value', align: 'right' },
          ]}
          empty="No suppliers priced in this category."
          rows={comparisonRows.map((row, i) => {
            const p = row.record;
            const isTop = i === 0;
            return [
              <div key="sup" className="flex items-center gap-2">
                {p.supplierId ? (
                  <SupplierNameButton id={p.supplierId} name={p.supplierName || 'Supplier'} />
                ) : (
                  <span className="font-medium text-[#1A1C1E]">{p.supplierName || '—'}</span>
                )}
                {isTop ? <Badge label="Top pick" tone="positive" /> : null}
              </div>,
              <span key="item" className="text-[#5F6368]">{p.item}</span>,
              <span key="price" className="tabular-nums font-medium text-[#1A1C1E]">{zar(p.currentPrice)}</span>,
              <ScorePill key="rel" value={row.reliability} />,
              <ScorePill key="qual" value={row.quality} />,
              <ScorePill key="del" value={row.delivery} />,
              <ScorePill key="val" value={row.value} />,
            ];
          })}
        />
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      {/* 3) Buying opportunities                                           */}
      {/* ---------------------------------------------------------------- */}
      <SectionCard
        title="Buying opportunities"
        right={<span className="text-[12px] text-[#9A9DA1]">Recommendations · act in ProcurePulse</span>}
      >
        {groupedOpps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-10 text-center">
            <p className="text-[14px] font-medium text-[#1A1C1E]">No standout opportunities right now</p>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">
              Supplier prices are tracking close to market. SupplySync will flag below-market buys and above-market lines to negotiate as new price lists arrive.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {groupedOpps.map((group) => {
              const meta = OPP_META[group.kind];
              return (
                <div key={group.kind}>
                  <div className="mb-2.5 flex items-center gap-2">
                    <Badge label={meta.label} tone={meta.tone} />
                    <span className="text-[12px] text-[#9A9DA1]">{group.items.length}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {group.items.map((o) => (
                      <article
                        key={o.id}
                        className="rounded-2xl border border-[#E7E7E2] bg-white p-4"
                        style={{ borderLeft: `3px solid ${meta.accent}` }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-[14px] font-semibold text-[#1A1C1E]">{o.title}</h3>
                            <p className="mt-0.5 text-[12px] text-[#9A9DA1]">
                              {o.supplierName || 'Supplier'}
                              {o.category ? ` · ${o.category}` : ''}
                            </p>
                          </div>
                          <Badge label={meta.label} tone={meta.tone} />
                        </div>
                        <p className="mt-2.5 text-[13px] leading-relaxed text-[#5F6368]">{o.body}</p>
                        <div className="mt-3 rounded-xl bg-[#FBFBF9] px-3 py-2">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-[#9A9DA1]">Suggested action</span>
                          <p className="mt-0.5 text-[13px] text-[#1A1C1E]">{o.suggestedAction}</p>
                        </div>
                        <div className="mt-3.5 flex flex-wrap items-center gap-2">
                          <Link
                            href="/app/procurepulse"
                            className="inline-flex items-center rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: INK }}
                          >
                            Prioritise in ProcurePulse →
                          </Link>
                          {o.supplierId ? (
                            <button
                              type="button"
                              onClick={() => o.supplierId && openProfile(o.supplierId)}
                              className="inline-flex items-center rounded-lg border border-[#E7E7E2] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1C1E] hover:bg-[#FAFAF8]"
                            >
                              View supplier
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!hasSuppliers ? (
          <p className="mt-4 text-[11px] text-[#9A9DA1]">
            Supplier scorecards aren&apos;t loaded yet — value scores use pricing only until suppliers sync.
          </p>
        ) : null}
      </SectionCard>
    </div>
  );
}

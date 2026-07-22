'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import {
  zar,
  zar2,
  sellPrice,
  recommendationMeta,
  CONFIDENCE_STYLE,
  type Opportunity,
} from '@/lib/platform/pricepilot';

/**
 * Suggested price changes — products below the target margin, with confidence,
 * reasoning and an Accept / Modify / Accept-all flow. Publishing writes a margin
 * override on the base price list (reuses pl_overrides upsert); accepted products
 * move to target and drop off the list on refresh.
 */
export function RecommendationsView({
  opportunities,
  baseListId,
  target,
}: {
  opportunities: Opportunity[];
  baseListId: string | null;
  target: number;
}) {
  const router = useRouter();
  const { org } = usePlatform();
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [published, setPublished] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const visible = opportunities.filter((o) => !published.has(o.item.id));
  const marginFor = (o: Opportunity) => {
    const raw = edited[o.item.id];
    if (raw == null || raw.trim() === '') return Math.round(o.suggestedMargin); // default matches the displayed value
    const n = Number(raw.replace(/[^0-9.]/g, '')); // strip minus + junk, like PriceListDetail
    return Number.isFinite(n) && n >= 0 && n <= 1000 ? n : Math.round(o.suggestedMargin);
  };
  const impactFor = (o: Opportunity) => {
    const cost = Number(o.item.avg_unit_price ?? 0);
    const newSell = sellPrice(cost, marginFor(o));
    return (newSell - o.currentSell) * o.monthlyUnits;
  };

  const totalImpact = visible.reduce((s, o) => s + impactFor(o), 0);

  async function publish(targets: { id: string; margin: number }[], key: string) {
    const supabase = createClient();
    if (!supabase || !org || !baseListId) {
      setError('Create a price list before publishing changes.');
      return;
    }
    setBusy(key);
    setError(null);
    const rows = targets.map((t) => ({
      org_id: org.id,
      price_list_id: baseListId,
      stock_item_id: t.id,
      margin_pct: t.margin,
    }));
    const { error: upErr } = await supabase.from('pl_overrides').upsert(rows, { onConflict: 'price_list_id,stock_item_id' });
    if (upErr) {
      setError(upErr.message);
      setBusy(null);
      return;
    }
    // Only optimistically hide rows that actually reach target — a deliberate
    // below-target reprice stays visible (and the refresh shows its new margin).
    setPublished((p) => {
      const next = new Set(p);
      targets.forEach((t) => {
        if (t.margin >= target) next.add(t.id);
      });
      return next;
    });
    setBusy(null);
    router.refresh();
  }

  if (!baseListId) {
    return (
      <EmptyState
        title="No price list yet"
        body="Recommendations compare each product's margin to your target. Create a price list first, then PricePilot will suggest where to raise prices."
        cta={{ href: '/app/pricepilot/price-lists', label: 'Create a price list →' }}
      />
    );
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        title="You're all set 🎉"
        body={`Every product is at or above your ${Math.round(target)}% target margin. Nothing to reprice right now.`}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold text-[#1A1C1E]">Recommendations</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">
            {visible.length} suggested price {visible.length === 1 ? 'change' : 'changes'} · up to{' '}
            <span className="font-semibold text-[#0F6E56]">+{zar(totalImpact)}/mo</span> gross profit
          </p>
        </div>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            if (!window.confirm(`Publish all ${visible.length} suggested changes to your base price list?`)) return;
            publish(
              visible.map((o) => ({ id: o.item.id, margin: marginFor(o) })),
              'all',
            );
          }}
          className="inline-flex items-center justify-center rounded-lg bg-[#1F5FA8] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#174C87] disabled:opacity-50"
        >
          {busy === 'all' ? 'Publishing…' : 'Accept all'}
        </button>
      </div>

      {error ? <p className="mt-3 text-[13px] text-[#A32D2D]">{error}</p> : null}

      <div className="mt-5 flex flex-col gap-3">
        {visible.map((o) => {
          const meta = recommendationMeta(o);
          const cs = CONFIDENCE_STYLE[meta.confidence];
          const cost = Number(o.item.avg_unit_price ?? 0);
          const m = marginFor(o);
          const newSell = sellPrice(cost, m);
          const impact = impactFor(o);
          return (
            <div key={o.item.id} className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-[#1A1C1E]">{o.item.name}</span>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: cs.bg, color: cs.fg }}
                    >
                      {cs.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#5F6368]">{meta.reason}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[13px]">
                    <Stat label="Margin" from={`${Math.round(o.currentMargin)}%`} to={`${Math.round(m)}%`} />
                    <Stat label="Sell price" from={zar2(o.currentSell)} to={zar2(newSell)} />
                    <span className="text-[#9A9DA1]">
                      Impact{' '}
                      {impact >= 1 ? (
                        <span className="font-semibold text-[#0F6E56]">+{zar(impact)}/mo</span>
                      ) : impact <= -1 ? (
                        <span className="font-semibold text-[#A32D2D]">−{zar(Math.abs(impact))}/mo</span>
                      ) : (
                        <span>—</span>
                      )}
                    </span>
                  </div>
                  {m < o.currentMargin ? (
                    <p className="mt-2 text-[12px] font-medium text-[#A32D2D]">
                      ⚠ Below the current {Math.round(o.currentMargin)}% margin — this lowers the price.
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-end gap-2">
                  <label className="text-[12px] text-[#9A9DA1]">
                    <span className="mb-1 block">Target margin</span>
                    <span className="flex items-center rounded-lg border border-[#D7DAD8] bg-white px-2.5 focus-within:border-[#3E7BC4]">
                      <input
                        inputMode="decimal"
                        value={edited[o.item.id] ?? String(Math.round(o.suggestedMargin))}
                        onChange={(e) => setEdited((v) => ({ ...v, [o.item.id]: e.target.value }))}
                        className="w-14 bg-transparent py-2 text-right text-[14px] text-[#1A1C1E] outline-none"
                      />
                      <span className="ml-1 text-[14px] text-[#9A9DA1]">%</span>
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => publish([{ id: o.item.id, margin: m }], o.item.id)}
                    className="inline-flex h-[38px] items-center justify-center rounded-lg bg-[#1F5FA8] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87] disabled:opacity-50"
                  >
                    {busy === o.item.id ? '…' : 'Accept'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <span className="text-[#9A9DA1]">
      {label}{' '}
      <span className="text-[#5F6368]">{from}</span> <span aria-hidden>→</span>{' '}
      <span className="font-semibold text-[#0F6E56]">{to}</span>
    </span>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div>
      <h1 className="text-[26px] font-bold text-[#1A1C1E]">Recommendations</h1>
      <div className="mt-6 rounded-2xl border border-[#E7E7E2] bg-white px-6 py-12 text-center">
        <p className="text-[15px] font-semibold text-[#1A1C1E]">{title}</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-[#5F6368]">{body}</p>
        {cta ? (
          <Link
            href={cta.href}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#1F5FA8] px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87]"
          >
            {cta.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

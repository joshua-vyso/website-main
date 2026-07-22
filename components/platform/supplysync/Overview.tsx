'use client';

import type { ReactNode } from 'react';
import type { OpportunityKind, Supplier } from '@/lib/platform/supplysync-data';
import { useSupplySync } from './context';
import {
  EmptyState,
  ScorePill,
  SupplierNameButton,
  RED,
  AMBER,
  GREEN,
  MUTE,
} from './shared';
import { Badge, DataTable, Kpi, KpiStrip, SectionCard, type Tone } from '@/components/platform/module-ui';

// ---------------------------------------------------------------------------
// Small helpers (local — no new shared utilities)
// ---------------------------------------------------------------------------

/** Average of a numeric selector across suppliers, rounded, 0 when empty. */
function avgBy(suppliers: Supplier[], pick: (s: Supplier) => number): number {
  if (suppliers.length === 0) return 0;
  const total = suppliers.reduce((sum, s) => sum + pick(s), 0);
  return Math.round(total / suppliers.length);
}

/** Opportunity kind → badge tone. */
const OPP_TONE: Record<OpportunityKind, Tone> = {
  buy_now: 'positive',
  negotiate: 'warning',
  review: 'critical',
  watch: 'neutral',
};
const OPP_LABEL: Record<OpportunityKind, string> = {
  buy_now: 'Buy now',
  negotiate: 'Negotiate',
  review: 'Review',
  watch: 'Watch',
};

interface Alert {
  id: string;
  supplierId: string;
  color: string;
  text: ReactNode;
}

/** A single alert row — coloured dot + text — clickable to open the profile. */
function AlertRow({ alert, onOpen }: { alert: Alert; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(alert.supplierId)}
      className="flex w-full items-start gap-2.5 rounded-[11px] px-2.5 py-2 text-left transition-colors hover:bg-[#F5F9FE]"
    >
      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: alert.color }} />
      <span className="text-[14px] leading-snug text-[#2C333B]">{alert.text}</span>
    </button>
  );
}

/** One compact mobile-snapshot card: faint label + severity-coloured value. */
function SnapshotCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-[14px] border border-[#EEF1F5] bg-white p-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{label}</div>
      <div className="of-display mt-2 text-[16px] font-semibold leading-tight tracking-[-0.01em]" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export function SupplySyncOverview() {
  const { suppliers, pricing, opportunities, history, isEmpty, openProfile } = useSupplySync();

  if (isEmpty) {
    return (
      <EmptyState
        title="No suppliers yet"
        hint="Add your first supplier to start scoring reliability, pricing and compliance — or upload a supplier price list to Doc-U and SupplySync will build the record for you."
      />
    );
  }

  // --- KPI values --------------------------------------------------------
  const activeCount = suppliers.filter((s) => s.status === 'active' || s.status === 'preferred').length;
  const preferredCount = suppliers.filter((s) => s.status === 'preferred').length;
  const highRiskCount = suppliers.filter((s) => s.risk === 'high').length;
  const avgReliability = avgBy(suppliers, (s) => s.scorecard.reliability);
  const docsToAction = suppliers.reduce((sum, s) => sum + s.docsToAction, 0);
  const avgOnTime = avgBy(suppliers, (s) => s.onTimePct);
  const priceAlerts = pricing.filter((p) => p.diffVsMarketPct >= 8 || p.changePct >= 5).length;
  const recentlyUpdated = suppliers.filter((s) =>
    s.history.some((h) => {
      const t = new Date(h.date + 'T00:00:00').getTime();
      return Number.isFinite(t) && Date.now() - t <= 7 * 86_400_000 && Date.now() - t >= -86_400_000;
    }),
  ).length;

  // --- Risk alerts (up to 6) --------------------------------------------
  const alerts: Alert[] = [];
  for (const s of suppliers) {
    if (alerts.length >= 6) break;
    if (s.risk === 'high') {
      alerts.push({
        id: `risk-${s.id}`,
        supplierId: s.id,
        color: RED,
        text: (
          <>
            <span className="font-medium text-[#171A17]">{s.name}</span> is flagged high-risk
            {s.lastIssue ? ` — ${s.lastIssue.toLowerCase()}.` : '.'}
          </>
        ),
      });
    }
  }
  for (const s of suppliers) {
    if (alerts.length >= 6) break;
    if (s.docsToAction > 0) {
      alerts.push({
        id: `docs-${s.id}`,
        supplierId: s.id,
        color: AMBER,
        text: (
          <>
            <span className="font-medium text-[#171A17]">{s.name}</span> has <span className="of-num">{s.docsToAction}</span> compliance
            {' '}document{s.docsToAction === 1 ? '' : 's'} outstanding.
          </>
        ),
      });
    }
  }
  for (const s of suppliers) {
    if (alerts.length >= 6) break;
    if (s.onTimePct < 80) {
      alerts.push({
        id: `ontime-${s.id}`,
        supplierId: s.id,
        color: AMBER,
        text: (
          <>
            <span className="font-medium text-[#171A17]">{s.name}</span> on-time delivery has slipped to{' '}
            <span className="of-num">{Math.round(s.onTimePct)}%</span>.
          </>
        ),
      });
    }
  }
  const alertRows = alerts.slice(0, 6);

  // --- Top suppliers by overall score (up to 6) --------------------------
  const topSuppliers = [...suppliers].sort((a, b) => b.scorecard.overall - a.scorecard.overall).slice(0, 6);
  const topRows: ReactNode[][] = topSuppliers.map((s) => [
    <SupplierNameButton key="name" id={s.id} name={s.name} />,
    <span key="cat" className="text-[#6B6F68]">{s.category || '—'}</span>,
    <ScorePill key="overall" value={s.scorecard.overall} />,
    <ScorePill key="rel" value={s.scorecard.reliability} />,
    <ScorePill key="price" value={s.scorecard.priceStability} />,
    <ScorePill key="del" value={s.scorecard.deliveryConsistency} />,
    <ScorePill key="comp" value={s.scorecard.compliance} />,
  ]);

  // --- Opportunities (up to 4) ------------------------------------------
  const topOpportunities = opportunities.slice(0, 4);

  // --- Mobile snapshot derivations --------------------------------------
  const topHighRisk = [...suppliers]
    .filter((s) => s.risk === 'high')
    .sort((a, b) => a.scorecard.overall - b.scorecard.overall)[0];
  const missingDocs = suppliers.reduce(
    (sum, s) => sum + s.docs.filter((d) => d.status === 'missing' || d.status === 'expired').length,
    0,
  );
  const bestSupplier = topSuppliers[0];
  const buyNow = opportunities.find((o) => o.kind === 'buy_now');
  const followUpsDue = history.filter((h) => h.followUp && !h.followUpDone).length;

  return (
    <div className="space-y-5">
      {/* 1) KPI cards */}
      <KpiStrip>
        <Kpi label="Active suppliers" value={String(activeCount)} sub={`${suppliers.length} on the base`} />
        <Kpi label="Preferred suppliers" value={String(preferredCount)} accent={preferredCount > 0 ? GREEN : undefined} />
        <Kpi label="High-risk suppliers" value={String(highRiskCount)} accent={highRiskCount > 0 ? RED : undefined} />
        <Kpi label="Average reliability" value={`${avgReliability}`} sub="scorecard" />
        <Kpi label="Docs to action" value={String(docsToAction)} accent={docsToAction > 0 ? AMBER : undefined} />
        <Kpi label="Avg on-time delivery" value={`${avgOnTime}%`} accent={avgOnTime < 80 ? AMBER : undefined} />
        <Kpi
          label="Price alerts"
          value={String(priceAlerts)}
          accent={priceAlerts >= 3 ? RED : priceAlerts > 0 ? AMBER : undefined}
          sub="above-market / rising"
        />
        <Kpi label="Recently updated" value={String(recentlyUpdated)} sub="active in last 7 days" />
      </KpiStrip>

      {/* 2) Supplier risk alerts */}
      <SectionCard
        title="Supplier risk alerts"
        right={<Badge label={`${alertRows.length} flagged`} tone={alertRows.length > 0 ? 'warning' : 'positive'} />}
      >
        {alertRows.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[#6B6F68]">
            No open risk flags — every supplier is compliant and delivering on time.
          </p>
        ) : (
          <div className="space-y-0.5">
            {alertRows.map((a) => (
              <AlertRow key={a.id} alert={a} onOpen={openProfile} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* 3) Top suppliers */}
      <SectionCard title="Top suppliers">
        <DataTable
          columns={[
            { label: 'Supplier' },
            { label: 'Category' },
            { label: 'Overall' },
            { label: 'Reliability' },
            { label: 'Price stability' },
            { label: 'Delivery' },
            { label: 'Compliance' },
          ]}
          rows={topRows}
          empty="No suppliers to rank yet."
        />
      </SectionCard>

      {/* 4) Supplier opportunities */}
      <SectionCard title="Supplier opportunities">
        {topOpportunities.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[#6B6F68]">
            No standout pricing signals right now — pricing is tracking the market across the base.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {topOpportunities.map((o) => (
              <div key={o.id} className="flex flex-col rounded-[14px] border border-[#EEF1F5] bg-[#FBFCFE] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="of-display text-[15px] font-semibold text-[#171A17]">{o.title}</div>
                  <Badge label={OPP_LABEL[o.kind]} tone={OPP_TONE[o.kind]} />
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-[#6B6F68]">{o.body}</p>
                <p className="mt-2 text-[12px] font-medium text-[#171A17]">{o.suggestedAction}</p>
                {o.supplierId ? (
                  <button
                    type="button"
                    onClick={() => openProfile(o.supplierId as string)}
                    className="mt-3 self-start text-[13px] font-semibold text-[#1F5FA8] transition-colors hover:text-[#174C87] hover:underline"
                  >
                    View supplier →
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 5) Mobile snapshot */}
      <div>
        <h2 className="of-display text-[16px] font-semibold text-[#171A17]">
          Mobile snapshot — widgets the companion app will surface
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SnapshotCard
            label="Supplier risk alert"
            value={topHighRisk ? topHighRisk.name : 'All clear'}
            color={topHighRisk ? RED : GREEN}
          />
          <SnapshotCard
            label="Missing documents"
            value={missingDocs === 0 ? 'None' : `${missingDocs} to action`}
            color={missingDocs > 0 ? AMBER : GREEN}
          />
          <SnapshotCard
            label="Best supplier this week"
            value={bestSupplier ? `${bestSupplier.name} · ${bestSupplier.scorecard.overall}` : '—'}
            color={bestSupplier ? GREEN : MUTE}
          />
          <SnapshotCard
            label="Price opportunity"
            value={buyNow ? `${buyNow.supplierName} · ${buyNow.category}` : '—'}
            color={buyNow ? GREEN : MUTE}
          />
          <SnapshotCard
            label="Follow-up due"
            value={followUpsDue === 0 ? 'None' : `${followUpsDue} pending`}
            color={followUpsDue > 0 ? AMBER : GREEN}
          />
          <SnapshotCard
            label="High-risk suppliers"
            value={highRiskCount === 0 ? 'None' : String(highRiskCount)}
            color={highRiskCount > 0 ? RED : GREEN}
          />
        </div>
        <p className="mt-2.5 text-[12px] text-[#A0A49C]">Values shown are live from this org — the companion app renders these as home-screen cards.</p>
      </div>
    </div>
  );
}

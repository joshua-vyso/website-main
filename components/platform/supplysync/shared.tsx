'use client';

import { Badge, type Tone } from '@/components/platform/module-ui';
import { zar } from '@/lib/platform/orderflow';
import { useSupplySync } from './context';
import type {
  Supplier,
  SupplierStatus,
  SupplierRisk,
  SupplierDocumentStatus,
  SupplierRiskSeverity,
  SupplierRiskStatus,
  MarketPosition,
  SupplierComparison,
} from '@/lib/platform/supplysync-data';

export { zar };

// ---------------------------------------------------------------------------
// Palette + score colours (calm blue/amber/red bands)
// ---------------------------------------------------------------------------

export const ACCENT = '#3E7BC4';
export const GREEN = '#0F6E56';
export const AMBER = '#854F0B';
export const RED = '#A32D2D';
export const PURPLE = '#5B53C0';
export const INK = '#1A1C1E';
export const MUTE = '#5F6368';
export const FAINT = '#9A9DA1';

/** Score → colour band (0–100). */
export function scoreColor(n: number): string {
  if (n >= 85) return GREEN;
  if (n >= 72) return ACCENT;
  if (n >= 60) return AMBER;
  return RED;
}
export function scoreTone(n: number): Tone {
  if (n >= 85) return 'positive';
  if (n >= 72) return 'neutral';
  if (n >= 60) return 'warning';
  return 'critical';
}

/** Compact tinted score chip used across tables and cards. */
export function ScorePill({ value, suffix = '' }: { value: number; suffix?: string }) {
  const c = scoreColor(value);
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums" style={{ backgroundColor: `${c}1A`, color: c }}>
      {value}
      {suffix}
    </span>
  );
}

/** Larger score readout (profile header / scorecards). */
export function ScoreStat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  const c = scoreColor(value);
  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white p-3.5">
      <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">{label}</div>
      <div className="mt-1 text-[22px] font-bold leading-none tabular-nums" style={{ color: c }}>{value}{suffix}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categorical badges
// ---------------------------------------------------------------------------

export const SUPPLIER_STATUS_META: Record<SupplierStatus, { label: string; tone: Tone }> = {
  preferred: { label: 'Preferred', tone: 'positive' },
  active: { label: 'Active', tone: 'neutral' },
  review: { label: 'On review', tone: 'warning' },
};
export function SupplierStatusBadge({ status }: { status: SupplierStatus }) {
  const m = SUPPLIER_STATUS_META[status];
  return <Badge label={m.label} tone={m.tone} />;
}

export const SUPPLIER_RISK_META: Record<SupplierRisk, { label: string; tone: Tone; color: string }> = {
  low: { label: 'Low risk', tone: 'positive', color: GREEN },
  medium: { label: 'Medium risk', tone: 'warning', color: AMBER },
  high: { label: 'High risk', tone: 'critical', color: RED },
};
export function SupplierRiskBadge({ risk }: { risk: SupplierRisk }) {
  const m = SUPPLIER_RISK_META[risk];
  return <Badge label={m.label} tone={m.tone} />;
}

export const DOC_STATUS_META: Record<SupplierDocumentStatus, { label: string; tone: Tone; color: string }> = {
  valid: { label: 'Valid', tone: 'positive', color: GREEN },
  expiring: { label: 'Expiring soon', tone: 'warning', color: AMBER },
  expired: { label: 'Expired', tone: 'critical', color: RED },
  missing: { label: 'Missing', tone: 'critical', color: RED },
};
export function DocStatusBadge({ status }: { status: SupplierDocumentStatus }) {
  const m = DOC_STATUS_META[status];
  return <Badge label={m.label} tone={m.tone} />;
}

export const SEVERITY_META: Record<SupplierRiskSeverity, { label: string; tone: Tone; color: string }> = {
  low: { label: 'Low', tone: 'neutral', color: FAINT },
  medium: { label: 'Medium', tone: 'warning', color: AMBER },
  high: { label: 'High', tone: 'critical', color: RED },
  critical: { label: 'Critical', tone: 'critical', color: RED },
};
export function SeverityBadge({ severity }: { severity: SupplierRiskSeverity }) {
  const m = SEVERITY_META[severity];
  return <Badge label={m.label} tone={m.tone} />;
}

export const RISK_STATUS_META: Record<SupplierRiskStatus, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'warning' },
  in_progress: { label: 'In progress', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'positive' },
  ignored: { label: 'Ignored', tone: 'neutral' },
};
export function RiskStatusBadge({ status }: { status: SupplierRiskStatus }) {
  const m = RISK_STATUS_META[status];
  return <Badge label={m.label} tone={m.tone} />;
}

export const POSITION_META: Record<MarketPosition, { label: string; color: string }> = {
  below: { label: 'Below market', color: GREEN },
  at: { label: 'At market', color: MUTE },
  above: { label: 'Above market', color: RED },
};

/** Signed % vs market, coloured (cheaper = green, dearer = red). */
export function marketDiffColor(diffPct: number): string {
  if (diffPct <= -3) return GREEN;
  if (diffPct >= 3) return RED;
  return MUTE;
}

export function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px]" style={{ color: '#C9A227' }} aria-label={`${rating} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ color: i < full ? '#C9A227' : '#E1E1DC' }}>★</span>
      ))}
    </span>
  );
}

/**
 * Canonical "click a supplier name to open its profile" affordance — one
 * treatment (ink text, module-accent hover) reused across every tab and drawer
 * so the same element never reads differently from screen to screen.
 */
export function SupplierNameButton({ id, name, className = '' }: { id: string; name: string; className?: string }) {
  const { openProfile } = useSupplySync();
  return (
    <button
      type="button"
      onClick={() => openProfile(id)}
      className={`text-left font-medium text-[#1A1C1E] transition-colors hover:text-[#B0466A] hover:underline ${className}`}
    >
      {name}
    </button>
  );
}

// ---------------------------------------------------------------------------
// History / relationship channel styling
// ---------------------------------------------------------------------------

export const CHANNELS = ['Call', 'WhatsApp', 'Email', 'Meeting', 'Price Update', 'Document Request', 'Complaint', 'Delivery Issue'] as const;
export type Channel = (typeof CHANNELS)[number];

export function channelColor(channel: string | null): string {
  switch (channel) {
    case 'Call': return ACCENT;
    case 'WhatsApp': return GREEN;
    case 'Email': return '#3A4DB0';
    case 'Meeting': return PURPLE;
    case 'Price Update': return AMBER;
    case 'Document Request': return '#7C5BC0';
    case 'Complaint': return RED;
    case 'Delivery Issue': return RED;
    default: return FAINT;
  }
}

/** Human label + dot colour for a supplier-history event_type. */
export function eventMeta(eventType: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    document_uploaded: { label: 'Document uploaded', color: GREEN },
    price_list_received: { label: 'Price list received', color: AMBER },
    late_delivery: { label: 'Late delivery', color: RED },
    delivery_issue: { label: 'Delivery issue', color: RED },
    compliance_issue: { label: 'Compliance issue', color: RED },
    marked_preferred: { label: 'Marked preferred', color: GREEN },
    note_added: { label: 'Note added', color: ACCENT },
    order_linked: { label: 'Order linked (ProcurePulse)', color: PURPLE },
    call: { label: 'Call', color: ACCENT },
    whatsapp: { label: 'WhatsApp', color: GREEN },
    email: { label: 'Email', color: '#3A4DB0' },
    meeting: { label: 'Meeting', color: PURPLE },
    price_update: { label: 'Price update', color: AMBER },
    document_request: { label: 'Document request', color: '#7C5BC0' },
    complaint: { label: 'Complaint', color: RED },
  };
  return map[eventType] ?? { label: eventType.replace(/_/g, ' '), color: FAINT };
}

// ---------------------------------------------------------------------------
// Shared empty state
// ---------------------------------------------------------------------------

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
      <p className="text-[15px] font-medium text-[#1A1C1E]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comparison builder (used by the compare drawer)
// ---------------------------------------------------------------------------

export function buildComparison(suppliers: Supplier[]): SupplierComparison[] {
  if (suppliers.length === 0) return [];
  const maxOverall = Math.max(...suppliers.map((s) => s.scorecard.overall));
  const maxReliability = Math.max(...suppliers.map((s) => s.scorecard.reliability));
  return suppliers.map((s) => {
    const hasDocGap = s.docs.some((d) => d.status === 'missing' || d.status === 'expired');
    let recommendation: string;
    if (s.scorecard.compliance < 75 || hasDocGap || s.risk === 'high') recommendation = 'Compliance risk';
    else if (s.marketPosition === 'above' || s.priceTrend === 'rising') recommendation = 'Watch pricing';
    else if (s.scorecard.overall === maxOverall) recommendation = 'Best value';
    else if (s.scorecard.reliability === maxReliability) recommendation = 'Most reliable';
    else recommendation = 'Solid choice';
    return {
      supplierId: s.id,
      name: s.name,
      overall: s.scorecard.overall,
      reliability: s.scorecard.reliability,
      quality: s.scorecard.quality,
      delivery: s.scorecard.deliveryConsistency,
      priceStability: s.scorecard.priceStability,
      compliance: s.scorecard.compliance,
      pricePosition: s.marketPosition,
      lastIssue: s.lastIssue,
      recommendation,
    };
  });
}

export function recommendationTone(rec: string): Tone {
  if (rec === 'Best value') return 'positive';
  if (rec === 'Most reliable') return 'info';
  if (rec === 'Compliance risk') return 'critical';
  if (rec === 'Watch pricing') return 'warning';
  return 'neutral';
}

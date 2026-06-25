/**
 * PricePilot — types + pure helpers for price lists (margins on ProcurePulse
 * base prices), and customer complaints. Sales views read OrderFlow directly.
 */

export type PriceCadence = 'standard' | 'daily' | 'weekly' | 'monthly';
export type ComplaintStatus = 'open' | 'investigating' | 'resolved';

export interface PlPriceList {
  id: string;
  org_id: string;
  name: string;
  customer_id: string | null;
  default_margin_pct: number;
  cadence: PriceCadence;
  created_at: string;
}

export interface PlOverride {
  id: string;
  org_id: string;
  price_list_id: string;
  stock_item_id: string;
  margin_pct: number;
  created_at: string;
}

export interface PlComplaint {
  id: string;
  org_id: string;
  customer_id: string | null;
  order_id: string | null;
  title: string;
  body: string | null;
  image_url: string | null;
  status: ComplaintStatus;
  created_at: string;
}

export const CADENCES: readonly PriceCadence[] = ['standard', 'daily', 'weekly', 'monthly'];
export const CADENCE_LABEL: Record<PriceCadence, string> = {
  standard: 'Standard',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export const COMPLAINT_STATUSES: readonly ComplaintStatus[] = ['open', 'investigating', 'resolved'];
export const COMPLAINT_STATUS_STYLE: Record<ComplaintStatus, { bg: string; fg: string; label: string }> = {
  open: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Open' },
  investigating: { bg: '#FBEEDA', fg: '#854F0B', label: 'Investigating' },
  resolved: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Resolved' },
};

/** Sell price = base × (1 + margin%). */
export function sellPrice(base: number | null | undefined, marginPct: number): number {
  return (Number(base) || 0) * (1 + marginPct / 100);
}

/** Rand, plain. */
export function zar(n: number | null | undefined): string {
  if (n == null) return '—';
  return `R ${Math.round(n).toLocaleString('en-ZA')}`;
}

/** Rand with cents (price lists need precision). */
export function zar2(n: number | null | undefined): string {
  if (n == null) return '—';
  return `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

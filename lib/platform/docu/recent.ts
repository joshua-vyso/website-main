/**
 * "Recent" buckets for Doc-U — by the date a document was ADDED to Doc-U
 * (`created_at`), not the date printed on the document. Two non-overlapping
 * buckets: Today, and earlier in the current week (Monday-start).
 */
import type { DocumentWithSupplier } from '@/lib/platform/types';

export interface RecentBuckets {
  today: DocumentWithSupplier[];
  /** Added earlier this week (this week's Monday → before today). */
  week: DocumentWithSupplier[];
}

/** Split documents into Today / earlier-this-week by their `created_at`. */
export function recentBuckets(docs: DocumentWithSupplier[]): RecentBuckets {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // Monday-start week.
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const startOfWeek = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysSinceMonday,
  ).getTime();

  const today: DocumentWithSupplier[] = [];
  const week: DocumentWithSupplier[] = [];
  for (const d of docs) {
    const t = new Date(d.created_at).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= startOfToday) today.push(d);
    else if (t >= startOfWeek) week.push(d);
  }
  return { today, week };
}

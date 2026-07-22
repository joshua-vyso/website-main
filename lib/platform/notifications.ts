import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NOTIFICATION_KINDS } from './procurepulse';
import type { PpNotification } from './types';

/** A notification surfaced in the cross-module centre, tagged with its module. */
export interface ModuleNotification {
  id: string;
  module: 'procurepulse' | 'docu';
  moduleLabel: string;
  title: string;
  body: string | null;
  created_at: string;
  read: boolean;
  /** Resolved icon colours + the kind label, so the page stays presentational. */
  bg: string;
  fg: string;
  kindLabel: string;
}

const DOCU_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  uploaded: { bg: '#E6F1FB', fg: '#0C447C', label: 'Uploaded' },
  reviewed: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Reviewed' },
  needs_review: { bg: '#FBEEDA', fg: '#854F0B', label: 'Needs review' },
  error: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Failed' },
};

/** Map a Doc-U document's status to a notification kind. */
function docuKind(status: string): keyof typeof DOCU_STYLE {
  if (status === 'reviewed' || status === 'approved') return 'reviewed';
  if (status === 'error' || status === 'rejected') return 'error';
  if (status === 'extracted') return 'needs_review';
  return 'uploaded';
}

/**
 * Fetch a unified notification feed across modules. ProcurePulse has its own
 * pp_notifications table; Doc-U has no table yet, so its notifications are
 * synthesised from recent document activity. OrderFlow / PricePilot are
 * skeletons with no notifications. Returns newest-first.
 */
export async function fetchModuleNotifications(
  db: SupabaseClient,
  orgId: string,
): Promise<ModuleNotification[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: ppRows }, { data: docRows }] = await Promise.all([
    db.from('pp_notifications').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(40),
    db
      .from('documents')
      .select('id, filename, status, created_at, updated_at')
      .eq('org_id', orgId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  // Fallback styling — pp_notifications.kind has no DB enum, so a row could carry
  // an unknown kind; never let that crash the whole feed.
  const fallback = { bg: '#EEF1F5', fg: '#6B6F68', label: 'Update' };
  const pp: ModuleNotification[] = ((ppRows ?? []) as PpNotification[]).map((n) => {
    const k = NOTIFICATION_KINDS[n.kind] ?? fallback;
    return {
      id: `pp-${n.id}`,
      module: 'procurepulse',
      moduleLabel: 'ProcurePulse',
      title: n.title,
      body: n.body,
      created_at: n.created_at,
      read: n.read,
      bg: k.bg,
      fg: k.fg,
      kindLabel: k.label,
    };
  });

  const docu: ModuleNotification[] = (
    (docRows ?? []) as { id: string; filename: string; status: string; created_at: string; updated_at: string | null }[]
  ).map((d) => {
    const kind = docuKind(d.status);
    const s = DOCU_STYLE[kind];
    const title =
      kind === 'reviewed'
        ? `Reviewed · ${d.filename}`
        : kind === 'error'
          ? `Extraction failed · ${d.filename}`
          : kind === 'needs_review'
            ? `Awaiting review · ${d.filename}`
            : `Document added · ${d.filename}`;
    return {
      id: `docu-${d.id}`,
      module: 'docu',
      moduleLabel: 'Doc-U',
      title,
      body: kind === 'needs_review' ? 'Extracted — confirm the details' : null,
      created_at: d.updated_at ?? d.created_at,
      read: true,
      bg: s.bg,
      fg: s.fg,
      kindLabel: s.label,
    };
  });

  const t = (s: string) => {
    const n = new Date(s).getTime();
    return Number.isNaN(n) ? 0 : n;
  };
  return [...pp, ...docu].sort((a, b) => t(b.created_at) - t(a.created_at));
}

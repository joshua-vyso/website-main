'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatusPill } from '@/components/platform/ui';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { getTransitions, workflowLabel } from '@/lib/platform/docu/workflow';
import type { WorkflowAction } from '@/lib/platform/docu/types';
import type { DocumentStatus } from '@/lib/platform/types';

/**
 * Approval workflow actions (feature 6). Persists status + audit columns
 * (approved_by/at, reviewed_by/at, archived_at) via the browser Supabase client,
 * then refreshes the server component. Stays on the page (unlike ExtractionEditor).
 */
export function ApprovalActions({
  documentId,
  status,
}: {
  documentId: string;
  status: DocumentStatus;
}) {
  const router = useRouter();
  const { userId } = usePlatform();
  const [busy, setBusy] = useState<WorkflowAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transitions = getTransitions(status);

  async function run(action: WorkflowAction, toStatus: DocumentStatus) {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(action);
    setError(null);

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: toStatus };
    if (action === 'review') {
      patch.reviewed_at = now;
      patch.reviewed_by = userId;
    } else if (action === 'approve' || action === 'reject') {
      patch.approved_at = now;
      patch.approved_by = userId;
    } else if (action === 'archive') {
      patch.archived_at = now;
    }

    const { error: updateErr } = await supabase.from('documents').update(patch).eq('id', documentId);
    if (updateErr) {
      setError(updateErr.message);
      setBusy(null);
      return;
    }
    router.refresh();
    setBusy(null);
  }

  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="flex items-center justify-between">
        <span className="of-display text-[16px] font-semibold text-[#171A17]">Workflow</span>
        <StatusPill status={status} />
      </div>
      <div className="mt-1 text-[12px] text-[#A0A49C]">Current — {workflowLabel(status)}</div>

      <div className="mt-3 flex flex-wrap gap-2">
        {transitions.map((t) => (
          <button
            key={t.action}
            type="button"
            disabled={!t.available || busy !== null}
            onClick={() => run(t.action, t.toStatus)}
            className={`inline-flex h-[38px] items-center rounded-[11px] px-4 text-[13px] transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
              t.primary
                ? 'bg-[#1F5FA8] font-semibold text-white hover:bg-[#174C87]'
                : 'border border-[#E2E6EC] bg-white font-medium text-[#3E4A57] hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]'
            }`}
          >
            {busy === t.action ? '…' : t.label}
          </button>
        ))}
      </div>

      {error ? <p className="mt-2 text-[12px] text-[#A32D2D]">{error}</p> : null}
    </div>
  );
}

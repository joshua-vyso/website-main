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
    <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-[#1A1C1E]">Workflow</span>
        <StatusPill status={status} />
      </div>
      <div className="mt-1 text-[12px] text-[#9A9DA1]">Current — {workflowLabel(status)}</div>

      <div className="mt-3 flex flex-wrap gap-2">
        {transitions.map((t) => (
          <button
            key={t.action}
            type="button"
            disabled={!t.available || busy !== null}
            onClick={() => run(t.action, t.toStatus)}
            className={`rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              t.primary
                ? 'bg-[#1F5FA8] text-white hover:bg-[#184c44]'
                : 'border border-[#D7DAD8] text-[#5F6368] hover:bg-[#FAFAF8]'
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

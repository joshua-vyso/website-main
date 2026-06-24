/**
 * Approval workflow (feature 6) — the single source of truth for the human
 * status labels and the legal Review / Approve / Reject / Archive transitions.
 */
import type { DocumentStatus } from '@/lib/platform/types';
import type { WorkflowAction, WorkflowTransition } from './types';

/** Human workflow label for a DB status. */
export const WORKFLOW_LABELS: Record<DocumentStatus, string> = {
  pending: 'Uploaded',
  extracted: 'Pending review',
  reviewed: 'Reviewed',
  approved: 'Approved',
  rejected: 'Rejected',
  archived: 'Archived',
  error: 'Extraction failed',
};

export function workflowLabel(status: DocumentStatus): string {
  return WORKFLOW_LABELS[status];
}

const ACTION_TO_STATUS: Record<WorkflowAction, DocumentStatus> = {
  review: 'reviewed',
  approve: 'approved',
  reject: 'rejected',
  archive: 'archived',
};

export function nextStatusFor(action: WorkflowAction): DocumentStatus {
  return ACTION_TO_STATUS[action];
}

/** The actions to render for the current status, each marked available/primary. */
export function getTransitions(status: DocumentStatus): WorkflowTransition[] {
  const isTerminal = status === 'archived';
  const reviewable = status === 'extracted' || status === 'pending';
  const approvable = status === 'reviewed' || status === 'extracted';
  return [
    { action: 'review', toStatus: 'reviewed', label: 'Mark reviewed', primary: false, available: reviewable },
    { action: 'approve', toStatus: 'approved', label: 'Approve', primary: true, available: approvable },
    { action: 'reject', toStatus: 'rejected', label: 'Reject', primary: false, available: !isTerminal && status !== 'rejected' },
    { action: 'archive', toStatus: 'archived', label: 'Archive', primary: false, available: !isTerminal },
  ];
}

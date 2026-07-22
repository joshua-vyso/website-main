'use client';

import { Modal, SecondaryBtn } from '@/components/platform/coredata/ui';

/**
 * Shown when a user taps a module that isn't part of their plan. Explains the
 * lock and offers a pre-filled mailto to Joshua to unlock it.
 */
export function ModuleLockNotice({
  open,
  moduleLabel,
  onClose,
}: {
  open: boolean;
  moduleLabel: string;
  onClose: () => void;
}) {
  const mailto = `mailto:joshua@vyso.co.za?subject=${encodeURIComponent(`Unlock ${moduleLabel}`)}`;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${moduleLabel} is locked`}
      width={400}
      footer={
        <>
          <SecondaryBtn onClick={onClose}>Close</SecondaryBtn>
          <a
            href={mailto}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[#1F5FA8] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87]"
          >
            Email Joshua
          </a>
        </>
      }
    >
      <div className="flex flex-col items-center py-2 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F0EFEA] text-[#854F0B]" aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <p className="max-w-[300px] text-[13px] leading-relaxed text-[#5F6368]">
          This module isn&apos;t part of your plan yet. Contact{' '}
          <span className="font-medium text-[#1A1C1E]">joshua@vyso.co.za</span> to unlock it.
        </p>
      </div>
    </Modal>
  );
}

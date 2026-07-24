'use client';

import { FinchMark } from './FinchMark';

/**
 * The "Finch" launcher pill — a rounded, light-blue gradient that ebbs and
 * flows (animation in globals.css → .finch-gradient). Sits at the top-right of
 * a module's sub-nav.
 */
export function FinchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open Finch"
      className="finch-gradient inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-[0_2px_10px_-2px_rgba(62,143,224,0.6)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
    >
      <FinchMark size={15} title="" />
      Finch
    </button>
  );
}

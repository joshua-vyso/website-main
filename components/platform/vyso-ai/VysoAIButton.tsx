'use client';

/**
 * The "Vyso AI" launcher pill — a rounded, light-blue gradient that ebbs and
 * flows (animation in globals.css → .vyso-ai-gradient). Sits at the top-right of
 * a module's sub-nav.
 */
function SparkleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l1.6 4.6L18 9.2l-4.4 1.6L12 15l-1.6-4.2L6 9.2l4.4-1.6L12 3z"
        fill="#fff"
      />
      <path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" fill="#fff" opacity="0.85" />
    </svg>
  );
}

export function VysoAIButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open Vyso AI"
      className="vyso-ai-gradient inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-[0_2px_10px_-2px_rgba(62,143,224,0.6)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
    >
      <SparkleIcon />
      Vyso AI
    </button>
  );
}

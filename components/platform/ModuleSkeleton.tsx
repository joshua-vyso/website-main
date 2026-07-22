import Link from 'next/link';

/**
 * A skeleton page block for a not-yet-built module screen. Communicates what the
 * screen will do and how it connects to the rest of the platform, so the
 * navigation + structure are real while the data layer is still to come.
 */
export function ModuleSkeleton({
  title,
  subtitle,
  capabilities,
  links = [],
}: {
  title: string;
  subtitle: string;
  /** What this screen will do once built. */
  capabilities: string[];
  /** Cross-module connections (e.g. → ProcurePulse stock). */
  links?: { label: string; href: string }[];
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">{title}</h1>
        <span className="inline-flex items-center rounded-full bg-[#FBEEDA] px-2.5 py-1 text-[11px] font-medium text-[#854F0B]">
          Skeleton
        </span>
      </div>
      <p className="mt-1.5 max-w-2xl text-[14px] text-[#8A8E86]">{subtitle}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)] lg:col-span-2">
          <h2 className="of-display text-[16px] font-semibold text-[#171A17]">What this will do</h2>
          <ul className="mt-3 space-y-2.5">
            {capabilities.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#2C333B]">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F5FA8]" aria-hidden />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Connects to</h2>
          {links.length === 0 ? (
            <p className="mt-3 text-[13px] text-[#A0A49C]">Standalone for now.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="inline-flex items-center justify-between rounded-[12px] border border-[#EEF1F5] bg-[#FBFCFE] px-3.5 py-2.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
                >
                  {l.label}
                  <span aria-hidden className="text-[#A0A49C]">→</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

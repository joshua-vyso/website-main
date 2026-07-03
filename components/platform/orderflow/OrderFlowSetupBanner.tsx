/**
 * Setup nudge shown above the OrderFlow chrome when the v2 tables are missing
 * (supabase/core-data.sql hasn't been run yet). Server-safe — no hooks, no
 * client directive — so the layout can render it inline after its cheap probe.
 */

export function OrderFlowSetupBanner() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#EBD9B0] bg-[#FBF3E4] px-4 py-3.5 text-[#854F0B]">
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className="mt-0.5 h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 2.5 1.8 16.5h16.4L10 2.5Z" />
        <path d="M10 8v3.5" />
        <path d="M10 14.2h.01" />
      </svg>
      <div>
        <p className="text-[13px] font-semibold">Finish OrderFlow setup</p>
        <p className="mt-0.5 text-[13px] leading-relaxed">
          Run <code className="rounded bg-[#F3E6C8] px-1 py-0.5 text-[12px] font-medium">supabase/core-data.sql</code> in your
          Supabase SQL editor to enable invoices, quotes, credit notes, payments and delivery notes. Customers, orders and
          price lists work now; the rest need this one-time step.
        </p>
      </div>
    </div>
  );
}

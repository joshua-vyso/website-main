import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { PpSubnav } from '@/components/platform/procurepulse/ui';

/** Shared chrome for every ProcurePulse desktop screen: feature gate + sub-nav. */
export default async function ProcurePulseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  if (!session.features.procurepulse) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-8 py-7">
        <div className="max-w-sm rounded-2xl border border-[#EAEDF2] bg-white px-8 py-10 text-center shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <h1 className="of-display text-[18px] font-semibold text-[#171A17]">
            ProcurePulse is not enabled for your plan
          </h1>
          <p className="mt-2 text-[14px] text-[#6B6F68]">
            Contact your administrator to add ProcurePulse to your subscription.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-7">
      <PpSubnav />
      <div className="mt-6">{children}</div>
    </div>
  );
}

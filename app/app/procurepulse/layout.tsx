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
        <div className="max-w-sm rounded-2xl border border-[#E7E7E2] bg-white px-8 py-10 text-center">
          <h1 className="text-[18px] font-bold text-[#1A1C1E]">
            ProcurePulse is not enabled for your plan
          </h1>
          <p className="mt-2 text-[14px] text-[#5F6368]">
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

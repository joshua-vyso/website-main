import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { SubNav } from '@/components/platform/SubNav';

const TABS = [
  { label: 'Overview', href: '/app/shiftboard' },
  { label: 'Live Ops', href: '/app/shiftboard/live' },
  { label: 'Roster', href: '/app/shiftboard/roster' },
  { label: 'People', href: '/app/shiftboard/people' },
  { label: 'Attendance', href: '/app/shiftboard/attendance' },
  { label: 'Leave', href: '/app/shiftboard/leave' },
  { label: 'Insights', href: '/app/shiftboard/insights' },
];

/** ShiftBoard chrome: Doc-U-style underline sub-nav across its people-ops screens. */
export default async function ShiftBoardLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  return (
    <div className="px-8 py-7">
      <SubNav tabs={TABS} rootHref="/app/shiftboard" />
      <div className="mt-6">{children}</div>
    </div>
  );
}

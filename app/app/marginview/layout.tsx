import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getPlanWiseData } from '@/lib/platform/planwise-data';
import { SubNav } from '@/components/platform/SubNav';
import { PlanWiseProvider } from '@/components/platform/planwise/context';
import type { PlanWiseData } from '@/lib/platform/planwise';

const EMPTY: PlanWiseData = {
  budget: [],
  goals: [],
  forecast: [],
  scenarios: [],
  revenueSeries: [],
  totalBudget: 0,
  totalActual: 0,
  scenarioBase: { revenue: 0, expenses: 0, cogs: 0, cash: 0, outstanding: 0, runwayMonths: 0 },
  monthlyGoal: { label: 'Monthly Revenue Goal', targetRevenue: 0, currentForecast: 0 },
  financialFlow: [],
};

const TABS = [
  { label: 'Overview', href: '/app/marginview' },
  { label: 'Budget', href: '/app/marginview/budget' },
  { label: 'Goals', href: '/app/marginview/goals' },
  { label: 'Forecast', href: '/app/marginview/forecast' },
  { label: 'Scenarios', href: '/app/marginview/scenarios' },
];

/** PlanWise chrome: Doc-U-style underline sub-nav across its planning screens. */
export default async function PlanWiseLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const data = session.org ? await getPlanWiseData(session.org.id) : EMPTY;

  return (
    <div className="px-8 py-7">
      <SubNav tabs={TABS} rootHref="/app/marginview" />
      <PlanWiseProvider data={data}>
        <div className="mt-6">{children}</div>
      </PlanWiseProvider>
    </div>
  );
}

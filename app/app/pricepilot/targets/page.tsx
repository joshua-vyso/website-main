import { redirect } from 'next/navigation';

/** Targets/thresholds now live in PlanWise → Goals (the strategic planning layer). */
export default function PricePilotTargetsRedirect() {
  redirect('/app/marginview/goals');
}

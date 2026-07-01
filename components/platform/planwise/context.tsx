'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { PlanWiseData } from '@/lib/platform/planwise';

interface PlanWiseCtx extends PlanWiseData {
  /** True when the org has no plan data yet (render empty states). */
  isEmpty: boolean;
}

const Ctx = createContext<PlanWiseCtx | null>(null);

export function PlanWiseProvider({ data, children }: { data: PlanWiseData; children: ReactNode }) {
  const value = useMemo<PlanWiseCtx>(
    () => ({ ...data, isEmpty: data.budget.length === 0 && data.goals.length === 0 }),
    [data],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlanWise(): PlanWiseCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlanWise must be used within a PlanWiseProvider');
  return ctx;
}

'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { deptColor, type ShiftBoardData } from '@/lib/platform/shiftboard';

interface ShiftBoardCtx extends ShiftBoardData {
  /** Department colour resolved against the org's departments. */
  deptColor: (name: string) => string;
  /** True when the org has no people data yet (render empty states). */
  isEmpty: boolean;
}

const Ctx = createContext<ShiftBoardCtx | null>(null);

export function ShiftBoardProvider({ data, children }: { data: ShiftBoardData; children: ReactNode }) {
  const value = useMemo<ShiftBoardCtx>(
    () => ({ ...data, deptColor: (name: string) => deptColor(name, data.departments), isEmpty: data.employees.length === 0 }),
    [data],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShiftBoard(): ShiftBoardCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useShiftBoard must be used within a ShiftBoardProvider');
  return ctx;
}

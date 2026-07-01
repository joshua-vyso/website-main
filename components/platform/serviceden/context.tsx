'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ServiceDenData, SdCustomer } from '@/lib/platform/serviceden';

interface ServiceDenCtx extends ServiceDenData {
  customerById: (id: string | null | undefined) => SdCustomer | undefined;
}

const Ctx = createContext<ServiceDenCtx | null>(null);

export function ServiceDenProvider({ data, children }: { data: ServiceDenData; children: ReactNode }) {
  const value = useMemo<ServiceDenCtx>(() => {
    const byId = new Map(data.customers.map((c) => [c.id, c]));
    return { ...data, customerById: (id) => (id ? byId.get(id) : undefined) };
  }, [data]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useServiceDen(): ServiceDenCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useServiceDen must be used within a ServiceDenProvider');
  return ctx;
}

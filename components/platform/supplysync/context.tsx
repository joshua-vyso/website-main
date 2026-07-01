'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Supplier, SupplySyncData } from '@/lib/platform/supplysync-data';

/** Max suppliers that can be compared side by side. */
export const MAX_COMPARE = 3;

interface SupplySyncCtx extends SupplySyncData {
  isEmpty: boolean;
  supplierById: (id: string | null | undefined) => Supplier | undefined;
  // Supplier profile drawer (opened from any tab).
  profileId: string | null;
  openProfile: (id: string) => void;
  closeProfile: () => void;
  // Compare tray (2–3 suppliers).
  compareIds: string[];
  isComparing: (id: string) => boolean;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  compareOpen: boolean;
  openCompare: () => void;
  closeCompare: () => void;
  // Add-supplier wizard.
  addOpen: boolean;
  openAdd: () => void;
  closeAdd: () => void;
}

const Ctx = createContext<SupplySyncCtx | null>(null);

export function SupplySyncProvider({ data, children }: { data: SupplySyncData; children: ReactNode }) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const byId = useMemo(() => new Map(data.suppliers.map((s) => [s.id, s])), [data.suppliers]);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev; // cap; ignore beyond the max
      return [...prev, id];
    });
  }, []);

  const value = useMemo<SupplySyncCtx>(
    () => ({
      ...data,
      isEmpty: data.suppliers.length === 0,
      supplierById: (id) => (id ? byId.get(id) : undefined),
      profileId,
      openProfile: (id) => setProfileId(id),
      closeProfile: () => setProfileId(null),
      compareIds,
      isComparing: (id) => compareIds.includes(id),
      toggleCompare,
      clearCompare: () => setCompareIds([]),
      compareOpen,
      openCompare: () => setCompareOpen(true),
      closeCompare: () => setCompareOpen(false),
      addOpen,
      openAdd: () => setAddOpen(true),
      closeAdd: () => setAddOpen(false),
    }),
    [data, byId, profileId, compareIds, compareOpen, addOpen, toggleCompare],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSupplySync(): SupplySyncCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSupplySync must be used within a SupplySyncProvider');
  return ctx;
}

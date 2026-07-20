'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { FeatureKey, Organisation, Profile } from './types';

export interface PlatformContextValue {
  userId: string;
  email: string;
  profile: Profile | null;
  org: Organisation | null;
  features: Record<FeatureKey, boolean>;
  /** Module feature-keys this org may NOT open (locked in the sidebar + guarded). */
  lockedModules: FeatureKey[];
  /** Whether Vyso AI is enabled platform-wide (server-resolved env kill switch). */
  vysoAiEnabled: boolean;
}

const PlatformContext = createContext<PlatformContextValue | undefined>(undefined);

/** Hydrates client components with the server-resolved session (set in /app/layout). */
export function PlatformProvider({
  value,
  children,
}: {
  value: PlatformContextValue;
  children: ReactNode;
}) {
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within <PlatformProvider>');
  return ctx;
}

/** Feature-flag hook — every sidebar item and module screen gates on this. */
export function useFeature(featureKey: FeatureKey): boolean {
  return usePlatform().features[featureKey] ?? false;
}

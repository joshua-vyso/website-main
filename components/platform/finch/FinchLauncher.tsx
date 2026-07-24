'use client';

import { useState } from 'react';
import { usePlatform } from '@/lib/platform/session';
import { type AgentModule } from '@/lib/ai/finch/config';
import { FinchButton } from './FinchButton';
import { FinchModal } from './FinchModal';

/**
 * Drops the Finch button + chat into a module's chrome. Available to every
 * signed-in user; renders nothing when the platform-wide kill switch is off (the
 * API enforces the same gate server-side, so this just hides the affordance).
 * `module` scopes the agent's knowledge to the current module.
 */
export function FinchLauncher({ module }: { module: AgentModule }) {
  const { email, org, finchEnabled } = usePlatform();
  const [open, setOpen] = useState(false);

  if (!finchEnabled || !email) return null;

  return (
    <>
      <FinchButton onClick={() => setOpen(true)} />
      <FinchModal open={open} onClose={() => setOpen(false)} module={module} orgName={org?.name ?? null} />
    </>
  );
}

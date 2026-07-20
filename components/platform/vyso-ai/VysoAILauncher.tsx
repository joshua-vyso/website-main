'use client';

import { useState } from 'react';
import { usePlatform } from '@/lib/platform/session';
import { type AgentModule } from '@/lib/ai/vyso-agent/config';
import { VysoAIButton } from './VysoAIButton';
import { VysoAIModal } from './VysoAIModal';

/**
 * Drops the Vyso AI button + chat into a module's chrome. Available to every
 * signed-in user; renders nothing when the platform-wide kill switch is off (the
 * API enforces the same gate server-side, so this just hides the affordance).
 * `module` scopes the agent's knowledge to the current module.
 */
export function VysoAILauncher({ module }: { module: AgentModule }) {
  const { email, org, vysoAiEnabled } = usePlatform();
  const [open, setOpen] = useState(false);

  if (!vysoAiEnabled || !email) return null;

  return (
    <>
      <VysoAIButton onClick={() => setOpen(true)} />
      <VysoAIModal open={open} onClose={() => setOpen(false)} module={module} orgName={org?.name ?? null} />
    </>
  );
}

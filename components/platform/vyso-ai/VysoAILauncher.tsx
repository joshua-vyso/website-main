'use client';

import { useState } from 'react';
import { usePlatform } from '@/lib/platform/session';
import { isVysoAiAllowed, type AgentModule } from '@/lib/ai/vyso-agent/config';
import { VysoAIButton } from './VysoAIButton';
import { VysoAIModal } from './VysoAIModal';

/**
 * Drops the Vyso AI button + chat into a module's chrome. Preview-gated: renders
 * nothing unless the signed-in account is on the allowlist (the API enforces the
 * same gate, so this is just to hide the affordance). `module` scopes the
 * agent's knowledge to the current module.
 */
export function VysoAILauncher({ module }: { module: AgentModule }) {
  const { email, org } = usePlatform();
  const [open, setOpen] = useState(false);

  if (!isVysoAiAllowed(email)) return null;

  return (
    <>
      <VysoAIButton onClick={() => setOpen(true)} />
      <VysoAIModal open={open} onClose={() => setOpen(false)} module={module} orgName={org?.name ?? null} />
    </>
  );
}

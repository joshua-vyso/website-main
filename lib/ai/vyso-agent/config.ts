/**
 * Vyso AI agent — shared configuration.
 *
 * The agent is intentionally small and composable: a set of *modules* it can
 * assist with, a two-tier model policy (a fast Haiku tier for Q&A / analytics /
 * parsing, a stronger Sonnet tier for multi-step workflows), and an allowlist of
 * accounts that may use it while it's in preview. Adding a module later is just a
 * new entry here + its knowledge doc + (eventually) its tools — nothing else in
 * the plumbing changes.
 */

/** Modules the agent can currently assist with. Extend as coverage grows. */
export type AgentModule = 'orderflow' | 'docu';

export const AGENT_MODULES: readonly AgentModule[] = ['orderflow', 'docu'];

export function isAgentModule(value: unknown): value is AgentModule {
  return typeof value === 'string' && (AGENT_MODULES as readonly string[]).includes(value);
}

/**
 * Platform-wide kill switch for Vyso AI. Defaults ON — every authenticated user
 * gets it. Set `VYSO_AI_ENABLED` to a falsy value ('false' | '0' | 'off' | 'no')
 * to turn the whole feature off (UI hidden + every /api/ai/agent/* route rejects)
 * without a redeploy.
 *
 * SERVER-ONLY: reads a non-`NEXT_PUBLIC_` var, so it is `undefined` in the browser
 * (→ treated as ON). Never call this from a client component to decide UI
 * visibility — during a kill the browser can't see the var and would keep showing
 * the button. Client components read the server-resolved `vysoAiEnabled` flag off
 * the platform session instead (see lib/platform/supabase-server.ts).
 */
export function isVysoAiEnabled(): boolean {
  const flag = process.env.VYSO_AI_ENABLED;
  if (flag == null || flag.trim() === '') return true; // default ON
  return !['false', '0', 'off', 'no'].includes(flag.trim().toLowerCase());
}

/**
 * Server-side access gate for the /api/ai/agent/* routes: Vyso AI is available to
 * every authenticated user while the feature is enabled. Enforced on the server
 * (the routes reject everyone else); the client hides the affordance via the
 * session flag. Never trust the client alone.
 */
export function isVysoAiAllowed(email: string | null | undefined): boolean {
  return isVysoAiEnabled() && !!email;
}

/**
 * Model tiers. Haiku is the default (fast + cheap) for UI Q&A, analytics and
 * parsing; the workflow tier (Sonnet) is reserved for multi-step actions and is
 * wired in a later phase. Both are env-overridable so models can be swapped
 * without a redeploy.
 */
export const AGENT_MODEL = process.env.ANTHROPIC_AGENT_MODEL || 'claude-haiku-4-5';
export const WORKFLOW_MODEL = process.env.ANTHROPIC_WORKFLOW_MODEL || 'claude-sonnet-4-6';

/** Output cap for a chat turn. Haiku 4.5 allows up to 64k; a chat reply is small. */
export const AGENT_MAX_TOKENS = 2048;

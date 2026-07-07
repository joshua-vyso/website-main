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
 * Accounts allowed to use Vyso AI while it's in preview. Gating is enforced on
 * BOTH the client (button only renders for these) and the server (the route
 * rejects everyone else) — never trust the client alone. Lower-cased compare.
 */
export const VYSO_AI_EMAILS: readonly string[] = ['test@example.com'];

export function isVysoAiAllowed(email: string | null | undefined): boolean {
  return !!email && VYSO_AI_EMAILS.includes(email.toLowerCase());
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

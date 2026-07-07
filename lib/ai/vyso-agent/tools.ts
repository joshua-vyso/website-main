/**
 * Vyso AI tool registry. Tools are the agent's read-only window onto the live
 * data — namespaced per module so adding a module later is just more tool
 * entries (the route/loop is generic). Every tool runs through the caller's
 * RLS-scoped Supabase client, so a tool can only ever read the caller's own org.
 *
 * Phase 2 = READ tools only (analytics + lookups). Write/workflow tools are a
 * later phase and will carry their own confirmation guardrails.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentModule } from './config';
import { businessSnapshot, recentInvoices, recentOrders, findCustomers } from './orderflow-data';

/** Runtime context handed to every tool. `canSeeMoney` mirrors the OrderFlow
 *  finance gate (members don't see revenue/outstanding). */
export interface ToolContext {
  supabase: SupabaseClient;
  orgId: string;
  canSeeMoney: boolean;
}

export interface AgentTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
  run: (ctx: ToolContext, input: Record<string, unknown>) => Promise<string>;
}

/** Clamp a model-supplied limit into a sane range. */
function clampLimit(raw: unknown, def: number, max: number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

const ORDERFLOW_TOOLS: AgentTool[] = [
  {
    name: 'orderflow_get_business_snapshot',
    description:
      'Get the headline OrderFlow numbers for THIS business right now: revenue this month, revenue today, total outstanding (unpaid), overdue invoice count, unpaid invoice count, and counts of customers and orders. Call this when the user asks how the business is doing, about revenue, money owed to them, overdue invoices, or overall performance.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    run: (ctx) => businessSnapshot(ctx.supabase, ctx.orgId, ctx.canSeeMoney).then((r) => JSON.stringify(r)),
  },
  {
    name: 'orderflow_list_recent_invoices',
    description:
      'List the most recent invoices (newest first) with their number, customer, date, total, outstanding balance and status. Call this when the user asks about recent/latest invoices, which invoices are unpaid or overdue, or what a recent invoice was for.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'How many to return (default 8, max 25).' },
      },
      additionalProperties: false,
    },
    run: (ctx, input) =>
      recentInvoices(ctx.supabase, ctx.orgId, clampLimit(input.limit, 8, 25)).then((r) => JSON.stringify(r)),
  },
  {
    name: 'orderflow_list_recent_orders',
    description:
      'List the most recent customer orders (newest first) with order number, customer, status, ex-VAT subtotal, whether it has been invoiced yet, and date. Call this when the user asks about recent orders or orders awaiting invoicing.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'How many to return (default 8, max 25).' },
      },
      additionalProperties: false,
    },
    run: (ctx, input) =>
      recentOrders(ctx.supabase, ctx.orgId, clampLimit(input.limit, 8, 25)).then((r) => JSON.stringify(r)),
  },
  {
    name: 'orderflow_find_customer',
    description:
      "Look up customers by name (partial match). Returns each match's trading name, account status, standing rebate %, payment terms, and how much they currently owe (outstanding balance + open invoice count). Call this when the user names a customer and asks who they are, their rebate, their terms, or what they owe.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The customer name or part of it to search for.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    run: (ctx, input) =>
      findCustomers(ctx.supabase, ctx.orgId, String(input.query ?? ''), ctx.canSeeMoney).then((r) => JSON.stringify(r)),
  },
];

const TOOLS_BY_MODULE: Record<AgentModule, AgentTool[]> = {
  orderflow: ORDERFLOW_TOOLS,
  docu: [], // Doc-U tools land in a later phase.
};

/** The tool objects (with run handlers) available for a module. */
export function getTools(module: AgentModule): AgentTool[] {
  return TOOLS_BY_MODULE[module] ?? [];
}

/** The Anthropic tool definitions (no run handler) to send with the request. */
export function toolDefsFor(module: AgentModule) {
  return getTools(module).map(({ name, description, input_schema }) => ({ name, description, input_schema }));
}

/** Execute a tool by name. Never throws — returns a string result / error note. */
export async function runTool(
  module: AgentModule,
  name: string,
  ctx: ToolContext,
  input: Record<string, unknown>,
): Promise<{ content: string; isError: boolean }> {
  const tool = getTools(module).find((t) => t.name === name);
  if (!tool) return { content: `Unknown tool: ${name}`, isError: true };
  try {
    return { content: await tool.run(ctx, input ?? {}), isError: false };
  } catch (err) {
    return { content: err instanceof Error ? err.message : 'Tool failed', isError: true };
  }
}

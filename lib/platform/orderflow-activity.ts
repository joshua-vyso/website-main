/**
 * Activity feed writer — every meaningful OrderFlow/Core Data action records an
 * of_activity event so customer timelines and the dashboard feed are real.
 * Fire-and-forget from client components: a failed log never blocks the action.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ActivityInput {
  orgId: string;
  actorEmail?: string | null;
  /** customer | quote | order | invoice | credit_note | delivery_note | payment | price_list | product | document */
  entityType: string;
  entityId?: string | null;
  customerId?: string | null;
  /** Short machine key, e.g. invoice_created, payment_recorded, status_changed. */
  event: string;
  description?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logActivity(supabase: SupabaseClient<any, any, any> | null, input: ActivityInput): void {
  if (!supabase) return;
  void supabase
    .from('of_activity')
    .insert({
      org_id: input.orgId,
      actor_email: input.actorEmail ?? null,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      customer_id: input.customerId ?? null,
      event: input.event,
      description: input.description ?? null,
    })
    .then(({ error }) => {
      if (error) console.warn('activity log failed:', error.message);
    });
}

/** Human labels for feed rendering (fallback: the raw event key). */
export const ACTIVITY_EVENT_LABEL: Record<string, string> = {
  customer_created: 'Customer created',
  customer_updated: 'Customer updated',
  contact_added: 'Contact added',
  address_added: 'Delivery address added',
  quote_created: 'Quote created',
  quote_sent: 'Quote sent',
  quote_accepted: 'Quote accepted',
  quote_rejected: 'Quote rejected',
  quote_converted: 'Quote converted',
  order_created: 'Order created',
  order_updated: 'Order updated',
  order_status_changed: 'Order status changed',
  invoice_created: 'Invoice created',
  invoice_sent: 'Invoice sent',
  invoice_updated: 'Invoice updated',
  invoice_cancelled: 'Invoice cancelled',
  payment_recorded: 'Payment recorded',
  credit_note_issued: 'Credit note issued',
  delivery_note_created: 'Delivery note created',
  delivery_note_delivered: 'Delivery confirmed',
  pod_uploaded: 'Proof of delivery uploaded',
  document_attached: 'Document attached',
  price_list_updated: 'Price list updated',
  product_created: 'Product added',
  product_updated: 'Product updated',
};

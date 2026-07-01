/**
 * ServiceDen data access — fetches the org's customers, services and invoices
 * (with line items) from Supabase and maps snake_case → camelCase. Org-scoped
 * by RLS; an org with no rows returns empty arrays.
 */

import { createServerSupabase } from './supabase-server';
import type {
  ServiceDenData,
  SdCustomer,
  SdService,
  SdServiceUnit,
  SdInvoice,
  SdInvoiceItem,
  SdInvoiceStatus,
} from './serviceden';

export const EMPTY_SERVICEDEN: ServiceDenData = { customers: [], services: [], invoices: [] };

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export async function getServiceDenData(orgId: string): Promise<ServiceDenData> {
  const sb = await createServerSupabase();
  const [cus, svc, inv, itm] = await Promise.all([
    sb.from('sd_customers').select('*').eq('org_id', orgId).order('name'),
    sb.from('sd_services').select('*').eq('org_id', orgId).order('sort_order'),
    sb.from('sd_invoices').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('sd_invoice_items').select('*').eq('org_id', orgId).order('sort_order'),
  ]);

  const customers: SdCustomer[] = ((cus.data as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name ?? '',
    company: r.company ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    address: r.address ?? null,
    notes: r.notes ?? null,
  }));

  const services: SdService[] = ((svc.data as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name ?? '',
    description: r.description ?? null,
    unit: (r.unit as SdServiceUnit) ?? 'fixed',
    unitPrice: num(r.unit_price),
    active: r.active !== false,
  }));

  const itemsByInvoice = new Map<string, SdInvoiceItem[]>();
  for (const r of (itm.data as any[]) ?? []) {
    const item: SdInvoiceItem = {
      id: r.id,
      invoiceId: r.invoice_id,
      serviceId: r.service_id ?? null,
      description: r.description ?? '',
      quantity: num(r.quantity, 1),
      unitPrice: num(r.unit_price),
    };
    const arr = itemsByInvoice.get(r.invoice_id) ?? [];
    arr.push(item);
    itemsByInvoice.set(r.invoice_id, arr);
  }

  const invoices: SdInvoice[] = ((inv.data as any[]) ?? []).map((r) => ({
    id: r.id,
    customerId: r.customer_id ?? null,
    invoiceNumber: r.invoice_number ?? '',
    status: (r.status as SdInvoiceStatus) ?? 'draft',
    issueDate: r.issue_date ?? '',
    dueDate: r.due_date ?? null,
    taxRate: num(r.tax_rate, 15),
    notes: r.notes ?? null,
    items: itemsByInvoice.get(r.id) ?? [],
  }));

  return { customers, services, invoices };
}

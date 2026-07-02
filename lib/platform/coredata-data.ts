/**
 * Core Data access — server-side fetch of the shared operational entities for
 * the Doc-U Databases pages and any module that needs the full picture.
 * Org-scoped by RLS; missing tables (migration not yet run) degrade to empty.
 */

import { createServerSupabase } from './supabase-server';
import type { OfCustomer } from './orderflow';
import type {
  CdContact,
  CdDeliveryAddress,
  CdProduct,
  CdPriceList,
  CdPriceOverride,
  CdPaymentTerm,
  CdVatRate,
  CdCompanyProfile,
  CdDocTemplate,
} from './coredata';

export interface CoreData {
  customers: OfCustomer[];
  contacts: CdContact[];
  addresses: CdDeliveryAddress[];
  products: CdProduct[];
  priceLists: CdPriceList[];
  overrides: CdPriceOverride[];
  paymentTerms: CdPaymentTerm[];
  vatRates: CdVatRate[];
  companyProfile: CdCompanyProfile | null;
  templates: CdDocTemplate[];
}

export const EMPTY_CORE_DATA: CoreData = {
  customers: [],
  contacts: [],
  addresses: [],
  products: [],
  priceLists: [],
  overrides: [],
  paymentTerms: [],
  vatRates: [],
  companyProfile: null,
  templates: [],
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function rows<T>(res: { data: unknown }): T[] {
  return ((res.data as any[]) ?? []) as T[];
}

export async function getCoreData(orgId: string): Promise<CoreData> {
  const sb = await createServerSupabase();
  const [cus, con, adr, prod, lists, ovr, terms, vat, profile, tpl] = await Promise.all([
    sb.from('of_customers').select('*').eq('org_id', orgId).order('name'),
    sb.from('cd_contacts').select('*').eq('org_id', orgId).order('name'),
    sb.from('cd_delivery_addresses').select('*').eq('org_id', orgId).order('created_at'),
    sb.from('pp_stock_items').select('*').eq('org_id', orgId).order('name'),
    sb.from('pl_price_lists').select('*').eq('org_id', orgId).order('created_at'),
    sb.from('pl_overrides').select('*').eq('org_id', orgId),
    sb.from('cd_payment_terms').select('*').eq('org_id', orgId).order('days'),
    sb.from('cd_vat_rates').select('*').eq('org_id', orgId).order('rate', { ascending: false }),
    sb.from('cd_company_profile').select('*').eq('org_id', orgId).maybeSingle(),
    sb.from('cd_doc_templates').select('*').eq('org_id', orgId).order('created_at'),
  ]);

  return {
    customers: rows<OfCustomer>(cus),
    contacts: rows<CdContact>(con),
    addresses: rows<CdDeliveryAddress>(adr),
    products: rows<CdProduct>(prod),
    priceLists: rows<CdPriceList>(lists),
    overrides: rows<CdPriceOverride>(ovr),
    paymentTerms: rows<CdPaymentTerm>(terms),
    vatRates: rows<CdVatRate>(vat),
    companyProfile: (profile.data as CdCompanyProfile | null) ?? null,
    templates: rows<CdDocTemplate>(tpl),
  };
}

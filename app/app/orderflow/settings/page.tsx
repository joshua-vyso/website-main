import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { getOfSettings } from '@/lib/platform/orderflow-data';
import { DEFAULT_OF_SETTINGS } from '@/lib/platform/orderflow';
import type { CdPaymentTerm, CdVatRate } from '@/lib/platform/coredata';
import { OrderFlowSettingsView } from '@/components/platform/orderflow/OrderFlowSettingsView';

/* eslint-disable @typescript-eslint/no-explicit-any */
function rows<T>(res: { data: unknown }): T[] {
  return ((res.data as any[]) ?? []) as T[];
}

/**
 * OrderFlow → Settings. Server-fetches the org's document-numbering + defaults
 * (of_settings) plus the Core Data lists the defaults pick from (payment terms,
 * VAT rates), then hands them to the client view. No org → default settings +
 * empty lists (non-crashing).
 */
export default async function OrderFlowSettingsPage() {
  const session = await getPlatformSession();
  const org = session?.org ?? null;

  if (!org) {
    return (
      <OrderFlowSettingsView
        settings={{ ...DEFAULT_OF_SETTINGS }}
        paymentTerms={[]}
        vatRates={[]}
      />
    );
  }

  const sb = await createServerSupabase();
  const [settings, terms, vat] = await Promise.all([
    getOfSettings(org.id),
    sb.from('cd_payment_terms').select('*').eq('org_id', org.id).order('days'),
    sb.from('cd_vat_rates').select('*').eq('org_id', org.id).order('rate'),
  ]);

  return (
    <OrderFlowSettingsView
      settings={settings}
      paymentTerms={rows<CdPaymentTerm>(terms)}
      vatRates={rows<CdVatRate>(vat)}
    />
  );
}

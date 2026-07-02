import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getInvoiceDetail, type InvoiceDetailData } from '@/lib/platform/orderflow-data';
import { InvoiceDetailV2 } from '@/components/platform/orderflow/InvoiceDetailV2';

const EMPTY: InvoiceDetailData = {
  invoice: null,
  items: [],
  payments: [],
  creditNotes: [],
  creditNoteItems: [],
  customer: null,
  order: null,
  companyProfile: null,
  documents: [],
  activity: [],
};

/**
 * Invoice detail — server-fetches the invoice fresh on every navigation (never
 * a layout provider) so a just-created invoice always resolves.
 */
export default async function InvoiceDetailPage(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getPlatformSession();
  const data = session?.org ? await getInvoiceDetail(session.org.id, id) : EMPTY;
  return <InvoiceDetailV2 data={data} orgName={session?.org?.name ?? null} />;
}

import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import type {
  OfCreditNote,
  OfCreditNoteItem,
  OfCustomer,
  OfInvoice,
} from '@/lib/platform/orderflow';
import type { CdCompanyProfile } from '@/lib/platform/coredata';
import { CreditNoteDetail } from '@/components/platform/orderflow/CreditNoteDetail';

/**
 * Credit note detail — server-fetches the note fresh on every navigation (never
 * a layout provider) so a just-issued credit note is always found. Pulls the
 * note, its items, the customer, the invoice it credits and the company profile
 * (for the printable sheet).
 */
export default async function OrderFlowCreditNotePage(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';

  if (!orgId) {
    return (
      <CreditNoteDetail creditNote={null} items={[]} customer={null} invoice={null} companyProfile={null} orgName={null} />
    );
  }

  const sb = await createServerSupabase();
  const [cnRes, itemRes, profileRes] = await Promise.all([
    sb.from('of_credit_notes').select('*').eq('org_id', orgId).eq('id', id).maybeSingle(),
    sb.from('of_credit_note_items').select('*').eq('credit_note_id', id),
    sb.from('cd_company_profile').select('*').eq('org_id', orgId).maybeSingle(),
  ]);

  const creditNote = (cnRes.data as OfCreditNote | null) ?? null;

  const [customerRes, invoiceRes] = await Promise.all([
    creditNote?.customer_id
      ? sb.from('of_customers').select('*').eq('id', creditNote.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    creditNote?.invoice_id
      ? sb.from('of_invoices').select('*').eq('id', creditNote.invoice_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <CreditNoteDetail
      creditNote={creditNote}
      items={((itemRes.data as OfCreditNoteItem[] | null) ?? [])}
      customer={(customerRes.data as OfCustomer | null) ?? null}
      invoice={(invoiceRes.data as OfInvoice | null) ?? null}
      companyProfile={(profileRes.data as CdCompanyProfile | null) ?? null}
      orgName={session?.org?.name ?? null}
    />
  );
}

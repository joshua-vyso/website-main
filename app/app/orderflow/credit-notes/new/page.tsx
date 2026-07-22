import Link from 'next/link';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getCreditNotesData } from '@/lib/platform/orderflow-data';
import { CreditNoteBuilder } from '@/components/platform/orderflow/CreditNoteBuilder';

/**
 * New-credit-note page — server-fetches every invoice + its items + payments +
 * existing credit notes so the builder can compute outstanding balances client
 * side. `?invoice=<id>` pre-selects a source invoice; otherwise the builder
 * shows an invoice picker (invoices with a balance still owing).
 */
export default async function NewCreditNotePage(ctx: { searchParams: Promise<{ invoice?: string }> }) {
  const { invoice } = await ctx.searchParams;
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';

  if (!orgId) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
        <p className="text-[15px] font-medium text-[#1A1C1E]">Not connected</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">Sign in to raise a credit note.</p>
        <Link href="/app/orderflow/credit-notes" className="mt-3 inline-block text-[13px] font-medium text-[#1F5FA8] hover:underline">
          ← Back to credit notes
        </Link>
      </div>
    );
  }

  const data = await getCreditNotesData(orgId);

  return (
    <CreditNoteBuilder
      invoices={data.invoices}
      invoiceItems={data.invoiceItems}
      payments={data.payments}
      creditNotes={data.creditNotes}
      creditNoteItems={data.items}
      customers={data.customers}
      initialInvoiceId={invoice ?? null}
    />
  );
}

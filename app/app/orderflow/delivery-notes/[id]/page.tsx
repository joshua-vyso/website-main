import Link from 'next/link';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { DeliveryNoteDetail } from '@/components/platform/orderflow/DeliveryNoteDetail';
import type { LinkedDocument } from '@/lib/platform/orderflow-data';
import type {
  OfCustomer,
  OfDeliveryNote,
  OfDeliveryNoteItem,
  OfInvoice,
  OfOrder,
} from '@/lib/platform/orderflow';
import type { CdCompanyProfile } from '@/lib/platform/coredata';

const LINKED_DOC_COLS =
  'id, filename, document_type, status, storage_path, entity_type, entity_id, customer_id, created_at';

/**
 * Delivery-note detail — server-fetches the note fresh on every navigation
 * (never reads a layout provider that would be stale for a just-created note),
 * mirroring getOrderDetail's shape: the note org-scoped, its items, the
 * customer, the linked order/invoice, the company profile and any linked docs.
 */
export default async function DeliveryNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const sb = await createServerSupabase();

  const [dnRes, itemsRes, profileRes, docsRes] = await Promise.all([
    sb.from('of_delivery_notes').select('*').eq('org_id', orgId).eq('id', id).maybeSingle(),
    sb.from('of_delivery_note_items').select('*').eq('delivery_note_id', id).order('created_at', { ascending: true }),
    sb.from('cd_company_profile').select('*').eq('org_id', orgId).maybeSingle(),
    sb.from('documents').select(LINKED_DOC_COLS).eq('org_id', orgId).eq('entity_type', 'delivery_note').eq('entity_id', id),
  ]);

  const note = (dnRes.data as OfDeliveryNote | null) ?? null;

  if (!note) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-sm rounded-2xl border border-[#EAEDF2] bg-white px-8 py-10 text-center">
          <h1 className="text-[18px] font-bold text-[#171A17]">Delivery note not found</h1>
          <p className="mt-1 text-[13px] text-[#6B6F68]">It may have been deleted, or the migration has not run.</p>
          <Link
            href="/app/orderflow/delivery-notes"
            className="mt-4 inline-flex h-9 items-center rounded-lg bg-[#1F5FA8] px-4 text-[13px] font-medium text-white"
          >
            Back to Delivery notes
          </Link>
        </div>
      </div>
    );
  }

  const [customer, order, invoice] = await Promise.all([
    note.customer_id
      ? sb.from('of_customers').select('*').eq('id', note.customer_id).maybeSingle().then((r) => (r.data as OfCustomer | null) ?? null)
      : Promise.resolve(null),
    note.order_id
      ? sb.from('of_orders').select('*').eq('id', note.order_id).maybeSingle().then((r) => (r.data as OfOrder | null) ?? null)
      : Promise.resolve(null),
    note.invoice_id
      ? sb.from('of_invoices').select('*').eq('id', note.invoice_id).maybeSingle().then((r) => (r.data as OfInvoice | null) ?? null)
      : Promise.resolve(null),
  ]);

  return (
    <DeliveryNoteDetail
      note={note}
      items={(itemsRes.data as OfDeliveryNoteItem[] | null) ?? []}
      customer={customer}
      order={order}
      invoice={invoice}
      companyProfile={(profileRes.data as CdCompanyProfile | null) ?? null}
      documents={(docsRes.data as LinkedDocument[] | null) ?? []}
      orgName={session?.org?.name ?? null}
    />
  );
}

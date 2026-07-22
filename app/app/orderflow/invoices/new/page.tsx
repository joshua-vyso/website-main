import Link from 'next/link';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { getBuilderContext } from '@/lib/platform/orderflow-data';
import { InvoiceBuilder, type InvoiceBuilderInitial, type InvoiceInitialLine } from '@/components/platform/orderflow/InvoiceBuilder';
import type { CdCompanyProfile } from '@/lib/platform/coredata';
import type {
  OfInvoice,
  OfInvoiceItem,
  OfOrder,
  OfOrderItem,
  OfQuote,
  OfQuoteItem,
} from '@/lib/platform/orderflow';

interface Search {
  customer?: string;
  order?: string;
  quote?: string;
  duplicate?: string;
  edit?: string;
}

function noticeCard(title: string, body: string, backLabel: string, backHref: string) {
  return (
    <div className="rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-12 text-center">
      <p className="text-[15px] font-medium text-[#171A17]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-[#6B6F68]">{body}</p>
      <Link href={backHref} className="mt-3 inline-block text-[13px] font-medium text-[#1F5FA8] hover:underline">
        ← {backLabel}
      </Link>
    </div>
  );
}

/**
 * New-invoice page — server-fetches builder context plus, when converting or
 * editing, the source document + items, and passes everything as initial state.
 * Handles ?customer / ?order / ?quote / ?duplicate / ?edit.
 */
export default async function NewInvoicePage(ctx: { searchParams: Promise<Search> }) {
  const sp = await ctx.searchParams;
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';

  if (!orgId) {
    return noticeCard('Not connected', 'Sign in to create an invoice.', 'Back to invoices', '/app/orderflow/invoices');
  }

  const db = await createServerSupabase();
  const [ctxData, profileRes] = await Promise.all([
    getBuilderContext(orgId),
    db.from('cd_company_profile').select('*').eq('org_id', orgId).maybeSingle(),
  ]);
  const companyProfile = (profileRes.data as CdCompanyProfile | null) ?? null;

  let initial: InvoiceBuilderInitial = { mode: 'new', customerId: sp.customer ?? null };

  if (sp.edit || sp.duplicate) {
    const id = sp.edit ?? sp.duplicate!;
    const [{ data: inv }, { data: items }] = await Promise.all([
      db.from('of_invoices').select('*').eq('org_id', orgId).eq('id', id).maybeSingle(),
      db.from('of_invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
    ]);
    const invoice = (inv as OfInvoice | null) ?? null;
    if (!invoice) {
      return noticeCard('Invoice not found', 'It may have been deleted.', 'Back to invoices', '/app/orderflow/invoices');
    }
    if (sp.edit && invoice.status !== 'draft') {
      return noticeCard(
        'Only drafts can be edited',
        `${invoice.invoice_number} has already been ${invoice.status === 'sent' ? 'sent' : `marked ${invoice.status.replace('_', ' ')}`}. Duplicate it to make changes on a new invoice.`,
        'Back to the invoice',
        `/app/orderflow/invoices/${invoice.id}`,
      );
    }
    const lines: InvoiceInitialLine[] = (((items ?? []) as OfInvoiceItem[])).map((it) => ({
      stock_item_id: it.stock_item_id,
      name: it.name,
      qty: Number(it.qty) || 0,
      unit: it.unit,
      unit_price: Number(it.unit_price) || 0,
      override_note: it.override_note ?? null,
    }));
    initial = {
      mode: sp.edit ? 'edit' : 'new',
      editInvoice: sp.edit ? invoice : null,
      customerId: invoice.customer_id,
      lines,
      vatRate: invoice.vat_rate,
      discount: invoice.discount,
      // Duplicates start fresh on today's dates; edits keep the draft's.
      issueDate: sp.edit ? invoice.issue_date : null,
      dueDate: sp.edit ? invoice.due_date : null,
      customerPo: invoice.customer_po,
      billingAddress: invoice.billing_address,
      deliveryAddress: invoice.delivery_address,
      deliveryInstructions: invoice.delivery_instructions,
      notes: invoice.notes,
      terms: invoice.terms,
      sourceLabel: sp.edit ? null : `invoice ${invoice.invoice_number}`,
    };
  } else if (sp.order) {
    const [{ data: ord }, { data: items }] = await Promise.all([
      db.from('of_orders').select('*').eq('org_id', orgId).eq('id', sp.order).maybeSingle(),
      db.from('of_order_items').select('*').eq('order_id', sp.order).order('created_at', { ascending: true }),
    ]);
    const order = (ord as OfOrder | null) ?? null;
    if (!order) {
      return noticeCard('Order not found', 'It may have been deleted.', 'Back to orders', '/app/orderflow/orders');
    }
    if (order.invoice_id) {
      return noticeCard(
        'Already invoiced',
        `This order was already invoiced${order.invoice_number ? ` as ${order.invoice_number}` : ''}.`,
        'View the invoice',
        `/app/orderflow/invoices/${order.invoice_id}`,
      );
    }
    const orderRef = order.order_number ?? `#${order.id.slice(0, 6).toUpperCase()}`;
    initial = {
      mode: 'new',
      customerId: order.customer_id,
      orderId: order.id,
      lines: (((items ?? []) as OfOrderItem[])).map((it) => ({
        stock_item_id: it.stock_item_id,
        name: it.name,
        qty: Number(it.qty) || 0,
        unit: it.unit,
        unit_price: Number(it.unit_price) || 0,
        override_note: null,
      })),
      customerPo: order.customer_po ?? null,
      deliveryAddress: order.delivery_address ?? null,
      deliveryInstructions: order.delivery_instructions ?? null,
      notes: order.notes,
      sourceLabel: `order ${orderRef}`,
    };
  } else if (sp.quote) {
    const [{ data: qt }, { data: items }] = await Promise.all([
      db.from('of_quotes').select('*').eq('org_id', orgId).eq('id', sp.quote).maybeSingle(),
      db.from('of_quote_items').select('*').eq('quote_id', sp.quote).order('sort_order'),
    ]);
    const quote = (qt as OfQuote | null) ?? null;
    if (!quote) {
      return noticeCard('Quote not found', 'It may have been deleted.', 'Back to quotes', '/app/orderflow/quotes');
    }
    if (quote.converted_invoice_id) {
      return noticeCard(
        'Already converted',
        'This quote was already converted to an invoice.',
        'View the invoice',
        `/app/orderflow/invoices/${quote.converted_invoice_id}`,
      );
    }
    initial = {
      mode: 'new',
      customerId: quote.customer_id,
      quoteId: quote.id,
      lines: (((items ?? []) as OfQuoteItem[])).map((it) => ({
        stock_item_id: it.stock_item_id,
        name: it.name,
        qty: Number(it.qty) || 0,
        unit: it.unit,
        unit_price: Number(it.unit_price) || 0,
        override_note: it.override_note ?? null,
      })),
      vatRate: quote.vat_rate,
      customerPo: quote.customer_po,
      deliveryAddress: quote.delivery_address,
      notes: quote.notes,
      sourceLabel: `quote ${quote.quote_number}`,
    };
  }

  return (
    <InvoiceBuilder
      customers={ctxData.customers}
      addresses={ctxData.addresses}
      products={ctxData.products}
      priceLists={ctxData.priceLists}
      overrides={ctxData.overrides}
      settings={ctxData.settings}
      companyProfile={companyProfile}
      initial={initial}
    />
  );
}

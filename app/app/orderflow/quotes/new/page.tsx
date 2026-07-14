import Link from 'next/link';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getBuilderContext, getQuoteRequest } from '@/lib/platform/orderflow-data';
import { QuoteBuilder } from '@/components/platform/orderflow/QuoteBuilder';
import type { BuilderLine } from '@/components/platform/orderflow/builder';
import { quoteRequestWho, type OfQuoteRequest } from '@/lib/platform/orderflow';

/**
 * Prefill the builder from a website enquiry.
 *
 * The lines come back as UNPRICED free-text lines with no stock_item_id. The enquirer
 * typed "20kg oyster mushrooms" into a form — that's a request, not a catalogue match.
 * Guessing which product (and therefore which price) they meant is exactly the kind of
 * silent wrong answer that costs money, so the human picks the product and the price.
 *
 * The enquirer's MESSAGE is deliberately NOT seeded into the quote's notes. Notes get
 * printed on the issued quote, right beside the org's banking details — so prefilling a
 * stranger's free text there hands anyone with the contact form a way to put words like
 * "our account has changed, please remit to …" onto a document you send to a real
 * customer, in a field a rushed user may never clear. The message is shown read-only
 * beside the builder instead (see QuoteBuilder's enquiry panel); if it belongs on the
 * quote, someone types it there on purpose.
 */
/** Collapse whitespace and strip control chars from stranger-typed free text, and cap
 *  it so nothing can hide beyond the visible width of a builder input. */
function cleanText(v: string, max: number): string {
  // Strip control chars (incl. newlines) so a payload can't hide on a second line, then
  // collapse runs of whitespace and cap the length.
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function prefillFrom(request: OfQuoteRequest): { lines: BuilderLine[] } {
  const items = Array.isArray(request.requested_items) ? request.requested_items : [];

  const lines: BuilderLine[] = items
    .map((it, i) => {
      // quantity is a free string the model produced from a stranger's text. "1e400"
      // parses to Infinity, which passes a naive `> 0`, poisons the totals with NaN and
      // then fails the insert as null. Only a finite, sane number is allowed through.
      const n = Number(it.quantity);
      const qty = Number.isFinite(n) && n > 0 ? Math.min(n, 100_000) : 1;

      // description and unit both PRINT on the issued quote (DocSheet), and both come
      // from stranger text. The human prices each line before saving, but a narrow input
      // can hide a long payload ("kg — NOTE: pay account 123…"). Normalise + hard-cap so
      // whatever the human sees is the whole value; a unit that isn't a short unit-shaped
      // token is dropped rather than shown.
      const name = cleanText(it.description ?? '', 80);
      const rawUnit = cleanText(it.unit ?? '', 16);
      const unit = /^[\p{L}\d./-]{1,12}$/u.test(rawUnit) ? rawUnit : null;

      return {
        key: `req${request.id}_${i}`,
        stock_item_id: null,
        name,
        qty,
        unit,
        unit_price: 0,
        source: 'none' as const,
        override_note: null,
      };
    })
    .filter((l) => l.name.length > 0);

  return { lines };
}

/** New-quote page — server-fetches builder context (customers, products, price lists, settings). */
export default async function NewQuotePage(ctx: {
  searchParams: Promise<{ customer?: string; request?: string }>;
}) {
  const { customer, request } = await ctx.searchParams;
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';

  if (!orgId) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
        <p className="text-[15px] font-medium text-[#1A1C1E]">Not connected</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">Sign in to create a quote.</p>
        <Link href="/app/orderflow/quotes" className="mt-3 inline-block text-[13px] font-medium text-[#1E5E54] hover:underline">
          ← Back to quotes
        </Link>
      </div>
    );
  }

  // getQuoteRequest is org-scoped, so a ?request= id belonging to another tenant simply
  // resolves to null and the builder opens empty.
  const [ctxData, quoteRequest] = await Promise.all([
    getBuilderContext(orgId),
    request ? getQuoteRequest(orgId, request) : Promise.resolve(null),
  ]);

  const prefill = quoteRequest ? prefillFrom(quoteRequest) : null;

  return (
    <QuoteBuilder
      customers={ctxData.customers}
      addresses={ctxData.addresses}
      products={ctxData.products}
      priceLists={ctxData.priceLists}
      overrides={ctxData.overrides}
      settings={ctxData.settings}
      initialCustomerId={customer ?? null}
      initialLines={prefill?.lines ?? null}
      quoteRequest={quoteRequest}
    />
  );
}

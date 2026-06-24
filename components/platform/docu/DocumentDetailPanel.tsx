'use client';

import Link from 'next/link';
import { ConfidenceText, StatusPill } from '@/components/platform/ui';
import { ExtractionEditor } from '@/components/platform/ExtractionEditor';
import { ApprovalActions } from './ApprovalActions';
import { FlagsList } from './FlagsList';
import { AiSummaryCard } from './AiSummaryCard';
import { ConfidenceBreakdown } from './ConfidenceBreakdown';
import { DocumentRelationshipFlow } from './DocumentRelationshipFlow';
import { ActivityTimeline } from './ActivityTimeline';
import { RoutingCard } from './RoutingCard';
import { SupplierIntelligenceCard } from './SupplierIntelligenceCard';
import { MissingDocumentsCard } from './MissingDocumentsCard';
import { deriveFlags } from '@/lib/platform/docu/flags';
import { deriveSupplierIntelligence } from '@/lib/platform/docu/supplier-intel';
import { getMissingDocs } from '@/lib/platform/docu/missing-docs';
import { inferSupplierFromDoc } from '@/lib/platform/docu/supplier-match';
import type { AiSummary } from '@/lib/platform/docu/types';
import type { DocumentWithSupplier } from '@/lib/platform/types';

/**
 * The enriched document detail. Left: original preview + extracted-data editor.
 * Right: the intelligence rail (approval, AI summary, flags, supplier intel,
 * confidence, relationships, missing docs, activity, routing).
 */
export function DocumentDetailPanel({
  doc,
  orgDocs,
  originalUrl,
  isImage,
}: {
  doc: DocumentWithSupplier;
  orgDocs: DocumentWithSupplier[];
  originalUrl: string | null;
  isImage: boolean;
}) {
  const fields = doc.extracted_data?.fields ?? [];
  const lineItems = doc.extracted_data?.line_items ?? [];

  const flags = deriveFlags(doc, orgDocs);
  const match = inferSupplierFromDoc(doc);
  const supplierName = doc.supplier?.name ?? match.canonical ?? 'Unknown supplier';
  const intel = deriveSupplierIntelligence(doc.supplier_id, supplierName, orgDocs);
  const missing = getMissingDocs(doc);
  const initialSummary = (doc.ai_summary as AiSummary | null) ?? null;
  const autoMatched = !doc.supplier && match.matched && match.canonical != null;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/app/docu"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-[#E7E7E2] bg-white px-3 text-[13px] text-[#5F6368] transition-colors hover:border-[#1E5E54]/30 hover:text-[#1A1C1E]"
          >
            <span aria-hidden>‹</span> Documents
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-[20px] font-bold leading-tight text-[#1A1C1E]">
              {doc.filename}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-[#5F6368]">{supplierName}</span>
              {autoMatched ? (
                <span className="inline-flex items-center rounded-full bg-[#E6F1FB] px-2 py-0.5 text-[11px] font-medium text-[#0C447C]">
                  auto-matched · {match.confidence}%
                </span>
              ) : null}
              <span className="text-[#9A9DA1]">·</span>
              <span className="text-[#5F6368]">
                <ConfidenceText value={doc.confidence} /> confidence
              </span>
            </div>
          </div>
        </div>
        <StatusPill status={doc.status} />
      </div>

      {/* Main grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* LEFT — original + extracted data */}
        <div className="space-y-6">
          <div className="flex flex-col rounded-2xl border border-[#E7E7E2] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#F0F0EC] px-6 py-5">
              <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Original document</h2>
              <span className="truncate text-[12px] text-[#9A9DA1]">{doc.filename}</span>
            </div>
            <div className="p-4">
              {originalUrl ? (
                isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={originalUrl}
                    alt="Original document"
                    className="max-h-[60vh] w-full rounded-xl border border-[#E7E7E2] object-contain"
                  />
                ) : (
                  <iframe
                    src={originalUrl}
                    title="Original document"
                    className="h-[60vh] w-full rounded-xl border border-[#E7E7E2]"
                  />
                )
              ) : (
                <div className="flex h-[40vh] items-center justify-center rounded-xl border border-dashed border-[#E7E7E2] bg-[#FAFAF8]">
                  <span className="text-[13px] text-[#9A9DA1]">Preview unavailable</span>
                </div>
              )}
            </div>
          </div>

          <ExtractionEditor id={doc.id} status={doc.status} fields={fields} lineItems={lineItems} />
        </div>

        {/* RIGHT — intelligence rail */}
        <div className="space-y-4">
          <ApprovalActions documentId={doc.id} status={doc.status} />
          <AiSummaryCard documentId={doc.id} initialSummary={initialSummary} />
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
            <h3 className="mb-3 text-[14px] font-medium text-[#1A1C1E]">Flags</h3>
            <FlagsList flags={flags} />
          </div>
          <SupplierIntelligenceCard intel={intel} />
          <ConfidenceBreakdown doc={doc} />
          <DocumentRelationshipFlow doc={doc} />
          <MissingDocumentsCard insights={missing} />
          <ActivityTimeline doc={doc} />
          <RoutingCard docType={doc.document_type} />
        </div>
      </div>
    </div>
  );
}

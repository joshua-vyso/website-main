'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ConfidenceText, StatusPill } from '@/components/platform/ui';
import { ExtractionEditor } from '@/components/platform/ExtractionEditor';
import { ApprovalActions } from './ApprovalActions';
import { DocumentRename } from './DocumentRename';
import { FolderPicker } from './FolderPicker';
import { PushToButton } from './PushToButton';
import { TypePicker } from './TypePicker';
import { StatementTotalsCard } from './StatementTotalsCard';
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
import type { AiSummary, DocuExtractedData } from '@/lib/platform/docu/types';
import type { DocumentFolder, DocumentWithSupplier, FeatureKey } from '@/lib/platform/types';

/**
 * The document detail. Two main blocks side by side — extracted-data editor
 * (left) and original preview (right) — with everything else (workflow, AI
 * summary, flags, supplier intel, confidence, relationships, missing docs,
 * activity, routing) tucked into a collapsible "Additional information" tile.
 */
export function DocumentDetailPanel({
  doc,
  orgDocs,
  folders,
  features,
  fedItemCount,
  orgUnits,
  originalUrl,
  isImage,
}: {
  doc: DocumentWithSupplier;
  orgDocs: DocumentWithSupplier[];
  folders: DocumentFolder[];
  features: Record<FeatureKey, boolean>;
  fedItemCount: number;
  orgUnits: string[];
  originalUrl: string | null;
  isImage: boolean;
}) {
  const [showMore, setShowMore] = useState(false);

  const fields = doc.extracted_data?.fields ?? [];
  const lineItems = doc.extracted_data?.line_items ?? [];

  const flags = deriveFlags(doc, orgDocs);
  const match = inferSupplierFromDoc(doc);
  const supplierName = doc.supplier?.name ?? match.canonical ?? match.raw ?? 'Unknown supplier';
  const intel = deriveSupplierIntelligence(doc.supplier_id, supplierName, orgDocs);
  const missing = getMissingDocs(doc);
  const initialSummary = (doc.ai_summary as AiSummary | null) ?? null;
  const autoMatched = !doc.supplier && match.matched && match.canonical != null;
  const extracted = (doc.extracted_data as DocuExtractedData | null) ?? null;
  const statementSummary = extracted?.summary ?? null;

  const preview = (
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
              className="max-h-[calc(100vh-12rem)] w-full rounded-xl border border-[#E7E7E2] object-contain"
            />
          ) : (
            <iframe
              src={originalUrl}
              title="Original document"
              className="h-[calc(100vh-12rem)] min-h-[420px] w-full rounded-xl border border-[#E7E7E2]"
            />
          )
        ) : (
          <div className="flex min-h-[50vh] items-center justify-center rounded-xl border border-dashed border-[#E7E7E2] bg-[#FAFAF8]">
            <span className="text-[13px] text-[#9A9DA1]">Preview unavailable</span>
          </div>
        )}
      </div>
    </div>
  );

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
            <DocumentRename documentId={doc.id} filename={doc.filename} />
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
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <PushToButton documentId={doc.id} docType={doc.document_type} features={features} />
          <TypePicker documentId={doc.id} documentType={doc.document_type} extractedData={extracted} />
          <FolderPicker documentId={doc.id} folders={folders} currentFolderId={doc.folder_id} />
          <StatusPill status={doc.status} />
        </div>
      </div>

      {/* Two main blocks — extracted data (left) + original preview (right).
          The preview cell stretches to the row height and holds a sticky child,
          so the preview stays in view while the long list scrolls the page. */}
      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <ExtractionEditor
          id={doc.id}
          status={doc.status}
          fields={fields}
          lineItems={lineItems}
          extractedData={extracted}
          orgUnits={orgUnits}
        />
        <div className="lg:self-stretch">
          <div className="lg:sticky lg:top-6">{preview}</div>
        </div>
      </div>

      {/* Additional information — collapsed by default */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <button
          type="button"
          onClick={() => setShowMore((s) => !s)}
          className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-[#FAFAF8]"
          aria-expanded={showMore}
        >
          <span className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-[#1A1C1E]">Additional information</span>
            <span className="text-[12px] text-[#9A9DA1]">
              Workflow, AI summary, flags, supplier intel & more
            </span>
          </span>
          <span
            className={`text-[#9A9DA1] transition-transform ${showMore ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▾
          </span>
        </button>

        {showMore ? (
          <div className="border-t border-[#F0F0EC] p-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ApprovalActions documentId={doc.id} status={doc.status} />
              <AiSummaryCard documentId={doc.id} initialSummary={initialSummary} />
              {statementSummary ? <StatementTotalsCard summary={statementSummary} /> : null}
              <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
                <h3 className="mb-3 text-[14px] font-medium text-[#1A1C1E]">Flags</h3>
                <FlagsList flags={flags} />
              </div>
              <SupplierIntelligenceCard intel={intel} />
              <ConfidenceBreakdown doc={doc} />
              <DocumentRelationshipFlow doc={doc} />
              <MissingDocumentsCard insights={missing} />
              <ActivityTimeline doc={doc} />
              <RoutingCard docType={doc.document_type} documentId={doc.id} fedItemCount={fedItemCount} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

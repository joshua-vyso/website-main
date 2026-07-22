'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ConfidenceText, StatusPill } from '@/components/platform/ui';
import { ExtractionEditor } from '@/components/platform/ExtractionEditor';
import { OrderReviewEditor, type CustomerLite, type LinkedOrder } from './OrderReviewEditor';
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
  customers,
  linkedOrder,
  originalUrl,
  isImage,
}: {
  doc: DocumentWithSupplier;
  orgDocs: DocumentWithSupplier[];
  folders: DocumentFolder[];
  features: Record<FeatureKey, boolean>;
  fedItemCount: number;
  orgUnits: string[];
  customers: CustomerLite[];
  linkedOrder: LinkedOrder | null;
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
    <div className="flex flex-col rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#EEF1F5] px-6 py-5">
        <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Original document</h2>
        <span className="truncate text-[12px] text-[#A0A49C]">{doc.filename}</span>
      </div>
      <div className="p-4">
        {originalUrl ? (
          isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={originalUrl}
              alt="Original document"
              className="max-h-[calc(100vh-16rem)] w-full rounded-xl border border-[#EAEDF2] object-contain"
            />
          ) : (
            <iframe
              src={originalUrl}
              title="Original document"
              className="h-[calc(100vh-16rem)] min-h-[420px] w-full rounded-xl border border-[#EAEDF2]"
            />
          )
        ) : (
          <div className="flex min-h-[50vh] items-center justify-center rounded-xl border border-dashed border-[#EAEDF2] bg-[#F5F9FE]">
            <span className="text-[13px] text-[#8A8E86]">Preview unavailable</span>
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
            className="inline-flex h-[38px] shrink-0 items-center gap-1 rounded-full border border-[#E2E6EC] bg-white px-4 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
          >
            <span aria-hidden>‹</span> Documents
          </Link>
          <div className="min-w-0">
            <DocumentRename documentId={doc.id} filename={doc.filename} />
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-[#6B6F68]">{supplierName}</span>
              {autoMatched ? (
                <span className="inline-flex items-center rounded-full bg-[#E6F1FB] px-2.5 py-1 text-[11px] font-medium text-[#0C447C]">
                  auto-matched · <span className="of-num">{match.confidence}%</span>
                </span>
              ) : null}
              <span className="text-[#8A8E86]">·</span>
              <span className="text-[#6B6F68]">
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
        {doc.document_type === 'order' ? (
          <OrderReviewEditor
            documentId={doc.id}
            extractedData={extracted}
            customers={customers}
            linkedOrder={linkedOrder}
            orgUnits={orgUnits}
          />
        ) : (
          <ExtractionEditor
            id={doc.id}
            status={doc.status}
            fields={fields}
            lineItems={lineItems}
            extractedData={extracted}
            orgUnits={orgUnits}
          />
        )}
        <div className="lg:self-stretch">
          <div className="lg:sticky lg:top-6">{preview}</div>
        </div>
      </div>

      {/* Additional information — collapsed by default */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <button
          type="button"
          onClick={() => setShowMore((s) => !s)}
          className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-[#F5F9FE]"
          aria-expanded={showMore}
        >
          <span className="flex items-center gap-2">
            <span className="of-display text-[16px] font-semibold text-[#171A17]">Additional information</span>
            <span className="text-[12px] text-[#A0A49C]">
              Workflow, AI summary, flags, supplier intel & more
            </span>
          </span>
          <span
            className={`text-[#8A8E86] transition-transform ${showMore ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▾
          </span>
        </button>

        {showMore ? (
          <div className="border-t border-[#EEF1F5] p-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ApprovalActions documentId={doc.id} status={doc.status} />
              <AiSummaryCard documentId={doc.id} initialSummary={initialSummary} />
              {statementSummary ? <StatementTotalsCard summary={statementSummary} /> : null}
              <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
                <h3 className="of-display mb-3 text-[16px] font-semibold text-[#171A17]">Flags</h3>
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

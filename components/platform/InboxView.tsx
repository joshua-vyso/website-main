'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentStatsCards } from './docu/DocumentStatsCards';
import { DocumentFilters } from './docu/DocumentFilters';
import { DocumentTable } from './docu/DocumentTable';
import { UploadBubble } from './docu/UploadBubble';
import { DocuNav } from './docu/DocuNav';
import { applySearch, parseSearch, SEARCH_EXAMPLES } from '@/lib/platform/docu/search';
import { deriveFlags } from '@/lib/platform/docu/flags';
import type { DocumentFolder, DocumentType, DocumentWithSupplier } from '@/lib/platform/types';

/**
 * Doc-U inbox. Owns search / type-filter / folder-filter / sort state, an
 * in-place upload bubble, and live polling while documents are extracting.
 * Public signature adds `folders`; the awaiting / confidence / flagged routes
 * pass an empty folder list and keep working.
 */
export function InboxView({
  docs,
  folders = [],
  title,
  subtitle,
}: {
  docs: DocumentWithSupplier[];
  folders?: DocumentFolder[];
  title: string;
  subtitle: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<DocumentType | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [uploadOpen, setUploadOpen] = useState(false);

  // While any document is still extracting (status 'pending'), poll the server
  // component so rows flip from "Extracting…" to their result live. The budget
  // resets whenever the pending set changes (e.g. a new upload), and caps at
  // ~2 min so a permanently-stuck pending row can't poll forever.
  const pendingKey = docs
    .filter((d) => d.status === 'pending')
    .map((d) => d.id)
    .sort()
    .join(',');
  const pollsRef = useRef(0);
  useEffect(() => {
    if (!pendingKey) return;
    pollsRef.current = 0;
    const iv = setInterval(() => {
      pollsRef.current += 1;
      if (pollsRef.current > 40) {
        clearInterval(iv);
        return;
      }
      router.refresh();
    }, 3000);
    return () => clearInterval(iv);
  }, [pendingKey, router]);

  const rows = useMemo(() => {
    const parsed = parseSearch(search);
    let result = applySearch(docs, parsed);
    if (activeType) result = result.filter((d) => d.document_type === activeType);
    if (activeFolderId) result = result.filter((d) => d.folder_id === activeFolderId);
    if (parsed.flag) {
      result = result.filter((d) => deriveFlags(d, docs).some((f) => f.kind === parsed.flag));
    }
    return [...result].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });
  }, [docs, search, activeType, activeFolderId, sortDir]);

  return (
    <div className="px-8 py-7">
      <DocuNav />

      {/* Header */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-[12rem] flex-1">
          <h1 className="text-[26px] font-bold leading-tight text-[#1A1C1E]">{title}</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Try: ${SEARCH_EXAMPLES[0]}`}
            aria-label="Search documents"
            className="h-10 w-72 rounded-xl border border-[#E7E7E2] bg-white px-4 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none"
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => setUploadOpen((o) => !o)}
              className="inline-flex h-10 shrink-0 items-center rounded-xl bg-[#D9730D] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#C2650B]"
            >
              Upload document
            </button>
            {uploadOpen ? <UploadBubble onClose={() => setUploadOpen(false)} /> : null}
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="mt-6">
        <DocumentStatsCards docs={docs} />
      </div>

      {/* Table or new-user empty state */}
      {docs.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#E7E7E2] bg-white px-8 py-14 text-center">
          <h2 className="text-[18px] font-semibold text-[#1A1C1E]">No documents yet</h2>
          <p className="mx-auto mt-1 max-w-md text-[14px] text-[#5F6368]">
            Upload your first document and Doc-U will extract the details automatically. Your
            stats above will fill in as documents come through.
          </p>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="mt-5 inline-flex h-10 items-center rounded-xl bg-[#D9730D] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#C2650B]"
          >
            Upload your first document
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <DocumentFilters
              docs={docs}
              folders={folders}
              activeType={activeType}
              onTypeChange={setActiveType}
              activeFolderId={activeFolderId}
              onFolderChange={setActiveFolderId}
              sortDir={sortDir}
              onSortToggle={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            />
          </div>
          <div className="mt-4">
            {rows.length === 0 && search.trim() ? (
              <div className="rounded-2xl border border-[#E7E7E2] bg-white px-6 py-12 text-center">
                <p className="text-[14px] text-[#5F6368]">No documents match “{search}”.</p>
                <p className="mt-1 text-[13px] text-[#9A9DA1]">
                  Try: {SEARCH_EXAMPLES.slice(1).join(' · ')}
                </p>
              </div>
            ) : (
              <DocumentTable rows={rows} allDocs={docs} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DocuNav } from './DocuNav';
import { DocumentStatsCards } from './DocumentStatsCards';
import { UploadBubble } from './UploadBubble';
import { NewFolderButton } from './NewFolderButton';
import { FolderCardMenu } from './FolderCardMenu';
import { buildFolderTiles, type FolderTile } from '@/lib/platform/docu/folders';
import type { DocumentFolder, DocumentWithSupplier } from '@/lib/platform/types';

type View = 'grid' | 'list';
const VIEW_KEY = 'docu-folder-view';

function FolderIcon({ color }: { color: string }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
      style={{ backgroundColor: `${color}1A` }}
      aria-hidden
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 7a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.4.6L11.4 7H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
          fill={color}
          fillOpacity="0.9"
        />
      </svg>
    </span>
  );
}

/**
 * The Doc-U Documents hub: a grid (or list) of folders — All, the default
 * document-type folders, and any custom folders the org has created. Each opens
 * the month-organised document list scoped to that folder.
 */
export function FolderGridView({
  docs,
  folders,
}: {
  docs: DocumentWithSupplier[];
  folders: DocumentFolder[];
}) {
  const [view, setView] = useState<View>('grid');
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === 'grid' || saved === 'list') setView(saved);
  }, []);
  const pickView = (v: View) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  const tiles = buildFolderTiles(docs, folders);

  return (
    <div className="px-8 py-7">
      <DocuNav />

      {/* Header */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-[12rem] flex-1">
          <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Documents</h1>
          <p className="mt-1.5 text-[14px] text-[#8A8E86]">
            Browse by folder — open one to see its documents by month
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {/* View toggle */}
          <div className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white p-0.5">
            <button
              type="button"
              onClick={() => pickView('grid')}
              aria-pressed={view === 'grid'}
              aria-label="Grid view"
              className={`flex h-[38px] w-[38px] items-center justify-center rounded-[9px] transition-colors ${
                view === 'grid' ? 'bg-[#1F5FA8] text-white' : 'text-[#6B6F68] hover:bg-[#EAF2FC] hover:text-[#174C87]'
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <rect x="1" y="1" width="6" height="6" rx="1.5" />
                <rect x="9" y="1" width="6" height="6" rx="1.5" />
                <rect x="1" y="9" width="6" height="6" rx="1.5" />
                <rect x="9" y="9" width="6" height="6" rx="1.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => pickView('list')}
              aria-pressed={view === 'list'}
              aria-label="List view"
              className={`flex h-[38px] w-[38px] items-center justify-center rounded-[9px] transition-colors ${
                view === 'list' ? 'bg-[#1F5FA8] text-white' : 'text-[#6B6F68] hover:bg-[#EAF2FC] hover:text-[#174C87]'
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                <path d="M2 4h12M2 8h12M2 12h12" />
              </svg>
            </button>
          </div>
          <NewFolderButton />
          <div className="relative">
            <button
              type="button"
              onClick={() => setUploadOpen((o) => !o)}
              className="inline-flex h-[42px] shrink-0 items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]"
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

      {/* Folders */}
      {view === 'grid' ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <FolderCard key={t.key} tile={t} />
          ))}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          {tiles.map((t, i) => (
            <FolderRow key={t.key} tile={t} first={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderCard({ tile }: { tile: FolderTile }) {
  return (
    <div className="group relative flex flex-col gap-4 rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-colors hover:border-[#3E7BC4]/30 hover:bg-[#F5F9FE]">
      <Link
        href={`/app/docu/folder/${tile.key}`}
        aria-label={`Open ${tile.name}`}
        className="absolute inset-0 z-0 rounded-2xl"
      />
      <div className="pointer-events-none relative z-10 flex items-start justify-between">
        <FolderIcon color={tile.color} />
        <span className="flex items-center gap-1">
          <span className="of-num text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{tile.count}</span>
          {tile.kind === 'custom' ? (
            <span className="pointer-events-auto">
              <FolderCardMenu folderId={tile.key} name={tile.name} color={tile.color} />
            </span>
          ) : null}
        </span>
      </div>
      <div className="pointer-events-none relative z-10 min-w-0">
        <p className="of-display truncate text-[15px] font-semibold text-[#171A17]">{tile.name}</p>
        <p className="mt-0.5 text-[12px] text-[#A0A49C]">
          <span className="of-num">{tile.count}</span> document{tile.count === 1 ? '' : 's'}
          {tile.kind === 'custom' ? ' · custom folder' : ''}
        </p>
      </div>
    </div>
  );
}

function FolderRow({ tile, first }: { tile: FolderTile; first: boolean }) {
  return (
    <div
      className={`group relative flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#F5F9FE] ${
        first ? '' : 'border-t border-[#EEF1F5]'
      }`}
    >
      <Link href={`/app/docu/folder/${tile.key}`} aria-label={`Open ${tile.name}`} className="absolute inset-0 z-0" />
      <span className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-3">
        <FolderIcon color={tile.color} />
        <span className="min-w-0">
          <span className="of-display block truncate text-[14px] font-semibold text-[#171A17]">{tile.name}</span>
          <span className="block text-[12px] text-[#A0A49C]">
            {tile.kind === 'custom' ? 'Custom folder' : tile.kind === 'all' ? 'Everything in Doc-U' : 'Default folder'}
          </span>
        </span>
      </span>
      <span className="of-num pointer-events-none relative z-10 text-[14px] font-semibold text-[#171A17]">{tile.count}</span>
      {tile.kind === 'custom' ? (
        <span className="pointer-events-auto relative z-10">
          <FolderCardMenu folderId={tile.key} name={tile.name} color={tile.color} />
        </span>
      ) : (
        <span className="relative z-10 text-[#BFC5CC]" aria-hidden>›</span>
      )}
    </div>
  );
}

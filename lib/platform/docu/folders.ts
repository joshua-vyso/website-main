/**
 * Folder model for the Doc-U landing grid. A document's folder is its custom
 * `folder_id` filing when set, OR — as a default — its document_type bucket
 * (Invoices, Statements, …). The grid shows an "All" tile, one tile per default
 * document type, and a tile per custom folder the org has created.
 */
import { DOC_TYPES, isDefaultFolderName } from '@/lib/platform/documents';
import type { DocumentFolder, DocumentType, DocumentWithSupplier } from '@/lib/platform/types';

/** Palette offered when creating or recolouring a custom folder. */
export const FOLDER_COLORS: readonly string[] = [
  '#1E5E54', // teal
  '#0C447C', // blue
  '#0F6E56', // green
  '#854F0B', // amber
  '#5B4FD6', // indigo
  '#C0345A', // rose
  '#B5651D', // clay
  '#5F6368', // slate
];

export type FolderKind = 'all' | 'default' | 'custom';

export interface FolderTile {
  /** Route key: 'all', a DocumentType, or a custom folder UUID. */
  key: string;
  name: string;
  color: string;
  count: number;
  kind: FolderKind;
}

/** Build the ordered tiles for the folder grid: All → default types → custom. */
export function buildFolderTiles(
  docs: DocumentWithSupplier[],
  folders: DocumentFolder[],
): FolderTile[] {
  const tiles: FolderTile[] = [
    { key: 'all', name: 'All documents', color: '#1E5E54', count: docs.length, kind: 'all' },
  ];

  for (const t of DOC_TYPES) {
    if (t.key === null) continue;
    tiles.push({
      key: t.key,
      name: t.label,
      color: t.iconBg,
      count: docs.filter((d) => d.document_type === t.key).length,
      kind: 'default',
    });
  }

  // Custom folders only — default-named folder rows (created when filing into a
  // default category) are represented by the type tiles above, not duplicated.
  for (const f of folders.filter((f) => !isDefaultFolderName(f.name))) {
    tiles.push({
      key: f.id,
      name: f.name,
      color: f.color ?? '#C9CCC8',
      count: docs.filter((d) => d.folder_id === f.id).length,
      kind: 'custom',
    });
  }

  return tiles;
}

export interface ResolvedFolder {
  title: string;
  /** Filter by document_type (default folders), else null. */
  type: DocumentType | null;
  /** Filter by folder_id (custom folders), else null. */
  folderId: string | null;
  /** False when the key matches no known type or folder. */
  valid: boolean;
}

/** Resolve a folder route key into a title + the predicate to scope documents. */
export function resolveFolderKey(key: string, folders: DocumentFolder[]): ResolvedFolder {
  if (key === 'all') return { title: 'All documents', type: null, folderId: null, valid: true };

  const docType = DOC_TYPES.find((t) => t.key === key);
  if (docType && docType.key) {
    return { title: docType.label, type: docType.key, folderId: null, valid: true };
  }

  const folder = folders.find((f) => f.id === key);
  if (folder) return { title: folder.name, type: null, folderId: folder.id, valid: true };

  return { title: 'Folder', type: null, folderId: null, valid: false };
}

/** Scope the org's documents to a resolved folder. */
export function scopeDocsToFolder(
  docs: DocumentWithSupplier[],
  resolved: ResolvedFolder,
): DocumentWithSupplier[] {
  if (resolved.type) return docs.filter((d) => d.document_type === resolved.type);
  if (resolved.folderId) return docs.filter((d) => d.folder_id === resolved.folderId);
  return docs;
}

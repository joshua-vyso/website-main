/**
 * Vyso design tokens — sampled from the Figma "Vyso tokens" variable collection
 * (file atJsUrf10rEPEinSqe62EC). Raw hex values usable by both web (CSS) and
 * mobile (React Native). Mirrored into each app's lib folder.
 */
import type { DocumentStatus } from './types';

export const VYSO = {
  /** App canvas background. */
  page: '#F6F6F4',
  /** Card / surface background. */
  surface: '#FFFFFF',
  /** Hairline borders. */
  border: '#E7E7E2',
  /** Primary text. */
  textPrimary: '#1A1C1E',
  /** Secondary text. */
  textSecondary: '#5F6368',
  /** Muted / placeholder text. */
  muted: '#9A9DA1',
  /** Brand accent (blue). */
  accent: '#3E7BC4',
  /** Weak blue tint (selected nav, avatars, accent wells). */
  accentWeak: '#EAF2FC',
  /** Primary CTA / Upload — burnt orange (btn/Upload fill). */
  orange: '#D9730D',
} as const;

/** Status pill background/foreground pairs. Keyed by `documents.status`. */
export const STATUS_COLORS: Record<DocumentStatus, { bg: string; fg: string }> = {
  pending: { bg: '#FBEEDA', fg: '#854F0B' },
  extracted: { bg: '#E6F1FB', fg: '#0C447C' },
  reviewed: { bg: '#E1F5EE', fg: '#0F6E56' },
  error: { bg: '#FCEBEB', fg: '#A32D2D' },
  approved: { bg: '#E1F5EE', fg: '#0F6E56' },
  rejected: { bg: '#FCEBEB', fg: '#A32D2D' },
  archived: { bg: '#F0F0EC', fg: '#5F6368' },
};

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: 'Pending',
  extracted: 'Extracted',
  reviewed: 'Reviewed',
  error: 'Error',
  approved: 'Approved',
  rejected: 'Rejected',
  archived: 'Archived',
};

/** Per-field extraction confidence below this is flagged amber ("check"). */
export const FIELD_REVIEW_THRESHOLD = 90;

/** Document-level confidence below this counts a document as low-confidence. */
export const DOC_LOW_CONFIDENCE_THRESHOLD = 80;

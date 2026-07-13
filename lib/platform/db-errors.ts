/**
 * Postgres error helpers shared across the platform.
 *
 * Once the (org_id, lower(name)) unique indexes exist (supabase/dedup-unique-indexes.sql),
 * a duplicate-name insert fails with SQLSTATE 23505 instead of silently creating a
 * second row. Find-or-create paths re-select the winner on conflict; user-facing
 * add/import paths turn it into a friendly "already exists" message.
 */

type MaybePgError = { code?: string | null; message?: string | null } | null | undefined;

/** True when an insert failed a unique constraint / index (duplicate row). */
export function isUniqueViolation(error: MaybePgError): boolean {
  if (!error) return false;
  if (error.code === '23505') return true;
  const msg = error.message ?? '';
  return /duplicate key|unique constraint|already exists|23505/i.test(msg);
}

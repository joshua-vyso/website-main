import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import type { Supplier } from '@/lib/platform/types';

/** Avatar tints rotated across the directory (sampled from the platform palette). */
const AVATAR_TINTS: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: '#E9EFEC', fg: '#1E5E54' },
  { bg: '#E6F1FB', fg: '#0C447C' },
  { bg: '#FBEEDA', fg: '#854F0B' },
  { bg: '#ECEAFB', fg: '#5B4FD6' },
  { bg: '#FBE7EC', fg: '#C0345A' },
];

/** Derive up-to-two-letter initials from a stored value or the supplier name. */
function supplierInitials(supplier: Pick<Supplier, 'name' | 'initials'>): string {
  if (supplier.initials && supplier.initials.trim().length > 0) {
    return supplier.initials.trim().slice(0, 2).toUpperCase();
  }
  const words = supplier.name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default async function SuppliersPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const orgId = session.org?.id ?? '';
  const supabase = await createServerSupabase();

  const [{ data: supplierRows }, { data: documentRows }] = await Promise.all([
    supabase.from('suppliers').select('*').eq('org_id', orgId).order('name'),
    supabase.from('documents').select('supplier_id').eq('org_id', orgId),
  ]);

  const suppliers = (supplierRows ?? []) as Supplier[];
  const documents = (documentRows ?? []) as Array<{ supplier_id: string | null }>;

  const docCounts = new Map<string, number>();
  for (const doc of documents) {
    if (doc.supplier_id) {
      docCounts.set(doc.supplier_id, (docCounts.get(doc.supplier_id) ?? 0) + 1);
    }
  }

  return (
    <div className="px-8 py-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight text-[#1A1C1E]">Suppliers</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">
            {suppliers.length} {suppliers.length === 1 ? 'supplier' : 'suppliers'}
          </p>
        </div>
      </div>

      {/* Directory card */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_140px_1fr] items-center border-b border-[#E7E7E2] px-6 py-3 text-[12px] text-[#5F6368]">
          <span>Supplier</span>
          <span>Documents</span>
          <span>Location</span>
        </div>

        {/* Rows */}
        {suppliers.length === 0 ? (
          <div className="px-6 py-10 text-center text-[14px] text-[#9A9DA1]">No suppliers yet.</div>
        ) : (
          suppliers.map((supplier, index) => {
            const tint = AVATAR_TINTS[index % AVATAR_TINTS.length];
            const count = docCounts.get(supplier.id) ?? 0;
            return (
              <div
                key={supplier.id}
                className="grid grid-cols-[1fr_140px_1fr] items-center border-b border-[#F0F0EC] px-6 py-3.5 text-[14px] transition-colors last:border-b-0 hover:bg-[#FAFAF8]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                    style={{ backgroundColor: tint.bg, color: tint.fg }}
                    aria-hidden
                  >
                    {supplierInitials(supplier)}
                  </span>
                  <span className="truncate font-medium text-[#1A1C1E]">{supplier.name}</span>
                </div>
                <span className="text-[#5F6368]">
                  {count} {count === 1 ? 'document' : 'documents'}
                </span>
                <span className="truncate text-[#5F6368]">{supplier.location ?? '—'}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { IMPORT_ENTITIES, type ImportEntity } from '@/lib/platform/import-schema';
import { ImportWizard } from '@/components/platform/coredata/ImportWizard';

/**
 * Excel / CSV import wizard — a full-page multi-step flow that turns a
 * QuickBooks or Excel export into Core Data rows. Data is only committed on the
 * final Confirm step; nothing writes before that. The wizard fetches the
 * existing names itself (for dedupe), so no data fetch is needed here.
 */
export default async function ImportPage(ctx: { searchParams: Promise<{ entity?: string }> }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const { entity } = await ctx.searchParams;
  const initialEntity: ImportEntity = entity === 'products' ? 'products' : 'customers';

  return (
    <div className="px-8 py-7">
      <Link
        href="/app/docu/databases"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5F6368] transition-colors hover:text-[#1A1C1E]"
      >
        <span aria-hidden>&larr;</span> Databases
      </Link>

      <div className="mt-3">
        <h1 className="text-[26px] font-bold leading-tight text-[#1A1C1E]">Import Excel / CSV</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-[#5F6368]">
          Upload a QuickBooks or Excel export, tidy it in the grid, map the columns to your{' '}
          {IMPORT_ENTITIES[initialEntity].label.toLowerCase()} fields, then confirm. Nothing is saved until you confirm.
        </p>
      </div>

      <div className="mt-6">
        <ImportWizard initialEntity={initialEntity} />
      </div>
    </div>
  );
}

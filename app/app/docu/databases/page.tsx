import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { DocuNav } from '@/components/platform/docu/DocuNav';
import { getCoreData, EMPTY_CORE_DATA, type CoreData } from '@/lib/platform/coredata-data';
import { DB_ENTITIES, type DbEntityKey } from '@/lib/platform/coredata';

/** Row count shown on each Databases card. */
function countFor(key: DbEntityKey, data: CoreData): number {
  switch (key) {
    case 'customers':
      return data.customers.length;
    case 'contacts':
      return data.contacts.length;
    case 'addresses':
      return data.addresses.length;
    case 'products':
      return data.products.length;
    case 'price-lists':
      return data.priceLists.length;
    case 'payment-terms':
      return data.paymentTerms.length;
    case 'vat':
      return data.vatRates.length;
    case 'company':
      return data.companyProfile ? 1 : 0;
    case 'templates':
      return data.templates.length;
    default:
      return 0;
  }
}

/**
 * Doc-U → Databases: the governance interface for Core Data — the shared
 * operational records (customers, products, price lists, company profile…) that
 * OrderFlow and every other module read from and write back to. Each card opens
 * the full management view for one entity.
 */
export default async function DatabasesIndexPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const orgId = session.org?.id ?? '';
  const data = orgId ? await getCoreData(orgId) : EMPTY_CORE_DATA;

  return (
    <div className="px-8 py-7">
      <DocuNav />

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Databases</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] text-[#8A8E86]">
            Your Core Data — the single source of truth behind every document. Manage it here and it flows straight
            through to OrderFlow invoices, quotes, orders and delivery notes.
          </p>
        </div>
        <Link
          href="/app/docu/databases/import"
          className="inline-flex h-[42px] shrink-0 items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]"
        >
          Import Excel / CSV
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DB_ENTITIES.map((e) => {
          const count = countFor(e.key, data);
          return (
            <Link
              key={e.key}
              href={`/app/docu/databases/${e.key}`}
              className="group flex flex-col rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-colors hover:border-[#3E7BC4]/40 hover:bg-[#F5F9FE]"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="of-display text-[16px] font-semibold text-[#171A17] transition-colors group-hover:text-[#174C87]">
                  {e.label}
                </h2>
                <span className="of-num shrink-0 text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{count}</span>
              </div>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[#6B6F68]">{e.description}</p>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#EEF1F5] pt-3">
                <code className="truncate font-mono text-[11px] text-[#A0A49C]">{e.tables}</code>
                {e.csv ? (
                  <span className="shrink-0 rounded-full bg-[#EEF1F5] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-[#6B6F68]">
                    CSV
                  </span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getCoreData, EMPTY_CORE_DATA, type CoreData } from '@/lib/platform/coredata-data';
import { DB_ENTITY_BY_KEY } from '@/lib/platform/coredata';
import { CustomersDb } from '@/components/platform/coredata/CustomersDb';
import { ContactsDb } from '@/components/platform/coredata/ContactsDb';
import { AddressesDb } from '@/components/platform/coredata/AddressesDb';
// Views owned by concurrent agents — uniform { data }: { data: CoreData } signature.
import { ProductsDb } from '@/components/platform/coredata/ProductsDb';
import { PriceListsDb } from '@/components/platform/coredata/PriceListsDb';
import { PaymentTermsDb } from '@/components/platform/coredata/PaymentTermsDb';
import { VatDb } from '@/components/platform/coredata/VatDb';
import { CompanyProfileDb } from '@/components/platform/coredata/CompanyProfileDb';
import { TemplatesDb } from '@/components/platform/coredata/TemplatesDb';

function renderView(key: string, data: CoreData) {
  switch (key) {
    case 'customers':
      return <CustomersDb data={data} />;
    case 'contacts':
      return <ContactsDb data={data} />;
    case 'addresses':
      return <AddressesDb data={data} />;
    case 'products':
      return <ProductsDb data={data} />;
    case 'price-lists':
      return <PriceListsDb data={data} />;
    case 'payment-terms':
      return <PaymentTermsDb data={data} />;
    case 'vat':
      return <VatDb data={data} />;
    case 'company':
      return <CompanyProfileDb data={data} />;
    case 'templates':
      return <TemplatesDb data={data} />;
    default:
      return null;
  }
}

/**
 * A single Core Data database view. Looks up the entity in the DB_ENTITIES
 * registry, server-fetches all Core Data once, and renders the matching *Db
 * management view. Unknown keys 404.
 */
export default async function DatabaseEntityPage(ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  const meta = DB_ENTITY_BY_KEY[entity];
  if (!meta) notFound();

  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const orgId = session.org?.id ?? '';
  const data = orgId ? await getCoreData(orgId) : EMPTY_CORE_DATA;

  return (
    <div className="px-8 py-7">
      <Link
        href="/app/docu/databases"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5F6368] transition-colors hover:text-[#1A1C1E]"
      >
        <span aria-hidden>&larr;</span> Databases
      </Link>

      <div className="mt-3">
        <h1 className="text-[26px] font-bold leading-tight text-[#1A1C1E]">{meta.label}</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-[#5F6368]">{meta.description}</p>
      </div>

      <div className="mt-6">{renderView(entity, data)}</div>
    </div>
  );
}

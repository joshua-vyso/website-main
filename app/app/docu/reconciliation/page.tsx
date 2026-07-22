import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { ReconciliationView } from '@/components/platform/docu/ReconciliationView';
import type { DocumentWithSupplier } from '@/lib/platform/types';

export default async function DocuReconciliationPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  if (!session.features.docu) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-8 py-7">
        <div className="max-w-sm rounded-2xl border border-[#EAEDF2] bg-white px-8 py-10 text-center shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <h1 className="of-display text-[18px] font-semibold text-[#171A17]">Doc-U is not enabled for your plan</h1>
          <p className="mt-2 text-[14px] text-[#6B6F68]">
            Contact your administrator to add Doc-U to your subscription.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('documents')
    .select('*, supplier:suppliers(id,name,initials)')
    .eq('org_id', session.org?.id ?? '')
    .eq('document_type', 'statement')
    .order('created_at', { ascending: false });

  const statements = (data ?? []) as DocumentWithSupplier[];

  return <ReconciliationView statements={statements} />;
}

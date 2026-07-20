import { redirect } from 'next/navigation';
import { LeadsView } from '@/components/platform/serviceden/LeadsView';
import { getServiceDenLeadPageData } from '@/lib/platform/serviceden-leads-data';
import { SERVICEDEN_ACCOUNT_EMAIL } from '@/lib/platform/serviceden';
import { getPlatformSession } from '@/lib/platform/supabase-server';

export default async function ServiceDenLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail_connected?: string; gmail_error?: string }>;
}) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  if (!session.org || session.email.toLowerCase() !== SERVICEDEN_ACCOUNT_EMAIL) redirect('/app');

  const [data, query] = await Promise.all([
    getServiceDenLeadPageData(session.org.id, session.userId),
    searchParams,
  ]);

  return (
    <LeadsView
      initialData={data}
      orgId={session.org.id}
      userId={session.userId}
      notice={query.gmail_connected ? `Connected ${query.gmail_connected}` : null}
      initialError={query.gmail_error ?? null}
    />
  );
}

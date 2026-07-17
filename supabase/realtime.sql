-- ============================================================================
-- Enable Supabase Realtime on the tables the app now subscribes to, so the UI
-- updates live (a forwarded document, a new enquiry, a new order) with no manual
-- refresh. Paste into the Supabase SQL editor.
--
-- Realtime ENFORCES RLS: the browser only receives change events for rows the
-- signed-in user could SELECT, so this stays strictly org-scoped (it fails
-- closed — a missing SELECT policy means no events, never cross-tenant leakage).
-- Every table below already has an org-scoped RLS policy (verified live).
--
-- Idempotent: `add table` errors if the table is already in the publication, so
-- each is guarded. Safe to run more than once.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'documents',          -- Doc-U list + the review queue (the main one)
    'email_ingests',      -- Settings "Recent mail"
    'of_quote_requests',  -- website enquiries on the Quotes page
    'of_orders',          -- OrderFlow orders list
    'of_invoices'         -- OrderFlow invoices list
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

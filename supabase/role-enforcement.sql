-- ============================================================================
-- ROLE ENFORCEMENT on the OrderFlow financial tables (SEC-03).
--
-- Today every of_* policy is `FOR ALL` on org membership with NO role check, so
-- a 'member' (e.g. orders@turnnslice.com) can read, alter or DELETE the money
-- ledger — record fake payments, issue credit notes, cancel invoices, rewrite
-- numbering/VAT — straight through the Supabase Data API, bypassing every UI gate.
--
-- This locks the finance WRITES to owner/admin while leaving operational work
-- (orders, quotes, delivery notes, numbering, activity logging, order→invoice
-- creation) fully open to members.
--
-- Paste into the Supabase SQL editor. Idempotent. Deploy the matching UI guards
-- (which hide the now-admin-only buttons) BEFORE running this, so members never
-- click a button that would then hit an RLS error.
--
-- Design notes / why each table is where it is:
--   * SELECT stays org-wide on EVERYTHING. Restricting member SELECT silently
--     corrupts derived state — payment totals collapse to 0, every invoice reads
--     as unpaid — because status/balance are computed from these rows even when
--     the currency figure is visually redacted. Hiding money *values* from the
--     API is a separate, larger server-redaction change; this migration only
--     stops member TAMPERING, which is the high-severity half.
--   * Group A (orders/quotes/delivery notes/activity) is left untouched — members
--     must write these, and of_activity is the audit trail of member actions.
-- ============================================================================


-- ── Step 0 (PREREQUISITE): decouple member numbering from of_settings writes ──
-- of_next_number bumps of_settings counters, and it runs `security invoker`, so
-- once of_settings writes are admin-only a MEMBER minting a quote/order number
-- would be blocked and numbering would silently break. Make it `security definer`
-- so it runs as the function owner; it already derives the org from auth.uid()
-- internally, so it stays strictly org-scoped. (Body unchanged.)
create or replace function of_next_number(p_kind text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_prefix text;
  v_n int;
  v_pad int;
begin
  select p.org_id into v_org from profiles p where p.id = auth.uid();
  if v_org is null then
    raise exception 'no organisation for current user';
  end if;
  insert into of_settings (org_id) values (v_org) on conflict (org_id) do nothing;

  if p_kind = 'invoice' then
    update of_settings set invoice_next = invoice_next + 1, updated_at = now()
      where org_id = v_org returning invoice_prefix, invoice_next - 1, number_pad into v_prefix, v_n, v_pad;
  elsif p_kind = 'quote' then
    update of_settings set quote_next = quote_next + 1, updated_at = now()
      where org_id = v_org returning quote_prefix, quote_next - 1, number_pad into v_prefix, v_n, v_pad;
  elsif p_kind = 'order' then
    update of_settings set order_next = order_next + 1, updated_at = now()
      where org_id = v_org returning order_prefix, order_next - 1, number_pad into v_prefix, v_n, v_pad;
  elsif p_kind = 'credit_note' then
    update of_settings set credit_next = credit_next + 1, updated_at = now()
      where org_id = v_org returning credit_prefix, credit_next - 1, number_pad into v_prefix, v_n, v_pad;
  elsif p_kind = 'delivery_note' then
    update of_settings set dn_next = dn_next + 1, updated_at = now()
      where org_id = v_org returning dn_prefix, dn_next - 1, number_pad into v_prefix, v_n, v_pad;
  else
    raise exception 'unknown numbering kind: %', p_kind;
  end if;

  return v_prefix || lpad(v_n::text, greatest(v_pad, length(v_n::text)), '0');
end;
$$;


-- Reusable predicates (as inline SQL, since Postgres policies can't call a helper
-- cheaply): org membership, and owner/admin within the org.
--   org:        org_id = (select p.org_id from profiles p where p.id = auth.uid())
--   admin role: (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')


-- ── GROUP B — pure finance/config: SELECT = member, WRITE = owner/admin ──────
-- of_payments, of_credit_notes, of_credit_note_items, of_settings.

drop policy if exists of_payments_all          on of_payments;
drop policy if exists of_payments_select        on of_payments;
drop policy if exists of_payments_write          on of_payments;
create policy of_payments_select on of_payments for select
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_payments_write on of_payments for all
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')
  )
  with check (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')
  );

drop policy if exists of_credit_notes_all       on of_credit_notes;
drop policy if exists of_credit_notes_select     on of_credit_notes;
drop policy if exists of_credit_notes_write       on of_credit_notes;
create policy of_credit_notes_select on of_credit_notes for select
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_credit_notes_write on of_credit_notes for all
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')
  )
  with check (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')
  );

drop policy if exists of_credit_note_items_all  on of_credit_note_items;
drop policy if exists of_credit_note_items_select on of_credit_note_items;
drop policy if exists of_credit_note_items_write   on of_credit_note_items;
create policy of_credit_note_items_select on of_credit_note_items for select
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_credit_note_items_write on of_credit_note_items for all
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')
  )
  with check (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')
  );

drop policy if exists of_settings_all           on of_settings;
drop policy if exists of_settings_select         on of_settings;
drop policy if exists of_settings_write           on of_settings;
create policy of_settings_select on of_settings for select
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_settings_write on of_settings for all
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')
  )
  with check (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')
  );


-- ── GROUP C — invoices: members may CREATE, only owner/admin may EDIT/DELETE ──
-- Members legitimately turn an order into an invoice (and the Doc-U auto-invoice
-- runs under member RLS), so INSERT stays open. Tampering = altering amounts,
-- marking paid/sent/cancelled, or deleting — those are UPDATE/DELETE, locked to
-- owner/admin.

drop policy if exists of_invoices_all           on of_invoices;
drop policy if exists of_invoices_select         on of_invoices;
drop policy if exists of_invoices_insert         on of_invoices;
drop policy if exists of_invoices_update         on of_invoices;
drop policy if exists of_invoices_delete         on of_invoices;
create policy of_invoices_select on of_invoices for select
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_invoices_insert on of_invoices for insert
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_invoices_update on of_invoices for update
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')
  )
  with check (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')
  );
create policy of_invoices_delete on of_invoices for delete
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')
  );

drop policy if exists of_invoice_items_all      on of_invoice_items;
drop policy if exists of_invoice_items_select    on of_invoice_items;
drop policy if exists of_invoice_items_insert    on of_invoice_items;
drop policy if exists of_invoice_items_update    on of_invoice_items;
drop policy if exists of_invoice_items_delete    on of_invoice_items;
create policy of_invoice_items_select on of_invoice_items for select
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_invoice_items_insert on of_invoice_items for insert
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_invoice_items_update on of_invoice_items for update
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')
  )
  with check (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')
  );
create policy of_invoice_items_delete on of_invoice_items for delete
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner','admin')
  );

-- Group A (of_orders, of_order_items, of_quotes, of_quote_items,
-- of_delivery_notes, of_delivery_note_items, of_activity) is deliberately left as
-- the membership-only `_all` policy — members must write these.

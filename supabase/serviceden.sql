-- ServiceDen — a lightweight module for SERVICE businesses (customers, custom
-- services, and invoices you build from those services and export to PDF).
-- Org-scoped RLS, same shape as the of_*/ss_* tables. Idempotent — safe to
-- re-run. Paste into the Supabase SQL editor.
--
-- Access to the module UI is gated in-app to a single account (joshua@vyso.co.za),
-- but the tables are ordinary org-scoped tables so the data lives under the
-- Vyso organisation like everything else.

create table if not exists sd_customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sd_customers_org on sd_customers (org_id, name);

create table if not exists sd_services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  description text,
  -- how the service is billed: hour | day | fixed | project | month | unit
  unit text not null default 'fixed',
  unit_price numeric not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_sd_services_org on sd_services (org_id, sort_order);

create table if not exists sd_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  customer_id uuid references sd_customers(id) on delete set null,
  invoice_number text not null,
  -- draft | sent | paid
  status text not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  -- VAT / tax percentage applied to the subtotal
  tax_rate numeric not null default 15,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sd_invoices_org on sd_invoices (org_id, created_at desc);

create table if not exists sd_invoice_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  invoice_id uuid not null references sd_invoices(id) on delete cascade,
  -- the service this line came from (nullable — kept for reference only; the
  -- description/price below are a SNAPSHOT so editing a service later never
  -- rewrites a past invoice)
  service_id uuid references sd_services(id) on delete set null,
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_sd_invoice_items_invoice on sd_invoice_items (invoice_id, sort_order);
create index if not exists idx_sd_invoice_items_org on sd_invoice_items (org_id);

-- Row level security (org-scoped, same pattern as of_*/ss_*).
alter table sd_customers     enable row level security;
alter table sd_services      enable row level security;
alter table sd_invoices      enable row level security;
alter table sd_invoice_items enable row level security;

drop policy if exists sd_customers_all     on sd_customers;
drop policy if exists sd_services_all       on sd_services;
drop policy if exists sd_invoices_all        on sd_invoices;
drop policy if exists sd_invoice_items_all    on sd_invoice_items;

create policy sd_customers_all on sd_customers for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy sd_services_all on sd_services for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy sd_invoices_all on sd_invoices for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy sd_invoice_items_all on sd_invoice_items for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Business settings (one row per org): the "from" details + banking info shown
-- on invoices, and a logo (stored as a base64 data URL so it renders straight
-- into the invoice / PDF with no storage bucket or signed-URL plumbing).
-- Re-run this file to add the table if you created the others earlier.
-- ---------------------------------------------------------------------------
create table if not exists sd_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references organisations(id) on delete cascade,
  business_name text,
  business_email text,
  business_phone text,
  business_address text,
  vat_number text,
  bank_name text,
  account_name text,
  account_number text,
  branch_code text,
  swift text,
  payment_reference text,
  logo_data text,
  updated_at timestamptz not null default now()
);

alter table sd_settings enable row level security;
drop policy if exists sd_settings_all on sd_settings;
create policy sd_settings_all on sd_settings for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Leads + Gmail inbox connection
--
-- ServiceDen is intentionally private to joshua@vyso.co.za. Unlike the older
-- ServiceDen tables above, these policies enforce BOTH organisation membership
-- and an explicit immutable user-id access grant because mailbox data is
-- materially more sensitive than invoices. Gmail credentials are split into a
-- server-only table with no authenticated-client policy at all.
-- ---------------------------------------------------------------------------

create table if not exists sd_access_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references organisations(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

-- Seed the one current ServiceDen account without hard-coding an installation-
-- specific UUID. Future access is granted deliberately by inserting another row.
insert into sd_access_grants (user_id, org_id, enabled)
select u.id, p.org_id, true
from auth.users u
join profiles p on p.id = u.id
where lower(coalesce(u.email, '')) = 'joshua@vyso.co.za'
  and p.org_id is not null
on conflict (user_id, org_id) do update set enabled = excluded.enabled;

alter table sd_access_grants enable row level security;
drop policy if exists sd_access_grants_self_read on sd_access_grants;
create policy sd_access_grants_self_read on sd_access_grants for select
  using (user_id = auth.uid());

-- Tighten the original ServiceDen tables as part of the same ServiceDen-only
-- migration. The layout email gate is UX; these grants are the data boundary.
drop policy if exists sd_customers_all on sd_customers;
drop policy if exists sd_services_all on sd_services;
drop policy if exists sd_invoices_all on sd_invoices;
drop policy if exists sd_invoice_items_all on sd_invoice_items;
drop policy if exists sd_settings_all on sd_settings;

create policy sd_customers_all on sd_customers for all
  using (exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_customers.org_id and g.enabled))
  with check (exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_customers.org_id and g.enabled));
create policy sd_services_all on sd_services for all
  using (exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_services.org_id and g.enabled))
  with check (exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_services.org_id and g.enabled));
create policy sd_invoices_all on sd_invoices for all
  using (exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_invoices.org_id and g.enabled))
  with check (exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_invoices.org_id and g.enabled));
create policy sd_invoice_items_all on sd_invoice_items for all
  using (exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_invoice_items.org_id and g.enabled))
  with check (exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_invoice_items.org_id and g.enabled));
create policy sd_settings_all on sd_settings for all
  using (exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_settings.org_id and g.enabled))
  with check (exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_settings.org_id and g.enabled));

create table if not exists sd_gmail_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_address text not null,
  provider_account_id text,
  scopes text[] not null default '{}',
  status text not null default 'connected'
    check (status in ('connected', 'syncing', 'error', 'reauth_required', 'disconnected')),
  last_history_id text,
  watch_expires_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, email_address)
);
create index if not exists idx_sd_gmail_connections_org
  on sd_gmail_connections (org_id, user_id);
create unique index if not exists idx_sd_gmail_connections_one_active
  on sd_gmail_connections (org_id, user_id)
  where status <> 'disconnected';

-- Deliberately contains ONLY encrypted refresh tokens and is never selectable
-- through the browser Supabase client. Route handlers use the service-role key,
-- enforce the ServiceDen account gate, and always filter by org + connection.
create table if not exists sd_gmail_credentials (
  connection_id uuid primary key references sd_gmail_connections(id) on delete cascade,
  encrypted_refresh_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sd_gmail_oauth_states (
  state_hash text primary key,
  org_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_code_verifier text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sd_leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  gmail_connection_id uuid references sd_gmail_connections(id) on delete set null,
  converted_customer_id uuid references sd_customers(id) on delete set null,
  contact_name text not null,
  company text,
  email text not null,
  phone text,
  source text not null default 'manual'
    check (source in ('manual', 'gmail_agent', 'gmail_label', 'referral', 'website', 'other')),
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'replied', 'discovery', 'pilot_proposed', 'founding_customer', 'nurture', 'won', 'lost')),
  review_status text not null default 'accepted'
    check (review_status in ('suggested', 'accepted', 'rejected')),
  primary_pain text,
  summary text,
  agent_next_action text,
  agent_confidence int not null default 0
    check (agent_confidence between 0 and 100),
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  next_follow_up_at timestamptz,
  follow_up_count int not null default 0 check (follow_up_count >= 0),
  notes text,
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Replace the earliest draft's org-wide key if this script was already run.
alter table sd_leads drop constraint if exists sd_leads_org_id_email_key;
create unique index if not exists idx_sd_leads_owner_email
  on sd_leads (org_id, owner_user_id, email);
create index if not exists idx_sd_leads_org_stage
  on sd_leads (org_id, review_status, stage, next_follow_up_at);
create index if not exists idx_sd_leads_org_updated
  on sd_leads (org_id, updated_at desc);

create table if not exists sd_mail_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  connection_id uuid not null references sd_gmail_connections(id) on delete cascade,
  lead_id uuid references sd_leads(id) on delete cascade,
  provider_thread_id text not null,
  subject text,
  participants text[] not null default '{}',
  snippet text,
  latest_message_at timestamptz,
  latest_inbound_at timestamptz,
  latest_outbound_at timestamptz,
  message_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_thread_id)
);
create index if not exists idx_sd_mail_threads_lead
  on sd_mail_threads (org_id, lead_id, latest_message_at desc);

create table if not exists sd_mail_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  connection_id uuid not null references sd_gmail_connections(id) on delete cascade,
  thread_id uuid not null references sd_mail_threads(id) on delete cascade,
  provider_message_id text not null,
  internet_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_address text not null,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text,
  sent_at timestamptz not null,
  snippet text,
  body_text text,
  created_at timestamptz not null default now(),
  unique (connection_id, provider_message_id)
);
create index if not exists idx_sd_mail_messages_thread
  on sd_mail_messages (thread_id, sent_at);

create table if not exists sd_lead_activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  lead_id uuid not null references sd_leads(id) on delete cascade,
  mail_message_id uuid references sd_mail_messages(id) on delete set null,
  activity_type text not null,
  description text,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_sd_lead_activities_lead
  on sd_lead_activities (lead_id, occurred_at desc);

alter table sd_gmail_connections enable row level security;
alter table sd_gmail_credentials enable row level security;
alter table sd_gmail_oauth_states enable row level security;
alter table sd_leads enable row level security;
alter table sd_mail_threads enable row level security;
alter table sd_mail_messages enable row level security;
alter table sd_lead_activities enable row level security;

drop policy if exists sd_gmail_connections_private on sd_gmail_connections;
drop policy if exists sd_leads_private on sd_leads;
drop policy if exists sd_mail_threads_private on sd_mail_threads;
drop policy if exists sd_mail_messages_private on sd_mail_messages;
drop policy if exists sd_lead_activities_private on sd_lead_activities;

create policy sd_gmail_connections_private on sd_gmail_connections for all
  using (
    user_id = auth.uid()
    and exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_gmail_connections.org_id and g.enabled)
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_gmail_connections.org_id and g.enabled)
  );

create policy sd_leads_private on sd_leads for all
  using (
    owner_user_id = auth.uid()
    and exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_leads.org_id and g.enabled)
  )
  with check (
    owner_user_id = auth.uid()
    and exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_leads.org_id and g.enabled)
    and (
      gmail_connection_id is null
      or exists (
        select 1 from sd_gmail_connections c
        where c.id = sd_leads.gmail_connection_id
          and c.org_id = sd_leads.org_id
          and c.user_id = auth.uid()
      )
    )
    and (
      converted_customer_id is null
      or exists (
        select 1 from sd_customers c
        where c.id = sd_leads.converted_customer_id
          and c.org_id = sd_leads.org_id
      )
    )
  );

create policy sd_mail_threads_private on sd_mail_threads for all
  using (
    exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_mail_threads.org_id and g.enabled)
    and exists (
      select 1 from sd_gmail_connections c
      where c.id = sd_mail_threads.connection_id
        and c.org_id = sd_mail_threads.org_id
        and c.user_id = auth.uid()
    )
    and (
      lead_id is null
      or exists (
        select 1 from sd_leads l
        where l.id = sd_mail_threads.lead_id
          and l.org_id = sd_mail_threads.org_id
          and l.owner_user_id = auth.uid()
      )
    )
  )
  with check (
    exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_mail_threads.org_id and g.enabled)
    and exists (
      select 1 from sd_gmail_connections c
      where c.id = sd_mail_threads.connection_id
        and c.org_id = sd_mail_threads.org_id
        and c.user_id = auth.uid()
    )
    and (
      lead_id is null
      or exists (
        select 1 from sd_leads l
        where l.id = sd_mail_threads.lead_id
          and l.org_id = sd_mail_threads.org_id
          and l.owner_user_id = auth.uid()
      )
    )
  );

create policy sd_mail_messages_private on sd_mail_messages for all
  using (
    exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_mail_messages.org_id and g.enabled)
    and exists (
      select 1 from sd_gmail_connections c
      where c.id = sd_mail_messages.connection_id
        and c.org_id = sd_mail_messages.org_id
        and c.user_id = auth.uid()
    )
    and exists (
      select 1 from sd_mail_threads t
      where t.id = sd_mail_messages.thread_id
        and t.org_id = sd_mail_messages.org_id
        and t.connection_id = sd_mail_messages.connection_id
    )
  )
  with check (
    exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_mail_messages.org_id and g.enabled)
    and exists (
      select 1 from sd_gmail_connections c
      where c.id = sd_mail_messages.connection_id
        and c.org_id = sd_mail_messages.org_id
        and c.user_id = auth.uid()
    )
    and exists (
      select 1 from sd_mail_threads t
      where t.id = sd_mail_messages.thread_id
        and t.org_id = sd_mail_messages.org_id
        and t.connection_id = sd_mail_messages.connection_id
    )
  );

create policy sd_lead_activities_private on sd_lead_activities for all
  using (
    exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_lead_activities.org_id and g.enabled)
    and exists (
      select 1 from sd_leads l
      where l.id = sd_lead_activities.lead_id
        and l.org_id = sd_lead_activities.org_id
        and l.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_lead_activities.org_id and g.enabled)
    and exists (
      select 1 from sd_leads l
      where l.id = sd_lead_activities.lead_id
        and l.org_id = sd_lead_activities.org_id
        and l.owner_user_id = auth.uid()
    )
  );

-- Even if future default grants change, Gmail refresh tokens remain reachable
-- only through the service-role client in authenticated ServiceDen routes.
revoke all on table sd_gmail_credentials from anon, authenticated;
revoke all on table sd_gmail_oauth_states from anon, authenticated;
grant all on table sd_gmail_credentials to service_role;
grant all on table sd_gmail_oauth_states to service_role;

-- Atomic lead → customer conversion. Only the authenticated ServiceDen server
-- route (service role) can execute it; the route supplies IDs resolved from its
-- verified session rather than accepting tenant identity from the browser.
create or replace function sd_convert_lead(
  p_lead_id uuid,
  p_org_id uuid,
  p_owner_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.sd_leads%rowtype;
  v_customer_id uuid;
begin
  select * into v_lead
  from public.sd_leads
  where id = p_lead_id
    and org_id = p_org_id
    and owner_user_id = p_owner_user_id
  for update;

  if not found then
    raise exception 'Lead not found';
  end if;

  if v_lead.converted_customer_id is not null then
    return v_lead.converted_customer_id;
  end if;

  select id into v_customer_id
  from public.sd_customers
  where org_id = p_org_id
    and email is not null
    and lower(email) = lower(v_lead.email)
  order by created_at
  limit 1;

  if v_customer_id is null then
    insert into public.sd_customers (org_id, name, company, email, phone, notes)
    values (
      p_org_id,
      v_lead.contact_name,
      v_lead.company,
      lower(v_lead.email),
      v_lead.phone,
      coalesce(v_lead.notes, v_lead.summary)
    )
    returning id into v_customer_id;
  end if;

  update public.sd_leads
  set converted_customer_id = v_customer_id,
      review_status = 'accepted',
      stage = 'won',
      won_at = coalesce(won_at, now()),
      next_follow_up_at = null,
      updated_at = now()
  where id = p_lead_id;

  insert into public.sd_lead_activities (org_id, lead_id, activity_type, description, metadata)
  values (
    p_org_id,
    p_lead_id,
    'converted_to_customer',
    'Lead converted to a ServiceDen customer.',
    jsonb_build_object('customer_id', v_customer_id)
  );

  return v_customer_id;
end;
$$;

revoke all on function sd_convert_lead(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function sd_convert_lead(uuid, uuid, uuid) to service_role;

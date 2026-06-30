-- Seed InsightGen demo data for Fresh Valley Produce (Cape Town fruit & veg
-- wholesale, ~R7M/month, 40 staff). Figures are coherent with the canonical
-- company used across the other modules. Re-runnable: clears the org's rows
-- first, then re-inserts. Paste into the Supabase SQL editor and run.

-- ---------------------------------------------------------------------------
-- ig_insights  (~10 cross-module AI findings, in ZAR where money applies)
-- ---------------------------------------------------------------------------
delete from ig_insights
where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into ig_insights (org_id, source_module, severity, text, metric_label, metric_value, is_anomaly, created_at)
select o.id, v.source_module, v.severity, v.text, v.metric_label, v.metric_value, v.is_anomaly,
       now() - (v.age_hours || ' hours')::interval
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('wastewatch',  'critical', 'Waste cost rose 12% week-on-week to R84,500, driven mostly by Leafy Greens and Berries spoiling in the cold store.', 'Weekly waste cost', 'R84,500 (+12%)', true,  6),
  ('procurepulse','critical', '2 lines are out of stock and below reorder point: Baby Spinach and Strawberries. Reorder before Thursday market.',         'Lines out of stock', '2 lines',        true,  3),
  ('planwise',    'warning',  'Actual expenses are tracking 9% above plan this month, led by produce COGS (78% of revenue) and overtime in Dispatch.', 'Variance to plan',   '+9% vs budget',  false, 9),
  ('pricepilot',  'warning',  '12 products are priced below target margin, including Avocados, Mangoes and Blueberries — an estimated R41,000/month left on the table.', 'Below-target lines', '12 products',   false, 14),
  ('orderflow',   'warning',  'Cape Town Market''s order frequency has dropped 18% this month versus their 6-month average. Recommend a sales call.', 'Order frequency',    '-18% MoM',       false, 20),
  ('supplysync',  'warning',  'Tygerberg Tomatoes delivery consistency dropped to 81% on-time this month, down from 94%, with two short-shipped pallets.', 'On-time delivery',   '81% (-13pts)',   false, 26),
  ('shiftboard',  'warning',  'Drivers department is 3 short today (2 on leave, 1 absent) against a required 7 — dispatch SLA at risk for afternoon runs.', 'Drivers shortfall',  '4 of 7 on shift', false, 2),
  ('orderflow',   'positive', 'Revenue is tracking 82% toward this month''s R7.0M target with 9 days remaining — on pace to land around R7.4M.', 'Revenue to target',  '82% (~R7.4M)',   false, 5),
  ('docu',        'positive', '8 supplier invoices were captured and matched automatically this week with no manual edits, saving ~3 hours of admin.', 'Invoices auto-processed', '8 this week', false, 11),
  ('pricepilot',  'positive', 'Citrus margins improved to 21% after the Boland Citrus price update flowed through to the April list — best in 4 months.', 'Citrus gross margin', '21% (+4pts)',   false, 30)
) as v(source_module, severity, text, metric_label, metric_value, is_anomaly, age_hours);

-- ---------------------------------------------------------------------------
-- ig_reports  (saved report definitions)
-- ---------------------------------------------------------------------------
delete from ig_reports
where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into ig_reports (org_id, name, scope, modules, schedule, status, owner, last_run)
select o.id, v.name, v.scope, v.modules::jsonb, v.schedule, v.status, v.owner,
       now() - (v.age_hours || ' hours')::interval
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Weekly business brief',   'Company',     '["all"]',                            'weekly',  'ready',     'You',      2),
  ('Margin & pricing review', 'Finance',     '["pricepilot","orderflow"]',         'weekly',  'ready',     'You',      8),
  ('Waste & cost control',    'Operations',  '["wastewatch","planwise"]',          'weekly',  'draft',     'Thandi M.',32),
  ('Supplier scorecard',      'Procurement', '["supplysync","procurepulse"]',      'monthly', 'scheduled', 'You',      72),
  ('Monthly board pack',      'Executive',   '["all"]',                            'monthly', 'ready',     'Sarah J.', 96),
  ('Daily ops snapshot',      'Operations',  '["shiftboard","orderflow","procurepulse"]', 'daily', 'ready', 'Megan D.', 5)
) as v(name, scope, modules, schedule, status, owner, age_hours);

-- Seed PlanWise demo data for Fresh Valley Produce (Cape Town fruit & veg
-- wholesale distribution, ~R7M/month, 40 staff). Coherent with the canonical
-- company used across the other Vyso modules. Re-runnable: each table is
-- cleared for the org before re-inserting.
--
-- HOW TO APPLY: paste into the Supabase dashboard SQL editor and run.
-- All money in ZAR.

-- ---------------------------------------------------------------------------
-- Budget lines  (one month, ~R7.0M revenue / 78% COGS / R620k labour)
-- profit_impact: signed rand vs plan — under budget on a cost = +, over = −;
-- on revenue, beating plan = +.
-- ---------------------------------------------------------------------------
delete from pw_budget_lines where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into pw_budget_lines (org_id, cat, budgeted, actual, profit_impact, suggested_action, module, color, sort_order)
select o.id, v.cat, v.budgeted, v.actual, v.profit_impact, v.suggested_action, v.module, v.color, v.sort_order
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Revenue',          7000000, 7400000,  400000, 'Ahead of plan — protect margin on volume', 'orderflow',    '#1E5E54', 0),
  ('COGS (Produce)',   5460000, 5772000, -312000, 'Review ProcurePulse buying strategy',      'procurepulse', '#D9730D', 1),
  ('Labour',            620000,  631000,  -11000, 'Trim overtime in Dispatch & Cold Store',   null,           '#0C447C', 2),
  ('Transport & Fuel',  280000,  301500,  -21500, 'Re-route deliveries; lock a fuel rate',    'procurepulse', '#854F0B', 3),
  ('Rent & Cold Store',  165000,  165000,       0, 'On plan — fixed lease',                    null,           '#2E7D67', 4),
  ('Packaging',          110000,  118400,   -8400, 'Bulk-buy crates & punnets',                'procurepulse', '#5B53C0', 5),
  ('Utilities',           95000,  103200,   -8200, 'Check refrigeration tariffs & usage',      null,           '#A0691A', 6),
  ('Marketing',           60000,   41800,   18200, 'Increase spend to defend accounts',        'orderflow',    '#7C5BC0', 7),
  ('Other',               75000,   83600,   -8600, 'Reconcile loose expenses in Doc-U',        'docu',         '#9A9DA1', 8)
) as v(cat, budgeted, actual, profit_impact, suggested_action, module, color, sort_order)
;

-- ---------------------------------------------------------------------------
-- Goals  (target vs current strategic KPIs; trend = recent 6-point sparkline)
-- ---------------------------------------------------------------------------
delete from pw_goals where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into pw_goals (org_id, goal_key, label, target, current, unit, higher_is_better, module, trend, sort_order)
select o.id, v.goal_key, v.label, v.target, v.current, v.unit, v.higher_is_better, v.module, v.trend::jsonb, v.sort_order
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('revenue', 'Monthly revenue target', 7500000, 7400000, 'R', true,  'orderflow',    '[6500,6900,7100,7300,7350,7400]', 0),
  ('margin',  'Gross margin %',               24,      22, '%', true,  'pricepilot',   '[19,20,21,21,22,22]',             1),
  ('waste',   'Waste % of produce',            3,       4.4, '%', false, 'wastewatch',  '[6.1,5.6,5.2,4.9,4.6,4.4]',       2),
  ('labour',  'Labour % of revenue',           8,       8.5, '%', false, null,         '[9.4,9.1,8.9,8.7,8.6,8.5]',       3),
  ('cash',    'Cash reserve',            2500000, 2180000, 'R', true,  null,           '[1850000,1960000,2040000,2110000,2150000,2180000]', 4),
  ('growth',  'YoY growth target',             10,       6, '%', true,  'orderflow',   '[2,3,4,5,5,6]',                   5)
) as v(goal_key, label, target, current, unit, higher_is_better, module, trend, sort_order)
;

-- ---------------------------------------------------------------------------
-- Forecast  (headline lines + 12-month revenue series from SPEC.revenueSeriesMillions
-- = [6.4,6.9,7.3,6.7,7.8,7.1,6.5,7.6,8.1,7.0,6.8,7.4] in R-millions). The first
-- 9 months are 'actual', the last 3 are 'projected'. Revenue line carries the
-- full series; other lines carry a short trailing sparkline in `data`.
-- ---------------------------------------------------------------------------
delete from pw_forecast where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into pw_forecast (org_id, forecast_key, label, value, target, range_low, range_high, confidence, trend, tone, data, series, sort_order)
select o.id, v.forecast_key, v.label, v.value, v.target, v.range_low, v.range_high, v.confidence, v.trend, v.tone, v.data::jsonb, v.series::jsonb, v.sort_order
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('rev', 'Revenue forecast', 7400000, 7500000, 7250000, 7650000, 82, 'up', 'warning',
    '[6500,6700,7100,7300,7350,7400]',
    '[{"month":"Jul","value":6400000,"kind":"actual"},{"month":"Aug","value":6900000,"kind":"actual"},{"month":"Sep","value":7300000,"kind":"actual"},{"month":"Oct","value":6700000,"kind":"actual"},{"month":"Nov","value":7800000,"kind":"actual"},{"month":"Dec","value":7100000,"kind":"actual"},{"month":"Jan","value":6500000,"kind":"actual"},{"month":"Feb","value":7600000,"kind":"actual"},{"month":"Mar","value":8100000,"kind":"actual"},{"month":"Apr","value":7000000,"kind":"projected"},{"month":"May","value":6800000,"kind":"projected"},{"month":"Jun","value":7400000,"kind":"projected"}]',
    0),
  ('exp', 'Expense forecast', 7339500, 7280000, 7180000, 7490000, 88, 'up', 'critical',
    '[6900000,7010000,7080000,7150000,7240000,7339500]', '[]', 1),
  ('profit', 'Profit forecast', 60500, 220000, -40000, 180000, 71, 'flat', 'critical',
    '[145000,120000,90000,110000,75000,60500]', '[]', 2),
  ('cash', 'Cash position', 2180000, 2500000, 2080000, 2290000, 80, 'up', 'neutral',
    '[1850000,1960000,2040000,2110000,2150000,2180000]', '[]', 3)
) as v(forecast_key, label, value, target, range_low, range_high, confidence, trend, tone, data, series, sort_order)
;

-- ---------------------------------------------------------------------------
-- Scenarios  (what-if builders; `projected` is the cached outcome from the
-- SliderValues, anchored to the R7.4M revenue / R7.34M expense baseline).
-- ---------------------------------------------------------------------------
delete from pw_scenarios where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into pw_scenarios (org_id, scenario_key, title, description, assumption, sliders, projected, risk, probability, sort_order)
select o.id, v.scenario_key, v.title, v.description, v.assumption, v.sliders::jsonb, v.projected::jsonb, v.risk, v.probability, v.sort_order
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('A', 'Scenario A', 'Win 2 new wholesale accounts (+5% revenue)',
    'Sales lands two mid-size retail accounts; volume up, margin held',
    '{"revenueGrowth":5,"expenseReduction":0,"marginImprovement":0,"wasteReduction":0,"invoiceRecovery":0}',
    '{"revenue":7770000,"expenses":7339500,"profit":430500,"cash":2365000,"runwayMonths":5.1,"diffVsCurrent":370000}',
    'Medium', 60, 0),
  ('B', 'Scenario B', 'Cut produce waste + renegotiate transport (−8% expenses)',
    'WasteWatch trims 30% of spoilage and ProcurePulse re-routes deliveries',
    '{"revenueGrowth":0,"expenseReduction":8,"marginImprovement":0,"wasteReduction":30,"invoiceRecovery":0}',
    '{"revenue":7400000,"expenses":6752340,"profit":647660,"cash":2473830,"runwayMonths":6.2,"diffVsCurrent":587160}',
    'Low', 75, 1),
  ('C', 'Scenario C', 'Raise under-target margins (+3% pricing)',
    'PricePilot lifts 40 low-margin lines back to the 24% target',
    '{"revenueGrowth":0,"expenseReduction":0,"marginImprovement":3,"wasteReduction":0,"invoiceRecovery":50}',
    '{"revenue":7400000,"expenses":7339500,"profit":282500,"cash":2299250,"runwayMonths":5.4,"diffVsCurrent":222000}',
    'Medium', 65, 2)
) as v(scenario_key, title, description, assumption, sliders, projected, risk, probability, sort_order)
;

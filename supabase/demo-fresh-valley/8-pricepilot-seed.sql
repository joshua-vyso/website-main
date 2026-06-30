-- ===========================================================================
-- DEMO SEED — PricePilot for 'Fresh Valley Produce'
-- ---------------------------------------------------------------------------
-- PricePilot derives most of its numbers from of_orders + pp_stock_items
-- (those are seeded by the OrderFlow + ProcurePulse seeds). This file only
-- seeds the PricePilot-OWNED rows the module reads directly:
--   * pl_targets            — the org margin / revenue / GP / opex goals
--   * pl_price_lists        — a standard org-wide list + customer contract lists
--   * pl_overrides          — per-item margin overrides on the base list
--   * pl_price_list_versions— a published snapshot so version history is populated
--
-- All money is ZAR. Re-runnable: every block deletes the org's existing rows
-- first, then re-inserts. Overrides + customer-list FKs resolve by natural key
-- (pp_stock_items.name / of_customers.name) so no hardcoded uuids are needed.
--
-- HOW TO APPLY: paste into the Supabase dashboard SQL editor and run.
-- Requires the ProcurePulse (pp_stock_items) + OrderFlow (of_customers) seeds
-- to have run first, so the natural-key joins resolve.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- 1) pl_targets — single org-wide row (PK org_id).
--    Fruit & veg wholesale ~R7M/month. Produce margins run thin, so a 22%
--    org target margin is realistic; opex set so net profit is sensible.
-- --------------------------------------------------------------------------
delete from pl_targets
  where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into pl_targets (org_id, target_margin_pct, monthly_revenue_target, monthly_gross_profit_target, monthly_opex, updated_at)
select o.id, v.target_margin_pct, v.monthly_revenue_target, v.monthly_gross_profit_target, v.monthly_opex, now()
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  (22, 7000000, 1540000, 980000)   -- 22% target margin → R1.54M GP on R7M; R980k opex → ~R560k net
) as v(target_margin_pct, monthly_revenue_target, monthly_gross_profit_target, monthly_opex);

-- --------------------------------------------------------------------------
-- 2) pl_price_lists — the org's price lists.
--    * 'Standard Wholesale' is the BASE list (no customer, cadence=standard):
--      pickBaseList() reads catalogue margins from this one.
--    * Two customer contract lists (customer_id resolved by name) carry validity
--      windows so the Customers page shows an Active + an Expiring-soon contract.
--    Re-runnable: delete the org's lists first. (Cascades clear child overrides
--    + versions, which we re-seed below.)
-- --------------------------------------------------------------------------
delete from pl_price_lists
  where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

-- 2a) org-wide lists (no customer)
insert into pl_price_lists (org_id, name, customer_id, default_margin_pct, cadence, valid_from, valid_until, created_at)
select o.id, v.name, null, v.default_margin_pct, v.cadence, null, null, now() - (v.age_days || ' days')::interval
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Standard Wholesale',  22, 'standard', 120),   -- oldest → the base list
  ('Daily Market Board',  18, 'daily',     30)    -- a fast-moving daily list
) as v(name, default_margin_pct, cadence, age_days);

-- 2b) customer contract lists — customer_id resolved by of_customers.name.
--     Only inserts the row if the named customer exists for the org.
insert into pl_price_lists (org_id, name, customer_id, default_margin_pct, cadence, valid_from, valid_until, created_at)
select o.id, v.name, c.id, v.default_margin_pct, v.cadence,
       (current_date - (v.from_days_ago || ' days')::interval)::date,
       (current_date + (v.until_days || ' days')::interval)::date,
       now() - (v.age_days || ' days')::interval
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  -- name,                              customer,                       margin, cadence,    from_days_ago, until_days, age_days
  ('Woolworths Foods — Contract',       'Woolworths Foods Claremont',   16,     'weekly',   90,            210,        90),  -- active, long-dated
  ('Spar Constantia — Contract',        'Spar Constantia',              19,     'weekly',   60,             10,        60),  -- expiring soon (<14 days)
  ('Pick n Pay Plumstead — Contract',   'Pick n Pay Plumstead',         17,     'monthly',  45,             95,        45),  -- active
  ('Belmont Hotel Kitchen — Contract',  'Belmont Hotel Kitchen',        25,     'weekly',   30,            150,        30)   -- active, higher margin (food service)
) as v(name, customer_name, default_margin_pct, cadence, from_days_ago, until_days, age_days)
join of_customers c
  on c.org_id = o.id and c.name = v.customer_name;

-- --------------------------------------------------------------------------
-- 3) pl_overrides — per-item margin overrides on the BASE list
--    ('Standard Wholesale'). stock_item_id resolved by pp_stock_items.name.
--    Realistic produce spread: staples thin (15-18%), premium/specialty richer
--    (26-30%). Only inserts where the named stock item exists for the org.
-- --------------------------------------------------------------------------
delete from pl_overrides
  where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into pl_overrides (org_id, price_list_id, stock_item_id, margin_pct, created_at)
select o.id, pl.id, s.id, v.margin_pct, now()
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
join pl_price_lists pl
  on pl.org_id = o.id and pl.name = 'Standard Wholesale'
cross join (values
  -- thin-margin staples (high volume, price-sensitive)
  ('Potatoes (10kg)',        15),
  ('Onions (10kg)',          15),
  ('Carrots (10kg)',         16),
  ('Tomatoes (kg)',          17),
  ('Cabbage (ea)',           16),
  ('Bananas (box)',          18),
  ('Butternut (kg)',         18),
  ('Gem Squash (kg)',        18),
  ('Sweet Potato (kg)',      18),
  ('Lettuce-Iceberg (ea)',   17),
  ('Cucumber (ea)',          17),
  -- mid-margin
  ('Apples-Golden (box)',    22),
  ('Apples-Green (box)',     22),
  ('Apples-Red (box)',       22),
  ('Oranges (box)',          21),
  ('Lemons (box)',           21),
  ('Naartjies (box)',        21),
  ('Beetroot (bunch)',       22),
  ('Green Beans (kg)',       23),
  ('Peppers-Mixed (kg)',     24),
  ('Broccoli (kg)',          24),
  -- premium / specialty (richer margins)
  ('Baby Spinach (kg)',      28),
  ('Avocados (box)',         27),
  ('Mangoes (box)',          26),
  ('Grapes (punnet)',        28),
  ('Strawberries (punnet)',  30),
  ('Blueberries (punnet)',   30),
  ('Mushrooms (250g)',       28),
  ('Garlic (kg)',            26),
  ('Ginger (kg)',            27)
) as v(item_name, margin_pct)
join pp_stock_items s
  on s.org_id = o.id and lower(s.name) = lower(v.item_name);

-- --------------------------------------------------------------------------
-- 4) pl_price_list_versions — a published v1 snapshot of the BASE list.
--    overrides jsonb = [{ stock_item_id, margin_pct }] resolved by item name,
--    matching the v1 margins above. Gives the version-history / compare page
--    a baseline to diff the current (live) margins against.
-- --------------------------------------------------------------------------
delete from pl_price_list_versions
  where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into pl_price_list_versions (org_id, price_list_id, version_no, default_margin_pct, overrides, note, created_at)
select
  o.id,
  pl.id,
  1,
  pl.default_margin_pct,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object('stock_item_id', ov.stock_item_id, 'margin_pct', ov.margin_pct))
      from pl_overrides ov
      where ov.price_list_id = pl.id
    ),
    '[]'::jsonb
  ),
  'Initial published version — opening produce margins for the season.',
  now() - interval '7 days'
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
join pl_price_lists pl
  on pl.org_id = o.id and pl.name = 'Standard Wholesale';

-- ===========================================================================
-- Done. Targets, price lists (base + customer contracts), per-item overrides,
-- and a published version are now seeded for Fresh Valley Produce.
-- ===========================================================================

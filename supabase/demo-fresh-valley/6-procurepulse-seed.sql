-- Seed ProcurePulse stock intelligence for Fresh Valley Produce (Cape Town fruit
-- & veg wholesale distribution, ~R7M/month, 40 staff). The catalogue is the core:
-- 30 produce lines with live on-hand levels, low-stock thresholds, ZAR pricing,
-- per-supplier price quotes and a recent movement ledger so the dashboard, Stock,
-- Alerts, Reordering and Intelligence pages all render populated.
--
-- Re-runnable: each table is delete-for-org then insert, scoped to the org by
-- name. All money in ZAR. Coherent with the SupplySync supply base (the same 12
-- suppliers) so cheapest_supplier / pp_item_suppliers names line up across modules.
--
-- The pp_* tables already exist in the live DB (created earlier; some directly in
-- the dashboard). This file is SEED ONLY — no schema. Columns match the live
-- schema (lib/platform/types.ts StockItem / ItemSupplierPrice / StockMovement).
--
-- HOW TO APPLY: paste into the Supabase dashboard SQL editor and run.

-- ===========================================================================
-- 1. Stock catalogue (pp_stock_items) — 30 SPEC produce lines.
--    on_hand: realistic live levels in the counting unit. Two lines sit at/below
--    threshold (Baby Spinach, Strawberries — see InsightGen "2 lines out/low"),
--    Naartjies runs low. low_threshold ≈ a few days' cover. avg_unit_price is the
--    SPEC price (ZAR). category drives the dashboard donut + stock grouping.
--    cheapest_supplier names a SupplySync supplier coherent with the produce.
--    stock_history / price_history are 7-point sparklines (most-recent last).
--    kg_per_unit set where a unit has a natural pack weight (boxes/bags); the
--    Doc-U feed maintains these in production, here they are illustrative.
-- ===========================================================================
delete from pp_stock_items
  where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into pp_stock_items (
  org_id, name, category, pack, unit, on_hand, low_threshold,
  avg_unit_price, kg_per_unit, currency, trend_pct, cheapest_supplier,
  stock_history, price_history
)
select o.id, v.name, v.category, nullif(v.pack, ''), v.unit, v.on_hand, v.low_threshold,
       v.avg_unit_price, v.kg_per_unit, 'ZAR', v.trend_pct, v.cheapest_supplier,
       -- stock_history / price_history are jsonb columns; convert the array literals.
       to_jsonb(v.stock_history), to_jsonb(v.price_history)
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Apples-Golden (box)',          'Fruit',                  '12.5kg/box',   'box',        84,  20,  285.0, 12.5,    -3, 'Ceres Fruit Growers',    array[70,76,72,80,78,90,84],     array[292,290,288,288,286,285,285]),
  ('Apples-Green (box)',           'Fruit',                  '12.5kg/box',   'box',        72,  20,  270.0, 12.5,    -2, 'Ceres Fruit Growers',    array[60,66,64,70,68,74,72],     array[276,274,272,272,271,270,270]),
  ('Apples-Red (box)',             'Fruit',                  '12.5kg/box',   'box',        96,  24,  326.0, 12.5,     1, 'Witzenberg Orchards',    array[80,88,84,90,92,98,96],     array[320,322,324,324,325,326,326]),
  ('Bananas (box)',                'Fruit',                  '18kg/box',     'box',        58,  18,  245.0, 18.0,     4, 'Cape Town Market',       array[44,50,48,54,52,60,58],     array[236,238,240,242,243,245,245]),
  ('Potatoes (10kg)',              'Vegetables',             '10kg/bag',     'bag',       140,  40,  110.0, 10.0,     6, 'Sandveld Potatoes',      array[120,128,124,132,130,144,140], array[102,104,106,107,108,110,110]),
  ('Onions (10kg)',                'Vegetables',             '10kg/bag',     'bag',       118,  35,   95.0, 10.0,     5, 'Klein Karoo Veg',        array[96,104,100,108,106,120,118], array[90,91,92,93,94,95,95]),
  ('Tomatoes (kg)',                'Vegetables',             '',             'kg',        260,  80,   24.0, 1.0,      9, 'Cape Town Market',       array[200,224,210,240,232,268,260], array[21.5,22,22.5,23,23.5,24,24]),
  ('Carrots (10kg)',               'Vegetables',             '10kg/bag',     'bag',        92,  28,   88.0, 10.0,     2, 'Stellenbosch Farms',     array[74,82,78,86,84,94,92],     array[85,86,87,87,88,88,88]),
  ('Cabbage (ea)',                 'Vegetables',             '',             'ea',        210,  60,   14.0, 1.6,     -1, 'Philippi Fresh Co-op',   array[180,196,188,202,198,214,210], array[14.5,14.5,14,14,14,14,14]),
  ('Lettuce-Iceberg (ea)',         'Salad & Leafy Greens',   '',             'ea',        130,  50,   16.0, 0.5,     -2, 'Philippi Fresh Co-op',   array[150,140,134,128,132,134,130], array[16.5,16.5,16,16,16,16,16]),
  ('Baby Spinach (kg)',            'Salad & Leafy Greens',   '5kg/case',     'kg',         12,  20,   65.0, 1.0,      8, 'Philippi Fresh Co-op',   array[34,28,30,22,18,16,12],     array[60,61,62,63,64,65,65]),
  ('Oranges (box)',                'Fruit',                  '15kg/box',     'box',       150,  40,  180.0, 15.0,    -4, 'Boland Citrus',          array[180,172,168,162,158,154,150], array[190,188,186,184,182,180,180]),
  ('Lemons (box)',                 'Fruit',                  '15kg/box',     'box',       108,  30,  210.0, 15.0,    -3, 'Boland Citrus',          array[128,124,120,116,112,110,108], array[218,216,214,213,211,210,210]),
  ('Naartjies (box)',              'Fruit',                  '10kg/box',     'box',         26,  30,  165.0, 10.0,    -5, 'Boland Citrus',          array[60,52,46,40,34,30,26],     array[172,170,168,167,166,165,165]),
  ('Avocados (box)',               'Fruit',                  '4kg/box',      'box',        70,  24,  285.0, 4.0,      7, 'Two Oceans Produce',     array[52,58,56,62,64,68,70],     array[268,272,276,279,282,285,285]),
  ('Butternut (kg)',               'Vegetables',             '',             'kg',        320,  90,   18.0, 1.0,      1, 'Stellenbosch Farms',     array[280,296,288,304,300,326,320], array[17.5,17.5,18,18,18,18,18]),
  ('Sweet Potato (kg)',            'Vegetables',             '',             'kg',        180,  60,   22.0, 1.0,      3, 'Klein Karoo Veg',        array[150,162,156,168,166,184,180], array[21,21.5,21.5,22,22,22,22]),
  ('Green Beans (kg)',             'Vegetables',             '5kg/case',     'kg',         64,  25,   48.0, 1.0,      4, 'Stellenbosch Farms',     array[50,56,54,58,60,66,64],     array[45,46,46.5,47,47.5,48,48]),
  ('Peppers-Mixed (kg)',           'Vegetables',             '5kg/case',     'kg',         58,  22,   55.0, 1.0,      6, 'Tygerberg Tomatoes',     array[44,50,48,52,54,60,58],     array[50,51,52,53,54,55,55]),
  ('Cucumber (ea)',                'Vegetables',             '',             'ea',        240,  70,    9.0, 0.35,    -1, 'Two Oceans Produce',     array[260,250,244,236,242,244,240], array[9.5,9.5,9,9,9,9,9]),
  ('Broccoli (kg)',                'Vegetables',             '5kg/case',     'kg',         46,  20,   52.0, 1.0,      5, 'Stellenbosch Farms',     array[34,40,38,42,44,48,46],     array[48,49,50,51,51.5,52,52]),
  ('Grapes (punnet)',              'Fruit',                  '500g/punnet',  'punnet',     88,  30,   38.0, 0.5,     11, 'Hex River Grapes',       array[140,124,112,104,98,92,88], array[33,34,35,36,37,38,38]),
  ('Strawberries (punnet)',        'Fruit',                  '250g/punnet',  'punnet',     14,  24,   32.0, 0.25,    14, 'Hex River Grapes',       array[40,34,30,24,20,16,14],     array[27,28,29,30,31,32,32]),
  ('Blueberries (punnet)',         'Fruit',                  '125g/punnet',  'punnet',     52,  20,   45.0, 0.125,   12, 'Hex River Grapes',       array[70,66,62,58,56,54,52],     array[40,41,42,43,44,45,45]),
  ('Mangoes (box)',                'Fruit',                  '6kg/box',      'box',        44,  18,  220.0, 6.0,      9, 'Two Oceans Produce',     array[30,34,36,38,40,42,44],     array[204,208,212,215,218,220,220]),
  ('Beetroot (bunch)',             'Vegetables',             '',             'bunch',     112,  35,   18.0, 0.8,      2, 'Stellenbosch Farms',     array[92,100,96,104,102,116,112], array[17,17.5,17.5,18,18,18,18]),
  ('Mushrooms (250g)',             'Mushrooms',              '250g/punnet',  'punnet',     96,  35,   22.0, 0.25,     3, 'Cape Town Market',       array[78,86,82,90,88,100,96],    array[21,21,21.5,22,22,22,22]),
  ('Garlic (kg)',                  'Herbs',                  '',             'kg',         54,  20,   95.0, 1.0,      4, 'Cape Town Market',       array[42,48,46,50,52,56,54],     array[90,91,92,93,94,95,95]),
  ('Ginger (kg)',                  'Herbs',                  '',             'kg',         38,  15,  120.0, 1.0,      6, 'Cape Town Market',       array[28,32,30,34,36,40,38],     array[112,114,116,117,118,120,120]),
  ('Gem Squash (kg)',              'Vegetables',             '',             'kg',        148,  45,   20.0, 1.0,      1, 'Klein Karoo Veg',        array[124,134,130,138,136,152,148], array[19.5,19.5,20,20,20,20,20])
) as v(name, category, pack, unit, on_hand, low_threshold, avg_unit_price, kg_per_unit, trend_pct, cheapest_supplier, stock_history, price_history)
where exists (select 1 from organisations org2 where org2.name = 'Fresh Valley Produce');

-- ===========================================================================
-- 2. Per-supplier price quotes (pp_item_suppliers) — powers the Procurement
--    Intelligence price matrix, Alerts cheapest-supplier and the Reordering
--    draft PO (each low/out line buys from its cheapest supplier). 2-3 quotes
--    per line; the cheapest matches the item's cheapest_supplier above. Joined
--    to the catalogue by name so no hardcoded stock_item_id is needed.
-- ===========================================================================
delete from pp_item_suppliers
  where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into pp_item_suppliers (org_id, stock_item_id, supplier_name, price)
select s.org_id, s.id, v.supplier_name, v.price
from pp_stock_items s
join (values
  ('Apples-Golden (box)',   'Ceres Fruit Growers',  285.0),
  ('Apples-Golden (box)',   'Witzenberg Orchards',  292.0),
  ('Apples-Golden (box)',   'Elgin Apple Co',       298.0),
  ('Apples-Green (box)',    'Ceres Fruit Growers',  270.0),
  ('Apples-Green (box)',    'Witzenberg Orchards',  276.0),
  ('Apples-Green (box)',    'Elgin Apple Co',       281.0),
  ('Apples-Red (box)',      'Witzenberg Orchards',  326.0),
  ('Apples-Red (box)',      'Ceres Fruit Growers',  331.0),
  ('Apples-Red (box)',      'Elgin Apple Co',       338.0),
  ('Bananas (box)',         'Cape Town Market',     245.0),
  ('Bananas (box)',         'Two Oceans Produce',   258.0),
  ('Mangoes (box)',         'Two Oceans Produce',   220.0),
  ('Mangoes (box)',         'Cape Town Market',     234.0),
  ('Avocados (box)',        'Two Oceans Produce',   285.0),
  ('Avocados (box)',        'Cape Town Market',     299.0),
  ('Potatoes (10kg)',       'Sandveld Potatoes',    110.0),
  ('Potatoes (10kg)',       'Klein Karoo Veg',      116.0),
  ('Potatoes (10kg)',       'Cape Town Market',     119.0),
  ('Onions (10kg)',         'Klein Karoo Veg',       95.0),
  ('Onions (10kg)',         'Stellenbosch Farms',    99.0),
  ('Onions (10kg)',         'Cape Town Market',     102.0),
  ('Carrots (10kg)',        'Stellenbosch Farms',    88.0),
  ('Carrots (10kg)',        'Klein Karoo Veg',       92.0),
  ('Sweet Potato (kg)',     'Klein Karoo Veg',       22.0),
  ('Sweet Potato (kg)',     'Stellenbosch Farms',    23.5),
  ('Gem Squash (kg)',       'Klein Karoo Veg',       20.0),
  ('Gem Squash (kg)',       'Stellenbosch Farms',    21.0),
  ('Butternut (kg)',        'Stellenbosch Farms',    18.0),
  ('Butternut (kg)',        'Klein Karoo Veg',       19.0),
  ('Beetroot (bunch)',      'Stellenbosch Farms',    18.0),
  ('Beetroot (bunch)',      'Cape Town Market',      20.0),
  ('Green Beans (kg)',      'Stellenbosch Farms',    48.0),
  ('Green Beans (kg)',      'Two Oceans Produce',    52.0),
  ('Peppers-Mixed (kg)',    'Tygerberg Tomatoes',    55.0),
  ('Peppers-Mixed (kg)',    'Two Oceans Produce',    59.0),
  ('Broccoli (kg)',         'Stellenbosch Farms',    52.0),
  ('Broccoli (kg)',         'Cape Town Market',      56.0),
  ('Cucumber (ea)',         'Two Oceans Produce',     9.0),
  ('Cucumber (ea)',         'Stellenbosch Farms',     9.5),
  ('Tomatoes (kg)',         'Cape Town Market',      24.0),
  ('Tomatoes (kg)',         'Tygerberg Tomatoes',    25.5),
  ('Cabbage (ea)',          'Philippi Fresh Co-op',  14.0),
  ('Cabbage (ea)',          'Stellenbosch Farms',    15.5),
  ('Lettuce-Iceberg (ea)',  'Philippi Fresh Co-op',  16.0),
  ('Lettuce-Iceberg (ea)',  'Cape Town Market',      17.5),
  ('Baby Spinach (kg)',     'Philippi Fresh Co-op',  65.0),
  ('Baby Spinach (kg)',     'Cape Town Market',      72.0),
  ('Oranges (box)',         'Boland Citrus',        180.0),
  ('Oranges (box)',         'Cape Town Market',     192.0),
  ('Lemons (box)',          'Boland Citrus',        210.0),
  ('Lemons (box)',          'Cape Town Market',     222.0),
  ('Naartjies (box)',       'Boland Citrus',        165.0),
  ('Naartjies (box)',       'Cape Town Market',     178.0),
  ('Grapes (punnet)',       'Hex River Grapes',      38.0),
  ('Grapes (punnet)',       'Cape Town Market',      42.0),
  ('Strawberries (punnet)', 'Hex River Grapes',      32.0),
  ('Strawberries (punnet)', 'Cape Town Market',      36.0),
  ('Blueberries (punnet)',  'Hex River Grapes',      45.0),
  ('Blueberries (punnet)',  'Cape Town Market',      49.0),
  ('Mushrooms (250g)',      'Cape Town Market',      22.0),
  ('Mushrooms (250g)',      'Two Oceans Produce',    24.0),
  ('Garlic (kg)',           'Cape Town Market',      95.0),
  ('Garlic (kg)',           'Two Oceans Produce',   102.0),
  ('Ginger (kg)',           'Cape Town Market',     120.0),
  ('Ginger (kg)',           'Two Oceans Produce',   128.0)
) as v(item_name, supplier_name, price)
  on lower(s.name) = lower(v.item_name)
where s.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

-- ===========================================================================
-- 3. Recent stock movements (pp_movements) — the append-only ledger feeding the
--    dashboard activity strip and each item's history. A coherent week: market /
--    supplier receipts (positive) and order-driven sell-downs (negative). Joined
--    to the catalogue by name; occurred_at staggered back over ~6 days.
--    reason uses the typed MovementReason vocabulary (order_received /
--    recipe_consumed / count_adjustment).
-- ===========================================================================
delete from pp_movements
  where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into pp_movements (org_id, stock_item_id, change, reason, source_label, occurred_at)
select s.org_id, s.id, v.change, v.reason, v.source_label,
       now() - (v.age_hours || ' hours')::interval
from pp_stock_items s
join (values
  ('Potatoes (10kg)',            60,   'order_received',  'Sandveld Potatoes',        140),
  ('Onions (10kg)',              48,   'order_received',  'Klein Karoo Veg',          138),
  ('Apples-Golden (box)',        40,   'order_received',  'Ceres Fruit Growers',      132),
  ('Apples-Red (box)',           36,   'order_received',  'Witzenberg Orchards',      132),
  ('Tomatoes (kg)',             120,   'order_received',  'Cape Town Market',         120),
  ('Butternut (kg)',             90,   'order_received',  'Stellenbosch Farms',       118),
  ('Oranges (box)',             -32,   'order_received',  'Spar Constantia',          110),
  ('Lemons (box)',              -20,   'order_received',  'Pick n Pay Plumstead',     104),
  ('Baby Spinach (kg)',         -18,   'order_received',  'Woolworths Foods Claremont', 96),
  ('Strawberries (punnet)',     -22,   'order_received',  'Food Lover''s Market Tokai', 92),
  ('Grapes (punnet)',           -28,   'order_received',  'Harbour House Group',       88),
  ('Mushrooms (250g)',           40,   'order_received',  'Cape Town Market',          82),
  ('Avocados (box)',             18,   'order_received',  'Two Oceans Produce',        76),
  ('Mangoes (box)',              14,   'order_received',  'Two Oceans Produce',        76),
  ('Carrots (10kg)',             -8,   'recipe_consumed', 'Prep — mixed veg packs',    60),
  ('Peppers-Mixed (kg)',        -12,   'order_received',  'The Foodbarn Restaurant',   54),
  ('Cucumber (ea)',             -24,   'order_received',  'Ocean Basket V&A',          48),
  ('Broccoli (kg)',             -10,   'order_received',  'Saint Restaurant',          42),
  ('Naartjies (box)',           -16,   'order_received',  'OK Foods Wynberg',          36),
  ('Bananas (box)',              30,   'order_received',  'Cape Town Market',          30),
  ('Green Beans (kg)',           -6,   'order_received',  'Belmont Hotel Kitchen',     24),
  ('Lettuce-Iceberg (ea)',      -20,   'order_received',  'Kauai Cavendish',           18),
  ('Cabbage (ea)',              -14,   'order_received',  'Mama Africa Eatery',        12),
  ('Ginger (kg)',                 4,   'count_adjustment','Stock count — cold store',   6),
  ('Tomatoes (kg)',             -40,   'order_received',  'Newlands Deli',              4)
) as v(item_name, change, reason, source_label, age_hours)
  on lower(s.name) = lower(v.item_name)
where s.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

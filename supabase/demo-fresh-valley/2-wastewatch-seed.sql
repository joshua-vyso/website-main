-- Seed WasteWatch demo data for 'Fresh Valley Produce' (Cape Town fruit & veg
-- wholesaler, ~R7M/month, 40 staff). Re-runnable: deletes the org's rows first,
-- then re-inserts. All money in ZAR. Coherent with SPEC produce/employees/
-- suppliers/devices for cross-module consistency.

-- ---------------------------------------------------------------------------
-- Waste categories (7 SPEC categories, each a hex colour). Weekly costs sum to
-- R23,098 across the seeded events; pct/trend are illustrative aggregates.
-- ---------------------------------------------------------------------------
delete from ww_waste_categories
  where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into ww_waste_categories (org_id, name, color, cost, pct, trend, sort_order)
select o.id, v.name, v.color, v.cost, v.pct, v.trend::jsonb, v.sort_order
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Leafy Greens',        '#0F6E56', 5052, 22, '[18,20,17,23,21,24,22]', 1),
  ('Root Veg',            '#854F0B', 4079, 18, '[14,16,15,17,16,19,18]', 2),
  ('Citrus',              '#C77B0A', 2032,  9, '[8,9,7,10,9,9,9]',       3),
  ('Tropical',            '#A35A12', 2761, 12, '[10,11,13,12,11,12,12]', 4),
  ('Berries',             '#A32D2D', 2750, 12, '[9,11,13,12,14,12,12]',  5),
  ('Tomatoes & Peppers',  '#C0392B', 4403, 19, '[16,18,20,19,18,20,19]', 6),
  ('Other',               '#9A9DA1', 2021,  9, '[7,8,9,8,9,9,9]',        7)
) as v(name, color, cost, pct, trend, sort_order);

-- ---------------------------------------------------------------------------
-- Devices (7 SPEC devices). current_operator drawn from a working SPEC employee in
-- the device's department; nested fields stored as jsonb.
-- ---------------------------------------------------------------------------
delete from ww_devices
  where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into ww_devices (org_id, name, type, location, status, battery, last_sync, firmware, calibration, events_today, current_operator, current_recipe, measurements, history)
select o.id, v.name, v.type, v.location, v.status, v.battery, v.last_sync, v.firmware, v.calibration, v.events_today,
       v.current_operator::jsonb, v.current_recipe::jsonb, v.measurements::jsonb, v.history::jsonb
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  (
    'Bench Scale 1', 'Bench Scale', 'Packing', 'online', 84, '2m ago', 'v2.4.1', 'OK · 5 days ago', 16,
    '{"name":"Thandi Mokoena","role":"Packing lead","startedAt":"06:30","shift":"Morning"}',
    '{"name":"Mixed Salad Packs","expected":["Lettuce","Baby Spinach","Tomatoes","Cucumber"],"currentWaste":{"item":"Baby Spinach","qty":"640g"}}',
    '[{"time":"09:42","item":"Baby Spinach","qty":12,"unit":"kg"},{"time":"09:21","item":"Lettuce","qty":4.5,"unit":"kg"},{"time":"08:55","item":"Cucumber","qty":3.2,"unit":"kg"}]',
    '[{"kind":"recipe","label":"Recipe changed to Mixed Salad Packs","time":"06:30"},{"kind":"assigned","label":"Assigned to Thandi Mokoena","time":"06:30"},{"kind":"connected","label":"Connected","time":"06:05"}]'
  ),
  (
    'Bench Scale 2', 'Bench Scale', 'Packing', 'online', 67, '4m ago', 'v2.4.1', 'OK · 3 days ago', 11,
    '{"name":"Ridwaan Isaacs","role":"Packing operator","startedAt":"06:45","shift":"Morning"}',
    '{"name":"Berry Punnets","expected":["Strawberries","Blueberries","Grapes"],"currentWaste":{"item":"Strawberries","qty":"410g"}}',
    '[{"time":"10:08","item":"Strawberries","qty":18,"unit":"units"},{"time":"09:36","item":"Blueberries","qty":14,"unit":"units"}]',
    '[{"kind":"assigned","label":"Assigned to Ridwaan Isaacs","time":"06:45"},{"kind":"connected","label":"Connected","time":"06:10"}]'
  ),
  (
    'Floor Scale 1', 'Floor Scale', 'Receiving', 'online', 58, '6m ago', 'v2.4.0', 'OK · 8 days ago', 9,
    '{"name":"Aisha Patel","role":"Receiving lead","startedAt":"05:50","shift":"Early"}',
    null,
    '[{"time":"08:14","item":"Potatoes","qty":4,"unit":"crates"},{"time":"07:48","item":"Onions","qty":45,"unit":"kg"}]',
    '[{"kind":"assigned","label":"Assigned to Aisha Patel","time":"05:50"},{"kind":"connected","label":"Connected","time":"05:40"}]'
  ),
  (
    'Floor Scale 2', 'Floor Scale', 'Cold Store', 'attention', 16, '38m ago', 'v2.3.0', 'Due · 34 days ago', 4,
    null,
    null,
    '[{"time":"07:20","item":"Carrots","qty":60,"unit":"kg"},{"time":"06:58","item":"Butternut","qty":50,"unit":"kg"}]',
    '[{"kind":"calibration","label":"Calibration due","time":"Today"},{"kind":"connected","label":"Connected","time":"06:15"}]'
  ),
  (
    'Pallet Scale 1', 'Floor Scale', 'Dispatch', 'online', 73, '1m ago', 'v2.4.1', 'OK · 4 days ago', 7,
    '{"name":"Kabelo Nkosi","role":"Dispatch lead","startedAt":"06:00","shift":"Morning"}',
    null,
    '[{"time":"10:31","item":"Mixed pallet","qty":320,"unit":"kg"},{"time":"09:50","item":"Tomatoes","qty":3,"unit":"crates"}]',
    '[{"kind":"assigned","label":"Assigned to Kabelo Nkosi","time":"06:00"},{"kind":"connected","label":"Connected","time":"05:55"}]'
  ),
  (
    'Barcode Station 1', 'Barcode Station', 'Receiving', 'calibrating', 79, '1m ago', 'v3.0.2', 'In progress', 0,
    null,
    null,
    '[]',
    '[{"kind":"calibration","label":"Calibration started","time":"12:40"},{"kind":"connected","label":"Connected","time":"06:20"}]'
  ),
  (
    'Camera Station 1', 'Camera Station', 'Packing', 'online', null, 'Just now', 'v1.2.0', 'N/A', 6,
    '{"name":"Zanele Cele","role":"Packer","startedAt":"06:30","shift":"Morning"}',
    null,
    '[{"time":"11:34","item":"Lettuce","qty":36,"unit":"units"},{"time":"10:12","item":"Avocados","qty":72,"unit":"units"}]',
    '[{"kind":"assigned","label":"Assigned to Zanele Cele","time":"06:30"},{"kind":"connected","label":"Connected","time":"06:22"}]'
  )
) as v(name, type, location, status, battery, last_sync, firmware, calibration, events_today, current_operator, current_recipe, measurements, history);

-- ---------------------------------------------------------------------------
-- Waste events (25 rows). SPEC produce items, SPEC employees in plausible
-- departments, SPEC suppliers, SPEC devices. Costs total R23,098 for the week
-- (R18-25k target). Dates span the trading week ending 29 Jun 2026.
-- ---------------------------------------------------------------------------
delete from ww_waste_events
  where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into ww_waste_events (org_id, event_date, event_time, item, category, qty, unit, cost, reason, recipe, employee, device, location, preventable, notes, ingredient, supplier, batch, expected_qty)
select o.id, v.event_date::date, v.event_time, v.item, v.category, v.qty, v.unit, v.cost, v.reason, v.recipe,
       v.employee, v.device, v.location, v.preventable, v.notes, v.ingredient, v.supplier, v.batch, v.expected_qty
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  -- Leafy Greens
  ('2026-06-29','09:42','Baby Spinach','Leafy Greens',12.0,'kg',2028,'Wilted','Mixed Salad Packs','Thandi Mokoena','Bench Scale 1','Packing',true,'Held too long out of cold chain before packing','Baby Spinach','Philippi Fresh Co-op','PF-3318',8.0),
  ('2026-06-29','09:21','Lettuce','Leafy Greens',36.0,'units',680,'Wilted','Mixed Salad Packs','Zanele Cele','Camera Station 1','Packing',true,null,'Lettuce','Philippi Fresh Co-op','PF-3309',null),
  ('2026-06-28','14:05','Cabbage','Leafy Greens',40.0,'kg',356,'Spoiled',null,'Lwazi Dube','Floor Scale 2','Cold Store',false,'Outer leaves rotted in storage','Cabbage','Klein Karoo Veg','KK-1204',null),
  ('2026-06-28','08:30','Broccoli','Leafy Greens',14.0,'kg',1214,'Day-old',null,'Chris Adams','Floor Scale 1','Receiving',false,'Rejected on QC — yellowing florets','Broccoli','Klein Karoo Veg','KK-1188',null),
  ('2026-06-27','11:18','Green Beans','Leafy Greens',20.0,'kg',774,'Trim','Stir-fry Mix','Precious Ngwenya','Bench Scale 1','Packing',false,'Stringing and topping trim','Green Beans','Philippi Fresh Co-op',null,null),
  -- Root Veg
  ('2026-06-29','07:48','Onions','Root Veg',45.0,'kg',441,'Spoiled',null,'Sibusiso Ndlovu','Floor Scale 1','Receiving',false,'Soft/sprouting in delivered bags','Onions','Sandveld Potatoes','SP-0771',null),
  ('2026-06-28','08:14','Potatoes','Root Veg',4.0,'crates',1520,'Day-old',null,'Aisha Patel','Floor Scale 1','Receiving',false,'Green-skinned, rejected at receiving','Potatoes','Sandveld Potatoes','SP-0769',null),
  ('2026-06-28','07:20','Carrots','Root Veg',60.0,'kg',702,'Spoiled',null,'Pieter Botha','Floor Scale 2','Cold Store',false,'Soft and split after over-storage','Carrots','Klein Karoo Veg','KK-1175',null),
  ('2026-06-27','10:02','Sweet Potato','Root Veg',30.0,'kg',507,'Over-portioned','Roast Veg Packs','Katlego Tau','Bench Scale 2','Packing',true,'Cut too generously per pack','Sweet Potato','Klein Karoo Veg',null,22.0),
  ('2026-06-26','06:58','Butternut','Root Veg',50.0,'kg',395,'Trim','Butternut Cubes','Lindiwe Sibiya','Bench Scale 1','Packing',false,'Peel and seed trim','Butternut','Klein Karoo Veg',null,null),
  ('2026-06-25','13:40','Beetroot','Root Veg',24.0,'kg',514,'Spoiled',null,'Karabo Molefe','Floor Scale 2','Cold Store',false,null,'Beetroot','Klein Karoo Veg','KK-1140',null),
  -- Citrus
  ('2026-06-29','08:05','Oranges','Citrus',3.0,'crates',1134,'Spoiled',null,'Wandile Zwane','Floor Scale 1','Receiving',false,'Mould in bottom layer of crates','Oranges','Boland Citrus','BC-2255',null),
  ('2026-06-27','09:25','Lemons','Citrus',28.0,'kg',361,'Day-old',null,'Naledi Mahlangu','Floor Scale 1','Receiving',false,null,'Lemons','Boland Citrus','BC-2241',null),
  ('2026-06-26','11:50','Naartjies','Citrus',22.0,'kg',537,'Spoiled',null,'Sibusiso Ndlovu','Floor Scale 2','Cold Store',false,'Soft and splitting','Naartjies','Boland Citrus','BC-2230',null),
  -- Tropical
  ('2026-06-29','10:12','Avocados','Tropical',72.0,'units',785,'Over-portioned','Avo Halves','Zanele Cele','Camera Station 1','Packing',true,'Over-ripe rejected during packing','Avocados','Two Oceans Produce',null,48.0),
  ('2026-06-28','07:35','Bananas','Tropical',40.0,'kg',1076,'Day-old',null,'Bongani Sithole','Floor Scale 1','Receiving',false,'Blackened skins on inbound pallet','Bananas','Two Oceans Produce','TO-0915',null),
  ('2026-06-26','12:20','Mangoes','Tropical',2.0,'crates',900,'Spoiled',null,'Johan Smit','Floor Scale 2','Cold Store',false,'Anthracnose spotting','Mangoes','Two Oceans Produce','TO-0902',null),
  -- Berries
  ('2026-06-29','10:08','Strawberries','Berries',18.0,'units',1078,'Over-portioned','Berry Punnets','Ridwaan Isaacs','Bench Scale 2','Packing',true,'Consistently over-filled punnets — reduce order','Strawberries','Ceres Fruit Growers','CF-2291',12.0),
  ('2026-06-28','09:36','Blueberries','Berries',14.0,'units',594,'Spoiled','Berry Punnets','Ridwaan Isaacs','Bench Scale 2','Packing',false,'Soft fruit at base of punnets','Blueberries','Ceres Fruit Growers','CF-2287',null),
  ('2026-06-27','13:55','Grapes','Berries',18.0,'kg',1078,'Spoiled',null,'Lwazi Dube','Floor Scale 2','Cold Store',false,'Shatter and mould on bunches','Grapes','Hex River Grapes','HR-0488',null),
  -- Tomatoes & Peppers
  ('2026-06-29','09:50','Tomatoes','Tomatoes & Peppers',3.0,'crates',1494,'Spoiled',null,'Tshepo Mahlangu','Pallet Scale 1','Dispatch',false,'Crushed and split in transit crates','Tomatoes','Tygerberg Tomatoes','TT-0633',null),
  ('2026-06-28','11:12','Peppers','Tomatoes & Peppers',22.0,'kg',1505,'Spoiled',null,'Chris Adams','Floor Scale 1','Receiving',false,'Soft shoulders — QC reject','Peppers','Klein Karoo Veg','KK-1162',null),
  ('2026-06-26','10:40','Cucumber','Tomatoes & Peppers',30.0,'kg',1404,'Wilted',null,'Naledi Mahlangu','Floor Scale 1','Receiving',false,'Shrivelled after warm bay storage','Cucumber','Klein Karoo Veg','KK-1151',null),
  -- Other
  ('2026-06-29','08:48','Mushrooms','Other',9.0,'kg',1229,'Spoiled',null,'Pieter Botha','Floor Scale 2','Cold Store',false,'Sliming in punnets','Mushrooms','Cape Town Market','CM-1990',null),
  ('2026-06-27','12:30','Garlic','Other',8.0,'kg',792,'Spoiled',null,'Johan Smit','Floor Scale 2','Cold Store',false,'Sprouting and soft cloves','Garlic','Cape Town Market','CM-1977',null)
) as v(event_date, event_time, item, category, qty, unit, cost, reason, recipe, employee, device, location, preventable, notes, ingredient, supplier, batch, expected_qty);

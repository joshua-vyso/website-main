-- SupplySync demo seed for Fresh Valley Produce (Cape Town fruit & veg wholesale,
-- ~R7M/month, 40 staff). All money in ZAR. Re-runnable: deletes this org's rows
-- first, then re-inserts. Paste into the Supabase SQL editor and run.
-- Child rows cascade-delete with their suppliers; we also clear them explicitly
-- so a re-run after a schema change never leaves orphans.

delete from ss_supplier_history   where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);
delete from ss_supplier_risks     where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);
delete from ss_supplier_pricing   where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);
delete from ss_supplier_contacts  where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);
delete from ss_supplier_documents where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);
delete from ss_suppliers          where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

-- ---------------------------------------------------------------------------
-- 12 suppliers (base columns).
-- ---------------------------------------------------------------------------
insert into ss_suppliers (
  org_id, name, category, contact_name, contact_phone, contact_email,
  status, risk, rating, reliability, quality, delivery_pct, on_time_pct,
  price_trend, lead_time_days, last_issue, last_order, spend_mtd, notes
)
select o.id, v.name, v.category, v.contact_name, v.contact_phone, v.contact_email,
       v.status, v.risk, v.rating, v.reliability, v.quality, v.delivery_pct, v.on_time_pct,
       v.price_trend, v.lead_time_days, nullif(v.last_issue, ''), v.last_order::date, v.spend_mtd, v.notes::jsonb
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Ceres Fruit Growers',  'Pome & Stone Fruit', 'Hennie Lategan',    '023 312 1100', 'orders@ceresfruit.co.za',      'preferred', 'low',    5,   95, 94, 96, 96, 'stable',   2, '',                       '2026-06-28', 742000, '[{"body":"Locked July apple pricing at R23.80/kg — best rate in our base.","date":"2026-06-24","author":"Zinhle Khoza"},{"body":"COA and BEE certificate both current. Anchor supplier for Golden/Green apples.","date":"2026-06-10","author":"Megan Daniels"}]'),
  ('Philippi Fresh Co-op', 'Leafy Greens',       'Nomvula Mgcina',    '021 371 4480', 'sales@philippicoop.co.za',     'preferred', 'low',    5,   92, 91, 93, 94, 'stable',   1, '',                       '2026-06-29', 538000, '[{"body":"Preferred for spinach, lettuce and cabbage — same-day off the Cape Flats.","date":"2026-06-22","author":"Zinhle Khoza"},{"body":"Consistent quality on baby spinach all season.","date":"2026-06-05","author":"Chris Adams"}]'),
  ('Cape Town Market',     'Mixed Produce',      'Riaan Joubert',     '021 888 1900', 'agents@ctmarket.co.za',        'active',    'medium', 4,   84, 82, 86, 85, 'volatile', 1, 'Price spike on tomatoes', '2026-06-29', 905000, '[{"body":"Epping floor — our spot-buy fallback. Pricing swings daily with the auction.","date":"2026-06-27","author":"Pieter Steyn"},{"body":"Tomato lots ran R12/kg over forecast this week.","date":"2026-06-26","author":"Pieter Steyn"}]'),
  ('Stellenbosch Farms',   'Mixed Veg',          'Pieter Marais',     '021 884 3320', 'orders@stellfarms.co.za',      'active',    'low',    4,   88, 89, 87, 90, 'stable',   2, '',                       '2026-06-27', 472000, '[{"body":"Reliable on butternut, carrots and beetroot. Good consistency.","date":"2026-06-18","author":"Aisha Patel"}]'),
  ('Boland Citrus',        'Citrus',             'Andre du Toit',     '022 913 2210', 'sales@bolandcitrus.co.za',     'active',    'low',    4,   87, 88, 89, 91, 'stable',   3, '',                       '2026-06-26', 416000, '[{"body":"Oranges, lemons, naartjies — winter citrus season in full swing.","date":"2026-06-20","author":"Nadia Abrahams"}]'),
  ('Klein Karoo Veg',      'Root Veg',           'Sannie Vorster',    '044 272 5510', 'orders@kkveg.co.za',           'active',    'medium', 3,   79, 80, 78, 82, 'rising',   3, 'Short on potatoes',      '2026-06-25', 388000, '[{"body":"Potato and onion supply tightening — prices creeping up week on week.","date":"2026-06-23","author":"Aisha Patel"},{"body":"Last load 1.5t short on large potatoes; back-ordered.","date":"2026-06-21","author":"Wandile Zwane"}]'),
  ('Witzenberg Orchards',  'Pome Fruit',         'Johan Steyn',       '023 230 0440', 'pack@witzenberg.co.za',        'active',    'low',    4,   86, 90, 85, 88, 'stable',   2, '',                       '2026-06-28', 351000, '[{"body":"Secondary apple/pear supply behind Ceres. Quality strong.","date":"2026-06-16","author":"Chris Adams"}]'),
  ('Two Oceans Produce',   'Mixed Produce',      'Faried Hendricks',  '021 510 7720', 'sales@twooceans.co.za',        'review',    'medium', 3,   74, 76, 72, 77, 'volatile', 2, 'Late delivery x2',       '2026-06-24', 297000, '[{"body":"Two late deliveries this month — flagged. Escalate if it happens again.","date":"2026-06-24","author":"Kabelo Nkosi"},{"body":"Pricing inconsistent on peppers and cucumber.","date":"2026-06-15","author":"Pieter Steyn"}]'),
  ('Sandveld Potatoes',    'Root Veg',           'Dirk Pretorius',    '022 921 3300', 'orders@sandveld.co.za',        'active',    'low',    4,   85, 84, 86, 89, 'stable',   3, '',                       '2026-06-27', 268000, '[{"body":"Dedicated potato grower — large/medium washed. Steady volumes.","date":"2026-06-19","author":"Aisha Patel"}]'),
  ('Tygerberg Tomatoes',   'Tomatoes & Peppers', 'Lerato Mahlangu',   '021 949 6680', 'sales@tygtomatoes.co.za',      'active',    'medium', 3,   78, 81, 76, 80, 'rising',   2, 'Quality dip on plum',    '2026-06-26', 214000, '[{"body":"Plum tomato grade slipped on last two loads — monitoring.","date":"2026-06-22","author":"Chris Adams"},{"body":"Cocktail and on-the-vine still good.","date":"2026-06-12","author":"Nadia Abrahams"}]'),
  ('Hex River Grapes',     'Grapes & Berries',   'Wilhelm Basson',    '023 356 1180', 'export@hexrivergrapes.co.za',  'review',    'high',   3,   68, 85, 64, 70, 'volatile', 4, 'Season ending — availability dropping','2026-06-18', 132000, '[{"body":"Table-grape season winding down — availability dropping fast.","date":"2026-06-18","author":"Bheki Ngcobo"},{"body":"Insurance certificate expiring soon — chase before next contract.","date":"2026-06-11","author":"Rajesh Naidoo"}]'),
  ('Elgin Apple Co',       'Pome Fruit',         'Catherine Wallace', '021 848 9090', 'orders@elginapple.co.za',      'active',    'low',    4,   83, 88, 84, 87, 'stable',   3, '',                       '2026-06-25', 191000, '[{"body":"Cold-store apples — good late-season quality. Backup to Ceres/Witzenberg.","date":"2026-06-14","author":"Chris Adams"}]')
) as v(name, category, contact_name, contact_phone, contact_email, status, risk, rating, reliability, quality, delivery_pct, on_time_pct, price_trend, lead_time_days, last_issue, last_order, spend_mtd, notes)
where exists (select 1 from organisations org2 where org2.name = 'Fresh Valley Produce');

-- ---------------------------------------------------------------------------
-- Intelligence columns (overall score, sub-scores, categories, trends, spend).
-- ---------------------------------------------------------------------------
update ss_suppliers s set
  overall_score        = v.overall_score,
  price_stability      = v.price_stability,
  delivery_consistency = v.delivery_consistency,
  responsiveness       = v.responsiveness,
  compliance_score     = v.compliance_score,
  avg_monthly_spend    = v.avg_monthly_spend,
  categories           = v.categories,
  market_position      = v.market_position,
  late_deliveries      = v.late_deliveries,
  quality_issues       = v.quality_issues,
  complaints           = v.complaints,
  response_hours       = v.response_hours,
  reliability_trend    = v.reliability_trend::jsonb,
  delivery_trend       = v.delivery_trend::jsonb,
  score_trend          = v.score_trend::jsonb
from (values
  ('Ceres Fruit Growers',  96, 91, 96, 95, 100, 728000, array['Golden apples','Green apples','Pears'],            'at',    0, 0, 0, 2.5,  '[93,94,95,95,96,96]', '[95,96,95,96,96,96]', '[93,94,95,95,96,96]'),
  ('Philippi Fresh Co-op', 93, 90, 93, 92, 98,  521000, array['Spinach','Lettuce','Cabbage','Baby spinach'],      'below', 0, 0, 0, 3.0,  '[90,91,92,92,93,93]', '[92,92,93,93,94,94]', '[90,91,92,92,93,93]'),
  ('Cape Town Market',     82, 60, 85, 84, 88,  912000, array['Tomatoes','Mixed veg','Peppers','Cucumber'],       'above', 1, 1, 1, 5.0,  '[86,84,85,83,84,84]', '[88,86,87,85,86,85]', '[85,83,84,82,83,82]'),
  ('Stellenbosch Farms',   88, 89, 88, 87, 96,  466000, array['Butternut','Carrots','Beetroot'],                   'at',    0, 0, 0, 4.0,  '[87,88,88,89,88,88]', '[86,87,88,87,88,87]', '[87,88,88,88,88,88]'),
  ('Boland Citrus',        91, 90, 90, 88, 97,  409000, array['Oranges','Lemons','Naartjies','Grapefruit'],        'below', 0, 0, 0, 3.5,  '[85,86,87,87,88,87]', '[88,89,90,89,90,90]', '[88,89,90,90,91,91]'),
  ('Klein Karoo Veg',      78, 72, 80, 78, 84,  394000, array['Potatoes','Onions','Sweet potato'],                 'above', 1, 0, 0, 6.5,  '[81,80,79,79,78,79]', '[80,79,80,78,79,78]', '[80,79,78,78,77,78]'),
  ('Witzenberg Orchards',  87, 90, 87, 86, 94,  346000, array['Apples','Pears','Nectarines'],                       'at',    0, 0, 0, 4.5,  '[85,86,86,86,87,87]', '[84,85,85,86,85,85]', '[85,86,86,87,87,87]'),
  ('Two Oceans Produce',   72, 62, 74, 73, 76,  305000, array['Peppers','Cucumber','Mixed produce'],               'above', 2, 1, 2, 12.0, '[77,76,75,74,74,73]', '[80,78,76,75,74,72]', '[76,75,74,73,72,72]'),
  ('Sandveld Potatoes',    86, 88, 86, 85, 95,  272000, array['Potatoes','Washed potatoes'],                        'below', 0, 0, 0, 5.5,  '[84,85,85,85,86,86]', '[85,86,86,86,86,86]', '[84,85,85,86,86,86]'),
  ('Tygerberg Tomatoes',   77, 71, 78, 76, 83,  219000, array['Plum tomatoes','Cocktail tomatoes','On-the-vine'],  'at',    0, 2, 1, 7.5,  '[80,80,79,78,78,77]', '[79,80,79,77,78,76]', '[79,79,78,77,77,77]'),
  ('Hex River Grapes',     66, 58, 68, 66, 62,  138000, array['Red grapes','White grapes','Berries'],              'above', 1, 2, 1, 16.0, '[72,71,70,69,68,68]', '[74,72,71,70,69,70]', '[70,69,68,67,66,66]'),
  ('Elgin Apple Co',       84, 88, 85, 84, 92,  198000, array['Apples','Pears'],                                    'below', 0, 0, 0, 5.0,  '[82,83,83,83,84,84]', '[83,84,84,84,84,84]', '[82,83,83,84,84,84]')
) as v(name, overall_score, price_stability, delivery_consistency, responsiveness, compliance_score, avg_monthly_spend, categories, market_position, late_deliveries, quality_issues, complaints, response_hours, reliability_trend, delivery_trend, score_trend)
where s.name = v.name and s.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

-- ---------------------------------------------------------------------------
-- Compliance documents (contract / coa / bee / insurance / tax / food-safety /
-- price-list). Status valid | expiring | expired | missing, coherent with risk.
-- ---------------------------------------------------------------------------
insert into ss_supplier_documents (org_id, supplier_id, doc_type, label, status, expiry)
select s.org_id, s.id, v.doc_type, v.label, v.status, nullif(v.expiry, '')::date
from ss_suppliers s
join (values
  ('Ceres Fruit Growers',  'contract',         'Supply agreement 2026',       'valid',    '2027-03-31'),
  ('Ceres Fruit Growers',  'coa',              'Certificate of Analysis',     'valid',    '2026-12-31'),
  ('Ceres Fruit Growers',  'bee-certificate',  'B-BBEE certificate',          'valid',    '2027-02-28'),
  ('Ceres Fruit Growers',  'food-safety',      'Food safety (GLOBALG.A.P.)',  'valid',    '2027-01-31'),
  ('Philippi Fresh Co-op', 'contract',         'Co-op supply agreement',      'valid',    '2027-01-31'),
  ('Philippi Fresh Co-op', 'bee-certificate',  'B-BBEE certificate',          'valid',    '2026-11-30'),
  ('Philippi Fresh Co-op', 'tax-clearance',    'SARS tax clearance',          'valid',    '2026-12-31'),
  ('Philippi Fresh Co-op', 'food-safety',      'Food safety certificate',     'valid',    '2026-10-31'),
  ('Cape Town Market',     'contract',         'Market trading agreement',    'valid',    '2026-12-31'),
  ('Cape Town Market',     'insurance',        'Public liability cover',      'expiring', '2026-07-31'),
  ('Cape Town Market',     'price-list',       'June price list',             'valid',    '2026-07-31'),
  ('Stellenbosch Farms',   'contract',         'Supply agreement 2026',       'valid',    '2027-04-30'),
  ('Stellenbosch Farms',   'coa',              'Certificate of Analysis',     'valid',    '2026-10-31'),
  ('Stellenbosch Farms',   'bee-certificate',  'B-BBEE certificate',          'valid',    '2027-01-31'),
  ('Boland Citrus',        'contract',         'Citrus supply agreement',     'valid',    '2027-05-31'),
  ('Boland Citrus',        'coa',              'Certificate of Analysis',     'valid',    '2026-11-30'),
  ('Boland Citrus',        'tax-clearance',    'SARS tax clearance',          'valid',    '2026-12-31'),
  ('Boland Citrus',        'bank-confirmation','Bank confirmation letter',    'valid',    '2027-06-30'),
  ('Klein Karoo Veg',      'contract',         'Supply agreement 2026',       'valid',    '2026-12-31'),
  ('Klein Karoo Veg',      'bee-certificate',  'B-BBEE certificate',          'expiring', '2026-07-15'),
  ('Klein Karoo Veg',      'tax-clearance',    'SARS tax clearance',          'valid',    '2026-12-31'),
  ('Witzenberg Orchards',  'contract',         'Pack-house supply agreement', 'valid',    '2027-02-28'),
  ('Witzenberg Orchards',  'coa',              'Certificate of Analysis',     'valid',    '2026-12-31'),
  ('Two Oceans Produce',   'contract',         'Supply agreement 2026',       'valid',    '2026-09-30'),
  ('Two Oceans Produce',   'tax-clearance',    'SARS tax clearance',          'missing',  ''),
  ('Two Oceans Produce',   'bee-certificate',  'B-BBEE certificate',          'expiring', '2026-07-20'),
  ('Two Oceans Produce',   'food-safety',      'Food safety certificate',     'expired',  '2026-05-31'),
  ('Sandveld Potatoes',    'contract',         'Supply agreement 2026',       'valid',    '2027-03-31'),
  ('Sandveld Potatoes',    'coa',              'Certificate of Analysis',     'valid',    '2026-11-30'),
  ('Tygerberg Tomatoes',   'contract',         'Supply agreement 2026',       'valid',    '2026-12-31'),
  ('Tygerberg Tomatoes',   'coa',              'Certificate of Analysis',     'expiring', '2026-07-31'),
  ('Hex River Grapes',     'contract',         'Seasonal supply agreement',   'valid',    '2026-08-31'),
  ('Hex River Grapes',     'insurance',        'Goods-in-transit cover',      'expiring', '2026-07-10'),
  ('Hex River Grapes',     'tax-clearance',    'SARS tax clearance',          'missing',  ''),
  ('Hex River Grapes',     'coa',              'Certificate of Analysis',     'expired',  '2026-06-15'),
  ('Elgin Apple Co',       'contract',         'Cold-store supply agreement', 'valid',    '2027-01-31'),
  ('Elgin Apple Co',       'bee-certificate',  'B-BBEE certificate',          'valid',    '2026-12-31')
) as v(supplier_name, doc_type, label, status, expiry) on v.supplier_name = s.name
where s.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

-- ---------------------------------------------------------------------------
-- Contacts (multiple per supplier).
-- ---------------------------------------------------------------------------
insert into ss_supplier_contacts (org_id, supplier_id, name, role, email, phone, preferred_method, is_primary, sort_order)
select s.org_id, s.id, v.name, v.role, v.email, v.phone, v.method, v.is_primary, v.sort_order
from ss_suppliers s
join (values
  ('Ceres Fruit Growers',  'Hennie Lategan',   'Sales',          'orders@ceresfruit.co.za',   '023 312 1100', 'Call',     true,  0),
  ('Ceres Fruit Growers',  'Marlize Botha',    'Accounts',       'accounts@ceresfruit.co.za', '023 312 1104', 'Email',    false, 1),
  ('Ceres Fruit Growers',  'Deon Fourie',      'Dispatch',       'dispatch@ceresfruit.co.za', '082 551 2210', 'WhatsApp', false, 2),
  ('Philippi Fresh Co-op', 'Nomvula Mgcina',   'Sales',          'sales@philippicoop.co.za',  '021 371 4480', 'WhatsApp', true,  0),
  ('Philippi Fresh Co-op', 'Sipho Dlamini',    'Owner/Manager',  'sipho@philippicoop.co.za',  '083 220 4471', 'Call',     false, 1),
  ('Cape Town Market',     'Riaan Joubert',    'Sales',          'agents@ctmarket.co.za',     '021 888 1900', 'Call',     true,  0),
  ('Cape Town Market',     'Yusuf Adams',      'After-hours',    null,                        '072 900 3312', 'WhatsApp', false, 1),
  ('Stellenbosch Farms',   'Pieter Marais',    'Sales',          'orders@stellfarms.co.za',   '021 884 3320', 'Email',    true,  0),
  ('Stellenbosch Farms',   'Anke van Wyk',     'Accounts',       'accounts@stellfarms.co.za', '021 884 3325', 'Email',    false, 1),
  ('Boland Citrus',        'Andre du Toit',    'Sales',          'sales@bolandcitrus.co.za',  '022 913 2210', 'Call',     true,  0),
  ('Boland Citrus',        'Tania Smit',       'Accounts',       'accounts@bolandcitrus.co.za','022 913 2214','Email',    false, 1),
  ('Boland Citrus',        'Jaco Meyer',       'Dispatch',       null,                        '084 447 1180', 'WhatsApp', false, 2),
  ('Klein Karoo Veg',      'Sannie Vorster',   'Owner/Manager',  'orders@kkveg.co.za',        '044 272 5510', 'Call',     true,  0),
  ('Witzenberg Orchards',  'Johan Steyn',      'Sales',          'pack@witzenberg.co.za',     '023 230 0440', 'Email',    true,  0),
  ('Two Oceans Produce',   'Faried Hendricks', 'Sales',          'sales@twooceans.co.za',     '021 510 7720', 'WhatsApp', true,  0),
  ('Two Oceans Produce',   'Rushda Petersen',  'Accounts',       'accounts@twooceans.co.za',  '021 510 7724', 'Email',    false, 1),
  ('Sandveld Potatoes',    'Dirk Pretorius',   'Owner/Manager',  'orders@sandveld.co.za',     '022 921 3300', 'Call',     true,  0),
  ('Tygerberg Tomatoes',   'Lerato Mahlangu',  'Sales',          'sales@tygtomatoes.co.za',   '021 949 6680', 'WhatsApp', true,  0),
  ('Hex River Grapes',     'Wilhelm Basson',   'Sales',          'export@hexrivergrapes.co.za','023 356 1180','Email',    true,  0),
  ('Hex River Grapes',     'Elmarie Kruger',   'Accounts',       'accounts@hexrivergrapes.co.za','023 356 1184','Email',  false, 1),
  ('Elgin Apple Co',       'Catherine Wallace','Sales',          'orders@elginapple.co.za',   '021 848 9090', 'Call',     true,  0)
) as v(supplier_name, name, role, email, phone, method, is_primary, sort_order) on v.supplier_name = s.name
where s.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

-- ---------------------------------------------------------------------------
-- Pricing history visibility (per item/category). current vs previous vs market.
-- ---------------------------------------------------------------------------
insert into ss_supplier_pricing (org_id, supplier_id, item, category, unit, current_price, previous_price, market_avg, last_updated, trend, sort_order)
select s.org_id, s.id, v.item, v.category, v.unit, v.current_price, v.previous_price, v.market_avg, v.last_updated::date, v.trend::jsonb, v.sort_order
from ss_suppliers s
join (values
  ('Boland Citrus',        'Oranges',         'Citrus',            'kg', 12.60, 12.80, 13.70, '2026-06-26', '[13.6,13.4,13.2,12.9,12.8,12.6]', 0),
  ('Boland Citrus',        'Lemons',          'Citrus',            'kg', 18.40, 18.20, 19.10, '2026-06-26', '[19.0,18.8,18.6,18.4,18.2,18.4]', 1),
  ('Boland Citrus',        'Naartjies',       'Citrus',            'kg', 16.20, 16.50, 16.90, '2026-06-24', '[17.1,16.9,16.7,16.5,16.5,16.2]', 2),
  ('Ceres Fruit Growers',  'Golden apples',   'Pome Fruit',        'kg', 23.80, 23.50, 24.10, '2026-06-28', '[23.2,23.4,23.5,23.6,23.5,23.8]', 0),
  ('Ceres Fruit Growers',  'Green apples',    'Pome Fruit',        'kg', 22.10, 22.00, 22.40, '2026-06-28', '[21.8,21.9,22.0,22.0,22.0,22.1]', 1),
  ('Ceres Fruit Growers',  'Pears',           'Pome Fruit',        'kg', 20.90, 20.60, 21.20, '2026-06-27', '[20.4,20.5,20.6,20.7,20.6,20.9]', 2),
  ('Hex River Grapes',     'Red grapes',      'Grapes & Berries',  'kg', 41.20, 38.50, 36.80, '2026-06-18', '[35.5,36.2,37.4,38.5,39.8,41.2]', 0),
  ('Hex River Grapes',     'White grapes',    'Grapes & Berries',  'kg', 39.80, 37.20, 35.90, '2026-06-18', '[34.8,35.6,36.4,37.2,38.5,39.8]', 1),
  ('Philippi Fresh Co-op', 'Baby spinach',    'Leafy Greens',      'kg', 28.40, 28.60, 30.10, '2026-06-29', '[29.4,29.0,28.8,28.6,28.5,28.4]', 0),
  ('Philippi Fresh Co-op', 'Iceberg lettuce', 'Leafy Greens',      'ea', 11.20, 11.30, 12.00, '2026-06-29', '[11.8,11.6,11.4,11.3,11.3,11.2]', 1),
  ('Klein Karoo Veg',      'Potatoes (L)',    'Root Veg',          'kg',  9.80,  9.20,  9.40, '2026-06-25', '[8.6,8.8,9.0,9.2,9.5,9.8]',       0),
  ('Klein Karoo Veg',      'Onions',          'Root Veg',          'kg',  8.40,  7.90,  8.10, '2026-06-24', '[7.4,7.6,7.8,7.9,8.1,8.4]',       1),
  ('Sandveld Potatoes',    'Potatoes (washed)','Root Veg',         'kg',  9.10,  9.10,  9.40, '2026-06-27', '[9.0,9.1,9.1,9.1,9.1,9.1]',       0),
  ('Tygerberg Tomatoes',   'Plum tomatoes',   'Tomatoes & Peppers','kg', 16.80, 15.90, 16.40, '2026-06-26', '[15.2,15.5,15.7,15.9,16.3,16.8]', 0),
  ('Tygerberg Tomatoes',   'Cocktail tomatoes','Tomatoes & Peppers','kg',24.60, 24.20, 24.80, '2026-06-25', '[23.9,24.0,24.1,24.2,24.4,24.6]', 1),
  ('Cape Town Market',     'Tomatoes (mixed)','Tomatoes & Peppers','kg', 19.40, 16.80, 16.90, '2026-06-29', '[15.8,16.2,16.8,17.6,18.5,19.4]', 0),
  ('Stellenbosch Farms',   'Butternut',       'Mixed Veg',         'kg',  8.90,  8.80,  9.10, '2026-06-27', '[8.6,8.7,8.8,8.8,8.9,8.9]',       0),
  ('Stellenbosch Farms',   'Carrots',         'Mixed Veg',         'kg',  7.60,  7.50,  7.80, '2026-06-27', '[7.3,7.4,7.5,7.5,7.6,7.6]',       1),
  ('Witzenberg Orchards',  'Pears',           'Pome Fruit',        'kg', 21.10, 21.00, 21.20, '2026-06-28', '[20.7,20.8,20.9,21.0,21.0,21.1]', 0),
  ('Elgin Apple Co',       'Apples (cold)',   'Pome Fruit',        'kg', 22.60, 22.90, 24.00, '2026-06-25', '[23.4,23.2,23.0,22.9,22.8,22.6]', 0),
  ('Two Oceans Produce',   'Green peppers',   'Tomatoes & Peppers','kg', 22.40, 20.10, 20.80, '2026-06-24', '[19.2,19.6,20.1,20.8,21.6,22.4]', 0),
  ('Two Oceans Produce',   'Cucumber',        'Mixed Veg',         'ea',  8.90,  8.10,  8.30, '2026-06-24', '[7.6,7.8,8.1,8.4,8.7,8.9]',       1)
) as v(supplier_name, item, category, unit, current_price, previous_price, market_avg, last_updated, trend, sort_order) on v.supplier_name = s.name
where s.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

-- ---------------------------------------------------------------------------
-- Risk register.
-- ---------------------------------------------------------------------------
insert into ss_supplier_risks (org_id, supplier_id, risk_type, severity, description, suggested_action, owner, status, due_date)
select s.org_id, s.id, v.risk_type, v.severity, v.description, v.suggested_action, v.owner, v.status, nullif(v.due_date,'')::date
from ss_suppliers s
join (values
  ('Hex River Grapes',   'Expiring Document',  'high',     'Goods-in-transit insurance expires 10 Jul 2026.',            'Request renewed insurance certificate before next order.', 'Rajesh Naidoo', 'in_progress', '2026-07-08'),
  ('Hex River Grapes',   'Missing Document',   'high',     'SARS tax clearance not on file.',                            'Request tax clearance certificate.',                       'Rajesh Naidoo', 'open',        '2026-07-05'),
  ('Hex River Grapes',   'Price Volatility',   'high',     'Grape prices up 12% vs market as season ends.',              'Reduce reliance; confirm alternative grape supply.',       'Pieter Steyn',  'open',        '2026-07-10'),
  ('Hex River Grapes',   'Quality Issue',      'medium',   'Two quality flags on last grape loads.',                     'Inspect next delivery; log grade on arrival.',             'Chris Adams',   'open',        '2026-07-06'),
  ('Two Oceans Produce', 'Missing Document',   'high',     'SARS tax clearance missing; food-safety cert expired.',      'Request both documents; hold new orders until received.',  'Kabelo Nkosi',  'in_progress', '2026-07-04'),
  ('Two Oceans Produce', 'Late Delivery',      'medium',   'Two late deliveries this month.',                            'Escalate with supplier; review delivery schedule.',        'Kabelo Nkosi',  'open',        '2026-07-07'),
  ('Two Oceans Produce', 'Expiring Document',  'medium',   'B-BBEE certificate expires 20 Jul 2026.',                    'Request updated B-BBEE certificate.',                      'Rajesh Naidoo', 'open',        '2026-07-15'),
  ('Cape Town Market',   'Price Volatility',   'medium',   'Tomato pricing swung R12/kg over forecast this week.',        'Cap spot-buy volume; watch daily auction.',                'Pieter Steyn',  'in_progress', '2026-07-03'),
  ('Cape Town Market',   'Expiring Document',  'medium',   'Public liability cover expires 31 Jul 2026.',                'Request renewed liability certificate.',                   'Rajesh Naidoo', 'open',        '2026-07-20'),
  ('Klein Karoo Veg',    'Expiring Document',  'medium',   'B-BBEE certificate expires 15 Jul 2026.',                    'Request updated B-BBEE certificate.',                      'Aisha Patel',   'open',        '2026-07-12'),
  ('Klein Karoo Veg',    'Price Volatility',   'medium',   'Potato and onion prices rising week on week.',               'Lock a forward rate or shift volume to Sandveld.',         'Aisha Patel',   'open',        '2026-07-09'),
  ('Tygerberg Tomatoes', 'Quality Issue',      'medium',   'Plum-tomato grade slipped on last two loads.',               'Inspect on arrival; raise with supplier if repeated.',     'Chris Adams',   'open',        '2026-07-08'),
  ('Tygerberg Tomatoes', 'Expiring Document',  'low',      'Certificate of Analysis expires 31 Jul 2026.',               'Request updated COA.',                                     'Rajesh Naidoo', 'open',        '2026-07-25'),
  ('Klein Karoo Veg',    'Low Responsiveness', 'low',      'Slower to respond (avg 6.5h) than preferred suppliers.',      'Confirm best contact channel and hours.',                  'Aisha Patel',   'ignored',     '')
) as v(supplier_name, risk_type, severity, description, suggested_action, owner, status, due_date) on v.supplier_name = s.name
where s.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

-- ---------------------------------------------------------------------------
-- Relationship history — timeline, communication log and follow-ups.
-- ---------------------------------------------------------------------------
insert into ss_supplier_history (org_id, supplier_id, event_type, channel, summary, contact_name, follow_up, follow_up_date, follow_up_done, owner, event_date)
select s.org_id, s.id, v.event_type, nullif(v.channel,''), v.summary, nullif(v.contact_name,''), nullif(v.follow_up,''), nullif(v.follow_up_date,'')::date, v.follow_up_done, v.owner, v.event_date::date
from ss_suppliers s
join (values
  ('Ceres Fruit Growers',  'price_update',      'Price Update',     'Locked July apple pricing at R23.80/kg.',                 'Hennie Lategan',   '',                                    '',           false, 'Zinhle Khoza', '2026-06-24'),
  ('Ceres Fruit Growers',  'document_uploaded', 'Document Request', 'Received updated GLOBALG.A.P. food-safety cert.',         'Marlize Botha',    '',                                    '',           false, 'Megan Daniels','2026-06-20'),
  ('Ceres Fruit Growers',  'call',              'Call',             'Confirmed July apple volumes and delivery windows.',      'Hennie Lategan',   '',                                    '',           false, 'Zinhle Khoza', '2026-06-18'),
  ('Philippi Fresh Co-op', 'whatsapp',          'WhatsApp',         'Confirmed same-day spinach and lettuce for the week.',    'Nomvula Mgcina',   '',                                    '',           false, 'Zinhle Khoza', '2026-06-22'),
  ('Philippi Fresh Co-op', 'marked_preferred',  '',                 'Marked as preferred supplier for leafy greens.',          '',                 '',                                    '',           false, 'Pieter Steyn', '2026-06-14'),
  ('Cape Town Market',     'complaint',         'Complaint',        'Raised tomato lots running R12/kg over forecast.',        'Riaan Joubert',    'Confirm capped spot-buy volume for July',   '2026-07-02', false, 'Pieter Steyn', '2026-06-26'),
  ('Cape Town Market',     'price_update',      'Price Update',     'Daily auction pricing shared; tomatoes up sharply.',       'Riaan Joubert',    '',                                    '',           false, 'Pieter Steyn', '2026-06-27'),
  ('Boland Citrus',        'price_list_received','Price Update',    'Received winter citrus price list — 8% below market.',     'Andre du Toit',    'Prioritise Boland for citrus orders this week', '2026-07-01', false, 'Nadia Abrahams','2026-06-26'),
  ('Boland Citrus',        'call',              'Call',             'Discussed naartjie availability into July.',              'Andre du Toit',    '',                                    '',           false, 'Nadia Abrahams','2026-06-20'),
  ('Klein Karoo Veg',      'delivery_issue',    'Delivery Issue',   'Last load 1.5t short on large potatoes; back-ordered.',    'Sannie Vorster',   'Confirm back-order delivery date',          '2026-07-03', false, 'Wandile Zwane','2026-06-21'),
  ('Klein Karoo Veg',      'document_request',  'Document Request', 'Requested updated B-BBEE certificate (expiring).',         'Sannie Vorster',   'Chase B-BBEE certificate',                  '2026-07-12', false, 'Aisha Patel',  '2026-06-23'),
  ('Two Oceans Produce',   'delivery_issue',    'Delivery Issue',   'Second late delivery this month — flagged for review.',    'Faried Hendricks', 'Escalate if a third late delivery occurs',  '2026-07-07', false, 'Kabelo Nkosi', '2026-06-24'),
  ('Two Oceans Produce',   'document_request',  'Document Request', 'Requested tax clearance + food-safety renewal.',          'Rushda Petersen',  'Hold new orders until documents received',  '2026-07-04', false, 'Kabelo Nkosi', '2026-06-24'),
  ('Two Oceans Produce',   'compliance_issue',  '',                 'Compliance gap opened: tax clearance missing.',           '',                 '',                                    '',           false, 'Rajesh Naidoo','2026-06-24'),
  ('Witzenberg Orchards',  'order_linked',      '',                 'ProcurePulse order linked — 2.4t apples.',                '',                 '',                                    '',           false, 'Chris Adams',  '2026-06-28'),
  ('Sandveld Potatoes',    'call',              'Call',             'Confirmed steady washed-potato volumes for July.',        'Dirk Pretorius',   '',                                    '',           false, 'Aisha Patel',  '2026-06-19'),
  ('Tygerberg Tomatoes',   'complaint',         'Complaint',        'Raised plum-tomato grade dip on last two loads.',         'Lerato Mahlangu',  'Inspect next delivery grade on arrival',    '2026-07-08', false, 'Chris Adams',  '2026-06-22'),
  ('Hex River Grapes',     'meeting',           'Meeting',          'Season wind-down review; availability dropping fast.',      'Wilhelm Basson',   'Confirm alternative grape supply',          '2026-07-05', false, 'Bheki Ngcobo', '2026-06-18'),
  ('Hex River Grapes',     'document_request',  'Document Request', 'Requested insurance renewal + tax clearance.',            'Elmarie Kruger',   'Chase insurance certificate before next order','2026-07-08', false, 'Rajesh Naidoo','2026-06-17'),
  ('Elgin Apple Co',       'price_list_received','Price Update',    'Cold-store apple price list received — below market.',      'Catherine Wallace','',                                    '',           false, 'Chris Adams',  '2026-06-25')
) as v(supplier_name, event_type, channel, summary, contact_name, follow_up, follow_up_date, follow_up_done, owner, event_date) on v.supplier_name = s.name
where s.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

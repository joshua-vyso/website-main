-- SupplySync demo seed for Fresh Valley Produce (Cape Town fruit & veg wholesale,
-- ~R7M/month, 40 staff). All money in ZAR. Re-runnable: deletes this org's rows
-- first, then re-inserts. Paste into the Supabase SQL editor and run.
-- Documents cascade-delete with their suppliers, so we only need to clear suppliers.

delete from ss_supplier_documents where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);
delete from ss_suppliers          where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

-- 12 suppliers from the SPEC supply base. Spend_mtd sums to ~R5.46M (≈78% COGS of
-- a ~R7M month, the rest being market spot-buys). Risk/status/rating coherent.
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
  ('Hex River Grapes',     'Grapes & Berries',   'Wilhelm Basson',    '023 356 1180', 'export@hexrivergrapes.co.za',  'review',    'high',   3,   68, 85, 64, 70, 'volatile', 4, 'Season ending — low stock','2026-06-18', 132000, '[{"body":"Table-grape season winding down — availability dropping fast.","date":"2026-06-18","author":"Bheki Ngcobo"},{"body":"Insurance certificate expiring soon — chase before next contract.","date":"2026-06-11","author":"Rajesh Naidoo"}]'),
  ('Elgin Apple Co',       'Pome Fruit',         'Catherine Wallace', '021 848 9090', 'orders@elginapple.co.za',      'active',    'low',    4,   83, 88, 84, 87, 'stable',   3, '',                       '2026-06-25', 191000, '[{"body":"Cold-store apples — good late-season quality. Backup to Ceres/Witzenberg.","date":"2026-06-14","author":"Chris Adams"}]')
) as v(name, category, contact_name, contact_phone, contact_email, status, risk, rating, reliability, quality, delivery_pct, on_time_pct, price_trend, lead_time_days, last_issue, last_order, spend_mtd, notes)
where exists (select 1 from organisations org2 where org2.name = 'Fresh Valley Produce');

-- Compliance documents: 2-3 per supplier (contract / coa / bee-certificate /
-- insurance / tax-clearance). Status valid | expiring | missing, with expiry dates.
-- Coherent with supplier risk: preferred = all valid; review/high = gaps/expiring.
insert into ss_supplier_documents (org_id, supplier_id, doc_type, label, status, expiry)
select s.org_id, s.id, v.doc_type, v.label, v.status, nullif(v.expiry, '')::date
from ss_suppliers s
join (values
  ('Ceres Fruit Growers',  'contract',        'Supply agreement 2026',       'valid',    '2027-03-31'),
  ('Ceres Fruit Growers',  'coa',             'Certificate of Analysis',     'valid',    '2026-12-31'),
  ('Ceres Fruit Growers',  'bee-certificate', 'B-BBEE certificate',          'valid',    '2027-02-28'),
  ('Philippi Fresh Co-op', 'contract',        'Co-op supply agreement',      'valid',    '2027-01-31'),
  ('Philippi Fresh Co-op', 'bee-certificate', 'B-BBEE certificate',          'valid',    '2026-11-30'),
  ('Philippi Fresh Co-op', 'tax-clearance',   'SARS tax clearance',          'valid',    '2026-12-31'),
  ('Cape Town Market',     'contract',        'Market trading agreement',    'valid',    '2026-12-31'),
  ('Cape Town Market',     'insurance',       'Public liability cover',      'expiring', '2026-07-31'),
  ('Stellenbosch Farms',   'contract',        'Supply agreement 2026',       'valid',    '2027-04-30'),
  ('Stellenbosch Farms',   'coa',             'Certificate of Analysis',     'valid',    '2026-10-31'),
  ('Stellenbosch Farms',   'bee-certificate', 'B-BBEE certificate',          'valid',    '2027-01-31'),
  ('Boland Citrus',        'contract',        'Citrus supply agreement',     'valid',    '2027-05-31'),
  ('Boland Citrus',        'coa',             'Certificate of Analysis',     'valid',    '2026-11-30'),
  ('Boland Citrus',        'tax-clearance',   'SARS tax clearance',          'valid',    '2026-12-31'),
  ('Klein Karoo Veg',      'contract',        'Supply agreement 2026',       'valid',    '2026-12-31'),
  ('Klein Karoo Veg',      'bee-certificate', 'B-BBEE certificate',          'expiring', '2026-07-15'),
  ('Witzenberg Orchards',  'contract',        'Pack-house supply agreement', 'valid',    '2027-02-28'),
  ('Witzenberg Orchards',  'coa',             'Certificate of Analysis',     'valid',    '2026-12-31'),
  ('Two Oceans Produce',   'contract',        'Supply agreement 2026',       'valid',    '2026-09-30'),
  ('Two Oceans Produce',   'tax-clearance',   'SARS tax clearance',          'missing',  ''),
  ('Two Oceans Produce',   'bee-certificate', 'B-BBEE certificate',          'expiring', '2026-07-20'),
  ('Sandveld Potatoes',    'contract',        'Supply agreement 2026',       'valid',    '2027-03-31'),
  ('Sandveld Potatoes',    'coa',             'Certificate of Analysis',     'valid',    '2026-11-30'),
  ('Tygerberg Tomatoes',   'contract',        'Supply agreement 2026',       'valid',    '2026-12-31'),
  ('Tygerberg Tomatoes',   'coa',             'Certificate of Analysis',     'expiring', '2026-07-31'),
  ('Hex River Grapes',     'contract',        'Seasonal supply agreement',   'valid',    '2026-08-31'),
  ('Hex River Grapes',     'insurance',       'Goods-in-transit cover',      'expiring', '2026-07-10'),
  ('Hex River Grapes',     'tax-clearance',   'SARS tax clearance',          'missing',  ''),
  ('Elgin Apple Co',       'contract',        'Cold-store supply agreement', 'valid',    '2027-01-31'),
  ('Elgin Apple Co',       'bee-certificate', 'B-BBEE certificate',          'valid',    '2026-12-31')
) as v(supplier_name, doc_type, label, status, expiry) on v.supplier_name = s.name
where s.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

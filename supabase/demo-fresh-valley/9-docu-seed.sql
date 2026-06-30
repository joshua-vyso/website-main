-- Doc-U demo seed for Fresh Valley Produce (Cape Town fruit & veg wholesale,
-- ~R7M/month, 40 staff). All money in ZAR. Re-runnable: deletes this org's rows
-- first, then re-inserts. Paste into the Supabase SQL editor and run.
--
-- Tables: document_folders (custom filing folders) + documents (scanned supplier
-- invoices, delivery notes, statements + a couple of orders/price lists).
--
-- Columns are taken ONLY from what the code reads/writes:
--   document_folders: org_id, name, color, starred, created_by   (selected with *)
--   documents:        org_id, supplier_id, folder_id, filename, document_type,
--                     status, starred, confidence, extracted_data (jsonb),
--                     storage_path, uploaded_by, created_at        (selected with *)
--
-- NOTE: supplier_id is left NULL. The canonical `suppliers` table is not seeded
-- for this org (SupplySync seeds its own `ss_suppliers`), and Doc-U / the
-- ProcurePulse feed read the supplier name from extracted_data.supplier first
-- (procurepulse-feed.ts), falling back to suppliers only when supplier_id is set.
-- So every document carries its supplier in extracted_data.supplier — exactly how
-- a freshly-extracted document looks before a manual supplier link.

-- ---------------------------------------------------------------------------
-- Folders (custom). Names are deliberately NOT the built-in default category
-- names (Invoices / Statements / Delivery notes / Price lists / Orders) so they
-- render as their own tiles in the folder grid (isDefaultFolderName() hides
-- default-named folders behind the type tiles).
-- ---------------------------------------------------------------------------
delete from document_folders where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into document_folders (org_id, name, color, starred, created_by)
select o.id, v.name, v.color, v.starred, null
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Supplier invoices',   '#0C447C', true),
  ('Delivery notes — June','#854F0B', false),
  ('Supplier statements',  '#0F6E56', true),
  ('Market floor (CTM)',   '#C0345A', false),
  ('Price lists — June',   '#5B4FD6', false)
) as v(name, color, starred);

-- ---------------------------------------------------------------------------
-- Documents (18 scanned docs across June 2026). The bulk are supplier invoices
-- and delivery notes from the SPEC supplier base; plus three statements, a price
-- list and a customer order. Most are 'extracted' (awaiting review) with a couple
-- 'approved', one 'pending' (just uploaded, not yet extracted) and one 'error'
-- (low confidence) to populate the KPI roll-ups (total / awaiting / flagged).
--
-- folder_id resolves by joining document_folders on the folder name (natural key)
-- so no hardcoded uuids. Docs with no folder file under their type tile (folder = '').
--
-- extracted_data is valid jsonb: { fields:[{label,value,confidence}], line_items:[...],
-- supplier }. Invoice/delivery-note totals live in fields[] as "Total (incl. VAT)".
-- Statements additionally carry a `summary` object (the TRANSACTION SUMMARY the
-- statement-totals card + reconciliation read). Orders carry customer_name.
-- ---------------------------------------------------------------------------
delete from documents where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into documents (
  org_id, supplier_id, folder_id, filename, document_type, status,
  confidence, extracted_data, storage_path, uploaded_by, created_at
)
select
  o.id,
  null,                                                   -- supplier_id (see header note)
  f.id,                                                   -- folder_id resolved by name, or NULL
  v.filename,
  v.document_type,
  v.status,
  v.confidence,
  v.extracted_data::jsonb,
  v.storage_path,
  null,                                                   -- uploaded_by (demo: system upload)
  v.created_at::timestamptz
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  -- filename, document_type, status, starred, confidence, folder_name, extracted_data, storage_path, created_at

  -- ----- Supplier invoices -----
  ('ceres-fruit-growers-INV-20418.pdf', 'invoice', 'extracted', true, 96, 'Supplier invoices',
   '{"supplier":"Ceres Fruit Growers","fields":[{"label":"Supplier","value":"Ceres Fruit Growers","confidence":98},{"label":"Invoice number","value":"INV-20418","confidence":97},{"label":"Invoice date","value":"2026-06-28","confidence":96},{"label":"Total (incl. VAT)","value":"R 184 230.00","confidence":95},{"label":"VAT","value":"R 24 030.00","confidence":94}],"line_items":[{"description":"Apples-Golden (box)","quantity":"320","unit":"box","unit_price":"285.00","amount":"91200.00","confidence":96},{"description":"Apples-Green (box)","quantity":"180","unit":"box","unit_price":"270.00","amount":"48600.00","confidence":95},{"description":"Apples-Red (box)","quantity":"60","unit":"box","unit_price":"326.00","amount":"19560.00","confidence":94}]}',
   'demo/docu/ceres-fruit-growers-INV-20418.pdf', '2026-06-28T07:42:00Z'),

  ('philippi-fresh-coop-INV-7741.pdf', 'invoice', 'extracted', false, 93, 'Supplier invoices',
   '{"supplier":"Philippi Fresh Co-op","fields":[{"label":"Supplier","value":"Philippi Fresh Co-op","confidence":95},{"label":"Invoice number","value":"INV-7741","confidence":94},{"label":"Invoice date","value":"2026-06-29","confidence":93},{"label":"Total (incl. VAT)","value":"R 41 285.00","confidence":92},{"label":"VAT","value":"R 5 385.00","confidence":91}],"line_items":[{"description":"Baby Spinach (kg)","quantity":"240","unit":"kg","unit_price":"65.00","amount":"15600.00","confidence":94},{"description":"Lettuce-Iceberg (ea)","quantity":"600","unit":"ea","unit_price":"16.00","amount":"9600.00","confidence":92},{"description":"Cabbage (ea)","quantity":"800","unit":"ea","unit_price":"14.00","amount":"11200.00","confidence":91}]}',
   'demo/docu/philippi-fresh-coop-INV-7741.pdf', '2026-06-29T06:18:00Z'),

  ('boland-citrus-INV-3320.pdf', 'invoice', 'approved', false, 95, 'Supplier invoices',
   '{"supplier":"Boland Citrus","fields":[{"label":"Supplier","value":"Boland Citrus","confidence":97},{"label":"Invoice number","value":"INV-3320","confidence":96},{"label":"Invoice date","value":"2026-06-26","confidence":95},{"label":"Total (incl. VAT)","value":"R 62 745.00","confidence":94},{"label":"VAT","value":"R 8 184.00","confidence":93}],"line_items":[{"description":"Oranges (box)","quantity":"180","unit":"box","unit_price":"180.00","amount":"32400.00","confidence":95},{"description":"Lemons (box)","quantity":"90","unit":"box","unit_price":"210.00","amount":"18900.00","confidence":94},{"description":"Naartjies (box)","quantity":"66","unit":"box","unit_price":"165.00","amount":"10890.00","confidence":93}]}',
   'demo/docu/boland-citrus-INV-3320.pdf', '2026-06-26T08:05:00Z'),

  ('stellenbosch-farms-INV-9914.pdf', 'invoice', 'extracted', false, 90, 'Supplier invoices',
   '{"supplier":"Stellenbosch Farms","fields":[{"label":"Supplier","value":"Stellenbosch Farms","confidence":92},{"label":"Invoice number","value":"INV-9914","confidence":91},{"label":"Invoice date","value":"2026-06-27","confidence":90},{"label":"Total (incl. VAT)","value":"R 38 940.00","confidence":89}],"line_items":[{"description":"Butternut (kg)","quantity":"650","unit":"kg","unit_price":"18.00","amount":"11700.00","confidence":91},{"description":"Carrots (10kg)","quantity":"120","unit":"bag","unit_price":"88.00","amount":"10560.00","confidence":90},{"description":"Beetroot (bunch)","quantity":"260","unit":"bunch","unit_price":"18.00","amount":"4680.00","confidence":88},{"description":"Gem Squash (kg)","quantity":"600","unit":"kg","unit_price":"20.00","amount":"12000.00","confidence":89}]}',
   'demo/docu/stellenbosch-farms-INV-9914.pdf', '2026-06-27T07:11:00Z'),

  ('sandveld-potatoes-INV-1187.pdf', 'invoice', 'extracted', false, 94, 'Supplier invoices',
   '{"supplier":"Sandveld Potatoes","fields":[{"label":"Supplier","value":"Sandveld Potatoes","confidence":96},{"label":"Invoice number","value":"INV-1187","confidence":95},{"label":"Invoice date","value":"2026-06-27","confidence":94},{"label":"Total (incl. VAT)","value":"R 27 500.00","confidence":93}],"line_items":[{"description":"Potatoes (10kg)","quantity":"250","unit":"bag","unit_price":"110.00","amount":"27500.00","confidence":94}]}',
   'demo/docu/sandveld-potatoes-INV-1187.pdf', '2026-06-27T09:33:00Z'),

  ('tygerberg-tomatoes-INV-5562.pdf', 'invoice', 'error', false, 58, 'Supplier invoices',
   '{"supplier":"Tygerberg Tomatoes","fields":[{"label":"Supplier","value":"Tygerberg Tomatoes","confidence":61},{"label":"Invoice number","value":"INV-5562","confidence":55},{"label":"Invoice date","value":"2026-06-26","confidence":52},{"label":"Total (incl. VAT)","value":"R 19 920.00","confidence":48}],"line_items":[{"description":"Tomatoes (kg)","quantity":"700","unit":"kg","unit_price":"24.00","amount":"16800.00","confidence":57},{"description":"Peppers-Mixed (kg)","quantity":"40","unit":"kg","unit_price":"55.00","amount":"2200.00","confidence":54}]}',
   'demo/docu/tygerberg-tomatoes-INV-5562.pdf', '2026-06-26T10:47:00Z'),

  ('witzenberg-orchards-INV-8830.pdf', 'invoice', 'extracted', false, 92, 'Supplier invoices',
   '{"supplier":"Witzenberg Orchards","fields":[{"label":"Supplier","value":"Witzenberg Orchards","confidence":94},{"label":"Invoice number","value":"INV-8830","confidence":93},{"label":"Invoice date","value":"2026-06-28","confidence":92},{"label":"Total (incl. VAT)","value":"R 33 660.00","confidence":90}],"line_items":[{"description":"Apples-Red (box)","quantity":"60","unit":"box","unit_price":"326.00","amount":"19560.00","confidence":92},{"description":"Apples-Golden (box)","quantity":"50","unit":"box","unit_price":"285.00","amount":"14250.00","confidence":91}]}',
   'demo/docu/witzenberg-orchards-INV-8830.pdf', '2026-06-28T11:20:00Z'),

  ('elgin-apple-co-INV-4471.pdf', 'invoice', 'approved', false, 95, 'Supplier invoices',
   '{"supplier":"Elgin Apple Co","fields":[{"label":"Supplier","value":"Elgin Apple Co","confidence":96},{"label":"Invoice number","value":"INV-4471","confidence":95},{"label":"Invoice date","value":"2026-06-25","confidence":95},{"label":"Total (incl. VAT)","value":"R 22 800.00","confidence":94}],"line_items":[{"description":"Apples-Green (box)","quantity":"60","unit":"box","unit_price":"270.00","amount":"16200.00","confidence":95},{"description":"Apples-Golden (box)","quantity":"23","unit":"box","unit_price":"285.00","amount":"6555.00","confidence":93}]}',
   'demo/docu/elgin-apple-co-INV-4471.pdf', '2026-06-25T08:50:00Z'),

  ('klein-karoo-veg-INV-2204.pdf', 'invoice', 'extracted', false, 88, 'Supplier invoices',
   '{"supplier":"Klein Karoo Veg","fields":[{"label":"Supplier","value":"Klein Karoo Veg","confidence":90},{"label":"Invoice number","value":"INV-2204","confidence":89},{"label":"Invoice date","value":"2026-06-25","confidence":88},{"label":"Total (incl. VAT)","value":"R 23 750.00","confidence":86}],"line_items":[{"description":"Onions (10kg)","quantity":"150","unit":"bag","unit_price":"95.00","amount":"14250.00","confidence":88},{"description":"Sweet Potato (kg)","quantity":"300","unit":"kg","unit_price":"22.00","amount":"6600.00","confidence":86},{"description":"Garlic (kg)","quantity":"30","unit":"kg","unit_price":"95.00","amount":"2850.00","confidence":85}]}',
   'demo/docu/klein-karoo-veg-INV-2204.pdf', '2026-06-25T12:09:00Z'),

  -- ----- Delivery notes -----
  ('ceres-fruit-growers-DN-20418.pdf', 'delivery_note', 'extracted', false, 91, 'Delivery notes — June',
   '{"supplier":"Ceres Fruit Growers","fields":[{"label":"Supplier","value":"Ceres Fruit Growers","confidence":94},{"label":"Delivery note","value":"DN-20418","confidence":93},{"label":"Delivery date","value":"2026-06-28","confidence":92},{"label":"Linked invoice","value":"INV-20418","confidence":90}],"line_items":[{"description":"Apples-Golden (box)","quantity":"320","unit":"box","confidence":93},{"description":"Apples-Green (box)","quantity":"180","unit":"box","confidence":92},{"description":"Apples-Red (box)","quantity":"60","unit":"box","confidence":91}]}',
   'demo/docu/ceres-fruit-growers-DN-20418.pdf', '2026-06-28T07:55:00Z'),

  ('philippi-fresh-coop-DN-7741.pdf', 'delivery_note', 'extracted', false, 89, 'Delivery notes — June',
   '{"supplier":"Philippi Fresh Co-op","fields":[{"label":"Supplier","value":"Philippi Fresh Co-op","confidence":92},{"label":"Delivery note","value":"DN-7741","confidence":91},{"label":"Delivery date","value":"2026-06-29","confidence":90}],"line_items":[{"description":"Baby Spinach (kg)","quantity":"240","unit":"kg","confidence":91},{"description":"Lettuce-Iceberg (ea)","quantity":"600","unit":"ea","confidence":90},{"description":"Cabbage (ea)","quantity":"800","unit":"ea","confidence":89}]}',
   'demo/docu/philippi-fresh-coop-DN-7741.pdf', '2026-06-29T06:30:00Z'),

  ('two-oceans-produce-DN-6650.pdf', 'delivery_note', 'pending', false, null, 'Delivery notes — June',
   '{"supplier":"Two Oceans Produce","fields":[]}',
   'demo/docu/two-oceans-produce-DN-6650.pdf', '2026-06-30T05:48:00Z'),

  ('sandveld-potatoes-DN-1187.pdf', 'delivery_note', 'extracted', false, 93, 'Delivery notes — June',
   '{"supplier":"Sandveld Potatoes","fields":[{"label":"Supplier","value":"Sandveld Potatoes","confidence":95},{"label":"Delivery note","value":"DN-1187","confidence":94},{"label":"Delivery date","value":"2026-06-27","confidence":93},{"label":"Linked invoice","value":"INV-1187","confidence":92}],"line_items":[{"description":"Potatoes (10kg)","quantity":"250","unit":"bag","confidence":94}]}',
   'demo/docu/sandveld-potatoes-DN-1187.pdf', '2026-06-27T09:40:00Z'),

  -- ----- Statements (carry a TRANSACTION SUMMARY in extracted_data.summary) -----
  ('cape-town-market-STMT-2026-06.pdf', 'statement', 'extracted', true, 90, 'Market floor (CTM)',
   '{"supplier":"Cape Town Market","fields":[{"label":"Supplier","value":"Cape Town Market","confidence":93},{"label":"Statement period","value":"June 2026","confidence":92},{"label":"Closing balance","value":"R 905 000.00","confidence":90}],"summary":{"statement_date":"30/JUN/2026","opening_balance":812400.00,"payments":-740000.00,"total_purchases":905000.00,"total_pallet_refunds":-3200.00,"total_pallet_usage":4100.00,"vat":118043.48,"total_charges":12600.00,"closing_balance":1108943.48,"net_financial_transactions":296543.48,"audit_error":0.00}}',
   'demo/docu/cape-town-market-STMT-2026-06.pdf', '2026-06-30T16:02:00Z'),

  ('ceres-fruit-growers-STMT-2026-06.pdf', 'statement', 'extracted', false, 94, 'Supplier statements',
   '{"supplier":"Ceres Fruit Growers","fields":[{"label":"Supplier","value":"Ceres Fruit Growers","confidence":96},{"label":"Statement period","value":"June 2026","confidence":95},{"label":"Closing balance","value":"R 742 000.00","confidence":94}],"summary":{"statement_date":"30/JUN/2026","opening_balance":698500.00,"payments":-700000.00,"total_purchases":742000.00,"total_pallet_refunds":0.00,"total_pallet_usage":0.00,"vat":96782.61,"total_charges":0.00,"closing_balance":740500.00,"net_financial_transactions":42000.00,"audit_error":0.00}}',
   'demo/docu/ceres-fruit-growers-STMT-2026-06.pdf', '2026-06-30T16:08:00Z'),

  ('boland-citrus-STMT-2026-06.pdf', 'statement', 'approved', false, 95, 'Supplier statements',
   '{"supplier":"Boland Citrus","fields":[{"label":"Supplier","value":"Boland Citrus","confidence":97},{"label":"Statement period","value":"June 2026","confidence":96},{"label":"Closing balance","value":"R 416 000.00","confidence":95}],"summary":{"statement_date":"30/JUN/2026","opening_balance":388200.00,"payments":-360000.00,"total_purchases":416000.00,"total_pallet_refunds":-1500.00,"total_pallet_usage":2200.00,"vat":54260.87,"total_charges":1800.00,"closing_balance":446700.00,"net_financial_transactions":58500.00,"audit_error":0.00}}',
   'demo/docu/boland-citrus-STMT-2026-06.pdf', '2026-06-30T16:15:00Z'),

  -- ----- Price list -----
  ('cape-town-market-pricelist-2026-06.pdf', 'price_list', 'extracted', false, 91, 'Price lists — June',
   '{"supplier":"Cape Town Market","fields":[{"label":"Supplier","value":"Cape Town Market","confidence":93},{"label":"Effective date","value":"2026-06-24","confidence":91}],"line_items":[{"description":"Tomatoes (kg)","unit":"kg","unit_price":"24.00","confidence":92},{"description":"Peppers-Mixed (kg)","unit":"kg","unit_price":"55.00","confidence":91},{"description":"Cucumber (ea)","unit":"ea","unit_price":"9.00","confidence":90},{"description":"Broccoli (kg)","unit":"kg","unit_price":"52.00","confidence":90},{"description":"Green Beans (kg)","unit":"kg","unit_price":"48.00","confidence":89}]}',
   'demo/docu/cape-town-market-pricelist-2026-06.pdf', '2026-06-24T13:40:00Z'),

  -- ----- Customer order (uploaded WhatsApp order -> document_type=order) -----
  ('spar-constantia-order-whatsapp-2026-06-29.jpg', 'order', 'extracted', false, 87, '',
   '{"customer_name":"Spar Constantia","customer_confidence":90,"fields":[{"label":"Customer","value":"Spar Constantia","confidence":90},{"label":"Order date","value":"2026-06-29","confidence":88}],"line_items":[{"description":"Bananas (box)","quantity":"40","unit":"box","confidence":88},{"description":"Potatoes (10kg)","quantity":"30","unit":"bag","confidence":87},{"description":"Tomatoes (kg)","quantity":"120","unit":"kg","confidence":86},{"description":"Oranges (box)","quantity":"25","unit":"box","confidence":86}]}',
   'demo/docu/spar-constantia-order-whatsapp-2026-06-29.jpg', '2026-06-29T15:12:00Z')

) as v(filename, document_type, status, starred, confidence, folder_name, extracted_data, storage_path, created_at)
left join document_folders f
  on f.org_id = o.id and f.name = nullif(v.folder_name, '')
where exists (select 1 from organisations org2 where org2.name = 'Fresh Valley Produce');

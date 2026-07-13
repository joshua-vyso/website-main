-- ============================================================================
-- Race-proof create-on-upload dedup: unique (org_id, lower(name)) indexes on
-- of_customers, suppliers, pp_stock_items, document_folders.
--
-- Today dedup is app-level only (select-by-name then insert), so two concurrent
-- uploads can both miss and both insert a duplicate; the ingest batch is
-- serialized as a stopgap. These indexes make the invariant hold at the DB level.
--
-- The index key is lower(name) (case-insensitive), matching how the app looks a
-- name up (ilike). It's PARTIAL on non-blank names so junk/blank rows can't block
-- creation. It is GLOBAL across statuses: an archived customer (account_status)
-- or archived product (active=false) still reserves its name — re-adding the same
-- name should restore/reuse the existing row, not mint a second one.
--
-- HOW TO RUN (Supabase dashboard → SQL editor):
--   1. Run PHASE 1 on its own and READ the result. Any rows = duplicates that
--      would make PHASE 3 fail. Folders are auto-merged in PHASE 2; for
--      customers/suppliers/stock-items you must merge/rename them by hand first
--      (they have invoice/order/movement FKs, so merging is a business decision).
--   2. Run PHASE 2 (safe: only touches folders).
--   3. Run PHASE 3 once PHASE 1 shows no non-folder duplicates remain.
-- Every statement is idempotent / re-runnable.
-- ============================================================================


-- ============================================================================
-- PHASE 1 — DETECTION.  Run this block ALONE first and review the output.
-- Returns one row per duplicate (org_id, lower(name)) group. `ids` is oldest→newest.
-- document_folders rows here are informational — PHASE 2 merges them for you.
-- ============================================================================
select 'of_customers'      as table_name, org_id, lower(name) as norm_name,
       count(*) as copies, array_agg(id order by created_at, id) as ids
  from of_customers
 where name is not null and btrim(name) <> ''
 group by org_id, lower(name) having count(*) > 1
union all
select 'suppliers', org_id, lower(name), count(*), array_agg(id order by created_at, id)
  from suppliers
 where name is not null and btrim(name) <> ''
 group by org_id, lower(name) having count(*) > 1
union all
select 'pp_stock_items', org_id, lower(name), count(*), array_agg(id order by created_at, id)
  from pp_stock_items
 where name is not null and btrim(name) <> ''
 group by org_id, lower(name) having count(*) > 1
union all
select 'document_folders', org_id, lower(name), count(*), array_agg(id order by created_at, id)
  from document_folders
 where name is not null and btrim(name) <> ''
 group by org_id, lower(name) having count(*) > 1
order by table_name, copies desc;


-- ============================================================================
-- PHASE 2 — auto-merge duplicate document_folders (SAFE).
-- Folders are flat (no nesting) and only documents.folder_id references them, so
-- we keep the OLDEST folder per (org_id, lower(name)), repoint every document off
-- the duplicates onto that keeper, then delete the emptied duplicates.
-- This also cleans up the duplicate "Orders" folders left by the old
-- PublishOrderButton .maybeSingle() bug.
-- ============================================================================
with keepers as (
  select id,
         first_value(id) over (
           partition by org_id, lower(name)
           order by created_at, id
         ) as keeper_id
    from document_folders
   where name is not null and btrim(name) <> ''
)
update documents d
   set folder_id = k.keeper_id
  from keepers k
 where d.folder_id = k.id
   and k.id <> k.keeper_id;

with keepers as (
  select id,
         first_value(id) over (
           partition by org_id, lower(name)
           order by created_at, id
         ) as keeper_id
    from document_folders
   where name is not null and btrim(name) <> ''
)
delete from document_folders f
 using keepers k
 where f.id = k.id
   and k.id <> k.keeper_id;


-- ============================================================================
-- PHASE 3 — unique indexes.  Run only after PHASE 1 shows no non-folder dupes.
-- ============================================================================
create unique index if not exists of_customers_org_lower_name_uidx
  on of_customers (org_id, lower(name))
  where name is not null and btrim(name) <> '';

create unique index if not exists suppliers_org_lower_name_uidx
  on suppliers (org_id, lower(name))
  where name is not null and btrim(name) <> '';

create unique index if not exists pp_stock_items_org_lower_name_uidx
  on pp_stock_items (org_id, lower(name))
  where name is not null and btrim(name) <> '';

create unique index if not exists document_folders_org_lower_name_uidx
  on document_folders (org_id, lower(name))
  where name is not null and btrim(name) <> '';

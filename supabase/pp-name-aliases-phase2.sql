-- Phase 2 of product matching: AI-suggested (Haiku) matches surface as `pending`
-- rows the user confirms or dismisses. Adds the columns that pending suggestions
-- carry. Idempotent — paste in the Supabase dashboard. Requires pp-name-aliases.sql.

alter table pp_name_aliases add column if not exists method text;            -- exact | ai | manual
alter table pp_name_aliases add column if not exists confidence numeric;      -- 0..100 (AI)
alter table pp_name_aliases add column if not exists ai_rationale text;       -- short model reason
-- The discovered (fed) item a pending suggestion is FOR; stock_item_id stays the
-- suggested/confirmed canonical target. Cascade so a pending row dies with its item.
alter table pp_name_aliases
  add column if not exists discovered_item_id uuid references pp_stock_items(id) on delete cascade;

create index if not exists idx_pp_name_aliases_pending
  on pp_name_aliases (org_id, status, method);

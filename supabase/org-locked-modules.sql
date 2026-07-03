-- ============================================================================
-- Per-org module locking
-- ----------------------------------------------------------------------------
-- `organisations.locked_modules` is the list of module feature-keys an org may
-- NOT open — the sidebar shows them with a lock + "Unlock" (→ contact Joshua),
-- and direct navigation is blocked. Empty (default) = nothing locked = every
-- module open (current behaviour for all other orgs). Idempotent.
--
-- Feature keys: docu, procurepulse, pricepilot, marginview, wastelog,
-- shiftboard, orderflow, reportgen, suppliers.
-- ============================================================================

alter table organisations add column if not exists locked_modules text[] not null default '{}';

-- Turn 'n Slice: lock everything except Doc-U and OrderFlow (for now).
update organisations
set locked_modules = array['procurepulse', 'pricepilot', 'marginview', 'wastelog', 'shiftboard', 'suppliers', 'reportgen']
where name ilike '%turn%slice%';

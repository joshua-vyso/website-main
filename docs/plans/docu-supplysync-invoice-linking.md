# Doc-U → SupplySync: automatic supplier linking for scanned invoices

**Goal.** A document scanned/uploaded/emailed into Doc-U is classified by the agent;
when it's an invoice (or statement / delivery note — anything *from* a supplier), the
agent links it to the right **supplier profile in SupplySync**, creating the profile if
needed, and the supplier's SupplySync page (documents, history timeline, spend rollups)
reflects it. Human review stays in the loop exactly where it is today.

---

## 1. What already exists (don't rebuild)

| Piece | Where | State |
|---|---|---|
| Single ingest pipeline: classify → file → route | `lib/platform/document-ingest.ts` (`ingestDocument`) | Built. One Haiku call classifies `invoice \| statement \| delivery_note \| price_list \| order` |
| Entry points | Vyso AI chat (`/api/ai/agent/ingest-document`), inbound email (`/api/email/process`, `deferCommit: true`), manual Doc-U scan (`UploadBubble` → `/api/ai/extract`) | Built. All three share `resolveSupplierId` |
| Direction, half of it | `ingestDocument` step 4a/4b | `order` → customer/OrderFlow; everything else → supplier. Implicit, not explicit |
| Supplier resolution | `resolveSupplierId` → core `suppliers` table, stamps `documents.supplier_id` | Built, but **creates a row for any extracted name** (no alias/typo guard) |
| Alias matching | `lib/platform/docu/supplier-match.ts` | **Skeleton: hardcoded demo alias map**, not org data |
| Review queue with atomic claim | `commitDocument` in `document-ingest.ts`; side effects idempotent per document | Built and hardened |
| Supplier intel derived from documents | `lib/platform/docu/supplier-intel.ts`, `SupplierIntelligenceCard` | Built — but Doc-U-side only |
| SupplySync module | `lib/platform/supplysync-data.ts` + `components/platform/supplysync/*`, `ss_*` tables | UI + read path real; **data is demo-seed only, no production write path** |

**The core gap:** `documents.supplier_id` references the core `suppliers` table;
SupplySync reads `ss_suppliers`. The two tables have **no relationship**. Nothing that
happens in Doc-U ever reaches a SupplySync profile.

## 2. Architecture decision: one supplier identity

Keep core `suppliers` as the canonical identity (documents, ProcurePulse and OrderFlow
already key on it). Make the SupplySync profile an *extension* of it:

```sql
-- supabase/supplysync-link.sql (new, idempotent)
alter table ss_suppliers
  add column if not exists supplier_id uuid references suppliers(id) on delete set null;
create unique index if not exists idx_ss_suppliers_supplier
  on ss_suppliers (org_id, supplier_id) where supplier_id is not null;
-- Backfill: match on org_id + normalized name.
```

Rejected alternative: migrating everything onto `ss_suppliers`. That touches documents,
the ProcurePulse feed, OrderFlow and the demo seeds — far larger blast radius for the
same outcome.

## 3. Pipeline changes

### 3a. `resolveSupplierProfile` — one shared step (covers all 3 entry points)

Wrap/extend `resolveSupplierId`: after resolving-or-creating the `suppliers` row,
ensure a linked `ss_suppliers` profile exists (minimal: name, category `'general'`,
status `'active'`, risk `'low'`). Because chat, email and manual scan all already call
`resolveSupplierId`, this single change gives every entry point SupplySync linking.

### 3b. Direction awareness — "supplier, not customer"

Today any non-order document is assumed to be *from* a supplier. Usually right for this
business, but the org's own **outgoing customer invoices** (OrderFlow generates them; a
scanned copy can re-enter via email) would get a bogus supplier created from the org's
own customer — or the org itself. Add to `extractDocument`'s JSON schema
(`lib/ai/anthropic.ts`):

- `direction: "incoming" | "outgoing"` — who issued the document vs. who is billed
- `counterparty_name` + `counterparty_confidence`

Server-side guards (never trust document content for identity):
- If the extracted supplier normalizes to the org's own name/aliases → **do not create
  a supplier**; flag for review.
- `direction === 'outgoing'` invoice → route toward customer/OrderFlow reconciliation
  (phase 2), never `resolveSupplierProfile`.

### 3c. Org-scoped alias learning (replaces the hardcoded map)

New table mirroring the `pp_name_aliases` precedent:

```sql
create table if not exists supplier_aliases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  raw_name text not null,
  normalized_name text,
  supplier_id uuid references suppliers(id) on delete cascade,
  status text not null default 'confirmed',   -- confirmed | dismissed
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (org_id, raw_name)
);
```

Resolution order in `resolveSupplierProfile`:
1. exact / `ilike` match on `suppliers` (exists today)
2. confirmed alias hit
3. fuzzy candidate (port the token-overlap scorer from `supplier-match.ts`) —
   **above threshold** (≥85): auto-link; **below**: leave `supplier_id` null, store the
   proposal in `extracted_data`, let the review queue decide.

A human confirming a match in the review queue **writes the alias row** — the agent
learns the org's supplier vocabulary. `lib/platform/docu/supplier-match.ts`'s hardcoded
`SUPPLIER_ALIASES` is deleted in favour of this.

### 3d. SupplySync side effects on commit (the payoff)

New `lib/platform/supplysync-feed.ts`, called from `runDocumentSideEffects` alongside
`feedDocumentToProcurePulse` (so it obeys the existing deferCommit/review-queue rules
and the atomic-claim idempotency contract):

- `ss_supplier_history`: insert an `invoice_received` (etc.) event with document id,
  amount, date — the relationship timeline fills itself.
- `ss_suppliers` rollups: `last_order`, `spend_mtd` — **recompute from `documents`
  rather than increment** (commits may legally retry; increments would double-count).
- Pricing: leave observations to ProcurePulse (`pp_supplier_price_history` already
  exists); SupplySync *surfaces* pricing per its stated boundary.

### 3e. Surfacing in SupplySync

- `SupplierProfileDrawer` → Documents tab: today reads `ss_supplier_documents`
  (compliance docs). Additionally query `documents` via the bridge — Doc-U remains the
  file source of truth; nothing is duplicated.
- `lib/platform/docu/routing.ts`: add `supplysync` routes for
  invoice/statement/delivery_note ("Update supplier scorecard & history").
- Realtime: subscribe SupplySync pages to `ss_*` changes (follow `realtime.sql`
  precedent) so a scanned invoice appears on the profile live.

## 4. Review flow (unchanged philosophy, one new surface)

- **Email** (`deferCommit: true`): document waits at `extracted`; the review queue shows
  the proposed supplier link ("Link to *Karsten Farms* — 92%") with change /
  create-new controls; Save = commit side effects **including** the SupplySync feed +
  alias write. Exactly the existing human-gate model.
- **Chat / manual scan** (inline commit): auto-link only at/above the confidence
  threshold; below it, the doc still files and extracts, link waits for review.

## 5. Build order

1. `supabase/supplysync-link.sql` — bridge column, `supplier_aliases`, RLS policies
   (mirror org-scoped pattern; check with `verify-rls-state.sql`), name backfill.
2. `resolveSupplierProfile` in `document-ingest.ts` + swap into `/api/ai/extract`.
3. Classifier schema: `direction` + counterparty fields; self-name guard.
4. `supplysync-feed.ts` + wire into `runDocumentSideEffects`; recompute rollups.
5. Review-queue UI: link proposal + confirm/change; alias learning on Save.
6. SupplySync surfaces: profile Documents tab reads bridged `documents`; routing card;
   Realtime.
7. Demo-seed compatibility: `4-supplysync-seed.sql` gains `supplier_id` backfill so
   Fresh Valley keeps working.

## 6. Edge cases & risks

- **Multi-supplier market statements**: per-line `supplier` (AGENT column) already
  extracted. Link the *document* to the market/statement issuer; per-line spend
  attribution is a later enhancement.
- **Typo-driven supplier duplication**: today `resolveSupplierId` creates on any name.
  The threshold + alias table stops the bleeding; a one-off dedup/merge pass over
  existing `suppliers` is worth doing at backfill time.
- **Idempotency**: all SupplySync writes keyed per document id / recomputed, because
  `commitDocument` retries are part of the contract.
- **Prompt-injection surface**: document content stays data — org identity and orgId
  never derive from content (existing invariant, preserved by the 3b guards).

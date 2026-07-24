# Plan: Finch rebrand + self-serve signup, verification & Finch-guided onboarding + "Join Waitlist" CTA sweep

Status: **DRAFT — awaiting user approval. No implementation may begin until approved.**
Architect: Fable (plans only). Implementers: Claude subagents per the phase assignments below.

---

## 0. Goal

1. Rebrand the in-app assistant "Vyso AI" → **Finch** everywhere (UI, prompts, routes, CSS, marketing page).
2. Add self-serve **account creation on the login screen**: email + password + full name → **6-digit email verification code** → onboarding.
3. Build a 3-stage **onboarding flow** hosted by Finch:
   - **Stage 1 — Profile**: user name, company name, industry, employee count.
   - **Stage 2 — Modules**: pick **3 modules** for the **14-day free trial** (Doc-U always on → 4 total unlocked).
   - **Stage 3 — Data**: Finch hand-holds the user through uploading their data (spreadsheets + documents), reads it into **Core Data**, and links it to the chosen modules.
4. Sweep marketing-site CTAs to **"Join Waitlist"**.

### Acceptance criteria

- A brand-new visitor can: create an account on `/login`, receive and enter a 6-digit code, complete all 3 onboarding stages, land in `/app` with exactly their 4 modules unlocked (others show the existing "Unlock" lock UX), and see any data they uploaded in Doc-U → Databases / OrderFlow / ProcurePulse.
- The string "Vyso AI" no longer appears anywhere user-visible (app or marketing). `/platform/vyso-ai` 308-redirects to the new Finch page. The agent identifies itself as Finch.
- Existing orgs (Vyso, Turn 'n Slice, Morco, Fresh Valley) are completely unaffected: their sessions, module access, and data flows behave identically.
- Every live marketing-site primary CTA reads "Join Waitlist" and captures a lead.
- `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass.

---

## 1. Established facts (from codebase research — implementers must not re-derive these)

- **No signup exists.** `/login` (`app/login/page.tsx`) is password-only via `signInWithPassword`; orgs/profiles are provisioned by hand-run SQL (`supabase/vyso-bootstrap.sql`, `tns-users-roles.sql`, `morco-users-roles.sql`). No `signUp`, `signInWithOtp`, or `verifyOtp` calls anywhere.
- **Session**: `getPlatformSession()` in `lib/platform/supabase-server.ts:56-106` returns `{userId, email, profile, org, features, lockedModules, vysoAiEnabled}`. Lines 87-89 contain a TEMP loop force-enabling all `features` — `org_features` currently has no effect. `lockedModules` (from `organisations.locked_modules text[]`) **is** enforced, via `ModuleLockGuard.tsx` (route-level) + `ModulesOverlay.tsx` ("Unlock" tiles) + `ModuleLockNotice.tsx`.
- **Auth guard**: `app/app/layout.tsx:23-26` redirects to `/login` when session is null. Note: a verified user with **no org** still gets a non-null session (profile/org null) — nothing currently handles that state.
- **`organisations`/`profiles`/`org_features` have no tracked CREATE TABLE** — they predate tracked migrations. Migrations are applied by **pasting SQL into the Supabase dashboard** (no CLI link). All new SQL must be idempotent (`add column if not exists`), and new code must tolerate missing columns (patterns: `insertDroppingMissing()` in `ImportWizard.tsx:84`, `applyStockPatch()` in `procurepulse-feed.ts:147`).
- **Agent ("Vyso AI")**: lib in `lib/ai/vyso-agent/` (`config.ts` — `AgentModule = 'orderflow'|'docu'`, `AGENT_MODEL` Haiku 4.5 / `WORKFLOW_MODEL` Sonnet 4.6; `knowledge.ts:106` — identity string "You are **Vyso AI**…"; `tools.ts`, `runtime.ts`, `orderflow-data.ts`, `name-match.ts`, `order-handoff.ts` with localStorage key `vysoai:parsed_order`). UI in `components/platform/vyso-ai/` (Button/Launcher/Modal/OrderPrefill/BouncingDots). Streaming: hand-rolled SSE in `app/api/ai/agent/route.ts` (events `{text}|{tool}|{orderDraft}|{done}|{error}`, `MAX_TURNS=5`). Gate: `VYSO_AI_ENABLED` env + `isVysoAiAllowed(email)` (any authed user). Mounted in `app/app/orderflow/layout.tsx` and `components/platform/docu/DocuNav.tsx`. **No rate limiting on `/api/ai/agent/*`** (audit SEC-08); `lib/platform/rate-limit.ts` (`rateLimitAllowed`) exists and is used by `/api/ai/message`.
- **Import pipeline**: `components/platform/coredata/ImportWizard.tsx` (3 steps: source → grid/map with AI assist → confirm), `lib/platform/import-schema.ts` (entities `customers`→`of_customers`, `products`→`pp_stock_items`), `lib/platform/csv.ts`, `app/api/import/parse-xlsx/route.ts` (dependency-free, auth + rate-limited), `app/api/import/assist/route.ts` (automap + command ops). Writes are chunked inserts via the RLS browser client stamped with `org_id`.
- **Document pipeline**: `lib/platform/document-ingest.ts` → `ingestDocument()` (classify → Doc-U → order sync / ProcurePulse feed / SupplySync feed). Chat attachment path already exists: `app/api/ai/agent/ingest-document/route.ts`.
- **"Linking data to modules" concretely**: OrderFlow + ProcurePulse read the same tables the import writes (`of_customers`, `pp_stock_items`) — linking is automatic. PricePilot participation = product exists (+ optionally a `pl_price_lists` row). SupplySync/stock-movement intelligence requires documents fed through Doc-U extraction. Suppliers are only ever created from documents.
- **Visual language (platform)**: tokens in `lib/platform/tokens.ts` (page `#F6F6F4`, border `#EAEDF2`, text `#171A17`, accent blue `#3E7BC4`/`#1F5FA8`, accentWeak `#EAF2FC`, orange `#D9730D` reserved for hero actions). Font: Instrument Sans (`--font-instrument`). Buttons `rounded-[11px]`, cards `rounded-2xl`. Shared kit: `components/platform/coredata/ui.tsx` (`PrimaryBtn`, `SecondaryBtn`, `Modal`, `EmptyState`…). Animations: `.vyso-fade-in`, `.vyso-pop-in` only. **Portal gotcha**: global `--radius:0rem`; `app/app/layout.tsx` overrides to `0.625rem`; every portal must re-apply `PORTAL_STYLE = {fontFamily:'var(--font-instrument)', '--radius':'0.625rem'}` or corners go square.
- **Wizard precedents**: `AddSupplierWizard.tsx` (numbered `StepIndicator`, `:134-163`) and `ImportWizard.tsx` (`StepBar` pills, `:871-898`).
- **Module registries**: `lib/platform/modules.ts` (`MODULES`, keys `docu|procurepulse|pricepilot|marginview|wastelog|shiftboard|suppliers|reportgen|orderflow`) and `lib/platform/module-meta.ts` (`MODULE_META` — display copy, icons, accent colors; best source for the module-picker cards).
- **Marketing CTAs**: full inventory in §6 below. **No waitlist capture exists anywhere** (`/api/contact` is a stateless Resend email form). `app/founding-client/page.tsx:143` literally says "This is not a waitlist" — copy must change.
- **Next 16 (`next@16.2.7`)**: middleware is `proxy.ts`; `cookies()`/`params`/`searchParams` are async-only; dev runs `next dev --webpack` (keep); `next lint` removed (`npm run lint` = eslint). Implementers must read `node_modules/next/dist/docs/` before writing route code (per AGENTS.md).

---

## 2. Material decisions

### Decided by architect (approved implicitly with this plan)

- **D1 — Module gating for trials uses `locked_modules`**, the mechanism with teeth. New trial orgs get `org_features` all-enabled rows seeded (future-proof) and `locked_modules` set to the 5 unchosen keys. The TEMP force-all-features loop in `getPlatformSession` **stays** (removing it risks existing orgs; it does not interfere with `locked_modules`). Add a comment pointing to this plan.
- **D2 — Signup lives on `/login`** as a "Create account" pane toggle (user asked for it "in the login screen"). Flow: `supabase.auth.signUp({email, password, options:{data:{full_name}}})` → code entry screen → `supabase.auth.verifyOtp({type:'signup', email, token})` → `router.push('/onboarding')`. Resend via `supabase.auth.resend({type:'signup'})` with a 60s cooldown. **Manual dashboard step (user)**: edit Supabase Auth "Confirm signup" email template to show `{{ .Token }}` (6-digit code) instead of the confirmation link.
- **D3 — Onboarding is a top-level route `/onboarding`** (own layout, no TopBar; full-screen Finch experience styled with platform tokens). Server layout: no session → `/login`; onboarding already complete → `/app`. Conversely `app/app/layout.tsx` gains: session non-null but `org` null **or** `org.onboarding_completed_at` null → `redirect('/onboarding')`. (Existing orgs are backfilled as completed — see migration — so they never see it.)
- **D4 — Org provisioning via SECURITY DEFINER RPCs** in a new `supabase/onboarding.sql` (pasted manually, like all migrations). No service-role key in the web app.
- **D5 — Stage-3 auto-linking**: customers/products → import pipeline (automatic for OrderFlow/ProcurePulse); if PricePilot chosen and no price list exists, create one default global `pl_price_lists` row ("Standard pricing"); documents → `ingestDocument()` (feeds ProcurePulse/SupplySync as gated). Finch narrates what landed where. Stage 3 is skippable ("I'll do this later" → completes onboarding with empty data).
- **D6 — Rate limiting added to `/api/ai/agent/*`** (closes SEC-08 before giving Finch to strangers): `rateLimitAllowed('ai-agent:'+userId, 40, 3600)` on the agent route, 20/hr on ingest-document + parse-order. Onboarding endpoints similarly limited.
- **D7 — CTA scope**: primary lead-gen CTAs become "Join Waitlist" (§6 list). Navigational/informational links ("View pricing", "Explore OrderFlow", "Log in", FAQ cross-links) are unchanged. Dead-redirected pages (`app/about`, `app/apps`, `app/services` — 308'd in `next.config.ts`) are untouched.
- **D8 — Renames stay consistent internally**: dirs `lib/ai/vyso-agent/`→`lib/ai/finch/`, `components/platform/vyso-ai/`→`components/platform/finch/`; CSS `.vyso-ai-*`→`.finch-*`; env `VYSO_AI_ENABLED` keeps working but `FINCH_ENABLED` is read first; localStorage handoff key becomes `finch:parsed_order` with dual-read of the old key.

### Resolved by user (2026-07-24)

- **Q1 — RESOLVED: new waitlist modal.** "Join Waitlist" CTAs open `WaitlistModal` (name, email, company) → `POST /api/waitlist` → `waitlist_signups` table + Resend notification. All ⚠ Q1 sections are in scope.
- **Q2 — RESOLVED: hard lock.** Trial expiry renders the full-screen `TrialGate` "Your trial has ended" screen over `/app` (module-lock visual grammar, contact CTA, data retained). The banner-only alternative is dropped.

---

## 3. Data / API / interface changes

### New migration `supabase/onboarding.sql` (idempotent; pasted in the Supabase dashboard)

```sql
-- organisations
alter table organisations add column if not exists industry text;
alter table organisations add column if not exists employee_count text;      -- band: '1-5'|'6-20'|'21-50'|'51-200'|'200+'
alter table organisations add column if not exists trial_started_at timestamptz;
alter table organisations add column if not exists trial_ends_at timestamptz;
alter table organisations add column if not exists onboarding_stage text not null default 'profile';  -- 'profile'|'modules'|'data'|'done'
alter table organisations add column if not exists onboarding_completed_at timestamptz;

-- Backfill: every existing org is done (never sees onboarding, no trial clock)
update organisations set onboarding_stage='done', onboarding_completed_at=now()
  where onboarding_completed_at is null;

-- RPC 1: create org for the calling user (stage 1). SECURITY DEFINER; guards:
--   caller must be authenticated (auth.uid() not null) and have no org yet
--   (profiles.org_id is null / no profiles row). Creates organisations row
--   (tier 'start', trial_started_at=now(), trial_ends_at=now()+interval '14 days',
--   locked_modules = all 9 keys minus 'docu' until stage 2 runs),
--   upserts profiles (id=auth.uid(), org_id, full_name, role='owner'),
--   seeds 9 org_features rows enabled=true. Returns org id.
create or replace function onboarding_create_org(p_org_name text, p_industry text,
  p_employee_count text, p_full_name text) returns uuid ...

-- RPC 2: record module choice (stage 2). Guards: caller is owner of the org,
--   onboarding not completed, exactly 3 keys, all valid, none = 'docu'.
--   Sets locked_modules = the 5 non-chosen non-docu keys, onboarding_stage='data'.
create or replace function onboarding_choose_modules(p_modules text[]) returns void ...

-- RPC 3: finish (stage 3 done or skipped): onboarding_stage='done',
--   onboarding_completed_at=now().
create or replace function onboarding_complete() returns void ...
```

Exact SQL is authored in Phase C; the semantics above are binding. All three RPCs `security definer set search_path = public`, `grant execute to authenticated`, and are written to be safe to re-run.

### TypeScript interface changes

- `lib/platform/types.ts` — `Organisation` gains `industry`, `employee_count`, `trial_started_at`, `trial_ends_at`, `onboarding_stage`, `onboarding_completed_at` (all optional, pre-migration tolerant).
- `lib/platform/supabase-server.ts` — `PlatformSession` gains `trial: {endsAt: string|null, daysLeft: number|null, expired: boolean} | null` (computed from org columns; null for non-trial orgs); `vysoAiEnabled` renamed `finchEnabled` (updated in `session.tsx` + all consumers).
- `lib/ai/finch/config.ts` — `AgentModule` gains `'onboarding'`.

### New/changed API routes

- `app/api/ai/agent/route.ts` — accepts `module:'onboarding'`; rate-limited (D6). Onboarding module gets its own knowledge doc + tools: `onboarding_get_progress` (counts of customers/products/documents so far + chosen modules), reusing `ToolContext`.
- Waitlist endpoint (Q1 resolved — in scope): `app/api/waitlist/route.ts` — POST `{name, email, company?}` → insert `waitlist_signups` (new table in the same migration: id, name, email unique-per-lower, company, source_path, created_at; RLS enabled with no policies — the route inserts via a `waitlist_join(name,email,company,source_path)` SECURITY DEFINER function granted to anon+authenticated, idempotent on duplicate email, defined in `supabase/onboarding.sql`; rate limit 5/hr/IP in the route) + Resend notification to joshua@vyso.co.za.

No changes to existing extraction/import endpoints beyond the rename pass.

---

## 4. Files to create / modify (by phase)

### Phase A — Finch rebrand (no behavior change)

**Finch mark (user-supplied icon, approved 2026-07-24).** Recreate the provided logo as an inline SVG component `components/platform/finch/FinchMark.tsx`:
- Minimalist single-line bird in profile facing right: round head, small triangular beak, dot eye, leaf-shaped wing curve inside the body, long pointed tail sweeping down-left, one short leg meeting a detached horizontal base line beneath the body.
- Continuous rounded stroke (`stroke-linecap/linejoin: round`), stroke-width ≈ 2.2% of viewBox width, `fill: none` (eye dot is filled).
- `linearGradient` on the stroke: cornflower blue `#6C9BE0` (head/tail, top-left) → warm orange `#F0873C` (beak/belly/leg, bottom-right). The eye dot is a muted blue-grey `#7E93B8`.
- Props: `size` (default 20), `title` (a11y), `animate?: 'draw' | 'none'`.
- Animation ("animate it nicely", scoped and subtle): on mount with `animate='draw'`, a stroke-dasharray draw-in (~0.9s ease-out) of the body path, then a one-time gentle settle (translateY 2px pop, reusing `.vyso-pop-in` timing feel); idle state is static. Respect `prefers-reduced-motion` (render final frame immediately). CSS lives beside the existing `.finch-gradient` block in `app/globals.css`.
- Usage in this phase: replaces the sparkle icon in `FinchButton` and the modal header avatar in `FinchModal`. Phase D reuses it (larger, `animate='draw'`) in the onboarding Finch panel.

Modify/rename (full inventory from research; grep `vyso ai|vysoai|vyso-ai` case-insensitive must end at zero user-visible hits):
- `lib/ai/vyso-agent/` → `lib/ai/finch/` (7 files; update the identity string `knowledge.ts:106` → "You are **Finch**, the assistant built into the Vyso operations platform…"; keep all guardrails).
- `components/platform/vyso-ai/` → `components/platform/finch/` with `FinchButton.tsx`, `FinchLauncher.tsx`, `FinchModal.tsx` (header/aria/disclaimer copy), `FinchOrderPrefill.tsx` ("Paste from Finch"), `BouncingDots.tsx` (aria "Finch is thinking").
- Consumers: `app/app/orderflow/layout.tsx`, `components/platform/docu/DocuNav.tsx`, `components/platform/orderflow/OrdersView.tsx` (toast copy), `components/platform/insightgen/View.tsx` (demo copy), `components/platform/SubNav.tsx` (comment).
- `app/api/ai/agent/*` 4 routes (imports/comments), `lib/platform/document-ingest.ts:22` comment.
- `lib/platform/supabase-server.ts` + `lib/platform/session.tsx` (`finchEnabled`), `lib/ai/finch/config.ts` (`isFinchEnabled`/`isFinchAllowed`; env: read `FINCH_ENABLED ?? VYSO_AI_ENABLED`).
- `app/globals.css:455-475` — `.finch-gradient`, `.finch-dot` + keyframes.
- `order-handoff.ts` — write `finch:parsed_order`, read new-then-old key.
- Marketing: `app/platform/vyso-ai/page.tsx` → `app/platform/finch/page.tsx` (retitle copy/metadata/JSON-LD/FAQ, keep structure); 308 redirect `/platform/vyso-ai` → `/platform/finch` in `next.config.ts`; `app/sitemap.ts:19`; `components/Navbar.tsx:53-56`; `components/sections/SiteFooter.tsx:10`; `app/platform/page.tsx:368-379` card; `app/founding-client/page.tsx:164`.

### Phase B — "Join Waitlist" CTA sweep (+ capture per Q1)
- `components/Navbar.tsx:488-502` desktop "Contact us" button + `:443` "Talk to Vyso" + `:609-628` mobile "Contact us →" → "Join Waitlist".
- `components/marketing/PublicMarketing.tsx:68-104` — `MarketingCta` default `primaryLabel` → "Join Waitlist"; page-level overrides updated: `app/south-africa/page.tsx:392-399`, `app/platform/finch/page.tsx` CTA, `app/platform/page.tsx:491-498`, `app/industries/[slug]/page.tsx:360-367`, `app/platform/vyso-for-smes/page.tsx:282-289`, `app/case-studies/turn-n-slice/page.tsx:215-222`, `app/founding-client/page.tsx:248-256` (also fix the ":143 not a waitlist" copy).
- `components/sections/PricingSection.tsx` — audit banner `:124-144` and all three tier `cta` strings `:169,185,203` → "Join Waitlist".
- Waitlist capture (Q1 resolved — in scope): `components/marketing/WaitlistModal.tsx` (name/email/company, marketing styling, posts `/api/waitlist`, success state) + `app/api/waitlist/route.ts` + `waitlist_signups` table in `supabase/onboarding.sql`. All swept CTAs open the modal (client boundary via a small `WaitlistCtaButton` wrapper so server pages stay server).
- Untouched: "Log in" links, `HeroAuthCta`, "See how it works", footer nav links, informational "View pricing / Explore …" links, dead pages `app/about|apps|services`.

### Phase C — Signup + verification code
- `app/login/page.tsx` — add pane state `'login' | 'signup' | 'verify'`. Signup: full name, email, password (min 8), confirm; `signUp()`; on success → verify pane (6 single-char code boxes, paste support, resend w/ 60s cooldown, error surface for wrong/expired code); `verifyOtp({type:'signup'})`; on success `router.push('/onboarding'); router.refresh()`. Keep existing login pane byte-for-byte in behavior. Copy: "Start your 14-day free trial".
- `app/login/layout.tsx` — metadata title "Log in or create account | Vyso".
- `supabase/onboarding.sql` — as §3.
- Docs note in the migration header: dashboard email-template step (D2) required before codes work.

### Phase D — Onboarding flow `/onboarding`
New:
- `app/onboarding/layout.tsx` — server: `getPlatformSession()`; null → `/login`; `org?.onboarding_completed_at` → `/app`. Sets Instrument Sans + `--radius:0.625rem` wrapper (platform tokens, `#F6F6F4` page, top wash gradient like `app/app/layout.tsx:37-38`).
- `app/onboarding/page.tsx` — server; fetches session and current `onboarding_stage`, renders `<OnboardingFlow initialStage=…/>`.
- `components/platform/onboarding/OnboardingFlow.tsx` — client orchestrator; numbered `StepIndicator` pattern (copied idiom from `AddSupplierWizard.tsx:134-163`); Finch presence throughout: a persistent side/bottom panel with the Finch mark (reuses `.finch-gradient`), streaming intro copy per stage.
- `components/platform/onboarding/StageProfile.tsx` — fields: your name (prefilled from signUp metadata), company name, industry (select: Food & beverage wholesale, Retail, Manufacturing, Logistics, Services, Construction, Agriculture, Other + free text), employee count (band pills). Submit → `supabase.rpc('onboarding_create_org', …)` → advance. (`router.refresh()` after each stage so the server session picks up the org.)
- `components/platform/onboarding/StageModules.tsx` — card grid from `MODULE_META` (name, description, icon, accent). Doc-U rendered pre-selected/disabled "Always included". Exactly 3 selectable (counter "2 of 3 selected"); trial framing copy "Your 14-day trial includes Doc-U plus any 3 modules". Submit → `rpc('onboarding_choose_modules')`.
- `components/platform/onboarding/StageData.tsx` — split layout. Left: Finch chat (module `'onboarding'`, same SSE client idiom as `FinchModal` — extract the SSE reader into `components/platform/finch/useFinchStream.ts` shared hook rather than duplicating). Right: upload surface + progress checklist ("Customers — 214 imported ✓ / Products / Documents") + per-chosen-module link summary. Spreadsheets (.csv/.xlsx) → embedded import flow; PDFs/images → POST to `/api/ai/agent/ingest-document`. "Skip for now" and "Finish" both call `rpc('onboarding_complete')` → `/app`.
- `components/platform/coredata/ImportWizard.tsx` — add optional props `{embedded?: boolean, entity?: 'customers'|'products', onComplete?: (summary) => void}` so StageData reuses the real source→map→confirm pipeline (per the visual-only-redesigns convention: optional props, no architecture change). Default behavior unchanged.
- `lib/ai/finch/knowledge.ts` — `ONBOARDING_KNOWLEDGE` doc: what Core Data is, what each chosen module does with uploaded data, spreadsheet vs document routing, SA-SME tone; instructs Finch to reference the checklist state (via `onboarding_get_progress` tool in `tools.ts`).
- `app/app/layout.tsx` — add the D3 redirect (org null or onboarding incomplete → `/onboarding`).
- PricePilot default price list (D5): created inside `StageData` completion when `pricepilot` chosen and `pl_price_lists` empty (browser client, org-stamped, tolerant insert).

### Phase E — Trial surfacing
- `lib/platform/supabase-server.ts` — compute `session.trial` (D3 interface).
- `components/platform/TopBar.tsx` — trial pill next to module label: "Trial · 9 days left" (blue accentWeak), links to `/app/settings`.
- Trial gate (Q2 resolved — hard lock): `components/platform/TrialGate.tsx` rendered in `app/app/layout.tsx` inside the provider — when `trial.expired`, full-screen "Your trial has ended" (same visual grammar as `ModuleLockGuard`'s lock screen, mailto/contact CTA). Data retained; access paused.

### Phase F — Agent rate limiting (D6)
- `app/api/ai/agent/route.ts`, `ingest-document/route.ts`, `parse-order/route.ts`, `customers/route.ts` — `rateLimitAllowed` per D6, 429 JSON error the modal already renders via `{error}`.

---

## 5. Constraints & files NOT to touch

- **Do not modify or revert** the in-flight ServiceDen/OrderFlow working-tree changes (`app/app/serviceden/*`, `components/platform/serviceden/*`, `lib/platform/serviceden*`, `components/platform/orderflow/CustomersManager.tsx`, `InvoicingView.tsx`, `supabase/serviceden*.sql`, `tests/`, `.vscode/`, `AUDIT_FINDINGS.md`). Stage/commit **only** files this plan names. Before committing, scan `git status` for unexpected resurrected files (known repo failure mode).
- Do not remove the TEMP force-all-features loop (D1) — annotate it only.
- Do not touch `lib/platform/serviceden-gmail.ts` Anthropic usage.
- No blanket color sweeps in globals.css (protected greens; marketing orange system stays orange — onboarding uses the *platform* blue system).
- No new npm dependencies. No Vercel AI SDK — keep the hand-rolled SSE.
- Existing login behavior (password sign-in path) must not change.
- All new Supabase writes tolerate missing columns/tables (degrade, never crash a page).
- Per AGENTS.md: read the relevant `node_modules/next/dist/docs/` guide before writing any route/layout code; async `cookies()`/`params`; no parallel-route slots without `default.js`.

## 6. CTA inventory being changed (verbatim targets)

| File:Line | Current | New |
|---|---|---|
| `components/Navbar.tsx:488-502` | "Contact us" | "Join Waitlist" |
| `components/Navbar.tsx:443` | "Talk to Vyso" | "Join Waitlist" |
| `components/Navbar.tsx:609-628` (mobile) | "Contact us →" | "Join Waitlist →" |
| `components/marketing/PublicMarketing.tsx:68-104` | default "Talk to Vyso" | default "Join Waitlist" |
| `app/south-africa/page.tsx:392-399` | "Discuss your workflow" | "Join Waitlist" |
| `app/platform/finch/page.tsx` (was vyso-ai:234-242) | "Become a founding client" | "Join Waitlist" |
| `app/platform/page.tsx:491-498` | "Talk to Vyso" | "Join Waitlist" |
| `app/industries/[slug]/page.tsx:360-367` | "Talk to Vyso" | "Join Waitlist" |
| `app/platform/vyso-for-smes/page.tsx:282-289` | "Book an audit conversation" | "Join Waitlist" |
| `app/case-studies/turn-n-slice/page.tsx:215-222` | "Discuss your invoicing workflow" | "Join Waitlist" |
| `app/founding-client/page.tsx:248-256` | "Start the conversation" | "Join Waitlist" |
| `components/sections/PricingSection.tsx:124-144` | "Discuss the audit" | "Join Waitlist" |
| `components/sections/PricingSection.tsx:169,185,203` | "Get started"/"Talk to us"×2 | "Join Waitlist" |

Secondary labels/hrefs in each `MarketingCta` stay as-is unless they duplicate the primary.

## 7. Ordered implementation steps & agent assignments

Phases are independent except D depends on C (session/org states) and A (Finch naming). Order: **A → B → C → D → E → F**, one PR-sized commit per phase on a feature branch `finch-onboarding`.

| Phase | Scope | Agent / model | Rationale |
|---|---|---|---|
| A | Mechanical rebrand, wide but low-risk | Sonnet | Rename/grep discipline, no design decisions |
| B | CTA sweep + waitlist capture | Sonnet | Small surface, clear spec |
| C | Signup + OTP + migration SQL | Opus (medium) | Auth-critical, one-shot correctness > retries |
| D | Onboarding flow + Finch stage | Opus (medium) | Largest, cross-cutting, UI polish matters |
| E | Trial pill/gate | Sonnet | Small, patterned |
| F | Rate limits | Haiku or Sonnet | Trivial, patterned on `/api/ai/message` |

Each implementer: follow this plan exactly; if a material decision is missing, **stop and report** (do not invent architecture); write outcomes/deviations to `.ai/implementation.md` (append per phase); run verification (§9) before declaring done.

## 8. Edge cases

- Signup with an email that already exists → Supabase returns ok-ish (anti-enumeration); show "If this email is new you'll receive a code; otherwise log in instead."
- Wrong/expired OTP → inline error, allow re-entry; resend cooldown 60s; code expiry per Supabase default (1h).
- User closes tab mid-onboarding → next `/app` visit redirects back to `/onboarding` at the saved `onboarding_stage` (server-read).
- User verified but RPC fails (migration not pasted) → visible error card: "Setup migration missing — run supabase/onboarding.sql", never a white screen.
- Double-submit of stage RPCs → RPCs are idempotent/guarded (org already exists → return existing id; modules already chosen → overwrite allowed until `done`).
- Second user of an existing org signs in mid-flow → has `org_id` with `onboarding_stage='done'` (backfill) → unaffected. A second brand-new signup from the same company creates their own org (invites are out of scope — note in plan as future work).
- Stage 3 with zero uploads → allowed (skip path).
- Spreadsheet with wrong headers / unmappable → the existing grid + AI assist handles it; Finch prompt explains the manual mapping controls.
- `pl_price_lists` insert failing (missing migration) → tolerated, logged in summary, onboarding still completes.
- Trial fields null (existing orgs) → `session.trial` null → no pill, no gate.
- Locked-module deep link during trial → existing `ModuleLockGuard` handles it (copy already generic).
- `vysoai:parsed_order` in-flight during rebrand deploy → dual-read (D8).
- Marketing pages with `supabaseConfigured=false` must still render (waitlist route degrades to Resend-only if table missing).

## 9. Exact verification commands

```bash
npm run lint
npx tsc --noEmit
npm run build
grep -rni --include='*.ts' --include='*.tsx' --include='*.css' -E 'vyso ?ai' app components lib   # expect: no user-visible hits (comments referencing history OK only in .ai/)
```

Manual (implementer, via dev server + browser tools): signup → code → 3 stages → land in `/app`; confirm ModulesOverlay shows 4 active + 5 locked; import a small CSV in stage 3 and see rows in Doc-U → Databases → Customers; confirm existing login (test creds in memory) still lands in `/app` untouched; screenshot each onboarding stage.

## 10. Out of scope (explicitly)

- Payments/billing at trial end; team invites; password reset flow; Google OAuth; mobile-app rebrand (separate repo); removing the TEMP features override; supplier/price-list import entities; Finch in modules beyond orderflow/docu/onboarding.

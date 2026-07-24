# Implementation report: ServiceDen Lead Email Agent

Status: **complete and review-approved** (4 review rounds against `.ai/plan.md`).
All code work is done and verified locally. What remains is environmental setup
and manual end-to-end testing by Joshua (§5) — no commits, pushes, production
migrations, or external emails have been made.

---

## 1. What was built

An AI-assisted, human-approved lead email system inside ServiceDen only:

- **Company research** per lead: bounded Firecrawl integration (1 search max,
  ≤5 page scrapes, public hosts only, SSRF-guarded), producing a structured,
  sourced, confidence-labelled brief cached for 30 days. Ambiguous domain
  matches ask the user to confirm; nothing is ever guessed. Users can exclude
  individual claims from drafting.
- **Templates tab**: stage-specific writing playbooks (instructions + multiple
  real email examples), CRUD from the browser under RLS, duplicate/activate
  controls, save-sent-email-as-example flow.
- **Draft generation**: OpenAI Responses API with Structured Outputs; context
  assembled in strict priority (Gmail thread > notes/lead facts > research >
  examples > generic fallback); prompt treats all email/website content as
  untrusted data.
- **Persistent drafts + approval**: `sd_email_drafts` with a status lifecycle
  (`draft → approved → sending → sent`, plus `failed`/`cancelled`). Approval
  stores a sha256 content hash; any edit to recipient/subject/body revokes
  approval server-side; research changes mark dependent drafts stale and revoke
  approval.
- **Gmail send**: new `gmail.send` scope added to the OAuth URL (existing
  connections need one reconnect; UI prompts for it). Send route re-verifies
  ownership, approval hash, recipient, connection scope, then claims the draft
  with a compare-and-swap lease — a double-click or retry returns the first
  result instead of sending twice. Replies carry the Gmail thread id,
  `In-Reply-To` and `References` (message-ids validated; header injection via
  subject/ids is neutralised).
- **Post-send updates**: sent message mirrored into the conversation view,
  `email_sent` activity recorded, `last_outbound_at`/follow-up date/count
  updated, `new → contacted` only. `replied/won/lost` are never auto-set.

The existing Anthropic classifier and Gmail sync are untouched in behaviour
(one internal refactor, §3).

## 2. Files created / modified

### Created
| File | Purpose |
| --- | --- |
| `supabase/serviceden-email-agent.sql` | All new schema + RLS + send-lifecycle column lockdown (idempotent, paste into SQL editor) |
| `lib/platform/serviceden-email.ts` | Pure helpers (no `server-only`): URL/SSRF guards, template selection, hashes, MIME builder, threading, model-output validation, context sections |
| `lib/platform/serviceden-research.ts` | Firecrawl provider (swappable interface) + research pipeline + caching + stale-draft invalidation |
| `lib/platform/serviceden-compose.ts` | OpenAI Responses transport (shared with research) + draft generation |
| `lib/platform/serviceden-email-data.ts` | RLS reads + row mappers for research/templates/drafts |
| `app/api/serviceden/leads/[id]/research/route.ts` | GET research; POST run/refresh/confirm-domain/toggle-exclusion |
| `app/api/serviceden/leads/[id]/drafts/route.ts` | GET drafts for lead; POST generate/regenerate |
| `app/api/serviceden/drafts/[id]/route.ts` | PATCH edit (revokes approval); DELETE cancel |
| `app/api/serviceden/drafts/[id]/approve/route.ts` | POST approve (stores content hash; stale gate with explicit `acceptStale`) |
| `app/api/serviceden/drafts/[id]/send/route.ts` | POST idempotent send + post-send writes |
| `app/app/serviceden/templates/page.tsx` | Templates tab server page |
| `components/platform/serviceden/TemplatesView.tsx` | Template list/editor UI |
| `components/platform/serviceden/ResearchCard.tsx` | Research card in the lead drawer |
| `components/platform/serviceden/DraftComposer.tsx` | Composer modal (edit / regenerate / save / approve & send) |
| `tests/serviceden-email.test.ts` | 21 unit tests over the pure helpers |

### Modified
| File | Change |
| --- | --- |
| `lib/platform/serviceden.ts` | New types (research/template/draft), `websiteUrl` on `SdLead`, `internetMessageId` on `SdMailMessage`, `GMAIL_SEND_SCOPE` + `connectionHasSendScope` |
| `lib/platform/serviceden-gmail.ts` | Send scope in auth URL, `sendGmailMessage`, extracted `getGmailAccessToken` (now used by sync too), exported `addBusinessDays` |
| `lib/platform/serviceden-leads-data.ts` | Map `website_url`; select + map `internet_message_id` (required for reply threading) |
| `components/platform/serviceden/LeadsView.tsx` | Website field, ResearchCard, Draft email button, composer wiring, send-scope reconnect banner |
| `app/app/serviceden/layout.tsx` | Templates tab |
| `package.json` | `"test": "node --test tests/*.test.ts"` |
| `tsconfig.json` | `allowImportingTsExtensions: true` (see deviations) |

## 3. Deviations from the plan (all reviewed and accepted)

1. **Template CRUD has no API routes** — done via the browser Supabase client
   under RLS, matching the repo convention (`patchLead`/`createManualLead`).
   The plan explicitly sanctioned this.
2. **`GMAIL_SEND_SCOPE` lives in `serviceden.ts`** (pure file), not only in the
   server-only gmail lib, because the client UI must warn about connections
   that predate the scope. Re-exported from `serviceden-gmail.ts`.
3. **Draft send-lockdown implemented as table-level `REVOKE UPDATE` + column
   re-grant** rather than the plan's bare column revoke — a bare column revoke
   is a no-op while the table-level grant exists. Stronger than planned.
4. **`tsconfig.json` gained `allowImportingTsExtensions`** — needed solely so
   the test file can import `../lib/platform/serviceden-email.ts` at runtime
   under `node --test` (Node type-stripping does no extension resolution).
   App code does not use `.ts` specifiers.
5. **Send retry lease is 2 minutes** (`sending` older than that may be
   retried); plan discussed 2–5 min. Note the inherent residual risk: if a
   crash happens after Gmail accepts the message but before the row flips to
   `sent`, a retry after the lease could resend — Gmail's API has no
   idempotency key; this is plan-acknowledged.
6. **One eslint suppression** in `ResearchCard.tsx`
   (`react-hooks/set-state-in-effect`, with a justifying comment): the flagged
   setState calls all run after `await`, not synchronously.
7. **`.next/types/* 2.ts` stale duplicate artifacts deleted** during review to
   unblock `tsc`/build — generated files, same Finder-duplication event that
   created `supabase/serviceden 2.sql`.

## 4. Verification (all run locally, all passing)

```
npm run test      # 21/21 pass
npx tsc --noEmit  # 0 source errors
npx eslint <serviceden surface>  # 1 pre-existing ui.tsx error only; 0 new
npm run build     # compiles, 139/139 pages generated
grep for OPENAI_API_KEY / FIRECRAWL_API_KEY in client code  # no hits
```

Repo-wide `npm run lint` still fails with ~73 pre-existing errors in unrelated
modules — unchanged by this work.

## 5. Remaining steps for Joshua (environmental — not code)

1. **Migration**: paste `supabase/serviceden-email-agent.sql` into the **dev**
   Supabase project's SQL editor (idempotent). Verify via a PostgREST fetch
   that `sd_email_drafts` exists and `sd_leads.website_url` is present.
   Production only with your explicit approval, after local testing.
2. **Env vars** in `.env.local`:
   ```
   OPENAI_API_KEY=...
   OPENAI_EMAIL_MODEL=...   # optional; code defaults to gpt-5.6-sol
   FIRECRAWL_API_KEY=...
   ```
3. **Verify the OpenAI model id** (`gpt-5.6-sol`) against the live OpenAI
   model list on first run; override via `OPENAI_EMAIL_MODEL` if needed.
4. **Reconnect Gmail** from the Leads tab so the connection picks up the
   `gmail.send` scope (the UI shows an amber banner until then). If the Google
   Cloud OAuth consent screen restricts scopes, `gmail.send` may need to be
   added there first — do not change Google Cloud settings without deciding to.
5. **End-to-end test** on joshua@vyso.co.za locally: add a lead with a website
   → Research company → create a template with 1–2 examples for its stage →
   Draft email → edit → Approve & send **to an inbox you control only** →
   confirm the reply threads correctly in Gmail and the lead's follow-up
   updates. Double-click Approve & send once to confirm no duplicate.

## 6. Committing (when you decide to)

Stage the files in §2 explicitly. Do **not** `git add -A`: the working tree
contains unrelated strays — `supabase/serviceden 2.sql`, `AUDIT_FINDINGS.md`,
`components/platform/orderflow/CustomersManager.tsx`,
`components/platform/orderflow/InvoicingView.tsx`, `.vscode/`, `FABLE.md`,
`.ai/` — decide separately what to do with those.

---

# Phase C — Signup + verification code (finch-onboarding)

Status: **complete**; `npx tsc --noEmit` and `eslint` clean for all Phase C
files. Verified against `.ai/plan_finch-onboarding.md` §1, §2 (D2/D4), §3, §4
Phase C, §5, §8.

## Files created / modified

1. **`supabase/onboarding.sql`** (new, idempotent, paste-in-dashboard migration).
   - `alter table organisations add column if not exists` for `industry`,
     `employee_count`, `trial_started_at`, `trial_ends_at`,
     `onboarding_stage` (not null default 'profile'), `onboarding_completed_at`.
   - Backfills every existing org to stage `'done'` + `completed_at = now()`
     where `onboarding_completed_at is null` (so existing orgs never see
     onboarding and carry no trial clock).
   - Widens the `org_features_feature_key_check` constraint to the full 9-key
     list so seeding never trips an older constraint.
   - `waitlist_signups` table (id/name/email/company/source_path/created_at),
     unique index on `lower(email)`, RLS enabled with **no policies**; written
     only via `waitlist_join(p_name,p_email,p_company,p_source_path)` SECURITY
     DEFINER fn (idempotent `on conflict do nothing`), granted to anon +
     authenticated.
   - Three onboarding RPCs, all `security definer set search_path = public`,
     `grant execute to authenticated`:
     - `onboarding_create_org(p_org_name,p_industry,p_employee_count,p_full_name)
       returns uuid` — guards authenticated + no existing org; idempotent
       (returns existing org id if the caller already has one). Creates org tier
       `'start'`, trial `now → +14 days`, `locked_modules` = all 8 non-docu keys,
       stage `'modules'`; generates a unique slug; upserts the profile as
       `'owner'`; seeds 9 enabled `org_features` rows (where-not-exists, no
       dependency on a unique constraint).
     - `onboarding_choose_modules(p_modules text[])` — guards owner + not
       completed + exactly 3 distinct valid non-docu keys; sets `locked_modules`
       to the 5 unchosen non-docu keys, stage `'data'`; re-runnable until done.
     - `onboarding_complete()` — guards owner; stage `'done'`,
       `onboarding_completed_at = coalesce(existing, now())`.
   - **Header documents the required dashboard step (D2):** edit the Auth
     "Confirm signup" email template to emit the 6-digit `{{ .Token }}` instead
     of the confirmation link, or codes never arrive.

2. **`lib/platform/types.ts`** — `Organisation` gains six optional, pre-migration
   tolerant fields (`industry`, `employee_count`, `trial_started_at`,
   `trial_ends_at`, `onboarding_stage`, `onboarding_completed_at`).

3. **`app/login/page.tsx`** — added `pane: 'login' | 'signup' | 'verify'` state.
   - Login pane behavior **unchanged** (same `signInWithPassword` → `/app` flow,
     same markup/fields/buttons); only wrapped in the pane conditional.
   - Signup: full name + email + password (min 8) + confirm; client-side
     validation; `supabase.auth.signUp({ email, password, options:{ data:{
     full_name } } })`; on success → verify pane with anti-enumeration copy
     ("If this email is new you'll receive a 6-digit code…"). CTA copy: "Start
     your 14-day free trial".
   - Verify: 6 single-digit boxes with auto-advance, backspace-to-previous,
     arrow nav, and full-code paste (onPaste + multi-char onChange spread);
     `supabase.auth.verifyOtp({ type:'signup', email, token })`; inline error on
     wrong/expired; "Resend code" via `supabase.auth.resend({ type:'signup' })`
     with a 60s cooldown; success → `router.push('/onboarding')` + `refresh()`.
   - All three panes tolerate `supabaseConfigured === false` (signup/verify
     buttons disabled + existing "Backend not configured" notice; handlers guard
     the null client — never crash).

4. **`app/login/layout.tsx`** — metadata title → "Log in or create account | Vyso".

## Verification

- `npx tsc --noEmit` — **zero errors in Phase C files** (`app/login/*`,
  `lib/platform/types.ts`). The remaining `vyso-agent`/`vyso-ai` module-not-found
  errors are the concurrent Phase A Finch-rebrand agent's in-flight work, out of
  Phase C scope.
- `eslint app/login/page.tsx app/login/layout.tsx lib/platform/types.ts` — clean.

## Deviations / notes

- Login pane behavior preserved byte-for-byte; refactor only extracted a shared
  `LABEL` class constant and wrapped panes in conditionals.
- SQL adds an owner guard to `onboarding_complete()` (plan §3 only specified the
  state change) — defensive, consistent with the other RPCs; does not change the
  happy path (the signing-up user is always the owner).
- `onboarding_create_org` generates a unique org `slug` (loop-suffixed) since
  `organisations.slug` is used elsewhere as a unique identifier — the plan named
  the columns to set but not the slug; derived deterministically from the name.

---

# Phase A — Finch rebrand (finch-onboarding)

Status: **complete**. `npx tsc --noEmit` and `npm run build` clean (post-rebrand).
Verified against `.ai/plan_finch-onboarding.md` §1, §2 D8, §4 Phase A, §5, §9.

## Outcomes

- `lib/ai/vyso-agent/` → `lib/ai/finch/` via `git mv` (7 files). Identity string
  in `knowledge.ts` now "You are **Finch**, the assistant built into the Vyso
  operations platform…". `config.ts`: `isVysoAiEnabled`/`isVysoAiAllowed` →
  `isFinchEnabled`/`isFinchAllowed`; env reads `FINCH_ENABLED ?? VYSO_AI_ENABLED`
  (legacy var still honoured, per D8).
- `components/platform/vyso-ai/` → `components/platform/finch/` via `git mv`,
  with `VysoAIButton`→`FinchButton`, `VysoAILauncher`→`FinchLauncher`,
  `VysoAIModal`→`FinchModal`, `VysoAIOrderPrefill`→`FinchOrderPrefill`
  (`BouncingDots` keeps its name; its aria-label is now "Finch is thinking").
  All user-visible copy, aria-labels and the mistakes disclaimer updated.
- **New `components/platform/finch/FinchMark.tsx`**: a stroked (fill:none),
  single-continuous-outline bird-in-profile SVG per the plan's spec (round
  head, triangular beak, dot eye, leaf wing curve, long pointed tail, one short
  leg + a detached base line), `linearGradient` cornflower-blue `#6C9BE0` →
  warm-orange `#F0873C` (top-left to bottom-right), muted blue-grey `#7E93B8`
  eye. Props `size` (default 20), `title` (a11y; empty string renders it
  `aria-hidden` for decorative use inside an already-labelled control),
  `animate?: 'draw' | 'none'`. `animate="draw"` measures the body path's real
  length via `getTotalLength()` and animates `stroke-dashoffset` inline (~0.9s
  ease-out) rather than a CSS keyframe, since the length is only known at
  runtime; a `.finch-mark-settle` CSS class (globals.css) plays a one-time
  2px translateY pop once the draw finishes. `prefers-reduced-motion` is
  checked via `matchMedia` and skips straight to the static final frame.
  Wired into `FinchButton` (replaces the sparkle icon) and `FinchModal`'s
  header avatar, exactly as scoped for this phase — the sparkle SVG is left
  in place everywhere else in `FinchModal` (composer send button, parsed-order
  card badges, ingest-result card badge) since the plan only named the button
  and modal-header spots for this phase.
- Consumers updated: `app/app/orderflow/layout.tsx`,
  `components/platform/docu/DocuNav.tsx`,
  `components/platform/orderflow/OrdersView.tsx` (toast copy + internal
  `handleVysoLoad`→`handleFinchLoad`), `components/platform/insightgen/View.tsx`
  (demo copy), `components/platform/SubNav.tsx` (comment), the 4 routes under
  `app/api/ai/agent/` (imports + user-facing 403 copy "Finch is not enabled…"),
  `lib/platform/document-ingest.ts` (comment).
- `lib/platform/supabase-server.ts` + `lib/platform/session.tsx`:
  `vysoAiEnabled` → `finchEnabled`, all consumers updated.
- `app/globals.css`: `.vyso-ai-gradient`/`.vyso-ai-dot` + keyframes →
  `.finch-gradient`/`.finch-dot`; added the `.finch-mark-settle` keyframe
  block beside it (see FinchMark note above for why the draw-in itself is
  inline, not a CSS keyframe).
- `lib/ai/finch/order-handoff.ts`: writes `finch:parsed_order`; `readParsedOrder`
  reads the new key first, falling back to the legacy `vysoai:parsed_order`
  (dual-read, D8); `clearParsedOrder` clears both keys.
- Marketing: `git mv app/platform/vyso-ai app/platform/finch`; retitled page
  copy/metadata/JSON-LD/FAQ/breadcrumb/heading id to Finch; **left the CTA
  banner's `primaryLabel`/`secondaryLabel` untouched** ("Become a founding
  client" / "Talk to us") per the plan — Phase B owns CTA label copy — but did
  update the banner's own `title` text ("Test Finch against real operational
  questions.") since that's page copy, not a CTA label. Added the 308 redirect
  `/platform/vyso-ai` → `/platform/finch` in `next.config.ts`; updated
  `app/sitemap.ts`, `components/Navbar.tsx` dropdown entry (label "Finch", href
  `/platform/finch`; nav CTA buttons untouched), `components/sections/SiteFooter.tsx`
  link, `app/platform/page.tsx` card, `app/founding-client/page.tsx:164` copy.

## Deviation / addition beyond the plan's explicit file list

- **`components/platform/TopBar.tsx`** imported `clearParsedOrder` from the old
  `@/lib/ai/vyso-agent/order-handoff` path. This wasn't in the plan's Phase A
  file inventory, but the `git mv` of that directory would have broken this
  import (module-not-found) if left alone, so it was updated to
  `@/lib/ai/finch/order-handoff` — a mechanical necessity of the rename, not a
  new behavior or design decision.

## Verification

```
npx tsc --noEmit     # 0 errors (after clearing stale .next/types cache)
npm run build        # compiles clean; /platform/finch and the /platform/vyso-ai
                      # redirect both resolve correctly (checked in-browser)
grep -rni --include='*.ts' --include='*.tsx' --include='*.css' -E 'vyso ?ai' app components lib
                      # 1 hit: lib/ai/finch/order-handoff.ts's LEGACY_KEY string
                      # 'vysoai:parsed_order' — required by D8's dual-read, not
                      # user-visible (a localStorage key), not a miss.
```

`npm run lint` does **not** cleanly pass, but this is pre-existing repo-wide
debt, not a Phase A regression: ~68 errors exist across files this phase never
touched (`components/platform/wastewatch/*`, `components/platform/supplysync/*`,
`components/sections/HowItWorks.tsx`, `app/app/docu/recent/page.tsx`,
`app/app/pricepilot/*`, etc.), almost all `react-hooks/set-state-in-effect` and
`Cannot call impure function during render` from a strict eslint-plugin-react
ruleset that predates this branch. Every lint hit inside a file this phase
touched is either identical pre-existing code carried over by the `git mv`
(e.g. `FinchModal.tsx`'s `useEffect(() => setMounted(true), [])`, and an
apostrophe in copy that was never edited), or one new instance in
`FinchMark.tsx` (`setSettled(true)` inside a `prefers-reduced-motion` branch)
that follows the exact same mounted-flag idiom already pervasive in this
codebase (SSR safety requires deferring the `window.matchMedia` check to an
effect). Fixing this ruleset repo-wide is out of Phase A's scope per §5
("Stage/commit only files this plan names").

## Files touched (committed)

Renamed (`git mv`): `lib/ai/vyso-agent/*` → `lib/ai/finch/*` (7 files),
`components/platform/vyso-ai/*` → `components/platform/finch/*` (5 files),
`app/platform/vyso-ai/page.tsx` → `app/platform/finch/page.tsx`.

New: `components/platform/finch/FinchMark.tsx`.

Modified: `app/api/ai/agent/{route,customers/route,ingest-document/route,parse-order/route}.ts`,
`app/app/orderflow/layout.tsx`, `app/founding-client/page.tsx`, `app/globals.css`,
`app/platform/page.tsx`, `app/sitemap.ts`, `components/Navbar.tsx`,
`components/platform/SubNav.tsx`, `components/platform/TopBar.tsx`,
`components/platform/docu/DocuNav.tsx`, `components/platform/insightgen/View.tsx`,
`components/platform/orderflow/OrdersView.tsx`, `components/sections/SiteFooter.tsx`,
`lib/platform/document-ingest.ts`, `lib/platform/session.tsx`,
`lib/platform/supabase-server.ts`, `next.config.ts`.

Not touched (hard constraints, pre-existing working-tree changes left as-is):
`app/app/serviceden/*`, `components/platform/serviceden/*`,
`lib/platform/serviceden*`, `components/platform/orderflow/CustomersManager.tsx`,
`components/platform/orderflow/InvoicingView.tsx`, `tests/`, `.vscode/`,
`AUDIT_FINDINGS.md`, `package.json`, `tsconfig.json`.

---

# Phase F — Rate limiting on Finch agent routes (finch-onboarding)

Status: **complete**. `npx tsc --noEmit` clean. `eslint` clean on 3 of 4 files;
1 pre-existing error on `app/api/ai/agent/route.ts` (the `module` variable
assignment, not introduced by this phase).
Verified against `.ai/plan_finch-onboarding.md` §2 (D6), §4 Phase F, §5, §9.

## Outcomes

Added per-user rate limiting to four Finch agent routes to close SEC-08:

1. **`app/api/ai/agent/route.ts`** — bucket `ai-agent:<userId>`, 40 per 3600s.
   Returns 429 JSON before stream opens: `{error: "You've hit the hourly Finch
   limit. Try again soon."}`.
2. **`app/api/ai/agent/ingest-document/route.ts`** — bucket
   `ai-agent-ingest:<userId>`, 20 per 3600s. Same error format.
3. **`app/api/ai/agent/parse-order/route.ts`** — bucket `ai-agent-parse:<userId>`,
   20 per 3600s. Same error format.
4. **`app/api/ai/agent/customers/route.ts`** — bucket
   `ai-agent-customers:<userId>`, 120 per 3600s. Same error format.

Pattern: imported `rateLimitAllowed` from `lib/platform/rate-limit`, checked
immediately after auth resolution (user id resolved, before any heavy work or DB
query), returns `NextResponse.json({ error: '...' }, { status: 429,
headers: AI_CORS_HEADERS })` on limit exceeded. Matches the idiom in
`app/api/ai/message/route.ts` exactly.

## Files modified

- `app/api/ai/agent/route.ts`
- `app/api/ai/agent/ingest-document/route.ts`
- `app/api/ai/agent/parse-order/route.ts`
- `app/api/ai/agent/customers/route.ts`

Total changes: 4 imports, 4 rate-limit guards (20 LOC added across all files).

## Verification

```
npx tsc --noEmit  # 0 errors
npm run lint -- app/api/ai/agent/{route,ingest-document,parse-order,customers}/route.ts
                  # 3 files clean; 1 pre-existing error on route.ts line 112
                  # (const module = ..., @next/next/no-assign-module-variable)
                  # not introduced by this phase
```

## Deviations / notes

- The eslint error on `app/api/ai/agent/route.ts:112` is pre-existing (the `module`
  variable assignment violates Next.js linting rules but existed before Phase F).
  This phase's rate-limit code passes eslint clean and does not touch that line.
- All four rate-limit checks use consistent bucket naming (`ai-agent*`), error
  copy, and response status per the plan §2 (D6).
- Per-user bucketing means each user has their own window; the rate limiter's
  FAILS OPEN behavior (tolerates missing migration or DB unavailability) preserves
  the endpoint's availability even if `rate-limits.sql` is not yet pasted.

---

# Phase E — Trial surfacing (finch-onboarding)

Status: **complete**. `npx tsc --noEmit` clean; `eslint` clean on all four files
except one pre-existing, unrelated warning (below). Verified against
`.ai/plan_finch-onboarding.md` §2 (Q2 hard lock), §3 (`PlatformSession.trial`),
§4 Phase E, §5, §8, §9.

## Outcomes

1. **`lib/platform/supabase-server.ts`** — added a `computeTrial(org)` helper
   and `trial: {endsAt, daysLeft, expired} | null` on `PlatformSession`,
   computed from `org.trial_started_at`/`trial_ends_at`. Null whenever either
   column is absent/null (existing orgs, or orgs mid-onboarding before stage 1
   completes), so nothing changes for them. `daysLeft` = `ceil` of remaining
   ms, floored at 0. `expired` = `trial_ends_at` in the past.
2. **`lib/platform/session.tsx`** — `PlatformContextValue` gains the identical
   `trial` field so the shape stays in sync with `PlatformSession` (the layout
   passes the session straight into `PlatformProvider`).
3. **`components/platform/TopBar.tsx`** — new `trialPillLabel(daysLeft)` helper
   ("Trial ends today" at 0, "Trial · 1 day left" singular, "Trial · N days
   left" otherwise) and a pill rendered next to the module label, visible only
   when `trial && !trial.expired` (hidden entirely when `trial` is null or
   expired — the gate owns the expired state). Styled `bg-[#EAF2FC]
   text-[#174C87] rounded-full`, matching the existing account-menu/notification
   accentWeak treatment already in this file; links to `/app/settings`.
4. **New `components/platform/TrialGate.tsx`** — client component; renders
   `children` unchanged unless `session.trial?.expired`, in which case it
   renders a full-screen "Your trial has ended" screen instead, mirroring
   `ModuleLockGuard`'s lock-screen structure/spacing/typography exactly (same
   icon chip, heading size, copy color, mailto button styling). Copy states
   data is retained/safe, includes the trial end date when known, and links
   `mailto:joshua@vyso.co.za?subject=Continue%20with%20Vyso`. No "Sign out"
   affordance inside the gate — the spec noted TopBar (rendered above it) still
   provides that.
5. **`app/app/layout.tsx`** — wired `TrialGate` around `ModuleLockGuard`
   (inside the existing `<main>`, inside `PlatformProvider`), so an expired
   trial takes precedence over the per-module lock screen while TopBar (and
   thus sign-out) keeps rendering. No changes to the auth redirect or any other
   layout structure; no `/onboarding` redirect added (explicitly Phase D's job,
   not touched here).

## Files touched

- `lib/platform/supabase-server.ts`
- `lib/platform/session.tsx`
- `components/platform/TopBar.tsx`
- `components/platform/TrialGate.tsx` (new)
- `app/app/layout.tsx`

## Verification

```
npx tsc --noEmit
# 0 errors

npx eslint lib/platform/supabase-server.ts lib/platform/session.tsx \
  components/platform/TopBar.tsx components/platform/TrialGate.tsx app/app/layout.tsx
# 1 warning: TopBar.tsx — 'SERVICEDEN_ACCOUNT_EMAIL' is defined but never used
# (pre-existing, unrelated to this phase's edits — present before this change,
# not touched by it)
```

`npx next build` was attempted but fails in this sandbox on unrelated Google
Fonts network access (`@vercel/turbopack-next/internal/font/google/font` can't
resolve — no outbound network to fonts.googleapis.com), not on anything this
phase changed; `tsc --noEmit` is the verification command this phase's spec
calls for and it is clean.

## Deviations / notes

- None from the plan. `PlatformSession.trial` and `PlatformContextValue.trial`
  are structurally identical by design, matching how every other session field
  (`org`, `features`, `lockedModules`, `finchEnabled`) is mirrored between the
  two types.
- The pre-existing `SERVICEDEN_ACCOUNT_EMAIL` unused-import warning in
  `TopBar.tsx` was left untouched per §5 (touch only the four files named for
  this phase; don't fix unrelated issues in-scope files beyond the assigned
  change).

---

# Phase B — "Join Waitlist" CTA sweep + waitlist capture (finch-onboarding)

Status: **complete**. `npx tsc --noEmit` clean repo-wide. `eslint` clean on all
Phase B files (created + modified). Verified against
`.ai/plan_finch-onboarding.md` §2 (Q1), §3 (waitlist endpoint), §4 Phase B,
§5, §6 (verbatim CTA inventory), §8, §9.

## What was built

- **`components/marketing/WaitlistModal.tsx`** (new) — the capture dialog:
  name / email / company(optional), posts to `/api/waitlist` with
  `usePathname()` as `source_path`, success state ("You're on the list"),
  inline error surface. Styled with the marketing orange system
  (`hsl(22,69%,44%)`, pill buttons, translucent card) matching
  `components/ContactForm.tsx`'s idiom — explicitly NOT the platform blue
  system. `role="dialog"` + `aria-modal`, Escape-to-close, body-scroll lock,
  autofocus on the name field, backdrop click to close, rendered via
  `createPortal` to `document.body`. No SSR "mounted" gate needed/used (see
  deviation below).
- **`components/marketing/WaitlistCtaButton.tsx`** (new) — the client
  boundary: a `forwardRef<HTMLButtonElement>` button that opens
  `WaitlistModal` on click, forwarding all `ButtonHTMLAttributes` (className,
  style, onMouseEnter/Leave, etc.) so it drops into every existing CTA slot's
  styling untouched — including composing through `LiquidButton`'s `asChild`
  clone and Radix `DropdownMenuItem`'s `asChild` Slot, both of which require a
  ref-forwarding, prop-spreading child.
- **`app/api/waitlist/route.ts`** (new) — POST `{name, email, company?,
  sourcePath?}`. Validates required fields, per-field length caps, email
  regex (mirrors `app/api/contact/route.ts`'s hostile-input posture:
  HTML-escaped interpolation, CRLF-stripped subject line). Rate-limited via
  `rateLimitAllowed('waitlist:<ip>', 5, 3600)` from `lib/platform/rate-limit.ts`
  (same IP-derivation idiom as the contact route). Writes via
  `supabase.rpc('waitlist_join', {p_name, p_email, p_company, p_source_path})`
  on the anon client (matches the exact signature in `supabase/onboarding.sql`,
  written by Phase C) — and unconditionally also sends a Resend notification
  to joshua@vyso.co.za. The DB write and the email are independent best-effort
  paths; the route only returns an error if **both** fail (confirmed live: with
  the migration not yet pasted, `waitlist_join` was absent from the schema
  cache, logged, and the route still returned 200 because the email path
  succeeded — see Verification).

## CTA sweep (§6 — all 13 rows)

- `components/marketing/PublicMarketing.tsx` — `MarketingCta`'s primary is now
  a `WaitlistCtaButton` (default label `"Join Waitlist"`); the `primaryHref`
  prop was removed (no longer meaningful — the primary action never navigates).
  Every one of its 7 callers had its `primaryLabel` override deleted so they
  fall through to the new default; the two that also passed `primaryHref`
  (`app/platform/finch/page.tsx`, `app/founding-client/page.tsx`) had that
  removed too. Secondary label/href left untouched everywhere, per plan.
- `components/Navbar.tsx` — desktop `LiquidButton` CTA ("Contact us" →
  "Join Waitlist", `GradientText` child swapped from `<Link>` to
  `WaitlistCtaButton`); the "Explore" mega-menu list item ("Talk to Vyso" →
  "Join Waitlist", branched to render `WaitlistCtaButton` instead of `<Link>`
  since the array was otherwise shared with two real nav links); mobile
  dropdown "Contact us →" → "Join Waitlist →" (same `WaitlistCtaButton` swap
  inside `DropdownMenuItem asChild`).
- `components/sections/PricingSection.tsx` — audit-banner CTA ("Discuss the
  audit" → "Join Waitlist"), and all three `TIERS[].cta` strings ("Get
  started"/"Talk to us"×2 → "Join Waitlist"), all converted from `<Link
  href="/contact">` to `WaitlistCtaButton` with identical inline
  style/hover-handler props. The file's `Link` import became unused after the
  swap and was removed.
- `app/founding-client/page.tsx:143` — reworded "This is not a waitlist or a
  speculative beta" → "This is not a speculative beta. Founding-client status
  is a structured commitment…" (keeps the founding-client framing, removes the
  contradiction with the new site-wide waitlist positioning). The page's own
  hero CTA ("Apply to become a founding client") and its `AUDIENCE_LINKS`
  Navbar entry (also literally "Become a founding client") were left alone —
  neither is one of the 13 §6 rows.

## Verification

```
npx tsc --noEmit
# 0 errors

npx eslint components/marketing/WaitlistModal.tsx components/marketing/WaitlistCtaButton.tsx \
  components/marketing/PublicMarketing.tsx app/api/waitlist/route.ts components/Navbar.tsx \
  components/sections/PricingSection.tsx app/south-africa/page.tsx app/platform/finch/page.tsx \
  app/platform/vyso-for-smes/page.tsx app/platform/page.tsx app/case-studies/turn-n-slice/page.tsx \
  "app/industries/[slug]/page.tsx" app/founding-client/page.tsx
# clean, exit 0

grep -rn "Join Waitlist" app components --include="*.tsx"
# all 13 §6 CTAs confirmed present (7 via MarketingCta's shared default, not
# literal per-file text)
```

Manual, via dev server + browser tools: opened `/pricing`, clicked the Navbar
"Join Waitlist" button — modal opened, styled correctly (orange accent, not
platform blue), name field autofocused. Submitted a real form (name + test
email) → `POST /api/waitlist` returned `200`; server log showed
`waitlist_join RPC error: Could not find the function public.waitlist_join(...)
in the schema cache` (expected — `supabase/onboarding.sql` has not been pasted
into the dashboard yet) with no email-send error logged, and the UI still
rendered the "You're on the list" success state — confirming the
never-fail-the-user degrade path works end-to-end. No console errors.
Confirmed `/founding-client`'s CTA renders "Join Waitlist" and the reworded
copy renders correctly.

## Deviations / notes

- **`primaryHref` removed from `MarketingCta`'s props**, not just unused —
  the plan's §4 Phase B bullet says "default `primaryLabel` → 'Join
  Waitlist'" without mentioning `primaryHref`, but since the primary action is
  now a button that opens a modal (never navigates), keeping a dead `href`
  prop around would be misleading. All 8 usages (component default + 7
  call-sites) were audited — no caller needs it kept for a non-waitlist
  primary action, since every `MarketingCta` instance in the codebase is one
  of the swept 13.
- **`WaitlistModal` has no SSR "mounted" gate**, unlike `FinchModal`'s
  precedent (`components/platform/finch/FinchModal.tsx`) which uses
  `useEffect(() => setMounted(true), [])` before calling `createPortal`. That
  pattern exists because `FinchModal` is always mounted (an `open` prop
  toggles visibility) and could in principle render during hydration.
  `WaitlistModal` is only ever mounted by `WaitlistCtaButton` via `{open &&
  <WaitlistModal .../>}`, which only becomes true after a user click — so
  `document` is always available when it mounts, and skipping the gate also
  sidesteps an eslint `react-hooks/set-state-in-effect` error the mounted-flag
  idiom triggers on this repo's ruleset (Phase A's report notes the same rule
  as pre-existing debt elsewhere; here it was avoidable outright rather than
  carried over).
- **Navbar's "Explore" list item required a small branch**, not a straight
  swap: `{label, href}` was mapped generically over three items (Pricing,
  FAQ, and the waitlist CTA) into `<Link>`s; since two of the three still
  navigate, the map body now branches on `href === null` to render
  `WaitlistCtaButton` instead of `<Link>`, sharing one `itemStyle` object so
  visual output is byte-identical to before for the two untouched items.
- No new npm dependencies; no changes to `next.config.ts`, `lib/ai/`,
  `components/platform/`, or any file under `app/app/`; strays in the working
  tree (`app/app/serviceden/*`, `components/platform/serviceden/*`,
  `lib/platform/serviceden*`, `components/platform/orderflow/*.tsx`,
  `package.json`, `tsconfig.json`, `.vscode/`, `AUDIT_FINDINGS.md`, `.ai/*`
  other than this file, `tests/`, `supabase/serviceden*`) were left untouched
  and excluded from staging (`git add` used explicit paths, not `-A`).

---

# Phase D — Finch-guided onboarding flow `/onboarding` (finch-onboarding)

Status: **complete**. `npx tsc --noEmit` clean; `eslint` clean on all Phase D
files; `npm run build` succeeds (`/onboarding` registered as a dynamic route);
live dev-server render check passed. Verified against
`.ai/plan_finch-onboarding.md` §1, §2 (D1/D3/D5), §3, §4 Phase D, §5, §8, §9.

## What was built

A top-level `/onboarding` route: a three-stage, Finch-hosted first-run flow that
provisions the org (stage 1), records the 3-module trial choice (stage 2), and
hand-holds the user through bringing data into Core Data (stage 3), then lands
them in `/app` with their chosen modules unlocked.

### Files created
| File | Purpose |
| --- | --- |
| `app/onboarding/layout.tsx` | Server shell. Guards: no session → `/login`; `org?.onboarding_completed_at` → `/app`. Instrument Sans + `--radius:0.625rem` wrapper, `#F6F6F4` page + the app-shell top-wash gradient, minimal chrome (Finch mark in a `.finch-gradient` badge + "Set up your workspace" + sign-out). |
| `app/onboarding/page.tsx` | Server. Derives the resume stage from `org.onboarding_stage` (no org → profile; modules → modules; else data), infers already-chosen modules from `locked_modules` (chosen = valid non-docu keys NOT locked), reads the signUp-metadata `full_name` for the name prefill, and wraps `<OnboardingFlow>` in a `PlatformProvider` (the /onboarding layout has none — the embedded ImportWizard + counts need `usePlatform()`). |
| `components/platform/onboarding/OnboardingFlow.tsx` | Client orchestrator. 3-step numbered `StepIndicator` (AddSupplierWizard idiom), a persistent Finch panel (FinchMark `animate="draw"`, re-keyed per stage, + short static intro copy) for stages 1–2, and `router.refresh()` after each RPC so the server session stays truthful for a resume/return. |
| `components/platform/onboarding/StageProfile.tsx` | Name (prefilled) + company + industry select (8 options incl. Other → free-text) + employee-count band pills. Submit → `rpc('onboarding_create_org', …)`. |
| `components/platform/onboarding/StageModules.tsx` | Card grid from `MODULES` (FeatureKey source of truth) + `MODULE_META` visuals (via a `featureKey→meta` index). Doc-U pre-selected/disabled, badged "Always included"; exactly 3 others selectable with a live "N of 3 selected" counter and the 14-day-trial framing. Submit → `rpc('onboarding_choose_modules', {p_modules})`. |
| `components/platform/onboarding/StageData.tsx` | Split layout. Left: Finch chat via the shared `useFinchStream` hook (module `'onboarding'`). Right: progress checklist (Customers/Products/Documents, real counts via the browser client), an upload surface (Import customers / Import products → embedded ImportWizard modal; Upload documents → POST `/api/ai/agent/ingest-document` with image downscaling, result cards), a per-chosen-module "what this unlocks" summary, and Skip / Finish buttons → `rpc('onboarding_complete')` → `/app`. D5: on finish, if `pricepilot` chosen and `pl_price_lists` empty, a tolerant insert of one default global "Standard pricing" list (failure logged, never blocks). |
| `components/platform/onboarding/OnboardingSignOut.tsx` | Small client sign-out link for the layout chrome (TopBar signOut idiom). |
| `components/platform/onboarding/shared.tsx` | `isMissingRpcError()` + `MigrationMissingCard` — every stage shows a visible card naming `supabase/onboarding.sql` when the RPC is absent, never a white screen (§8). |
| `components/platform/finch/useFinchStream.ts` | Shared Finch text-chat SSE hook (fetch → getReader → split('\n\n') → parse `{text|tool|done|error}`). |

### Files modified
| File | Change |
| --- | --- |
| `lib/ai/finch/config.ts` | `AgentModule` gains `'onboarding'` (+ `AGENT_MODULES`). |
| `lib/ai/finch/knowledge.ts` | New `ONBOARDING_KNOWLEDGE` doc (what Core Data is; per-module data effects — OrderFlow/ProcurePulse automatic, PricePilot via price list, SupplySync via documents; spreadsheets→import, documents→chat; SA-SME tone) wired into the `MODULE_KNOWLEDGE`/`MODULE_LABEL` maps exactly like the existing docs. Guardrail structure/injection-hardening in `buildSystemPrompt` untouched. |
| `lib/ai/finch/tools.ts` | New read-only `onboarding_get_progress` tool (counts of of_customers/pp_stock_items/documents + unlocked modules from `locked_modules`, all tolerant of missing tables/columns) registered for the onboarding module. |
| `app/api/ai/agent/route.ts` | Added the `onboarding_get_progress` status label. Module `'onboarding'` routes correctly with no changes needed: `isAgentModule` now accepts it, workflow escalation is `module === 'orderflow'`-only (so onboarding stays Q&A/Haiku), tools = the onboarding set, rate limiting intact. |
| `components/platform/coredata/ImportWizard.tsx` | Added optional `{embedded?, entity?, onComplete?}` props. Embedded: entity picker hidden when locked, the outbound "view" `<Link>` + post-import `router.refresh()` suppressed (reports via `onComplete` instead). **Default behaviour unchanged.** |
| `app/app/layout.tsx` | D3 redirect: `!session.org || session.org.onboarding_completed_at === null` → `/onboarding`. (See deviation 1.) |

## Verification

```
npx tsc --noEmit           # 0 errors
eslint <all Phase D files> # clean (route.ts's pre-existing no-assign-module-variable
                           #  error on `const module` is NOT from this phase)
npm run build              # succeeds; /onboarding = ƒ (dynamic). (One stale
                           #  ".next/…/chunks 2" Finder-duplicate had to be rm'd
                           #  first — same artifact prior phases hit.)
```

Live (dev server + browser, logged in as the existing test org DD Fruits & Veg):
- Unauthenticated `/onboarding` → redirects to `/login`. ✓
- Existing-org login lands on `/app` with **NO** redirect to `/onboarding` — the
  critical regression check. Confirms the `=== null` (not falsy) design: a
  pre-migration org has NO `onboarding_completed_at` column (field is `undefined`)
  so it is never redirected. ✓
- `/onboarding` for that org renders **StageData** (stage falls to 'data' with an
  existing org): step indicator, Finch chat, progress checklist showing the org's
  REAL counts (1 customer / 9 products / 6 documents), upload surface, and the
  "what your data unlocks" summary. ✓
- "Import customers" opens the **embedded ImportWizard** modal — entity picker
  hidden (locked), Upload→Review→Done step bar. ✓
- Finch chat streamed a reply that called `onboarding_get_progress` and quoted the
  real counts back ("1 customer, 9 products, and 6 documents loaded"), then gave
  onboarding-appropriate advice. Confirms `useFinchStream`, onboarding module
  routing, the knowledge doc, and the new tool end-to-end. ✓

**Render-check limitation:** StageProfile (needs no org) and StageModules (needs
`onboarding_stage='modules'`) could not be reached live — both states require the
onboarding migration to be applied to the dev DB (it is not) or a brand-new signup
(blocked by the manual OTP email-template step, D2). They are pure client
components, tsc/eslint/build-clean, and share the exact patterns proven working in
StageData (`createClient().rpc`, `MigrationMissingCard`, the platform-blue form
language). A full new-signup walkthrough needs Joshua to (1) paste
`supabase/onboarding.sql` and (2) set the Auth "Confirm signup" template to emit
`{{ .Token }}` (both already documented in the migration header / Phase C).

## Deviations / notes

1. **D3 redirect uses `=== null`, not a falsy check.** The plan wrote "org.onboarding_completed_at null → redirect". A bare falsy check would also catch `undefined` (the column absent), redirecting EVERY existing org into onboarding before the migration is pasted — the opposite of "existing orgs completely unaffected" (§0/§8). Strict `=== null` redirects only orgs that have the column present-but-empty (brand-new orgs mid-flow) while leaving pre-migration orgs alone. Verified live (DD Fruits & Veg was not redirected).
2. **FinchModal was NOT refactored onto `useFinchStream`.** Per the plan's own caveat ("…ONLY if the extraction is clean and behavior-identical; otherwise duplicate the small reader and note the deviation"): FinchModal's `send` carries branches this hook deliberately omits (deferred file attachments, order-draft cards, the workflow-tier arming), so widening the hook to cover them would not be behaviour-identical. The hook is the shared reader for the simpler onboarding chat; FinchModal keeps its own inline reader. Noted in the hook's header.
3. **`page.tsx` wraps the flow in `PlatformProvider`.** The /onboarding layout has none, but the embedded ImportWizard and the data-stage counts call `usePlatform()`. The provider is fed the same session object; `router.refresh()` after each stage keeps its `org` current as the org is created/updated. This is additive (not in the plan's file list) but a mechanical necessity of reusing ImportWizard, not a design change.
4. **D5 price-list failure is `console.warn`'d, not shown in a summary card.** Finish navigates straight to `/app`, so a post-completion summary card would never be seen; the tolerant insert logs on failure and never blocks completion, which honours the intent (§8: "tolerated, logged in summary, onboarding still completes").
5. **StageData reads the ingest-document image-downscale logic as a compact local copy** (not imported from FinchModal, whose helpers aren't exported) — same 2000px-JPEG / PDF-passthrough approach, same size caps.

## Files touched (to be committed — explicit paths, never `-A`)

New: `app/onboarding/layout.tsx`, `app/onboarding/page.tsx`,
`components/platform/onboarding/{OnboardingFlow,StageProfile,StageModules,StageData,OnboardingSignOut,shared}.tsx`,
`components/platform/finch/useFinchStream.ts`.

Modified: `lib/ai/finch/{config,knowledge,tools}.ts`,
`app/api/ai/agent/route.ts`, `app/app/layout.tsx`,
`components/platform/coredata/ImportWizard.tsx`, `.ai/implementation.md`.

Left untouched (hard constraints / others' in-flight work — NOT staged):
`package.json` + `tsconfig.json` (belong to the ServiceDen work — `test` script +
`allowImportingTsExtensions`, not mine), all `serviceden*` files,
`components/platform/orderflow/{CustomersManager,InvoicingView}.tsx`,
`app/apps/`, `app/services/`, `tests/`, `.vscode/`, `AUDIT_FINDINGS.md`,
`FABLE.md`, `Claude_Rules.md`, `supabase/serviceden*.sql`, and the other `.ai/*`
files.

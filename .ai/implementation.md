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

# Automating WhatsApp & Email Order + Invoice Capture — Plan

_Draft for review. Nothing here is built yet. Grounded in the current codebase (Aug 2026)._

## The one-line insight

**The hard part is already done.** Vyso already extracts orders/invoices from images/PDFs and builds real OrderFlow orders + ProcurePulse stock, with a human review UI. Automating "WhatsApp/email capture" is therefore an **ingestion problem** — build inbound channels that drop a file + a `documents` row into Supabase and trigger the existing extraction. Everything downstream already works and is review-hardened.

So most of this plan is plumbing, routing, and trust — not AI.

---

## Decisions I need from you (read this first)

1. **WhatsApp provider:** Meta WhatsApp **Cloud API direct** (lowest cost, most control, more setup) vs a **BSP** (Twilio = fastest DX + dev sandbox; 360dialog = SA-friendly flat WABA). For one client, Cloud API direct is fine; a BSP pays off if we onboard many clients fast.
2. **Email capture style:** a **dedicated Vyso inbound address** (e.g. `orders@freshco.vyso.co.za`) that the client auto-forwards their existing `orders@` to (2-min setup, works day one) — vs **natively connecting their existing inbox** (Gmail API / Microsoft Graph, zero forwarding but OAuth + token management).
3. **Auto-publish policy:** start **review-only** (everything lands as a draft to confirm — recommended for a first client) vs **auto-invoice high-confidence** captures from day one (the engine already supports this gate).
4. **Queue infra:** simple **Vercel Cron drain** vs a **durable queue** (Upstash QStash / Inngest / Trigger.dev) for retries + backpressure.
5. **What does the first client actually use today** — WhatsApp, email, or both? And do they have a **dedicated orders line / inbox**, or is it someone's personal number/mailbox? This sequences everything below.

---

## What already exists (so we build on it, not around it)

| Piece | Where | Notes |
|---|---|---|
| Upload → storage → `documents` row → extract | `components/platform/docu/UploadBubble.tsx`, `components/platform/orderflow/PublishOrderButton.tsx` | Bucket `documents`, path `{org_id}/{uuid}_{filename}`; insert `{org_id, filename, status:'pending', storage_path, uploaded_by, document_type, folder_id}`; then `POST /api/ai/extract {documentId}`. **This is exactly what we automate.** |
| Extraction entry point | `app/api/ai/extract/route.ts` | Downloads the file, branches on `document_type`. `'order'` → `extractOrderDocument` → `syncOrderFromDocument`. Else (`invoice`/`statement`/`delivery_note`/`price_list`) → `extractDocument` → `feedDocumentToProcurePulse`. |
| Claude extraction | `lib/ai/anthropic.ts` | `EXTRACT_MODEL` defaults to **`claude-haiku-4-5`** (env-overridable). Vision-capable: PDFs via `document` blocks, images via `image` blocks. `ORDER_EXTRACT_INSTRUCTION` already reads **WhatsApp screenshots, emails, handwritten notes**. Confidence scores 0–100. |
| Order builder | `lib/platform/orderflow-from-doc.ts` → `syncOrderFromDocument(db, {documentId, orgId, customerId?, finalize?})` | Customer match, PricePilot pricing, **auto-invoice only when customer known ≥80 AND all lines priced**, else holds draft. Idempotent per `source_document_id`. Directly callable from a backend process. |
| Invoice/stock feed | `lib/platform/procurepulse-feed.ts` → `feedDocumentToProcurePulse(supabase, doc)` | Idempotent per document. |
| Review UI | `/app/docu` inbox + `/awaiting` + `/flagged`; `OrderReviewEditor`, `ExtractionEditor` | Confirm customer + tidy lines → "Confirm & invoice". Statuses `pending → extracted → reviewed → approved`. **We can reuse this as the capture review surface.** |
| Matching keys | `of_customers.email` + `.phone`; `ss_suppliers.contact_phone/contact_email` | Present — we can match an inbound number/sender to a customer/supplier. |

### Gaps automation must fill
1. **Inbound webhooks** — none exist today (Resend is outbound-only for the marketing form).
2. **A server-side write path with no user session** — the app is **RLS/cookie-only; there is no service-role key**. A webhook can't insert `documents` for an org without one. _(See "The service-role decision" — it's the biggest cross-cutting item.)_
3. **Channel → org routing** and **sender → customer/supplier identity**.
4. **A capture/ingestion table + queue** for idempotency, retries, and raw-payload audit.
5. **A plain-TEXT order path** — WhatsApp orders are often just text ("10 boxes tomatoes, 5 lettuce for Thu"), not attachments. Current `extractOrderDocument` is file-only; we need `extractOrderFromText` (or synthesize a document). **Important and easy to miss.**
6. **Outbound confirmations** (optional, high-trust): reply to confirm the parsed order.

---

## Target architecture

```
Inbound channel (WhatsApp / Email)
        │  verify signature, ACK fast, dedup
        ▼
captured_messages (raw payload, org routing, idempotency)   ← new
        │  (queue / cron drain)
        ▼
ingestCapturedDocument()  ← the ONE new core function
        │  media → Storage 'documents';  text → extractOrderFromText
        │  insert documents row (routed org_id, document_type hint)
        ▼
/api/ai/extract  (EXISTING)  →  extractOrder/extractDocument
        ▼
syncOrderFromDocument / feedDocumentToProcurePulse  (EXISTING)
        ▼
Capture Inbox / Doc-U review  →  human confirm  →  publish  (EXISTING)
        │  (optional)
        ▼
Outbound confirmation (WhatsApp template / email reply)
```

**Design principle:** WhatsApp and email handlers are thin **adapters** over one `ingestCapturedDocument({ orgId, channel, sender, file?|text?, filename?, hintType })`. All the shared logic (storage, documents insert, extract trigger, dedup) lives in one place; adding a third channel later (SMS, a web form, a mobile capture) is just another adapter.

---

## Channel A — Email capture (recommended first; fastest to value)

Two ways in:

**A1. Inbound-parse webhook (recommended for MVP).** A dedicated address posts parsed mail (from, subject, body, attachments) to a Next.js route handler.
- Providers: **SendGrid Inbound Parse**, **Mailgun Routes**, **Postmark inbound**, **AWS SES → SNS/Lambda**, **Cloudflare Email Workers**.
- Setup: point an MX record for a subdomain (e.g. `inbound.vyso.co.za`) at the provider; give each org an address like `orders@freshco.vyso.co.za` (or `orders+freshco@…`). Client adds a one-line auto-forward from their real `orders@` — their customers never change anything.
- Pros: real-time, attachments parsed for us, no mailbox credentials. Cons: DNS/MX; a forwarding rule per client.

**A2. Native inbox connect (later).** OAuth into the client's existing mailbox.
- Gmail API (`users.watch` + Pub/Sub push, or polling); Microsoft Graph (subscriptions/webhooks); generic IMAP poll via cron.
- Pros: zero forwarding, client keeps their address. Cons: OAuth consent + refresh tokens, Gmail push needs Pub/Sub, polling adds latency.

**Routing:** inbound recipient address (or `+alias` / subdomain) → org via `channel_connections`. Sender email → `of_customers.email` (orders) or `ss_suppliers.contact_email` (supplier invoices). `document_type` hint from folder/keywords/attachment shape (or leave null and let extraction classify).

---

## Channel B — WhatsApp capture

Two ways in:

**B1. Meta WhatsApp Cloud API, direct (recommended for a single client / cost).** Meta-hosted; inbound webhook.
- Needs: Meta Business + WhatsApp Business Account (WABA) + a verified number + an app; webhook verification (`hub.challenge`) + payload signature (`X-Hub-Signature-256`); media fetched by media-ID + token.
- Pros: cheapest, full control. Cons: more onboarding steps.

**B2. BSP (fastest integration).** Twilio (great DX + sandbox for dev), 360dialog (SA-friendly, flat WABA), WATI (turnkey).
- Pros: simpler onboarding, nicer SDKs, sometimes SA support/billing. Cons: per-message markup, less control.

**Realities to plan for:**
- **The number:** the client's WhatsApp orders line must migrate to the WhatsApp **Business API** (it can't run in the consumer/Business app at the same time). Customers keep messaging the same number.
- **Policy:** 24-hour customer-service window; messaging outside it needs **pre-approved templates**; opt-in rules apply; scraping the consumer app is not allowed.
- **Media:** images/PDFs arrive as media IDs → fetch bytes → Storage.
- **Voice notes** (common for produce orders!): transcribe (Whisper / Deepgram) → feed as text. Phase 3.

**Routing:** inbound WABA `phone_number_id` → org via `channel_connections`. Sender `wa_id` (phone) → `of_customers.phone` (normalise `+27` / `0…` formats before matching).

---

## The service-role decision (biggest cross-cutting item)

Today everything is **RLS cookie/Bearer-scoped; no `SUPABASE_SERVICE_ROLE_KEY`**. A webhook has no user session, so it can't write `documents` for an org as-is. Options:

1. **Add a server-only service-role client (recommended).** New `createServiceClient()` used **only** by the ingestion/webhook routes. Because it bypasses RLS, every write **must** explicitly set the routed `org_id`, and every webhook route **must** verify a provider signature + a shared secret. Keep it in a tiny, audited `lib/ingest/` module — never import it into anything client-reachable.
2. **A per-org "system" service account** (a `profiles` row + auth user) whose token the webhook uses — keeps RLS on but means token management per org. Messier.

Recommendation: **#1**, with strict signature verification and a locked-down module. Document the RLS-bypass clearly.

---

## Proposed data model (new)

- **`channel_connections`** — `(id, org_id, channel 'whatsapp'|'email', identifier [WABA phone_number_id / inbound address], provider, secret_ref, status, created_at)`. The inbound → org map.
- **`captured_messages`** — `(id, org_id, channel, external_id [dedup key], sender, subject, body_text, raw_payload jsonb, status 'received'|'processing'|'documented'|'ignored'|'failed', document_id fk, error, received_at, processed_at)`. Raw inbox + idempotency + audit trail.
- **`documents`** additions — `source_channel`, `source_sender`, `captured_message_id` (fk). Reuse everything else.
- Reuse the existing **`of-order-source-doc`** linkage (already designed).

All via new `supabase/*.sql` files pasted through the dashboard (the established migration flow, since the CLI is unlinked).

---

## Processing model (async + reliable)

1. **Webhook route:** verify signature → **dedup on `external_id`** → insert `captured_messages` (`received`) → **return 200 fast** (providers retry on non-2xx, which would double-process).
2. **Drain/process** (separate from the ACK): download media → Storage → `documents` row → trigger extract → update `captured_messages`.
   - Simple: a **Vercel Cron** hitting a protected drain route every minute.
   - Durable: **Upstash QStash / Inngest / Trigger.dev** for retries, backpressure, and dead-letter — low ops, worth it once volume is real.
3. **Idempotency everywhere** — WhatsApp/email both redeliver. `syncOrderFromDocument` is already idempotent per `source_document_id`, so re-processing corrects rather than duplicates.
4. **Extraction escalation (optional):** Haiku first (cheap); if `overall_confidence` is low, retry with Sonnet/Opus before surfacing for review. The confidence field already exists.

---

## Human-in-the-loop (this is what earns a real client's trust)

- A **Capture Inbox** — new OrderFlow tab, or reuse Doc-U `/awaiting` — showing each capture with the **raw source** (message text / screenshot / email) beside the **extracted draft**.
- **Confidence-gated behaviour** (lever already built into `syncOrderFromDocument`): high confidence + known customer + all lines priced → auto-invoice; otherwise hold as a draft for one-tap confirm in `OrderReviewEditor`.
- **Start conservative:** everything lands as a draft for review; graduate specific customers to auto-publish once the client trusts the extraction. Nothing hits the books unreviewed on day one.

---

## Outbound confirmations (optional, Phase 3 — big trust win)

- **WhatsApp:** reply with an order-received **template** ("Got it — 10× tomato, 5× lettuce, delivering Tue. Reply YES to confirm."). Two-way confirm loop catches extraction errors before fulfilment.
- **Email:** auto-reply with the parsed summary + a confirm link.

---

## Compliance & cost (SA context)

- **POPIA:** we process customer PII (phone, order history). Client is the responsible party, Vyso is the operator → needs an operator clause + purpose limitation + security + a retention policy for raw messages/media.
- **WhatsApp Business Policy:** opt-in, session windows, template approval, no consumer-app scraping.
- **Cost:** WhatsApp conversation pricing (per BSP/Meta); email provider (cheap); Claude extraction is **cheap on Haiku** — good. Storage for media.

---

## Phasing

- **Phase 0 — Channel-agnostic foundation.** Service-role client; `channel_connections` + `captured_messages` + migration; `ingestCapturedDocument()` core; **text order path** (`extractOrderFromText`); Capture Inbox (reuse Doc-U review). Prove it end-to-end with a manual test injector before any provider.
- **Phase 1 — Email capture.** Inbound-parse address + client forward; sender→customer/supplier match; orders **and** supplier invoices. Fastest to real value.
- **Phase 2 — WhatsApp capture.** Cloud API (or Twilio) inbound; number onboarding; media fetch; phone→customer match; text + image/PDF.
- **Phase 3 — Trust & polish.** Outbound confirmations (templates), voice-note transcription, per-customer auto-publish, dedup/analytics, error alerting.

---

## Verify before building

- Is the **`of-order-source-doc` migration applied**? Order creation is gated on it.
- **Vercel function timeout** limits vs inline extraction (favours the queue/drain model).
- `documents.uploaded_by` **nullable** for webhook inserts (schema appears to allow it — confirm).
- **Multi-org isolation:** the routing table must be airtight so org A can never receive org B's captures — test explicitly.
- WhatsApp **number migration** logistics with the client (downtime? keep-same-number confirmed?).

---

## Smallest first slice I'd actually build

Phase 0 + a **paste-a-message / forward-an-email** test path → prove: raw capture → `documents` row → existing extract → draft order in the Capture Inbox → one-tap confirm → invoiced order feeding PricePilot. Once that loop is green with a real forwarded email, bolting on the WhatsApp adapter is mostly provider onboarding.

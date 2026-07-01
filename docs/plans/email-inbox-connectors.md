# Vyso Email Inbox Connectors — Gmail & Outlook (Microsoft 365)

_Long-term design for native inbox connection. Companion to `whatsapp-email-capture.md`._
_Email is ~70% of the first client's orders, so this is the priority channel._

> **DECIDED (with client):** first client is on **Microsoft 365 / Outlook**, and we're **building the connector direct (in-house)**. That's the best-case path — Microsoft Graph is clean, verification is light (no Google CASA assessment), and app-only access can be locked to **just the orders mailbox**. So the immediate build is the **Microsoft Graph connector** (below). Gmail is designed here too but deferred until a Gmail client appears. The `MailboxConnector` interface keeps both honest.

## Goal & principles

Connect a client's real mailbox (Gmail / Outlook) so incoming order emails flow into Vyso automatically — **no forwarding, no duct tape**. Principles:

- **Least privilege:** read-only, scoped to an "Orders" label/folder where possible, revocable.
- **Provider-agnostic core:** one `MailboxConnector` interface; Gmail and Microsoft are implementations behind it. Both normalise to one `CapturedEmail` shape and feed the **existing** `ingestCapturedDocument()` → `/api/ai/extract` pipeline. Adding IMAP or a third provider later is just another implementation.
- **Push-first, poll-fallback:** design for real-time change notifications; a delta/poll path is the safety net and the quickest first cut.
- **Encrypted, revocable tokens:** mailbox access is sensitive — treat it like a credential.

---

## The connector abstraction

```
interface MailboxConnector {
  authUrl(orgId): string                       // begin OAuth
  handleCallback(code, orgId): Connection       // exchange code → tokens, persist
  startWatch(conn): WatchState                  // Gmail watch / Graph subscription
  renewWatch(conn): WatchState                  // before expiry (cron)
  fetchChanges(conn, cursor): CapturedEmail[]   // new messages since cursor
  refreshToken(conn): Connection                // rotate access token
  disconnect(conn): void                        // revoke + delete tokens
}

type CapturedEmail = {
  externalId: string            // provider message id (idempotency key)
  from: string; fromName?: string
  subject: string
  receivedAt: string
  bodyText: string; bodyHtml?: string
  attachments: { filename: string; mimeType: string; bytes: Buffer }[]
}
```

Each `CapturedEmail` → for every PDF/image attachment: upload to Storage + insert a `documents` row (`document_type` hint) and trigger extract; **and** the body text → `extractOrderFromText` (many email orders are plain text in the body, not attachments). Sender → `of_customers.email` match. Everything after that is the pipeline we already have.

---

## Gmail connector

**OAuth & scope**
- Google OAuth 2.0, Gmail API. Scope: `gmail.readonly` (there is no per-label scope — readonly is the least-broad scope that still returns bodies + attachments).
- `gmail.readonly` is a **restricted** scope → see "Compliance" below (this is the main cost of doing Gmail directly).

**Receiving mail (push)**
1. GCP project: enable Gmail API; create a Pub/Sub **topic**; grant `gmail-api-push@system.gserviceaccount.com` Publisher on it; create a **push subscription** → an HTTPS Vyso webhook (verify the OIDC/JWT Google signs the push with).
2. `users.watch({ topicName, labelIds: ['Label_Orders'], labelFilterBehavior: 'INCLUDE' })` → returns a `historyId` + an expiry (**~7 days**). Store the `historyId` as the cursor.
3. On a push notification (`{ emailAddress, historyId }`), call `users.history.list({ startHistoryId })` → `messagesAdded` → `users.messages.get` (full) + `users.messages.attachments.get`. Advance the cursor.
4. **Renew the watch before 7 days** (a daily cron re-`watch`).

**Filtering to orders (elegant + privacy-preserving):** ask the client to add a Gmail **filter** that auto-labels incoming orders (e.g. from known customer domains, or subject contains "order") as `Vyso Orders`; we `watch` only that label. We then only ever read order mail, not their whole inbox — better for privacy, POPIA, and Google's review.

**Poll fallback:** `users.messages.list({ q: 'label:Vyso-Orders newer_than:1d' })` on a cron, cursor by `internalDate`.

**Workspace shortcut:** if the client is on Google **Workspace**, their admin can install/consent Vyso for the domain (Marketplace app / admin consent), which removes per-user consent friction. (Restricted-scope handling may still apply — see Compliance.)

---

## Microsoft (Outlook / Microsoft 365) connector

**OAuth & permission**
- Microsoft identity platform (Entra ID / Azure AD) + Microsoft **Graph** API.
- **Delegated** `Mail.Read` (per-user sign-in) **or** **Application** `Mail.Read` (app-only, admin-consented) — for a business client, app-only + an **Application Access Policy** (Exchange Online) that restricts the app to *only* the orders mailbox is the cleanest, most auditable option.

**Receiving mail (push)**
1. App registration in Entra ID: redirect URI, Graph `Mail.Read`, (admin consent if app-only).
2. Create a **subscription**: `POST /subscriptions { changeType:'created', notificationUrl, resource:"users/{id}/mailFolders('Inbox')/messages", expirationDateTime, clientState }`. Graph immediately sends a **validation request** (`validationToken`) → echo it back within 10s. Store `clientState` (a secret) and verify it on every notification.
3. On notification → `GET /messages/{id}` + `/messages/{id}/attachments`. (Optional: rich notifications with encrypted resource data via a cert to avoid the extra GET.)
4. Mail subscriptions live **~3 days** → **renew before expiry** (cron).

**Poll fallback:** `GET /me/mailFolders/inbox/messages/delta` → follow the `deltaLink` cursor on a cron.

**Filtering to orders:** subscribe to a specific mail **folder** (e.g. an "Orders" folder the client's rule files into), same idea as the Gmail label.

---

## ▶ Microsoft-first build checklist (the actual work)

**A. Entra ID app registration (one-time, Vyso tenant)**
- Register a **multi-tenant** app (so future clients' tenants can consent too).
- Add Microsoft Graph **application** permission `Mail.Read` (app-only). Keep a delegated `Mail.Read` as a dev/fallback.
- Credential: prefer a **certificate** over a client secret for app-only auth. Store the tenant id + credential ref in a secret manager.
- Redirect URI for the admin-consent callback.

**B. Auth (app-only / client credentials)**
- Per connected client: store `tenant_id` + consent status in `channel_connections`. Get Graph tokens via the client-credentials flow — **no per-user refresh tokens to babysit.**
- Admin-consent URL: `https://login.microsoftonline.com/{tenant}/adminconsent?client_id=…&redirect_uri=…` → client's M365 admin approves → we mark the connection active.

**C. Read the orders mailbox**
- **E1 (first cut): delta poll.** `GET /users/{mailbox}/mailFolders/{ordersFolder}/messages/delta` on a Vercel Cron (~1–2 min); persist the `deltaLink` cursor per connection. No subscriptions to renew — simplest reliable start.
- **E2: real-time.** Create a Graph change-notification **subscription** (validation handshake + `clientState`), renew before its ~3-day expiry via cron.
- Fetch: `GET /messages/{id}` (body text/html) + `/messages/{id}/attachments` (`fileAttachment.contentBytes`, base64).

**D. Vyso pieces to build**
1. `channel_connections` + `captured_messages` tables (new migration, pasted via dashboard).
2. **Server-only service-role Supabase client** (`lib/ingest/`) — the enabling gap; cron/webhook has no user session; every write sets `org_id`.
3. `lib/ingest/microsoft.ts` implementing `MailboxConnector` (token, listFolders, deltaFetch, getMessage, getAttachments, subscribe/renew).
4. `ingestCapturedDocument()` core + **`extractOrderFromText`** (typed-in-body orders).
5. Settings → "Connect Outlook": admin-consent start/callback, mailbox + Orders-folder picker, status, disconnect (revoke).
6. Cron: delta drain (E1) → subscription renewal (E2).
7. Capture Inbox surface (reuse Doc-U `/awaiting` + `OrderReviewEditor`).

**E. What we need FROM the client's M365 admin (send them this)**
- **Grant admin consent** to the Vyso app (Graph `Mail.Read`, application).
- Apply an **Application Access Policy** (Exchange Online) — or a mail-enabled security group — so the Vyso app can read **only the orders mailbox**, nothing else in the tenant. This is the key security control; lead with it, they'll appreciate it.
- Confirm the **orders mailbox** (ideally a dedicated one like `orders@theirco.co.za`) or create an **"Orders" folder + a rule** that files incoming order mail there.

**F. Compliance (light for Microsoft)**
- Microsoft **publisher verification** so the consent screen shows "verified" (no paid annual assessment — this is the Gmail-only tax we're skipping).
- POPIA operator agreement + read-only + scoped-mailbox + clean disconnect/erase.

---

## Token storage & security

- New/extended `channel_connections` rows hold: provider, external account id, the **encrypted refresh token**, the current watch/subscription id + expiry, cursor (`historyId` / `deltaLink`), and status.
- **Encrypt refresh tokens at rest** — app-level AES-GCM with a key from a secret manager, or Supabase **Vault**/pgsodium. Never expose tokens to the client bundle. All token use is server-side only.
- The background workers (watch renewal, change fetch, `documents` insert) run with the **server-only service-role Supabase client** flagged in the main plan — a webhook/cron has no user session. Every write sets `org_id` explicitly.
- Disconnect flow must **revoke** the OAuth grant (Google `revoke`, MS `oauth2/logout` / delete grant) and delete stored tokens.

---

## Build vs buy — the real fork

This is the decision that shapes the whole effort.

**Option 1 — Direct (Google + Microsoft APIs ourselves).**
- Pros: full control, no per-account fee, no third-party sub-processor touching client mail (cleanest POPIA story).
- Cons: we own OAuth verification, Pub/Sub + Graph subscriptions, renewals, token security — **and Google's restricted-scope security assessment (see below), which is the big one.**

**Option 2 — Unified email API (Nylas / Aurinko / Unipile / Merge).**
- One API for Gmail + Outlook (+ IMAP; Unipile also does WhatsApp, which could unify Channel B too). They handle OAuth, token refresh, watch/subscription renewal, normalisation, and shoulder much of the provider-verification burden.
- Pros: production-grade Gmail+Outlook in **days not weeks**; they carry a lot of the compliance/infra weight. This is a legitimate long-term architecture (not duct tape) — our connector core stays identical, we just swap what sits behind the `MailboxConnector` interface.
- Cons: per-connected-account cost; a third party processes client mail (an extra POPIA sub-operator to paper); some lock-in.

**My lean:** it depends heavily on the client's provider —
- **Microsoft 365 client → go direct.** Graph is clean, verification is lighter (publisher verification, no paid annual assessment), and Application Access Policy scopes app-only access to just the orders mailbox. Very doable in-house and genuinely long-term.
- **Gmail client → strongly consider a unified provider for the Gmail leg**, because Google's restricted-scope **CASA** assessment (below) is a real, recurring cost/time sink to own directly.
- Either way, **keep the `MailboxConnector` interface** so we're never locked to one approach and can move a provider in-house later without touching the pipeline.

---

## Compliance (the part people underestimate)

- **Google:** `gmail.readonly` is a **restricted** scope. A published, multi-tenant app using it needs Google **OAuth verification** *and* an annual **CASA** (third-party security assessment). Real money + weeks of lead time; unverified apps are capped (~100 users) with a scary consent screen. Budget for this if going direct on Gmail — or let a unified provider carry it.
- **Microsoft:** **publisher verification** (lighter, no paid annual assessment). Admin consent for app permissions; scope app-only reads to specific mailboxes with Application Access Policy.
- **POPIA:** Vyso is the operator, client is the responsible party → operator agreement, purpose limitation, encryption, retention policy, and a clean disconnect/erase path. A unified provider becomes a sub-operator to disclose.

---

## Data model (extends the capture plan)

- `channel_connections` (+ email fields): `provider ('gmail'|'microsoft')`, `account_email`, `refresh_token_enc`, `watch_id`, `watch_expiry`, `cursor`, `label_or_folder_id`, `status`.
- `captured_messages` (from the main plan) — raw inbound + idempotency (`external_id`) + audit; links to the created `documents` row.
- Reuse `documents` + the `of-order-source-doc` linkage.

---

## Flow (steady state)

```
Client mailbox  ──(new order email in 'Orders' label/folder)──►  Google/MS push
        │                                                              │
        ▼                                                              ▼
  Vyso webhook (verify signature/clientState)  ──►  captured_messages (dedup on externalId)
        │
        ▼  (cron drain / queue)
  connector.fetchChanges()  ──►  CapturedEmail (body + attachments)
        │
        ├─ attachments → Storage + documents row(s)
        └─ body text  → extractOrderFromText → documents row
        │
        ▼
  /api/ai/extract (EXISTING) → syncOrderFromDocument → draft/invoiced order
        │
        ▼
  Capture Inbox → human confirm → published order → PricePilot
```

A separate **renewal cron** keeps Gmail watches (<7d) and Graph subscriptions (<3d) alive and refreshes access tokens.

---

## Phased build

- **Phase E0 — Connector core + OAuth shell.** `MailboxConnector` interface, `channel_connections` with encrypted tokens, a Settings "Connect inbox" UI (OAuth start/callback/disconnect), the service-role client, and `extractOrderFromText`. Prove with one provider end-to-end.
- **Phase E1 — First provider (whichever the client uses).** OAuth + delta-poll first (fewer moving parts), reading a specific label/folder → ingestion → Capture Inbox. This alone delivers the 70%.
- **Phase E2 — Push + renewal.** Pub/Sub watch (Gmail) / Graph subscription + validation, renewal cron. Real-time.
- **Phase E3 — Second provider + hardening.** The other of Gmail/Outlook, plus verification/compliance work, disconnect/erase, monitoring.

---

## Decisions — status

1. ~~Platform?~~ → **Microsoft 365 / Outlook.** ✅
2. ~~Direct vs unified?~~ → **Direct, in-house.** ✅
3. **Poll-first or push-first** → recommend **delta-poll first (E1)**, add push (E2). _(default, no action needed)_
4. **App-only + Application Access Policy vs delegated sign-in** → recommend **app-only scoped to the orders mailbox** for production; delegated as dev fallback. _(confirm the client's admin will consent + apply the policy)_

**Open items to confirm with the client:**
- Do they have a **dedicated orders mailbox** already, or should they make an "Orders" folder + rule?
- Will their **M365 admin** grant consent + apply the Application Access Policy? (If not, we fall back to delegated per-user sign-in.)
- Verify the **`of-order-source-doc` migration** is applied in their Supabase (order creation is gated on it).

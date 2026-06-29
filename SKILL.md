---
name: book-order-platform
description: >-
  Implements a book order system with a Vite React storefront (React Router,
  TanStack Query) and an Express + Prisma + SQLite API: default pay-by-transfer
  flow with admin-reviewed payment proof, Cloudflare Turnstile on order submit,
  honeypot field, payment-proof upload with duplicate-image detection,
  8-character receipt codes plus opaque magic links, optional order kill-switch,
  minimal admin (single shared password, in-memory session tokens), and gated
  downloads via private object storage with short-lived signed URLs (never
  long-lived public book URLs). Use when building similar book sales,
  receipt-code access, or this two-service architecture; payment automation or
  gateways can replace or augment the default review step when the user requests
  it.
---

# Book order platform

**Default**: payment proof is **human-verified** (no payment gateway in the default stack). The same architecture can be extended—for example with Stripe or bank webhooks—when the user asks for automation.

## Product shape

- **Buyer**: Pays via bank/mobile instructions (off-app). Uploads **one payment proof image** (images only, size-capped). Submits name, phone, optional email/note.
- **Access after submit**: **Receipt code** `XXXX-XXXX` (8 letters/digits, hyphen; ambiguous chars omitted) and a **magic link** (`/order/magic/:token`) that maps to the same order without typing the code.
- **Fulfillment**: Admin sets order to `verified` or `rejected`. Buyer sees status on a status page. **Downloads** appear only when `verified` **and** admin toggles **book published** **and** each format is **configured** (object key or equivalent) in settings—see **Downloads: private storage + signed URLs** below.
- **Anti-abuse**: Cloudflare **Turnstile** (site key on web, secret on API), **rate limits**, optional **honeypot** (fake success if filled), **SHA-256 hash** of proof image to block reuse of the same file across orders.

## Downloads: private storage + signed URLs

**Principle**: Final book files live in **private** storage (S3-compatible bucket, R2, private disk tree behind the API). The database stores **locators**, not permanent public HTTPS links—e.g. **object keys**, relative paths under a private root, or bucket+key pairs. **Do not** store or return world-readable book URLs that work without auth/eligibility checks.

**Eligibility** (all required): order `verified`, settings `bookPublished`, and a locator configured for that format (e.g. PDF/EPUB per logical “book”).

**Serving to the buyer**:

1. **Preferred — API-mediated download**: Expose routes such as `GET /orders/:receiptCode/download/:format` and `GET /orders/magic/:token/download/:format` (or a single signed-url handler). Handler checks eligibility, then **mints a short-lived signed GET URL** (e.g. AWS SDK `getSignedUrl`, `@aws-sdk/s3-request-presigner`) or **streams** the object through the API. Use a configurable TTL (e.g. `DOWNLOAD_URL_TTL_SECONDS`, minimum ~15 minutes). On **302 redirect** to the signed URL, the browser talks to the storage host briefly; the long-lived secret remains server-side.

2. **JSON embed (acceptable)**: `GET /orders/...` may include freshly signed URLs in a `downloads` object—**only** at request time, with TTL aligned to env. The SPA must treat them as ephemeral: refetch order or hit the download endpoint again after expiry. Prefer redirect/stream if you want to avoid leaking long query strings in logs and history.

**Public status endpoint** (`GET /settings/book-status`): Expose only **booleans** (e.g. “PDF configured / object exists”)—never signed URLs, never raw keys if keys are sensitive.

**Admin**: Configure **keys or paths** (validate format: safe path segments, allowed key charset, no `..`). Optionally support upload-from-admin to private bucket and persist returned key. Payment proof uploads may stay on local disk or a separate private prefix.

**Implementation**: Use vendor SDK + credentials in server env (`SPACES_*`, `AWS_*`, or generic `S3_ENDPOINT` + bucket + keys). For **local private files** (`BOOK_FILES_DIR`), eligibility-checked handler can stream the file with `Content-Disposition: attachment` instead of signing—still no public URL in the DB.

**Operations**: Rotate storage credentials carefully; rate-limit download endpoints; avoid logging full signed URLs (they are bearer tokens until expiry).

## Repository layout

| Area | Role |
|------|------|
| `api/` | Express app: `/orders`, `/admin`, `/settings/book-status`, static `/uploads` (payment proofs only—not final books if books are private) |
| `web-app/` | Vite + React SPA: marketing home, order flow, check-order, admin UI |

## API (Express + Prisma + SQLite)

### Stack notes

- **Prisma 7** with **SQLite** via `@prisma/adapter-better-sqlite3`; client generated under `api/generated/prisma`.
- **Express 5**, **multer** disk uploads under `api/uploads/`, **cors**, **express-rate-limit**.
- **Trust proxy**: set `TRUST_PROXY` when behind reverse proxy / Cloudflare so rate limits and Turnstile `remoteip` behave.

### Data model (conceptual)

- **Order**: `receiptCode` (unique), `magicToken` (unique), contact fields, `paymentProofUrl`, `paymentProofHash`, `status` (`pending` \| `verified` \| `rejected`), read flag for admin inbox, optional download counters if you track usage server-side.
- **Settings** (singleton `id: 1`): `bookPublished`, per-book **private locators** for PDF/EPUB (e.g. object keys for “main” and “bonus” book—name fields to match your product), optional friendly file names for `Content-Disposition`.

### Public HTTP surface (implement the same contracts)

- `GET /settings/book-status` — `orderOpen` (from env), `bookPublished`, booleans for which formats are **configured** (and optionally probed with `HeadObject`); **no** secrets, keys, or signed URLs.
- `POST /orders` — multipart: `name`, `phone`, optional `email`, `note`, file field `paymentProof`, form field `cf-turnstile-response`. Optional honeypot `contact_time`: if present, return **201** with fake `receiptCode` / `magicLink`. Enforce Turnstile via `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret`, `response`, optional `remoteip`, `idempotency_key`. Reject duplicate `paymentProofHash`.
- `GET /orders/:receiptCode` and `GET /orders/magic/:token` — order summary; `downloads` may include **short-lived signed URLs** minted at request time **or** same-origin **download API paths** the UI uses as `href` (recommended) so the client never caches a long-lived book URL.
- `GET /orders/.../download/:format` — authorize, then **redirect** (302) to signed URL or **stream** body; validate `format` ∈ `{ pdf, epub }`.
- `GET /orders/stats/count` — total orders (public stat).

### Admin HTTP surface

- `POST /admin/login` `{ username, password }` → `{ token }`. **Bearer** token in `Authorization` for subsequent calls.
- Token validation: **in-memory `Set`** on the server (lost on restart; not multi-instance safe). Logout removes token.
- Typical endpoints: paginated orders with `status` + search `q`, unread count, patch status / read / contact fields, delete order, get/patch settings (validate **locators**, not arbitrary `http(s)` public book URLs unless you deliberately support remote URLs behind a server-side fetch—default is **keys/paths only**).

### Environment (API)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLite file URL |
| `PORT`, `CORS_ORIGIN`, `FRONTEND_URL` | Server port, CORS, magic-link host |
| `ORDER_OPEN` | When false, reject new orders |
| `TURNSTILE_SECRET_KEY` | Required for real order creation |
| `TRUST_PROXY` | Behind proxies / CF |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Single admin pair |
| `RATE_LIMIT_ENABLED` | Set `false` to disable limiters (dev only) |
| `DOWNLOAD_URL_TTL_SECONDS` | Signed URL lifetime (e.g. 900–3600) |
| `SPACES_*` / `AWS_*` / `S3_*` | Private bucket endpoint, region, credentials, bucket name |
| `BOOK_FILES_DIR` | Optional: private on-disk directory for keys resolved as relative paths |

### Implementation checklist (API)

- [ ] Receipt code generator: cryptographically random, **no** `I`, `O`, `0`, `1`; format `XXXX-XXXX`.
- [ ] Magic token: long URL-safe random string; store unique with retry loop.
- [ ] On order create: verify Turnstile **before** persisting; delete uploaded file on any validation failure.
- [ ] Global + stricter limiter on `POST /orders`; limiter on admin login and on **download** routes.
- [ ] **Private book files**: settings store keys/paths only; eligible download path **presigns or streams**; no permanent public book URL in DB or JSON.
- [ ] Serve `/uploads` only for **payment proofs**; never expose private book root via static middleware.

## Web app (Vite + React + React Router + TanStack Query)

### Routing

- Use **`createBrowserRouter`**; if the app is hosted under a subpath, set **`basename`** (e.g. `/store/`) — **must match** Vite `base` and deployment path.
- Routes pattern: `/` home, `/order` form, `/check-order` code entry, `/order/:receiptCode` and `/order/magic/:token` shared status view, `/admin/login`, `/admin` dashboard.

### API client patterns

- **JSON** reads: small `fetch` wrapper with `VITE_API_URL`.
- **Order create**: `fetch(POST /orders)` with **`FormData`** (not JSON) — includes file and `cf-turnstile-response`.
- **Turnstile**: load `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`, `render` widget with `VITE_TURNSTILE_SITE_KEY`, reset widget on submit error / expiry.
- **Downloads**: Prefer **`href={${API}/orders/${code}/download/pdf}`}** (or magic-token variant) so each click gets a **fresh** redirect/signature. If the API returns embedded signed URLs in JSON, refetch when downloads fail with 403/expired.

### Buyer UX extras

- **localStorage + cookie** (same JSON array): remember recent receipt codes for quick links (`order-storage` pattern); sync if sources diverge.
- Poll or refetch **`/settings/book-status`** on order page so `ORDER_OPEN` changes apply without redeploying the SPA.

### Admin UI

- Login stores **opaque token** in `localStorage`; all admin calls send `Authorization: Bearer …`.
- Dashboard: orders table with filters, detail modal, confirm/reject, optional edit/delete, settings card for **publish flag + per-format locators** (keys/paths), not paste-in public CDN URLs unless your policy allows.
- **Logout** clears client token; optionally call server logout to invalidate server-side token.

### Environment (web)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | API origin |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile widget |

## Security and operations

- **Never** ship default `ADMIN_PASSWORD` in production; rotate after first deploy.
- Prefer **restricted CORS** (`CORS_ORIGIN`) in production.
- Payment proofs are **PII + financial** — restrict disk access, consider retention policy and deletion when order is removed.
- Magic links are **secrets** — treat like passwords in support channels; receipt codes are shorter secrets — rate-limit lookup and download endpoints if abuse appears.
- **Signed URLs are secrets until expiry** — short TTL, HTTPS only, minimal logging.

## Build order for a greenfield clone

1. Prisma schema + migrate; seed `Settings` row; model **private locators** (not public URLs) for each book/format.
2. Express skeleton: CORS, JSON, static uploads for proofs only, error handler for multer size errors; wire **S3-compatible client** or private disk helper.
3. `POST /orders` with multer + Turnstile + hash duplicate check + code generation.
4. `GET` order by code/token + eligibility; implement **download routes** (presign + redirect or stream).
5. Admin auth + CRUD + settings patch with **locator** validation.
6. Vite app: order form + status page + download links to **API** (not raw storage URLs) + Turnstile + storage helper; then admin pages.
7. Deploy: API behind HTTPS, set `FRONTEND_URL`, `TRUST_PROXY`, Turnstile keys, storage credentials, TTL, strong admin password; SPA `base` matches hosting path.

## Optional extensions (not required for parity)

- Email/SMS notifications on status change.
- Move admin tokens to Redis or JWT with expiry.
- Virus scan or watermark pipeline on book objects before release.
- Webhook or bank API if payments become automated later.

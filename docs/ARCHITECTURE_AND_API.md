# ResumeSetu — Architecture, API & Data

Companion to [`UI_GUIDE.md`](UI_GUIDE.md). Everything behind the screens: routes, auth, data layer, scoring pipeline, AI routing, security, payments and deployment.

---

## 1. Runtime topology

Two entry points, **one Express app**:

| Mode | Entry | Notes |
| --- | --- | --- |
| Long-running server (dev / VPS) | `server.ts` via `tsx` | in dev it mounts Vite middleware and serves the SPA from memory; in prod it serves `dist/` with `compression()` and `app.get('*')` → `index.html` |
| Netlify Functions | `netlify/functions/api.ts` | `serverless-http` wrapper; `netlify.toml` force-redirects `/api/*` → `/.netlify/functions/api/:splat` **before** the SPA fallback |

`netlify.toml` build is `npm run build && npm run check:deploy`, publish dir `dist`, `node_bundler = esbuild`, `external_node_modules = ["express","vite","serverless-http"]`. `scripts/write-headers.ts` emits `dist/_headers` so the CSP actually reaches the static document (it previously only protected API responses).

---

## 2. HTTP API surface

Middleware chain (in order): `express.json`/`urlencoded` (1 mb) → `cookieParser` → security headers (`lib/csp.ts`) → `/api/auth` burst limiter → `/uploads` hard deny (410) → **session middleware** (HMAC cookie → `req.activeUserId`, issues a guest session when none) → routes.

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/api/health` | liveness probe (`serverless` flag) | public |
| GET | `/api/auth/me` | restore session → user record | session |
| POST | `/api/auth/login` | Clerk bearer token → provision/attach account + set cookie | Clerk token |
| POST | `/api/auth/logout` | clear cookie | session |
| POST | `/api/auth/migrate-guest` | fold guest history into a real account | session |
| POST | `/api/auth/delete-data` | purge user's resumes/scans/applications + objects | session |
| POST | `/api/auth/upgrade-pro` / `cancel-pro` | plan control | session |
| GET | `/api/payments/config` | public owner profile + price + free limit | public |
| POST | `/api/payments/request` | create payment reference + server-built Telegram link | session + shared IP burst |
| POST | `/api/check` | **the scan** (multipart `job_description` + `resume` or `sample_type`) | session, quota, prompt-injection screen |
| GET | `/api/scan/status/:jobId` / `/api/scan/stream/:jobId` | background tailor task (poll / SSE) | session, ownership |
| GET | `/api/history` | past scans | session |
| GET/POST | `/api/applications` | tracker list / create | session |
| PATCH/DELETE | `/api/applications/:id` | update / delete (ownership enforced) | session |
| POST | `/api/tailor` | synchronous tailored resume + cover letter (402 if not Pro, 409 if already running) | session + shared IP burst |
| POST | `/api/download-docx` | single-column `.docx` of a tailored resume | session |
| GET | `/api/resumes/:id/file` | download an owned, decrypted resume | session + ownership |
| POST | `/api/analytics/ping` | session heartbeat / time-spent | session |
| GET | `/api/admin/stats` | KPI aggregate | admin |
| GET | `/api/admin/users` | directory | admin |
| POST | `/api/admin/toggle-pro`, `set-plan`, `add-credits`, `toggle-admin`, `ban-user`, `edit-user`, `delete-user` | user administration | admin |
| GET/POST/PUT/DELETE | `/api/admin/llms…` | LLM registry CRUD | admin |
| GET/POST | `/api/admin/llm-bindings` | task → primary/fallback routing | admin |
| GET/POST | `/api/admin/settings` | platform settings | admin |
| GET | `/api/admin/security-logs` | audit trail | admin |
| POST | `/api/admin/confirm-payment` | verify a receipt; activates Pro when totals reach the price | admin |
| GET | `/api/admin/system-health` | process/subsystem health | admin |
| — | `app.use('/api', …)` | unknown API path → 404 JSON (never HTML) | — |

---

## 3. Auth & session model

1. Browser talks to **Clerk** for credentials only (embedded dialog, `routing="hash"`).
2. `AuthProvider` retries `getToken()` up to 4×, then `POST /api/auth/login` with `Authorization: Bearer <clerk token>` up to 3× (5xx/network only). The server verifies the token against Clerk, then provisions/attaches the local account.
3. The server returns a **signed httpOnly cookie** — `base64url(payload).HMAC-SHA256(body, SESSION_SECRET)`, constant-time compare, 30-day TTL (`lib/session.ts`). This cookie is the *only* authorisation source for every subsequent request; client-supplied identity headers are ignored (the old `x-user-email` trust was an owner-impersonation hole and was removed).
4. `GET /api/auth/me` re-hydrates the user; a cookie pointing at a deleted account is cleared immediately.
5. Guests get `guest_<uuid>` ids, are blocked from `hasAccess`, and their history can be migrated on sign-up.
6. Owner elevation is derived server-side from `OWNER_EMAIL` / role, plus `CLERK_AUTHORIZED_PARTIES` and `APP_URL` must match the deployed origin.

---

## 4. Data layer

### Two adapters, one runtime

| Adapter | File | Status |
| --- | --- | --- |
| **Supabase Postgres (service role)** | `lib/supabase-db.ts` | **the runtime** — every route, rate limiter and queue job goes through it |
| JSON file | `lib/db.ts` (`data/db.json`) | legacy/seed/migration source only; still exports the shared TS types |

Selection is by direct import (`server.ts` imports `supabaseDb as db`); there is no runtime switch. Verified live: `GET /api/admin/stats` returns the Supabase project's data, not the JSON file's.

### Schema (`supabase/migrations/`)

| Migration | Creates |
| --- | --- |
| `202610020001_initial_schema.sql` | tables `users, resumes, job_scans, applications, llm_configs, task_bindings, system_settings, security_logs`; enums `plan, user_role, application_status`; `set_updated_at` trigger; RLS; private `resumes-private` bucket |
| `202610020002_runtime_functions.sql` | RPCs `consume_scan_quota()`, `record_session_ping()` |
| `202610030001_application_status_saved.sql` | `application_status + 'SAVED'` — **no `BEGIN/COMMIT`**, **no exception swallowing** (both deliberately, asserted by unit tests) |
| `202610070001_shared_ip_rate_limits.sql` | `api_rate_limits` table + `consume_ip_burst_limit()` (HMAC-hashed IP counters, atomic across serverless instances) |
| `202610070002_manual_payment_ledger.sql` | `manual_payment_records` + `record_manual_payment()` |

`npm run db:check` (read-only) currently reports **"Schema is up to date"** — all 10 tables, the `SAVED` value and all 4 RPCs are present in the live project.

### Files

- Uploads are AES-256-GCM encrypted by the server **before** reaching storage; the bucket contains ciphertext only. `STORAGE_ENCRYPTION_KEY` must stay stable or old documents become unreadable.
- Parsing: `pdf-parse` (PDF) and `mammoth` (DOCX), with an OCR-readability gate (`lib/parser.ts`: alnum ratio ≥ 0.45).
- Local `uploads/` is the fallback provider; Supabase Storage is the default.
- `npm run migrate:supabase` upserts the JSON file by primary key, checks FK ownership first, and never copies resume bytes (legacy `local_encrypted` rows stay local).

---

## 5. The scan pipeline (`POST /api/check`)

```
guest? → 401
banned? → 403
checkTierRateLimit(user, ip, {enforceBurst}) → 402 paywall | 429 throttle
job_description missing/too long (>30k chars)/prompt-injection → 400/413
parse upload (or sample) → malformed → 400
atsEngine.analyzeMatch(jd, resume) → not scorable → 422 + reason
resume prompt-injection → 400
db.incrementScanUsage() → 402 if exhausted
store encrypted file + resume row (uploads only)
persist job_scans row
Pro? → taskQueue.enqueueTailorTask() (non-blocking background rewrite)
runDocumentChecks()
→ 200 in ~200 ms with score + gaps + checks + remainingScans
```

### Scoring (`lib/ats-engine.ts`)

- **Keyword coverage (55 %)** — auditable "x of y required terms appear in your resume". Stoplist removes recruiting filler so generic words cannot inflate the denominator; the missing list is sorted *before* any display cap (capping first used to inflate scores).
- **Semantic proximity (45 %)** — bag-of-words cosine similarity, rescaled by `SEMANTIC_STSTRETCH = 2.2` because short-document cosine rarely exceeds ~0.45, and labelled **ESTIMATED** in the UI.
- Returns `inputQuality.scorable === false` (with a human explanation) instead of a number when the input cannot honestly be scored.
- **LLMs never produce the percentage.** `lib/schemas.ts` deliberately omits `match_score` from the `score` task output, and `improved_match_score` was removed — the post-tailor score is *recomputed from the rewritten text* by the same deterministic engine (`lib/queue.ts`).

### Grounding (`lib/grounding.ts`)

Generated text is validated against the source resume: unsupported metrics/credentials are flagged and redacted; the UI surfaces this as the *Grounding report* on the Resume draft / Cover letter tabs.

---

## 6. AI orchestration (`lib/models.ts`, `lib/models/*`)

Adapters for **Gemini** (`@google/genai`), **Groq** (`groq-sdk`), **OpenAI**, **Anthropic**. Tasks: `score`, `tailor`, `cover_letter`, `resume_parse` (+ `star_bullet` binding in the admin registry). Each task has a **primary + fallback** binding editable in Admin → LLM Models; defaults prefer `gemini-2.5-flash`/`gemini-2.5-pro`, with Anthropic (`claude-haiku-4-5` / `claude-sonnet-4-5`) and Groq fallbacks. Provider failures are logged without leaking sensitive details; the UI shows "Local fallback — no model ran" rather than pretending.

---

## 7. Security

| Control | Where |
| --- | --- |
| HMAC session cookies, no identity headers | `lib/session.ts`, session middleware |
| CSP + security headers on API **and** static assets | `lib/csp.ts` + `scripts/write-headers.ts` (`dist/_headers`) |
| Tier quota (free 3/30 days) vs throttle separation | `lib/rate-limiter.ts` → 402 vs 429 |
| Per-IP burst (30/min), DB-backed, HMAC-hashed IP | `lib/shared-rate-limiter.ts` + `consume_ip_burst_limit()`; in-memory fallback with a loud log if the RPC is missing |
| Prompt-injection screening of JD **and** resume text | `containsPromptInjection()` + system prompts + grounding |
| 5 MB multer memory limit, MIME/extension allowlist | upload handler; `allowedFileExtensions` in settings |
| 30 k char JD cap | cost/DoS control |
| Ownership checks on every object route | `/api/resumes/:id/file`, `/api/applications/:id`, scan status/stream |
| Admin mutations protect owner rows | `AdminPanel` + server role checks |
| Constant-time signature compare; guest vs user separation | `lib/session.ts` |
| Unit tests that pin the above | `scripts/test-unit.ts` (242 checks: CSP directives, burst limiter, grounding, docx round-trip, "no `head: true` existence probes") |

Known gaps are listed in [`STATUS_AND_OPEN_QUESTIONS.md`](STATUS_AND_OPEN_QUESTIONS.md).

---

## 8. Payments & Pro

1. `POST /api/payments/request` → server issues an HMAC-signed reference (expiry-checked on confirm), builds the Telegram deep link to the configured `OWNER_TELEGRAM` handle, and logs `PRO_UPGRADE_REQUESTED`.
2. User pays outside the app (UPI/bank/cash), sends the reference.
3. Owner records it in **Admin → Security & Audit → Record verified payment** (amount, channel, reference, note) → `POST /api/admin/confirm-payment`.
4. Pro activates **only when verified totals reach the configured price**; duplicate transaction references are rejected; every confirmation is audited (`PAYMENT_CONFIRMED`).
5. Razorpay env vars exist in `.env.example` but no webhook/checkout route is implemented — the flow is intentionally manual today.

Free-tier gating is enforced server-side: `/api/tailor` and `/api/download-docx` return **402 `paywall_required`**, and `/api/check` no longer enqueues background tailoring for free users (it used to pay for rewrites only the browser hid).

---

## 9. Scripts

| Script | Purpose |
| --- | --- |
| `scripts/check-schema.ts` (`db:check`) | read-only live schema diff; prints exact SQL for gaps. Uses `select('*').limit(1)`, **never** `head: true` (HEAD resolves `error:null` for missing tables in the pinned supabase-js) |
| `scripts/check-deployment.ts` (`check:deploy`) | prod preflight: secrets, Clerk origin, bucket, tables, RPCs, AI task bindings reachable |
| `scripts/migrate-json-to-supabase.ts` | repeatable JSON → Supabase upsert import |
| `scripts/test-unit.ts` | 242 deterministic unit checks |
| `scripts/test-function.mjs` (`npm test`) | Netlify function contract (ESM + CJS, both URL shapes) |
| `scripts/test-server.mjs` | end-to-end HTTP against a real dev server |
| `scripts/write-headers.ts` | writes `dist/_headers` |

---

## 10. Environment variables (names only)

From `.env.example`: `SESSION_SECRET`, `STORAGE_ENCRYPTION_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `GROQ_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_API_VERSION`, `TAILOR_MODEL_ANTHROPIC`, `SCORE_MODEL_ANTHROPIC`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `AI_PROVIDER`, `SCORE_MODEL`, `TAILOR_MODEL`, `PORT`, `NODE_ENV`, `APP_URL`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_AUTHORIZED_PARTIES`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_STORAGE_URL`, `DATABASE_URL`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `R2_BUCKET`, `R2_ACCOUNT_ID`, `OWNER_TELEGRAM`, `OWNER_DISPLAY_NAME`, `OWNER_ROLE`, `OWNER_RESPONSE_TIME`, `OWNER_AVATAR_URL`, `PRO_PRICE_INR`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_ID`.

Notes:
- `NEXT_PUBLIC_*` names are accepted **aliases** of the Supabase vars (legacy naming), not a Next.js dependency.
- `DATABASE_URL`, the AWS/R2 and Razorpay vars are currently unused by any code path found in the audit.
- Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `VITE_`; it is a server credential that bypasses RLS.

---

## 11. Git hygiene facts (verified)

- 85 tracked files; `.env*`, `keys`, `uploads/`, `data/*` are gitignored.
- **`data/db.json` is nonetheless tracked** (committed before the ignore rule existed) and contains real-looking user emails plus resume/job-description text.
- `SUPABASE_MIGRATIONS_COPY.txt` is an untracked-by-ignition addition at the repo root duplicating migration SQL.
- No `README.md` existed before this audit; there is no `LICENSE`.

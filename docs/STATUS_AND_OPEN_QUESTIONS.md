# ResumeSetu — Status, Doubts & Open Questions

This is the honest audit sheet: what is finished and verified, what is half-done, what contradicts itself, and what needs a human decision. Every item below was checked against the running system or the source, not inferred.

Audit date: **2026-10-16** · Environment: `npm run dev` (`tsx server.ts`, port 3000) against the live Supabase project, headless Firefox capture.

---

## 1. Verified working (do not re-litigate)

| Item | Evidence |
| --- | --- |
| TypeScript compiles clean | `npm run lint` → exit 0 |
| Deterministic logic is tested | `npm run test:unit` → **242/242 pass** (scoring, grounding, date-conflict checks, highlighting, docx round-trip, CSP directives, burst limiter, deploy-gate invariants) |
| Live schema matches the code | `npm run db:check` → *"Schema is up to date"*: 10 tables, `application_status.SAVED`, RPCs `consume_scan_quota`, `record_session_ping`, `consume_ip_burst_limit`, `record_manual_payment` |
| API is up | `GET /api/health` → `{"success":true,"serverless":false}` |
| Session + admin auth works | signed cookie → `/api/auth/me` returns the owner record; `/api/admin/stats` returns live aggregates (2 users, 1 scan at capture time, avg ATS 86) |
| **Full scan flow works end-to-end in the real UI** | preset JD + sample resume → `POST /api/check` 200 → 86 % blended, keyword coverage 75 % (15/20), semantic proximity 100 %, alignment summary, keyword chips — see `screenshots/13-*.png` |
| All 31 UI states render | landing (9 sections), auth dialog, dashboard (5 tabs), admin (6 tabs), mobile — see `screenshots/` |
| Quota/paywall separation | 402 for exhausted quota (paywall) vs 429 for throttling (retry) |
| Owner account is protected from admin mutations | enforced in UI and server role checks |

---

## 2. The "pending migrations" warning is stale — highest-value correction

`locals.md` and `supabase/README.md` both say three migrations must still be applied before deploying:

- `202610030001_application_status_saved.sql`
- `202610070001_shared_ip_rate_limits.sql`
- `202610070002_manual_payment_ledger.sql`

**They are already applied.** `npm run db:check` (read-only, authoritative) reports the schema as up to date, including the `SAVED` enum value and both new RPCs, and the live rate limiter is using the DB path (`consume_ip_burst_limit`) without the "migration missing" fallback warning.

**Action:** update `locals.md` + `supabase/README.md` so the next deploy is not blocked by a phantom checklist. This is documentation drift, not an outage.

---

## 3. Things that need examination

Ordered by risk.

### 3.1 `data/db.json` is committed to git with real-looking personal data — **HIGH**

`.gitignore` ignores `data/*`, but `data/db.json` was committed *before* that rule and was never `git rm --cached`. It contains (as of this audit) five user records including two real-looking Gmail addresses, plus three stored scans with full resume text and job descriptions. The `.gitignore` comment even states this file holds "real user resume text and job descriptions".

**Doubt:** is this repo private forever? If it is ever made public, forked, or shared for a portfolio, that is a data leak.

**Options:** `git rm --cached data/db.json` + history purge (`git filter-repo`) and ship only `data/db.example.json`; or scrub the file down to synthetic demo users.

### 3.2 Landing/upgrade price was hard-coded while the admin price was live — **RESOLVED**

The landing page, dashboard, paywall, auth context, and server payment request all read `/api/payments/config`; the bundled `PRO_PRICE_INR` is only a loading fallback. Admin payment confirmation forms also initialise from the loaded runtime setting. The server resolves the same setting for the signed Telegram request and activation threshold.

Regression coverage should be extended with a browser test that changes the admin setting and verifies the public UI, when an authenticated browser test environment is available.

### 3.3 Dead / vestigial code — **LOW but confusing**

| Item | Finding |
| --- | --- |
| `src/components/BulletDiffExplorer.tsx` | removed after verification: zero importers |
| `src/components/HeroBridgeGraphic.tsx` | removed after verification: zero importers |
| `prisma/schema.prisma` | no `PrismaClient` / `@prisma/client` import anywhere; Supabase is the real data layer, and `DATABASE_URL` is unused |
| `firebase-applet-config.json` | tracked config with a Google browser API key; no source file imports Firebase. The unused `vendor-firebase` chunk has been removed; the config remains pending owner-approved cleanup |
| `DashboardProps.onOpenDeleteData` | removed from `Dashboard`; delete-data remains available from the authenticated navigation/footer flow |
| `AdminStats.llmMetrics` | fetched and typed, but every token/cost figure renders the literal "Not instrumented" |

### 3.4 Admin dialogs broke the app's own a11y pattern — **RESOLVED**

`AdminPanel` now uses `ConfirmPromptDialog` for the ban reason, delete-user confirmation, and delete-LLM confirmation. It uses the shared `useDialogA11y` focus trap, Escape handling, focus restoration, and mobile-safe app styling. A source scan finds no native `prompt()` or `confirm()` calls.

### 3.5 Static "Not tested" in one place regardless of state — **LOW**

The ATS-parser metric pill in the dashboard results renders a static "Not tested" value rather than deriving it from the check result. It is honest today (the parser test genuinely does not exist), but it will silently stay wrong if the test is ever implemented.

### 3.6 One lint suppression, no markers — **INFO**

`Dashboard.tsx` mount effect carries an `eslint-disable-next-line react-hooks/exhaustive-deps`. There are **zero** `TODO`/`FIXME`/`HACK`/`XXX` markers in the whole codebase — which is nice, but it also means nothing is written down for the next person; the knowledge lives only in long-form comments (several of which are excellent, e.g. `scripts/check-schema.ts`, `lib/schemas.ts`, `netlify.toml`).

---

## 4. Doubts / judgement calls worth an owner decision

| # | Question | Why it matters |
| --- | --- | --- |
| 1 | **Is the manual Telegram payment flow intentional for v1?** | Razorpay env vars exist but no checkout/webhook route does. Manual verification is honest and fraud-resistant, but it caps conversion and makes "Verified Revenue" a manual bookkeeping number. |
| 2 | **Should free users see the tailored-resume tab at all?** | Today they see a Pro gate inside it. Fine as a funnel, but it is a click-through that can never convert in-app. |
| 3 | **`semantic proximity` is labelled ESTIMATED — is that enough?** | The blend is 45 % vocabulary overlap. The label is honest; some users will still read 100 % as "perfect fit". Consider renaming to "vocabulary overlap" in the UI. |
| 4 | **Sample resumes are fictional but the scanner treats them as real candidates** | Good for demos; make sure "Sample loaded: software engineer" stays obvious in production so nobody mistakes a demo score for their own. |
| 5 | **The `star_bullet` task binding exists in the registry, but the STAR rewriter in the UI is guidance text** | Verify whether the binding is used at runtime; if not, either wire it or remove it from the admin list to avoid a dead control. |
| 6 | **Guest sessions mint 30-day cookies on every anonymous visit** | Harmless, but the `api_rate_limits` table will accumulate HMAC-hashed IP rows; confirm a retention/cleanup story. |
| 7 | **`test:server` / `npm test` were not executed in the original audit** | Resolved in the final pass: both suites and `npm run test:all` pass. |
| 8 | **`SUPABASE_MIGRATIONS_COPY.txt` at the repo root** | Duplicates `supabase/migrations/`. Is it a scratch copy for the SQL editor? If so, prefer `npm run db:check` output (it prints exactly what is missing) over a static copy that will drift. |

---

## 5. Deployment readiness

| Gate | Status |
| --- | --- |
| `npm run lint` | ✅ |
| `npm run test:unit` | ✅ 242/242 |
| `npm run db:check` | ✅ schema up to date |
| `npm run build` | ✅ passed |
| `node --import tsx scripts/check-deployment.ts` | ✅ configured environment passed; this is not a production-key validation |
| Netlify production dashboard | ⚠️ cannot be updated from here (no Netlify token/CLI login) |

Production checklist (from `locals.md`, still accurate for the *env* part):

- [ ] Live Clerk keys (not the test keys sitting in the local `keys` scratch file)
- [ ] `APP_URL` and `CLERK_AUTHORIZED_PARTIES` matching the real origin
- [ ] Stable 32-char `SESSION_SECRET` and `STORAGE_ENCRYPTION_KEY` (changing the storage key makes every existing encrypted resume unreadable)
- [ ] `NODE_ENV=production`, all Supabase vars set **without** a `VITE_` prefix on the secret key
- [x] `npm run build` and the configured deployment preflight pass; repeat with production-mode/live keys before release
- [ ] Delete `data/db.json` from git history if the repo will ever be shared (§3.1)

---

## 6. Suggested next actions

1. **Get owner approval for the data remediation** in `docs/SECURITY_REMEDIATION.md`; do not rewrite Git history in an application change.
2. Remove or archive the unused Prisma/Firebase artifacts in a separately reviewed cleanup change if they are not needed for local tooling.
3. Run `npm run check:deploy` with production-like environment variables before release; the local configured environment is not a substitute for live-key validation.
4. Decide on the **payment provider** question (§4.1) before any marketing push.

---

## 7. How this audit was produced (reproducible)

```bash
npm run dev                 # server on :3000 (Express + Vite middleware)
npm run lint                # tsc --noEmit
npm run test:unit           # 242 deterministic checks
npm run db:check            # read-only live schema diff
# UI capture: Playwright + Firefox, 1440x900 and 390x844,
# session cookie minted for the local dev secret, real POST /api/check executed.
```

The one side effect worth knowing: the scan performed for the screenshots wrote **one additional `job_scans` row** for the owner account in the live Supabase project (and incremented nothing, since Pro is unlimited). Delete it from the admin console or the SQL editor if you want the dataset exactly as it was.

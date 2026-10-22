# Landing page and auth polish

- [x] Remove the fifth landing-page section (the STAR bullet diff explorer).
- [x] Use the authenticated Clerk profile image and name in the user menu.
- [x] Refine the Clerk sign-in dialog and remove its branding footer.
- [x] Send successful sign-ins and sign-ups to the dashboard; Clerk hash routing handles OAuth callbacks.
- [x] Keep Clerk session exchange connected to the application backend.
- [x] Replace the gradient emphasis on “next opportunity” and “Interview Readiness” with solid brand blue.
- [x] Improve the footer with clear section links and a glass contact card.
- [x] Preserve the existing glass surfaces and Lenis smooth scrolling with reduced-motion support.
- [x] Keep the existing ambient background; it already has gradient blooms, a blueprint grid, and a reduced-motion-aware pointer light.
- [x] Keep a clear primary landing-page action and simplify the content path by removing the requested section.
- [x] Add Lenis smooth scrolling with reduced-motion support and a lower-motion mode.
- [x] Replace profile portraits with responsive, brand-colored resume, match-score, and keyword-gap illustrations.
- [x] Restore the dashboard directly when a returning user has a valid backend session.
- [x] Retry Clerk-to-backend session exchange and prevent auth responses from being cached.
- [x] Add a shared database-backed IP burst limiter for serverless instances.
- [x] Track admin-confirmed payment receipts separately from Pro access and activate Pro only when verified totals reach the price.

## Deployment note

The TypeScript check passes. Vite creates the production client bundle, but the full
build loads local environment settings when generating security headers. The
production deploy also needs the stable 32-character `SESSION_SECRET`,
`STORAGE_ENCRYPTION_KEY`, live Clerk keys, matching `APP_URL` and
`CLERK_AUTHORIZED_PARTIES`. The three migrations once listed as pending
(`202610030001_application_status_saved.sql`, `202610070001_shared_ip_rate_limits.sql`,
and `202610070002_manual_payment_ledger.sql`) are **already applied to the live
project** — `npm run db:check` is the source of truth and reports
"Schema is up to date" (re-run it before every deploy rather than trusting a
static checklist). The local `keys` file currently
contains Clerk test keys; production must use live keys from Clerk. Netlify's
production values must be updated separately in its dashboard because no
Netlify access token or CLI login is available here.

Disposable live probes confirmed Supabase database insert/update/select/delete
and private Storage upload/download/delete work. The disposable rows and objects
were removed after verification.

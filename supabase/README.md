# Supabase Setup

## Configure

Set these server-side values in `.env` (the existing `SUPABASE_STORAGE_URL` is accepted as a URL alias):

```dotenv
SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SECRET_KEY"
SUPABASE_STORAGE_BUCKET="resumes-private"
```

Use the Supabase **Secret key** (`sb_secret_...`) from Project Settings -> API Keys. Do not use the publishable key (`sb_publishable_...`) in this setting. This server credential can administer Storage and bypasses Row Level Security; keep it only on the Express server and never prefix it with `VITE_`.

## Apply Schema And Storage Bucket

The project schema is provisioned by [`migrations/202610020001_initial_schema.sql`](migrations/202610020001_initial_schema.sql), with runtime quota and analytics RPCs in [`migrations/202610020002_runtime_functions.sql`](migrations/202610020002_runtime_functions.sql). Both have been applied to the configured project. They create the application tables, enums, indexes, ownership foreign keys, update triggers, RLS, private resume bucket, and atomic database operations.

Uploads are AES-256-GCM encrypted by the server before being sent to Supabase Storage. The bucket contains ciphertext only. Keep the same `STORAGE_ENCRYPTION_KEY` across deployments; changing it makes previously uploaded documents unreadable.

## Migrations — Current Status

All migrations shipped in [`migrations/`](migrations/) are **already applied** to
the configured live project. `npm run db:check` is the source of truth: it is
read-only, safe to run at any time, and prints the exact SQL for anything
outstanding (it currently reports "Schema is up to date", including the
`SAVED` enum value and the runtime RPCs).

The files most often mistaken for still-pending:

- [`202610070001_shared_ip_rate_limits.sql`](migrations/202610070001_shared_ip_rate_limits.sql)
  stores HMAC-hashed IP counters and applies atomic burst limits across
  serverless instances. **Applied.**
- [`202610070002_manual_payment_ledger.sql`](migrations/202610070002_manual_payment_ledger.sql)
  records admin-verified receipts and activates Pro after confirmed receipts
  reach the configured price. **Applied.**

Do not block a deploy on a stale checklist — run `npm run db:check`
(included in `check:deploy`) and let it decide. No SQL values contain user secrets.

One trap worth knowing if you extend it: **do not probe table existence with
`head: true`.** In the pinned `@supabase/supabase-js`, a HEAD request against a
table that does not exist still resolves with `error: null`, so the check
reports "ok" for every table including missing ones — which is precisely the
failure the script exists to catch. Use `select('*').limit(1)`, which correctly
returns `PGRST205`.

This was not hypothetical: `npm run check:deploy` had exactly this bug and was
passing with a nonexistent table. It is now fixed in both scripts, and
`scripts/test-unit.ts` fails the build if `head: true` reappears in either.

ResumeSetu **cannot apply migrations itself**. The `sb_secret_…` key is a
PostgREST credential: it reads and writes rows but cannot execute DDL.
`supabase db push` needs a database password, and the Supabase Management API
needs a personal access token. Neither is present in this environment.

To apply a pending migration, paste the SQL that `db:check` prints into
**Supabase Dashboard -> SQL Editor -> Run**, then re-run `npm run db:check`.

### `202610030001_application_status_saved.sql` (applied)

Adds the `SAVED` stage to `public.application_status` so the tracker can
represent a saved-but-not-yet-applied role.

```sql
alter type public.application_status add value if not exists 'SAVED';
```

Two details in that file are deliberate and are asserted by
`npm run test:unit`, so please do not "tidy" them:

* **No `BEGIN`/`COMMIT`.** `ALTER TYPE … ADD VALUE` is rejected inside a
  transaction block on some PostgreSQL versions.
* **No `exception when others then null`.** The original version swallowed every
  error, so the migration reported success while changing nothing — the enum
  stayed missing and the tracker broke with an opaque
  `invalid input value for enum` error.

While it was missing, tracker writes failed with a message pointing at
`npm run db:check` rather than a raw database error. The migration is applied
now; `db:check` still guards against it being reverted.

## Import Existing JSON Data

1. Back up `data/db.json` and your `uploads/` directory.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`/deployment secrets.
3. Run `npm run migrate:supabase` to upsert users, resumes, scans, applications, model config, task bindings, settings, and security logs. A different input file can be supplied with `npm run migrate:supabase -- path/to/db.json`.

The import is repeatable by primary key and does not delete or modify the JSON source. It checks foreign-key owner references before writing and stops with examples if the source contains orphaned records. Resume object bytes are not copied by this command; existing `local_encrypted` resumes remain marked as local and require their original `uploads/` files. New uploads use Supabase Storage.

Before a deployment, run `npm run db:check` followed by `npm run build` and then `npm run check:deploy`. The preflight validates production secrets, the Clerk origin, the private bucket, all expected tables, and the quota/analytics RPCs. In production, use Clerk live keys and set `NODE_ENV=production`.

## Runtime Database

Express routes, the rate limiter, and the background tailoring queue now use the server-only Supabase Postgres adapter in `lib/supabase-db.ts`. The imported JSON file remains a local backup/migration source and is not used for runtime CRUD. Resume content is encrypted server-side and stored in the private Supabase bucket; keep `STORAGE_ENCRYPTION_KEY` stable across deployments. Never expose `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_SECRET_KEY` to browser code.

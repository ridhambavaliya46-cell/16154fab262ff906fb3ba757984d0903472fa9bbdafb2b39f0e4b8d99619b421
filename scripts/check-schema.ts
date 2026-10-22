/**
 * Reports whether the live Supabase schema matches what the app requires, and
 * prints the exact SQL to run when it does not.
 *
 * Why this exists
 * ---------------
 * The application uses the service-role key, which is a *PostgREST* credential:
 * it can read and write rows but it cannot execute DDL. `supabase db push` needs
 * a database password, and the Supabase Management API needs a personal access
 * token. With neither, schema changes cannot be applied automatically — so a
 * pending migration used to surface only as a raw PostgREST error deep inside an
 * API call, long after the user hit a broken button.
 *
 * This turns that into a 5-second preflight: run `npm run db:check`, and if
 * something is missing you get the precise statement to paste into the Supabase
 * SQL Editor.
 *
 * Safe to run at any time: read-only.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS: Array<{
  file: string;
  summary: string;
  sql: string;
  /** Tables this migration creates, for matching a probe failure to a fix. */
  creates?: string[];
}> = [
  {
    file: '202610030001_application_status_saved.sql',
    summary: "add the 'SAVED' application stage",
    sql: "alter type public.application_status add value if not exists 'SAVED';",
  },
  {
    file: '202610070001_shared_ip_rate_limits.sql',
    summary: 'add atomic shared IP burst limits for serverless instances',
    creates: ['api_rate_limits'],
    sql: fs.readFileSync(path.resolve('supabase/migrations/202610070001_shared_ip_rate_limits.sql'), 'utf8'),
  },
  {
    file: '202610070002_manual_payment_ledger.sql',
    summary: 'add verified manual-payment accounting and atomic Pro activation',
    creates: ['manual_payment_records'],
    sql: fs.readFileSync(path.resolve('supabase/migrations/202610070002_manual_payment_ledger.sql'), 'utf8'),
  },
];

const REQUIRED_TABLES = [
  'users',
  'resumes',
  'job_scans',
  'applications',
  'llm_configs',
  'task_bindings',
  'system_settings',
  'security_logs',
  'api_rate_limits',
  'manual_payment_records',
];

/**
 * Authentication is Clerk-only, so the database holds no password hashes and
 * there are no credential tables to verify here.
 */
const OPTIONAL_TABLES = new Set<string>();

function heading(text: string): void {
  console.log(`\n${text}\n${'-'.repeat(text.length)}`);
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.SUPABASE_STORAGE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run this check.');
    process.exit(2);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let failures = 0;
  const pending: typeof MIGRATIONS = [];

  heading('Tables');
  const missingTables: string[] = [];
  for (const table of REQUIRED_TABLES) {
    /*
     * NOTE: `head: true` is deliberately NOT used. This version of
     * supabase-js returns `error: null` for a HEAD request against a table that
     * does not exist, so the earlier probe cheerfully reported "ok" for a
     * missing table — which is precisely the failure this script exists to
     * catch. A plain `select('*').limit(1)` correctly returns PGRST205.
     */
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      const optional = OPTIONAL_TABLES.has(table);
      if (optional) {
        // Not a hard failure: the app still works, password sign-in is simply
        // unavailable and says so.
        console.log(`  ABSENT   ${table}  (optional — password sign-in disabled)`);
        missingTables.push(table);
      } else {
        failures += 1;
        console.log(`  MISSING  ${table}  (${error.message})`);
      }
    } else {
      console.log(`  ok       ${table}`);
    }
  }
  for (const table of missingTables) {
    const migration = MIGRATIONS.find((m) => m.creates?.includes(table));
    if (migration && !pending.includes(migration)) pending.push(migration);
  }

  heading('Enums');
  /*
   * There is no PostgREST endpoint for enum metadata, so membership is probed
   * with a real filter. A missing value returns 400 `22P02` (invalid input value
   * for enum); an existing value returns 200. The probe selects nothing, so it
   * cannot mutate data.
   */
  const enumProbes: Array<{ enum: string; column: string; table: string; value: string }> = [
    { enum: 'application_status', column: 'status', table: 'applications', value: 'SAVED' },
  ];

  for (const probe of enumProbes) {
    const { error } = await supabase
      .from(probe.table)
      .select(probe.column)
      .eq(probe.column, probe.value as never)
      .limit(1);

    const missing =
      Boolean(error) &&
      /invalid input value for enum|22P02/i.test(`${error?.code ?? ''} ${error?.message ?? ''}`);

    if (missing) {
      const migration = MIGRATIONS.find((m) => m.file.includes('application_status'));
      if (migration) pending.push(migration);
      failures += 1;
      console.log(`  MISSING  ${probe.enum}.${probe.value}`);
    } else if (error) {
      failures += 1;
      console.log(`  ERROR    ${probe.enum}.${probe.value} — ${error.message}`);
    } else {
      console.log(`  ok       ${probe.enum}.${probe.value}`);
    }
  }

  heading('RPCs');
  const rpcProbes: Array<{ name: string; args: Record<string, unknown> }> = [
    { name: 'consume_scan_quota', args: { p_user_id: `schema_probe_${Date.now()}` } },
    {
      name: 'record_session_ping',
      args: { p_user_id: `schema_probe_${Date.now()}`, p_seconds: 0 },
    },
    { name: 'consume_ip_burst_limit', args: { p_key_hash: 'invalid', p_max_requests: 1, p_window_seconds: 60 } },
    { name: 'record_manual_payment', args: { p_id: 'probe', p_user_id: 'probe', p_amount_inr: 0, p_payment_method: 'invalid', p_transaction_reference: '', p_payment_request_reference: '', p_required_amount_inr: 1, p_note: '', p_recorded_by: 'probe' } },
  ];
  for (const rpc of rpcProbes) {
    const { error } = await supabase.rpc(rpc.name, rpc.args);
    if (rpc.name === 'consume_ip_burst_limit' && error?.code === 'P0001') {
      console.log(`  ok       ${rpc.name}()`);
    } else if (rpc.name === 'record_manual_payment' && error?.code === 'P0001') {
      console.log(`  ok       ${rpc.name}()`);
    } else if (error) {
      failures += 1;
      console.log(`  MISSING  ${rpc.name}()  (${error.message})`);
      const migration = MIGRATIONS.find((item) =>
        rpc.name === 'consume_ip_burst_limit'
          ? item.file === '202610070001_shared_ip_rate_limits.sql'
          : item.file === '202610070002_manual_payment_ledger.sql'
      );
      if (migration && !pending.includes(migration)) pending.push(migration);
    } else {
      console.log(`  ok       ${rpc.name}()`);
    }
  }

  if (pending.length > 0) {
    heading('Action required');
    console.log(
      'The following migrations have NOT been applied. ResumeSetu cannot apply them\n' +
        'itself: the service-role key is a PostgREST credential and cannot run DDL.\n'
    );
    console.log('  Supabase Dashboard -> SQL Editor -> paste -> Run\n');
    for (const migration of pending) {
      console.log(`  -- ${migration.file}  (${migration.summary})`);
      console.log(`${migration.sql}\n`);
    }
    console.log('  Each block above is self-contained; run them in filename order.\n');
    console.log('  Then re-run: npm run db:check\n');
  }

  if (failures > 0) {
    console.error(`${failures} schema check(s) failed.`);
    process.exit(1);
  }
  console.log('\nSchema is up to date.');
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});

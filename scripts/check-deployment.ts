import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const failures: string[] = [];
const warnings: string[] = [];
const isProductionDeploy = process.env.NODE_ENV === 'production' || process.env.CONTEXT === 'production';
const requireValue = (name: string, minimumLength = 1): string | null => {
  const value = process.env[name]?.trim();
  if (!value || value.length < minimumLength) {
    failures.push(`${name} must be set${minimumLength > 1 ? ` to at least ${minimumLength} characters` : ''}.`);
    return null;
  }
  return value;
};
const describeSupabaseError = (error: { code?: string; status?: number; message?: string } | null | undefined): string => {
  if (!error) return 'request failed';
  const parts = [error.code, error.status ? `HTTP ${error.status}` : '', error.message].filter(Boolean);
  return parts.join(': ') || 'request failed';
};

if (!isProductionDeploy) {
  warnings.push('NODE_ENV is not production; deployment checks still run against the configured project.');
}

const clerkSecret = requireValue('CLERK_SECRET_KEY');
const clerkPublishable = requireValue('VITE_CLERK_PUBLISHABLE_KEY');
// requireValue validates presence/length and records a failure if unusable.
requireValue('SESSION_SECRET', 32);
requireValue('STORAGE_ENCRYPTION_KEY', 32);
const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.SUPABASE_STORAGE_URL?.trim() || null;
const supabaseSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  || process.env.SUPABASE_SECRET_KEY?.trim()
  || null;
if (!supabaseSecret) failures.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY must be set.');
const bucketName = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'resumes-private';
const appUrl = process.env.APP_URL?.trim();

if (!supabaseUrl) failures.push('SUPABASE_URL or SUPABASE_STORAGE_URL must be set.');
if (supabaseSecret && supabaseSecret.startsWith('sb_publishable_')) {
  failures.push('SUPABASE_SERVICE_ROLE_KEY contains a publishable key; use a Supabase Secret key (sb_secret_...) or legacy service-role JWT.');
}
if (clerkSecret && !clerkSecret.startsWith('sk_')) {
  failures.push('CLERK_SECRET_KEY does not look like a Clerk secret key.');
}
if (clerkPublishable && !clerkPublishable.startsWith('pk_')) {
  failures.push('VITE_CLERK_PUBLISHABLE_KEY does not look like a Clerk publishable key.');
}
if (isProductionDeploy && clerkSecret && !clerkSecret.startsWith('sk_live_')) {
  failures.push('Production requires a Clerk live secret key (sk_live_...).');
}
if (isProductionDeploy && clerkPublishable && !clerkPublishable.startsWith('pk_live_')) {
  failures.push('Production requires a Clerk live publishable key (pk_live_...).');
}

let appOrigin: string | null = null;
try {
  appOrigin = new URL(appUrl || '').origin;
} catch {
  failures.push('APP_URL must be an absolute deployment URL.');
}
if (isProductionDeploy && appOrigin) {
  const parsedAppUrl = new URL(appOrigin);
  if (parsedAppUrl.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(parsedAppUrl.hostname)) {
    failures.push('Production APP_URL must use HTTPS and a public hostname.');
  }
}
const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (appOrigin && !authorizedParties.includes(appOrigin)) {
  failures.push(`CLERK_AUTHORIZED_PARTIES must include the exact APP_URL origin "${appOrigin}" (no trailing slash).`);
}

if (!fs.existsSync(path.resolve(process.cwd(), 'dist', 'index.html'))) {
  failures.push('Production client build is missing; run npm run build.');
}

for (const runtimeFile of ['server.ts', 'lib/rate-limiter.ts', 'lib/shared-rate-limiter.ts', 'lib/queue.ts']) {
  const source = fs.readFileSync(path.resolve(process.cwd(), runtimeFile), 'utf8');
  if (!source.includes('supabaseDb as db')) {
    failures.push(`${runtimeFile} is not wired to the Supabase runtime repository.`);
  }
}

if (supabaseUrl && supabaseSecret) {
  const supabase = createClient(supabaseUrl, supabaseSecret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const bucket = await supabase.storage.getBucket(bucketName);
  if (bucket.error || !bucket.data || bucket.data.public) {
    failures.push(`Supabase bucket "${bucketName}" must exist, be private, and be accessible to the server key${bucket.error ? ` (${describeSupabaseError(bucket.error)})` : ''}.`);
  }

  const tableNames = [
    'users', 'resumes', 'job_scans', 'applications', 'llm_configs',
    'task_bindings', 'system_settings', 'security_logs', 'api_rate_limits', 'manual_payment_records',
  ];
  // NOTE: probe with a real SELECT, never `head: true`.
  //
  // With `head: true` this client reports `error: null` for a table that does
  // not exist (verified against this project: a bogus table yields
  // head:error=null but rows:error=PGRST205). The deploy gate therefore passed
  // while `users` or `security_logs` could have been missing — the one class of
  // failure it exists to catch. `.limit(1)` returns PGRST205 correctly.
  // Keep these probes sequential. Ten simultaneous PostgREST requests can
  // trip a platform or network burst limit and turn a healthy project into a
  // misleading wall of "fetch failed" errors.
  for (const table of tableNames) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      const migration = table === 'api_rate_limits'
        ? '202610070001_shared_ip_rate_limits.sql'
        : table === 'manual_payment_records'
          ? '202610070002_manual_payment_ledger.sql'
          : null;
      failures.push(
        `Supabase table public.${table} is unavailable (${describeSupabaseError(error)}).` +
        (migration ? ` Apply supabase/migrations/${migration} in the Supabase SQL Editor.` : '')
      );
    }
  }
  const probeId = `deployment_probe_${Date.now()}`;
  const quotaFunction = await supabase.rpc('consume_scan_quota', { p_user_id: probeId });
  if (quotaFunction.error) failures.push(`Supabase quota function is unavailable (${describeSupabaseError(quotaFunction.error)}).`);
  const pingFunction = await supabase.rpc('record_session_ping', { p_user_id: probeId, p_seconds: 0 });
  if (pingFunction.error) failures.push(`Supabase session analytics function is unavailable (${describeSupabaseError(pingFunction.error)}).`);
  const burstFunction = await supabase.rpc('consume_ip_burst_limit', {
    p_key_hash: 'invalid', p_max_requests: 1, p_window_seconds: 60,
  });
  if (burstFunction.error?.code !== 'P0001') {
    failures.push(
      `Supabase shared rate-limit function is unavailable (${describeSupabaseError(burstFunction.error)}). ` +
      'Apply supabase/migrations/202610070001_shared_ip_rate_limits.sql in the Supabase SQL Editor.'
    );
  }
  const paymentFunction = await supabase.rpc('record_manual_payment', {
    p_id: 'deployment_probe', p_user_id: 'deployment_probe', p_amount_inr: 0,
    p_payment_method: 'invalid', p_transaction_reference: '', p_payment_request_reference: '',
    p_required_amount_inr: 1, p_note: '', p_recorded_by: 'deployment_probe',
  });
  if (!paymentFunction.error || !['P0001', '23514'].includes(paymentFunction.error.code || '')) {
    failures.push(
      `Supabase manual payment ledger function is unavailable (${describeSupabaseError(paymentFunction.error)}). ` +
      'Apply supabase/migrations/202610070002_manual_payment_ledger.sql in the Supabase SQL Editor.'
    );
  }

  /*
   * Every AI task must have at least one model whose provider key is actually
   * present.
   *
   * getModelPipeline silently skips providers with no key and runModel falls
   * back to deterministic/local output, so an unreachable binding never throws.
   * That is the right behaviour for a user mid-request, but it means a fully
   * dead binding is invisible: cover_letter was bound to Gemini with an OpenAI
   * fallback while only GROQ_API_KEY was set, so every cover letter quietly came
   * back as the "no AI provider was configured" outline with no error anywhere.
   * Surfacing it here makes it a deploy warning instead of a silent downgrade.
   */
  const providerKeyEnv: Record<string, string> = {
    groq: 'GROQ_API_KEY',
    gemini: 'GEMINI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
  };
  const [{ data: llmRows }, { data: bindingRows }] = await Promise.all([
    supabase.from('llm_configs').select('id,provider,enabled'),
    supabase.from('task_bindings').select('task,primary_model_id,fallback_model_id'),
  ]);
  if (llmRows && bindingRows) {
    const byId = new Map(llmRows.map((row) => [row.id, row]));
    for (const binding of bindingRows) {
      const reachable = [binding.primary_model_id, binding.fallback_model_id].some((id) => {
        const model = byId.get(id);
        if (!model || !model.enabled) return false;
        const envName = providerKeyEnv[model.provider];
        return Boolean(envName && process.env[envName]);
      });
      if (!reachable) {
        failures.push(
          `AI task "${binding.task}" has no reachable model: neither its primary nor its fallback has a configured API key. ` +
          `Its output will silently degrade to local placeholder text. Add the provider key or rebind the task.`
        );
      }
    }
  }
} else {
  failures.push('Supabase Storage/Postgres connectivity could not be checked without URL and server Secret key.');
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (failures.length) {
  console.error('Deployment readiness: BLOCKED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Deployment readiness: all configured checks passed.');
